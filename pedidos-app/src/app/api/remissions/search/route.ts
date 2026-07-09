import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface RemissionItemRow {
  product_ref: string;
  product_name: string;
  packed_quantity: number;
  price_at_time: number;
  unit_type: string | null;
}

interface RemissionRow {
  id: string;
  order_id: string;
  total: number;
  created_at: string;
  remission_items: RemissionItemRow[] | null;
  orders: {
    id: string;
    customers: { name: string | null; phone: string | null } | null;
  } | null;
}

const SELECT = `
  id,
  order_id,
  total,
  created_at,
  remission_items (product_ref, product_name, packed_quantity, price_at_time, unit_type),
  orders!inner (id, customers (name, phone))
`;

const toMatch = (r: RemissionRow) => ({
  remissionId: r.id,
  orderId: r.order_id,
  customerName: r.orders?.customers?.name || 'Sin nombre',
  phone: r.orders?.customers?.phone || '',
  total: r.total,
  createdAt: r.created_at,
  items: (r.remission_items || []).map(i => ({
    ref: i.product_ref,
    name: i.product_name,
    quantity: i.packed_quantity,
    price: i.price_at_time,
    unit_type: i.unit_type || 'unidad',
  })),
});

// GET: el vendedor busca en el chat una remisión de su pedido,
// por # de pedido, # de remisión o nombre de cliente.
export async function GET(request: NextRequest) {
  try {
    const qRaw = request.nextUrl.searchParams.get('q')?.trim();
    if (!qRaw) {
      return NextResponse.json(
        { success: false, message: 'Escribe un pedido, una remisión o un nombre de cliente' },
        { status: 400 }
      );
    }
    const upper = qRaw.toUpperCase();
    const supabase = getSupabase();

    let remissionId: string | null = null;
    let orderId: string | null = null;

    if (/^REM-?\d+$/.test(upper)) {
      remissionId = upper.startsWith('REM-') ? upper : `REM-${upper}`;
    } else if (/^ORD-?\d+$/.test(upper) || /^\d+$/.test(upper)) {
      orderId = upper.startsWith('ORD-') ? upper : `ORD-${upper}`;
    }

    let orderIdsFilter: string[] | null = null;
    if (!remissionId && !orderId) {
      // Búsqueda por nombre de cliente: primero los clientes, luego sus pedidos
      const { data: custMatches, error: custErr } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', `%${qRaw}%`)
        .limit(20);
      if (custErr) throw custErr;

      const customerIds = (custMatches || []).map(c => c.id);
      if (customerIds.length === 0) {
        return NextResponse.json({ success: true, matches: [] });
      }

      const { data: orderMatches, error: orderErr } = await supabase
        .from('orders')
        .select('id')
        .in('customer_id', customerIds);
      if (orderErr) throw orderErr;

      orderIdsFilter = (orderMatches || []).map(o => o.id);
      if (orderIdsFilter.length === 0) {
        return NextResponse.json({ success: true, matches: [] });
      }
    }

    // El vendedor puede encontrar y volver a liquidar cualquier remisión de su
    // pedido en cualquier momento — no se exige revisión previa de secretaría
    // ni se excluyen las ya liquidadas (liquidar es repetible, mismo número).
    let query = supabase
      .from('remissions')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(10);

    if (remissionId) query = query.eq('id', remissionId);
    else if (orderId) query = query.eq('order_id', orderId);
    else if (orderIdsFilter) query = query.in('order_id', orderIdsFilter);

    const { data, error } = await query;
    if (error) throw error;

    const matches = ((data || []) as unknown as RemissionRow[]).map(toMatch);
    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error('GET /api/remissions/search error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error buscando remisiones' },
      { status: 500 }
    );
  }
}
