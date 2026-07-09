import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST: secretaría marca la remisión como revisada (bitácora informativa).
// No bloquea nada: el vendedor puede liquidarla en el chat con o sin esta
// marca, y secretaría puede seguir editándola después igual.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;

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
        { success: false, message: 'Esta remisión ya estaba finalizada' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await getSupabase()
      .from('remissions')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', remissionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, remission: updated });
  } catch (error) {
    console.error('POST /api/remissions/[id]/finalize error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error finalizando remisión' },
      { status: 500 }
    );
  }
}
