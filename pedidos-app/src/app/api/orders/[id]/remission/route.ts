import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface RemissionItemPayload {
  ref: string;
  name: string;
  ordered_quantity: number;
  packed_quantity: number;
  price: number;
  unit_type?: string;
  status: 'completo' | 'modificado' | 'agotado' | 'agregado';
  note?: string | null;
}

interface RemissionPayload {
  items: RemissionItemPayload[];
  packing?: {
    packer_name?: string;
    verifier_name?: string;
    packing_time?: string;
    packing_location?: string;
    packing_date?: string;
    boxes_count?: number | null;
  };
  notes?: string;
}

// GET: remisiones existentes de un pedido
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { data: remissions, error } = await getSupabase()
      .from('remissions')
      .select('*, remission_items (product_ref, product_name, ordered_quantity, packed_quantity, price_at_time, unit_type, item_status, notes)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, remissions: remissions || [] });
  } catch (error) {
    console.error('GET /api/orders/[id]/remission error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error obteniendo remisiones' },
      { status: 500 }
    );
  }
}

// POST: crear remisión confirmada + marcar pedido como Empacado
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const payload: RemissionPayload = await request.json();

    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Se requiere el array de items' },
        { status: 400 }
      );
    }

    const remissionId = `REM-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = payload.items.reduce(
      (sum, i) => sum + (i.price || 0) * (i.packed_quantity || 0), 0
    );

    const { error: remErr } = await getSupabase().from('remissions').insert([{
      id: remissionId,
      order_id: orderId,
      total,
      packer_name: payload.packing?.packer_name || null,
      verifier_name: payload.packing?.verifier_name || null,
      packing_time: payload.packing?.packing_time || null,
      packing_location: payload.packing?.packing_location || null,
      packing_date: payload.packing?.packing_date || null,
      boxes_count: payload.packing?.boxes_count ?? null,
      notes: payload.notes || null,
    }]);
    if (remErr) throw remErr;

    const itemsToInsert = payload.items.map(i => ({
      remission_id: remissionId,
      product_ref: i.ref,
      product_name: i.name,
      ordered_quantity: i.ordered_quantity || 0,
      packed_quantity: i.packed_quantity || 0,
      price_at_time: i.price || 0,
      unit_type: i.unit_type || 'unidad',
      item_status: i.status,
      notes: i.note || null,
    }));

    const { error: itemsErr } = await getSupabase()
      .from('remission_items')
      .insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    // Marcar el pedido como Empacado
    const { error: statusErr } = await getSupabase()
      .from('orders')
      .update({ status: 'Empacado' })
      .eq('id', orderId);
    if (statusErr) console.warn('No se pudo actualizar el estado del pedido:', statusErr.message);

    return NextResponse.json({
      success: true,
      remission: { id: remissionId, order_id: orderId, total },
      message: `Remisión ${remissionId} creada`
    });
  } catch (error) {
    console.error('POST /api/orders/[id]/remission error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error guardando remisión' },
      { status: 500 }
    );
  }
}
