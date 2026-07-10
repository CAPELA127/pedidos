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

interface Match {
  remissionId: string | null; // null = pedido sin empacar aún (sin remisión)
  orderId: string;
  customerName: string;
  phone: string;
  total: number;
  createdAt: string;
  items: { ref: string; name: string; quantity: number; price: number; unit_type: string }[];
}

const toMatch = (r: RemissionRow): Match => ({
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
    } else if (/^ORD-?\d+$/.test(upper)) {
      orderId = upper;
    }

    let orderIdsFilter: string[] | null = null;
    if (!remissionId && !orderId) {
      // Puede ser # de pedido (solo dígitos), cédula/NIT (admite guiones),
      // teléfono o nombre/alias del cliente. Clientes → pedidos → remisiones.
      const candidateOrderIds = new Set<string>();
      if (/^\d+$/.test(qRaw)) {
        candidateOrderIds.add(`ORD-${qRaw}`);
        // Variantes del consecutivo: "5" → ORD-005, "1000" → ORD-01000
        const n = parseInt(qRaw, 10);
        candidateOrderIds.add(n <= 999 ? `ORD-${String(n).padStart(3, '0')}` : `ORD-0${n}`);
      }

      // sin comas/paréntesis para no romper la sintaxis del filtro or() de PostgREST
      const safe = qRaw.replace(/[,()]/g, ' ').trim();
      const customerFilter = ['name', 'alias', 'cc_nit', 'phone', 'telefono_2']
        .map(f => `${f}.ilike.%${safe}%`)
        .join(',');
      const { data: custMatches, error: custErr } = await supabase
        .from('customers')
        .select('id')
        .or(customerFilter)
        .limit(20);
      if (custErr) throw custErr;

      const customerIds = (custMatches || []).map(c => c.id);
      if (customerIds.length > 0) {
        const { data: orderMatches, error: orderErr } = await supabase
          .from('orders')
          .select('id')
          .in('customer_id', customerIds);
        if (orderErr) throw orderErr;
        for (const o of orderMatches || []) candidateOrderIds.add(o.id);
      }

      orderIdsFilter = [...candidateOrderIds];
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

    const matches: Match[] = ((data || []) as unknown as RemissionRow[]).map(toMatch);

    // Sin restricciones: si el pedido existe pero bodega aún no lo ha empacado
    // (no tiene remisión), igual se ofrece como resultado. El vendedor lo puede
    // tomar tal cual — al elegirlo, el cliente llama a /api/remissions/from-order
    // que genera la remisión desde los items del pedido.
    if (!remissionId) {
      const coveredOrderIds = new Set(matches.map(m => m.orderId));
      const pendingIds = (orderId ? [orderId] : orderIdsFilter || []).filter(id => !coveredOrderIds.has(id));
      if (pendingIds.length > 0) {
        const { data: rawOrders, error: ordersErr } = await supabase
          .from('orders')
          .select('id, created_at, customers (name, phone), order_items (product_ref, product_name, quantity, price_at_time, unit_type)')
          .in('id', pendingIds);
        if (ordersErr) throw ordersErr;

        type OrderOnlyRow = {
          id: string;
          created_at: string;
          customers: { name: string | null; phone: string | null } | null;
          order_items: { product_ref: string; product_name: string; quantity: number; price_at_time: number; unit_type: string | null }[] | null;
        };
        for (const o of (rawOrders || []) as unknown as OrderOnlyRow[]) {
          const items = o.order_items || [];
          if (items.length === 0) continue;
          matches.push({
            remissionId: null,
            orderId: o.id,
            customerName: o.customers?.name || 'Sin nombre',
            phone: o.customers?.phone || '',
            total: items.reduce((s, i) => s + (i.price_at_time || 0) * (i.quantity || 0), 0),
            createdAt: o.created_at,
            items: items.map(i => ({
              ref: i.product_ref,
              name: i.product_name,
              quantity: i.quantity,
              price: i.price_at_time,
              unit_type: i.unit_type || 'unidad',
            })),
          });
        }
      }
    }

    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error('GET /api/remissions/search error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error buscando remisiones' },
      { status: 500 }
    );
  }
}
