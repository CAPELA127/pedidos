import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface OrderItemRow {
  product_ref: string;
  product_name: string;
  quantity: number;
  price_at_time: number;
  unit_type: string | null;
}

// POST: el vendedor toma un PEDIDO que bodega aún no ha empacado y lo
// liquida directamente desde el chat. Se genera la remisión a partir de
// los items del pedido (empacado = pedido) para que todo el flujo posterior
// (editar, liquidar, PDF, revisión de secretaría) funcione sin esperar a
// nadie. NO se marca el pedido como Empacado: bodega lo sigue viendo
// pendiente, y si después lo empaca de verdad su confirmación reutiliza
// esta misma remisión y pisa estos datos (comportamiento ya existente).
export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Se requiere el id del pedido' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Si el pedido ya tiene remisión, se devuelve esa (no duplicar)
    const { data: existing, error: existingErr } = await supabase
      .from('remissions')
      .select(`
        id, order_id, total, created_at,
        remission_items (product_ref, product_name, packed_quantity, price_at_time, unit_type),
        orders!inner (id, customers (name, phone))
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;

    if (existing) {
      const orders = existing.orders as unknown as { customers: { name: string | null; phone: string | null } | null } | null;
      return NextResponse.json({
        success: true,
        match: {
          remissionId: existing.id,
          orderId: existing.order_id,
          customerName: orders?.customers?.name || 'Sin nombre',
          phone: orders?.customers?.phone || '',
          total: existing.total,
          createdAt: existing.created_at,
          items: ((existing.remission_items || []) as { product_ref: string; product_name: string; packed_quantity: number; price_at_time: number; unit_type: string | null }[]).map(i => ({
            ref: i.product_ref,
            name: i.product_name,
            quantity: i.packed_quantity,
            price: i.price_at_time,
            unit_type: i.unit_type || 'unidad',
          })),
        },
      });
    }

    // Cargar el pedido con sus items y cliente
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customers (name, phone), order_items (product_ref, product_name, quantity, price_at_time, unit_type)')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) {
      return NextResponse.json(
        { success: false, message: `No existe el pedido ${orderId}` },
        { status: 404 }
      );
    }

    const items = (order.order_items || []) as OrderItemRow[];
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: `El pedido ${orderId} no tiene productos` },
        { status: 400 }
      );
    }

    const total = items.reduce((s, i) => s + (i.price_at_time || 0) * (i.quantity || 0), 0);

    // Crear la remisión con reintentos por colisión del número aleatorio
    let remissionId = '';
    let created = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      remissionId = `REM-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error: remErr } = await supabase.from('remissions').insert([{
        id: remissionId,
        order_id: orderId,
        total,
        notes: 'Generada por el vendedor desde el chat (sin empaque de bodega)',
      }]);
      if (!remErr) { created = true; break; }
      if (remErr.code !== '23505') throw remErr;
    }
    if (!created) throw new Error('No se pudo asignar número de remisión, intenta de nuevo');

    const { error: itemsErr } = await supabase.from('remission_items').insert(
      items.map(i => ({
        remission_id: remissionId,
        product_ref: i.product_ref,
        product_name: i.product_name,
        ordered_quantity: i.quantity || 0,
        packed_quantity: i.quantity || 0,
        price_at_time: i.price_at_time || 0,
        unit_type: i.unit_type || 'unidad',
        item_status: 'completo',
      }))
    );
    if (itemsErr) throw itemsErr;

    const customers = order.customers as unknown as { name: string | null; phone: string | null } | null;
    return NextResponse.json({
      success: true,
      match: {
        remissionId,
        orderId,
        customerName: customers?.name || 'Sin nombre',
        phone: customers?.phone || '',
        total,
        createdAt: new Date().toISOString(),
        items: items.map(i => ({
          ref: i.product_ref,
          name: i.product_name,
          quantity: i.quantity,
          price: i.price_at_time,
          unit_type: i.unit_type || 'unidad',
        })),
      },
    });
  } catch (error) {
    console.error('POST /api/remissions/from-order error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error preparando el pedido' },
      { status: 500 }
    );
  }
}
