import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderItemUpdate {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    const { data: order, error: orderError } = await supabase
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
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    return NextResponse.json({
      success: true,
      order
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error fetching order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const { items, status } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: 'Items array is required' },
        { status: 400 }
      );
    }

    // Calcular total
    const total = items.reduce((sum: number, item: OrderItemUpdate) => {
      return sum + ((item.price || 0) * item.quantity);
    }, 0);

    // Actualizar Order (status y total)
    const { error: updateError } = await supabase
      .from('Orders')
      .update({
        status: status || 'Pendiente',
        total
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Obtener los OrderItems actuales
    const { data: existingItems, error: fetchError } = await supabase
      .from('OrderItems')
      .select('id, product_ref')
      .eq('order_id', orderId);

    if (fetchError) throw fetchError;

    // Eliminar items que fueron removidos
    const existingRefs = new Set(existingItems.map(i => i.product_ref));
    const newRefs = new Set(items.map((i: OrderItemUpdate) => i.ref));

    const toDelete = existingItems.filter(i => !newRefs.has(i.product_ref));

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('OrderItems')
        .delete()
        .in('id', toDelete.map(i => i.id));

      if (deleteError) throw deleteError;
    }

    // Upsert items (actualizar o crear)
    for (const item of items) {
      const existing = existingItems.find(i => i.product_ref === item.ref);

      if (existing) {
        // Actualizar
        const { error: updateItemError } = await supabase
          .from('OrderItems')
          .update({
            quantity: item.quantity,
            price_at_time: item.price || 0
          })
          .eq('product_ref', item.ref)
          .eq('order_id', orderId);

        if (updateItemError) throw updateItemError;
      } else {
        // Crear nuevo
        const { error: insertError } = await supabase
          .from('OrderItems')
          .insert({
            order_id: orderId,
            product_ref: item.ref,
            quantity: item.quantity,
            price_at_time: item.price || 0
          });

        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully',
      total
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error updating order' },
      { status: 500 }
    );
  }
}
