import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  status?: string;
  date?: string;
  total_items?: number;
}

export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from('Orders')
      .select(`
        id,
        customer_id,
        status,
        total,
        created_at,
        Customers (id, name, email, phone),
        OrderItems (
          id,
          product_ref,
          quantity,
          price_at_time,
          Products (ref_code, name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mapear respuesta para compatibilidad con frontend
    const formattedOrders = orders.map((o: any) => ({
      id: o.id,
      customer: o.Customers?.name || 'Unknown',
      email: o.Customers?.email,
      customer_id: o.customer_id,
      phone: o.Customers?.phone,
      items: (o.OrderItems || []).map((oi: any) => ({
        ref: oi.product_ref,
        name: oi.Products?.name || 'Producto',
        quantity: oi.quantity,
        price: oi.price_at_time
      })),
      status: o.status,
      total: o.total,
      date: new Date(o.created_at).toLocaleDateString('es-ES'),
      total_items: (o.OrderItems || []).reduce((sum: number, i: any) => sum + i.quantity, 0)
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error fetching orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const payload: OrderPayload = await req.json();

    const {
      customer,
      email,
      customer_id: providedCustomerId,
      items,
      phone
    } = payload;

    if (!customer || !email || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'customer, email, and items are required' },
        { status: 400 }
      );
    }

    let customerId = providedCustomerId;

    // Si no viene customer_id, buscar/crear cliente
    if (!customerId) {
      const { data: existingCustomer } = await supabase
        .from('Customers')
        .select('id')
        .eq('email', email)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Crear nuevo cliente
        const { data: newCustomer, error: createError } = await supabase
          .from('Customers')
          .insert([{ name: customer, email, phone: phone || null }])
          .select('id')
          .single();

        if (createError) throw createError;
        customerId = newCustomer.id;
      }
    }

    // Generar ID del pedido
    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    // Calcular total
    const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    // Crear orden
    const { error: orderError } = await supabase
      .from('Orders')
      .insert([{
        id: orderId,
        customer_id: customerId,
        status: 'Pendiente',
        total
      }]);

    if (orderError) throw orderError;

    // Crear items del pedido
    const itemsToInsert = items.map(item => ({
      order_id: orderId,
      product_ref: item.ref,
      quantity: item.quantity,
      price_at_time: item.price || 0
    }));

    const { error: itemsError } = await supabase
      .from('OrderItems')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // Retornar orden creada
    const formattedOrder = {
      id: orderId,
      customer,
      email,
      customer_id: customerId,
      phone,
      items,
      status: 'Pendiente',
      total,
      date: new Date().toLocaleDateString('es-ES'),
      total_items: items.reduce((sum, i) => sum + i.quantity, 0)
    };

    return NextResponse.json({
      success: true,
      order: formattedOrder,
      message: `Pedido ${orderId} guardado en base de datos`
    });
  } catch (error) {
    console.error('Error guardando orden:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error guardando la orden'
      },
      { status: 500 }
    );
  }
}
