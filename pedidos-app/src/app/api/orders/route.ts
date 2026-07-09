import { getSupabase } from '@/lib/supabase-server';
import { nextSequentialOrderId } from '@/lib/order-id';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  unit_type?: 'unidad' | 'docena' | 'box';
  notes?: string;
}

interface OrderPayload {
  id?: string;
  customer: string;
  email: string;
  customer_id?: string;
  items: OrderItem[];
  phone?: string;
  cc_nit?: string;
  local_name?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  vendor_name?: string;
  delivery_address?: string;
  notes?: string;
}

export async function GET() {
  try {
    // Obtener órdenes con clientes e items (sin JOIN a Products)
    const { data: orders, error } = await getSupabase()
      .from('orders')
      .select(`
        id,
        customer_id,
        status,
        total,
        vendor_name,
        delivery_address,
        notes,
        created_at,
        customers (id, name, email, phone, local_name, city, neighborhood, address),
        order_items (
          id,
          product_ref,
          product_name,
          quantity,
          unit_type,
          notes,
          price_at_time
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedOrders = (orders || []).map((o: any) => ({
      id: o.id,
      customer: o.customers?.name || 'Sin nombre',
      email: o.customers?.email || '',
      phone: o.customers?.phone || '',
      local_name: o.customers?.local_name || '',
      city: o.customers?.city || '',
      neighborhood: o.customers?.neighborhood || '',
      address: o.customers?.address || '',
      customer_id: o.customer_id,
      vendor_name: o.vendor_name || '',
      delivery_address: o.delivery_address || '',
      notes: o.notes || '',
      items: (o.order_items || []).map((oi: any) => ({
        ref: oi.product_ref,
        name: oi.product_name || oi.product_ref,
        quantity: oi.quantity,
        unit_type: oi.unit_type || 'unidad',
        notes: oi.notes || undefined,
        price: oi.price_at_time
      })),
      status: o.status,
      total: o.total,
      date: new Date(o.created_at).toLocaleDateString('es-CO'),
      total_items: (o.order_items || []).reduce((s: number, i: any) => s + i.quantity, 0)
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error obteniendo pedidos' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const payload: OrderPayload = await req.json();
    const { customer, email, customer_id: providedCustomerId, items, phone, cc_nit, local_name, city, neighborhood, address, vendor_name, delivery_address, notes } = payload;

    if (!customer || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Faltan campos: customer, items' },
        { status: 400 }
      );
    }

    // Idempotencia para sincronización offline: si el cliente manda un id y
    // ese pedido ya existe, es un reintento — responder éxito sin duplicar
    const payloadTotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    let clientOrderId = payload.id && /^ORD-[A-Z0-9-]+$/i.test(payload.id) ? payload.id : null;
    if (clientOrderId) {
      const { data: existingOrder } = await getSupabase()
        .from('orders')
        .select('id, customer_id, total')
        .eq('id', clientOrderId)
        .single();

      // Con numeración consecutiva dos vendedores pueden llegar con el mismo
      // número: solo es un reintento si el pedido existente calza (mismo total
      // y mismo cliente); si no, es una colisión y se crea con otro número.
      const isRetry = existingOrder
        && Math.abs((existingOrder.total || 0) - payloadTotal) < 0.01
        && (!providedCustomerId || existingOrder.customer_id === providedCustomerId);
      if (existingOrder && !isRetry) clientOrderId = null;

      if (existingOrder && isRetry) {
        // Reintento tras fallo parcial: si la orden quedó sin items, completarlos
        const { count } = await getSupabase()
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', existingOrder.id);

        if (!count) {
          const { error: repairErr } = await getSupabase().from('order_items').insert(
            items.map(item => ({
              order_id: existingOrder.id,
              product_ref: item.ref,
              product_name: item.name,
              quantity: item.quantity,
              unit_type: item.unit_type || 'unidad',
              notes: item.notes || null,
              price_at_time: item.price || 0
            }))
          );
          if (repairErr) throw repairErr;
        }

        return NextResponse.json({
          success: true,
          alreadyExists: true,
          order: {
            id: existingOrder.id, customer, email, customer_id: existingOrder.customer_id,
            items, status: 'Pendiente', total: existingOrder.total,
            date: new Date().toLocaleDateString('es-CO'),
            total_items: items.reduce((s, i) => s + i.quantity, 0)
          },
          message: `Pedido ${existingOrder.id} ya estaba guardado`
        });
      }
    }

    // Buscar o crear cliente
    let customerId = providedCustomerId;
    if (!customerId) {
      let existing = null;
      if (cc_nit) {
        const { data } = await getSupabase()
          .from('customers')
          .select('id')
          .eq('cc_nit', cc_nit)
          .single();
        existing = data;
      }
      if (!existing && email) {
        const { data } = await getSupabase()
          .from('customers')
          .select('id')
          .eq('email', email)
          .single();
        existing = data;
      }

      if (existing) {
        customerId = existing.id;
      } else {
        // Cliente capturado offline: viene embebido en el pedido con todos sus datos
        const { data: created, error: createErr } = await getSupabase()
          .from('customers')
          .insert([{
            name: customer,
            email: email || null,
            phone: phone || null,
            cc_nit: cc_nit || null,
            local_name: local_name || null,
            city: city || null,
            neighborhood: neighborhood || null,
            address: address || null,
          }])
          .select('id')
          .single();
        if (createErr) throw createErr;
        customerId = created.id;
      }
    }

    let orderId = clientOrderId || await nextSequentialOrderId(getSupabase());
    const total = payloadTotal;

    // Crear orden
    // vendor_name se incluye sólo si la columna existe en la tabla
    const buildRow = (): Record<string, unknown> => ({
      id: orderId,
      customer_id: customerId,
      status: 'Pendiente',
      total,
      delivery_address: delivery_address || null,
      notes: notes || null,
    });

    let orderErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderRow = buildRow();
      // Intentar con vendor_name primero; si falla por columna inexistente, reintenta sin ella
      ({ error: orderErr } = await getSupabase().from('orders').insert([{ ...orderRow, vendor_name: vendor_name || null }]));
      if (orderErr?.message?.includes('vendor_name') || orderErr?.code === '42703') {
        console.warn('Columna vendor_name no existe, reintentando sin ella. Corre: ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_name TEXT');
        const retry = await getSupabase().from('orders').insert([orderRow]);
        orderErr = retry.error;
      }
      // Número consecutivo tomado por otro pedido en paralelo: probar el siguiente
      if (orderErr?.code === '23505') {
        orderId = await nextSequentialOrderId(getSupabase());
        continue;
      }
      break;
    }
    if (orderErr) throw orderErr;

    // Crear items — guardamos product_name para no depender de JOIN
    const itemsToInsert = items.map(item => ({
      order_id: orderId,
      product_ref: item.ref,
      product_name: item.name,          // ← nombre real del inventario
      quantity: item.quantity,
      unit_type: item.unit_type || 'unidad',
      notes: item.notes || null,        // ← variación/tipo (ej: BRILLO, TINTA)
      price_at_time: item.price || 0
    }));

    const { error: itemsErr } = await getSupabase()
      .from('order_items')
      .insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    return NextResponse.json({
      success: true,
      order: {
        id: orderId, customer, email, customer_id: customerId,
        items, status: 'Pendiente', total,
        date: new Date().toLocaleDateString('es-CO'),
        total_items: items.reduce((s, i) => s + i.quantity, 0)
      },
      message: `Pedido ${orderId} guardado`
    });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error guardando pedido' },
      { status: 500 }
    );
  }
}
