import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderItemUpdate {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  unit_type?: string;
  notes?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { items, status } = body;

    // ── Actualización solo de status (sin items) ──
    if (!items && status) {
      const { error: statusErr } = await getSupabase()
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (statusErr) throw statusErr;
      return NextResponse.json({ success: true, message: 'Estado actualizado' });
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: 'Se requiere el array de items' },
        { status: 400 }
      );
    }

    const total = items.reduce((sum: number, item: OrderItemUpdate) =>
      sum + ((item.price || 0) * item.quantity), 0);

    // Actualizar total y status de la orden
    const { error: updateError } = await getSupabase()
      .from('orders')
      .update({ status: status || 'Pendiente', total })
      .eq('id', orderId);
    if (updateError) throw updateError;

    // Traer items actuales
    const { data: existingItems, error: fetchError } = await getSupabase()
      .from('order_items')
      .select('id, product_ref')
      .eq('order_id', orderId);
    if (fetchError) throw fetchError;

    const newRefs = new Set(items.map((i: OrderItemUpdate) => i.ref));

    // Eliminar items removidos
    const toDelete = (existingItems || []).filter(i => !newRefs.has(i.product_ref));
    if (toDelete.length > 0) {
      const { error: delErr } = await getSupabase()
        .from('order_items')
        .delete()
        .in('id', toDelete.map(i => i.id));
      if (delErr) throw delErr;
    }

    // Actualizar o crear cada item
    for (const item of items) {
      const existing = (existingItems || []).find(i => i.product_ref === item.ref);
      if (existing) {
        const { error: updErr } = await getSupabase()
          .from('order_items')
          .update({ quantity: item.quantity, price_at_time: item.price || 0, product_name: item.name, unit_type: item.unit_type || 'unidad', notes: item.notes || null })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await getSupabase()
          .from('order_items')
          .insert({ order_id: orderId, product_ref: item.ref, product_name: item.name, quantity: item.quantity, price_at_time: item.price || 0, unit_type: item.unit_type || 'unidad', notes: item.notes || null });
        if (insErr) throw insErr;
      }
    }

    return NextResponse.json({ success: true, message: 'Pedido actualizado', total });
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error actualizando pedido' },
      { status: 500 }
    );
  }
}
