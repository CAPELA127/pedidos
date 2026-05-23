import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
        created_at,
        customers (id, name, email),
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
      customer_id: o.customer_id,
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
    const { customer, email, customer_id: providedCustomerId, items, phone } = payload;

    if (!customer || !email || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Faltan campos: customer, email, items' },
        { status: 400 }
      );
    }

    // Buscar o crear cliente
    let customerId = providedCustomerId;
    if (!customerId) {
      const { data: existing } = await getSupabase()
        .from('customers')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: created, error: createErr } = await getSupabase()
          .from('customers')
          .insert([{ name: customer, email, phone: phone || null }])
          .select('id')
          .single();
        if (createErr) throw createErr;
        customerId = created.id;
      }
    }

    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    // Crear orden
    const { error: orderErr } = await getSupabase()
      .from('orders')
      .insert([{ id: orderId, customer_id: customerId, status: 'Pendiente', total }]);
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
