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

    // Regla de negocio: ningún producto empacado puede quedar sin precio.
    // Solo se permite sin precio si está agotado del todo (empacado = 0).
    const missingPrice = payload.items.find(
      i => (i.packed_quantity || 0) > 0 && (!i.price || i.price <= 0)
    );
    if (missingPrice) {
      return NextResponse.json(
        {
          success: false,
          message: `El producto "${missingPrice.name || missingPrice.ref}" no tiene precio. Ponle precio o márcalo como agotado (empacado = 0).`,
        },
        { status: 400 }
      );
    }

    const total = payload.items.reduce(
      (sum, i) => sum + (i.price || 0) * (i.packed_quantity || 0), 0
    );

    // Un mismo pedido no debe acumular remisiones nuevas cada vez que bodega
    // vuelve a fotografiar/confirmar el empaque (ej: corrigiendo un error) —
    // se reutiliza la remisión existente en vez de crear una fila más.
    const { data: existingRemission } = await getSupabase()
      .from('remissions')
      .select('id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const remissionId = existingRemission?.id || `REM-${Math.floor(1000 + Math.random() * 9000)}`;

    const remissionRow = {
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
    };

    if (existingRemission) {
      // Re-empacar invalida cualquier revisión/liquidación previa sobre los
      // datos viejos — hay que volver a revisar y liquidar con lo nuevo.
      const { error: updErr } = await getSupabase()
        .from('remissions')
        .update({
          ...remissionRow,
          reviewed_at: null,
          liquidated_at: null,
          liquidated_total: null,
          discount_percent: 0,
          freight_value: 0,
          returns_value: 0,
          returns_reason: null,
        })
        .eq('id', remissionId);
      if (updErr) throw updErr;

      const { error: delErr } = await getSupabase()
        .from('remission_items')
        .delete()
        .eq('remission_id', remissionId);
      if (delErr) throw delErr;
    } else {
      const { error: remErr } = await getSupabase().from('remissions').insert([remissionRow]);
      if (remErr) throw remErr;
    }

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
      message: existingRemission ? `Remisión ${remissionId} actualizada` : `Remisión ${remissionId} creada`
    });
  } catch (error) {
    console.error('POST /api/orders/[id]/remission error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error guardando remisión' },
      { status: 500 }
    );
  }
}
