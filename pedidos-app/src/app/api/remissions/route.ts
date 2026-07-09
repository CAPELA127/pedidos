import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface RemissionItemRow {
  id: string;
  product_ref: string;
  product_name: string;
  ordered_quantity: number;
  packed_quantity: number;
  price_at_time: number;
  unit_type: string | null;
  item_status: string;
}

interface RemissionRow {
  id: string;
  order_id: string;
  total: number;
  packer_name: string | null;
  verifier_name: string | null;
  boxes_count: number | null;
  created_at: string;
  reviewed_at: string | null;
  remission_items: RemissionItemRow[] | null;
  orders: {
    id: string;
    vendor_name: string | null;
    delivery_address: string | null;
    customers: { name: string | null; city: string | null } | null;
  } | null;
}

// GET: lista de remisiones para los portales de vendedor y secretaría.
// ?vendor=Nombre filtra por el vendedor que creó el pedido.
export async function GET(request: NextRequest) {
  try {
    const vendor = request.nextUrl.searchParams.get('vendor')?.trim();

    let query = getSupabase()
      .from('remissions')
      .select(`
        id,
        order_id,
        total,
        packer_name,
        verifier_name,
        boxes_count,
        created_at,
        reviewed_at,
        remission_items (id, product_ref, product_name, ordered_quantity, packed_quantity, price_at_time, unit_type, item_status),
        orders!inner (id, vendor_name, delivery_address, customers (name, city))
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (vendor) {
      query = query.ilike('orders.vendor_name', vendor);
    }

    const { data, error } = await query;
    if (error) throw error;

    const remissions = ((data || []) as unknown as RemissionRow[]).map((r) => {
      const items = r.remission_items || [];
      return {
        id: r.id,
        order_id: r.order_id,
        total: r.total,
        packer_name: r.packer_name,
        verifier_name: r.verifier_name,
        boxes_count: r.boxes_count,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        vendor_name: r.orders?.vendor_name || '',
        customer: r.orders?.customers?.name || 'Sin nombre',
        city: r.orders?.customers?.city || '',
        delivery_address: r.orders?.delivery_address || '',
        total_units: items.reduce((s, i) => s + (i.packed_quantity || 0), 0),
        counts: {
          completo: items.filter(i => i.item_status === 'completo').length,
          modificado: items.filter(i => i.item_status === 'modificado').length,
          agotado: items.filter(i => i.item_status === 'agotado').length,
          agregado: items.filter(i => i.item_status === 'agregado').length,
        },
        items: items.map(i => ({
          id: i.id,
          ref: i.product_ref,
          name: i.product_name,
          ordered_quantity: i.ordered_quantity,
          packed_quantity: i.packed_quantity,
          price: i.price_at_time,
          unit_type: i.unit_type || 'unidad',
          status: i.item_status,
        })),
      };
    });

    return NextResponse.json({ success: true, remissions });
  } catch (error) {
    console.error('GET /api/remissions error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error obteniendo remisiones' },
      { status: 500 }
    );
  }
}
