import { getSupabase } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
}

interface OrderPayload {
  id?: string;
  customer: string;
  email: string;
  customer_id?: string;
  items: OrderItem[];
  phone?: string;
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
    const { customer, email, customer_id: providedCustomerId, items, phone, vendor_name, delivery_address, notes } = payload;

    if (!customer || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Faltan campos: customer, items' },
        { status: 400 }
      );
    }

    // Buscar o crear cliente
    let customerId = providedCustomerId;
    if (!customerId) {
      let existing = null;
      if (email) {
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
        const { data: created, error: createErr } = await getSupabase()
          .from('customers')
          .insert([{ name: customer, email: email || null, phone: phone || null }])
          .select('id')
          .single();
        if (createErr) throw createErr;
        customerId = created.id;
      }
    }

    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    // Crear orden
    // vendor_name se incluye sólo si la columna existe en la tabla
    const orderRow: Record<string, unknown> = {
      id: orderId,
      customer_id: customerId,
      status: 'Pendiente',
      total,
      delivery_address: delivery_address || null,
      // Si vendor_name está en notes como fallback hasta que se agregue la columna
      notes: vendor_name
        ? `[Vendedor: ${vendor_name}]${notes ? ' ' + notes : ''}`
        : (notes || null),
    };

    // Intentar con vendor_name primero; si falla por columna inexistente, reintenta sin ella
    let { error: orderErr } = await getSupabase().from('orders').insert([{ ...orderRow, vendor_name: vendor_name || null }]);
    if (orderErr?.message?.includes('vendor_name') || orderErr?.code === '42703') {
      console.warn('Columna vendor_name no existe, reintentando sin ella. Corre: ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_name TEXT');
      const retry = await getSupabase().from('orders').insert([orderRow]);
      orderErr = retry.error;
    }
    if (orderErr) throw orderErr;

    // Crear items — guardamos product_name para no depender de JOIN
    const itemsToInsert = items.map(item => ({
      order_id: orderId,
      product_ref: item.ref,
      product_name: item.name,          // ← nombre real del inventario
      quantity: item.quantity,
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
