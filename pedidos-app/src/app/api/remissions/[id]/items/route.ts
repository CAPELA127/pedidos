import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface ItemPatch {
  id: string;
  packed_quantity?: number;
  item_status?: 'completo' | 'modificado' | 'agotado' | 'agregado';
}

// PATCH: secretaría corrige cantidades/estado empacado al comparar vendido vs. empacado.
// Solo permitido antes de que la remisión quede finalizada (reviewed_at).
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
      .select('id, reviewed_at')
      .eq('id', remissionId)
      .single();

    if (fetchErr || !rem) {
      return NextResponse.json(
        { success: false, message: 'Remisión no encontrada' },
        { status: 404 }
      );
    }

    if (rem.reviewed_at) {
      return NextResponse.json(
        { success: false, message: 'Esta remisión ya fue finalizada y no se puede editar' },
        { status: 400 }
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
