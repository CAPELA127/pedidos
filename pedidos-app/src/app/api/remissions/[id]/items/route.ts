import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface ItemPatch {
  id: string;
  packed_quantity?: number;
  item_status?: 'completo' | 'modificado' | 'agotado' | 'agregado';
}

// PATCH: secretaría corrige cantidades/estado empacado al comparar vendido vs. empacado.
// Editable en cualquier momento, incluso después de revisada/liquidada.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;
    const { items } = (await request.json()) as { items: ItemPatch[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No se enviaron ítems para actualizar' },
        { status: 400 }
      );
    }

    const { data: rem, error: fetchErr } = await getSupabase()
      .from('remissions')
      .select('id')
      .eq('id', remissionId)
      .single();

    if (fetchErr || !rem) {
      return NextResponse.json(
        { success: false, message: 'Remisión no encontrada' },
        { status: 404 }
      );
    }

    for (const item of items) {
      const patch: Record<string, number | string> = {};
      if (item.packed_quantity !== undefined) {
        patch.packed_quantity = Math.max(0, Math.trunc(Number(item.packed_quantity) || 0));
      }
      if (item.item_status !== undefined) {
        patch.item_status = item.item_status;
      }
      if (Object.keys(patch).length === 0) continue;

      const { error: updateErr } = await getSupabase()
        .from('remission_items')
        .update(patch)
        .eq('id', item.id)
        .eq('remission_id', remissionId);

      if (updateErr) throw updateErr;
    }

    const { data: allItems, error: itemsErr } = await getSupabase()
      .from('remission_items')
      .select('packed_quantity, price_at_time')
      .eq('remission_id', remissionId);

    if (itemsErr) throw itemsErr;

    const total = (allItems || []).reduce(
      (s, i) => s + (i.packed_quantity || 0) * (i.price_at_time || 0),
      0
    );

    const { data: updatedRem, error: totalErr } = await getSupabase()
      .from('remissions')
      .update({ total })
      .eq('id', remissionId)
      .select()
      .single();

    if (totalErr) throw totalErr;

    return NextResponse.json({ success: true, remission: updatedRem });
  } catch (error) {
    console.error('PATCH /api/remissions/[id]/items error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error actualizando ítems' },
      { status: 500 }
    );
  }
}

interface FullItemPayload {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  unit_type?: string;
  notes?: string | null;
}

// Misma referencia puede tener presentaciones distintas (nombre distinto) —
// el match debe ser por ref + nombre, igual que en PUT /api/orders/[id].
const itemKey = (ref: string, name: string) => `${ref}::${name}`;

// PUT: reemplazo completo de los ítems de la remisión — usado por el editor
// del vendedor en el chat (cambia cantidades/precios y borra renglones sin
// existencia antes de liquidar). Reemplaza la ordered_quantity/packed_quantity
// tal cual: lo que llega es lo que queda facturado en esta remisión.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;
    const { items } = (await request.json()) as { items: FullItemPayload[] };

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: 'Se requiere el array de items' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: rem, error: fetchErr } = await supabase
      .from('remissions')
      .select('id')
      .eq('id', remissionId)
      .single();

    if (fetchErr || !rem) {
      return NextResponse.json(
        { success: false, message: 'Remisión no encontrada' },
        { status: 404 }
      );
    }

    const { data: existingItems, error: existingErr } = await supabase
      .from('remission_items')
      .select('id, product_ref, product_name')
      .eq('remission_id', remissionId);
    if (existingErr) throw existingErr;

    const newKeys = new Set(items.map(i => itemKey(i.ref, i.name)));
    const toDelete = (existingItems || []).filter(i => !newKeys.has(itemKey(i.product_ref, i.product_name)));
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('remission_items')
        .delete()
        .in('id', toDelete.map(i => i.id));
      if (delErr) throw delErr;
    }

    for (const item of items) {
      const existing = (existingItems || []).find(i => itemKey(i.product_ref, i.product_name) === itemKey(item.ref, item.name));
      const fields = {
        product_name: item.name,
        packed_quantity: Math.max(0, Math.trunc(Number(item.quantity) || 0)),
        price_at_time: item.price || 0,
        unit_type: item.unit_type || 'unidad',
        notes: item.notes || null,
      };
      if (existing) {
        const { error: updErr } = await supabase
          .from('remission_items')
          .update(fields)
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('remission_items')
          .insert({ remission_id: remissionId, product_ref: item.ref, ordered_quantity: 0, item_status: 'agregado', ...fields });
        if (insErr) throw insErr;
      }
    }

    const { data: allItems, error: itemsErr } = await supabase
      .from('remission_items')
      .select('packed_quantity, price_at_time')
      .eq('remission_id', remissionId);
    if (itemsErr) throw itemsErr;

    const total = (allItems || []).reduce((s, i) => s + (i.packed_quantity || 0) * (i.price_at_time || 0), 0);

    const { data: updatedRem, error: totalErr } = await supabase
      .from('remissions')
      .update({ total })
      .eq('id', remissionId)
      .select()
      .single();
    if (totalErr) throw totalErr;

    return NextResponse.json({ success: true, remission: updatedRem });
  } catch (error) {
    console.error('PUT /api/remissions/[id]/items error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error actualizando ítems' },
      { status: 500 }
    );
  }
}
