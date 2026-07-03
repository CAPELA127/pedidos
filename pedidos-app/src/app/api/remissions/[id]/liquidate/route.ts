import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface LiquidatePayload {
  discount_percent?: number;
  freight_value?: number;
  returns_value?: number;
  returns_reason?: string | null;
}

// POST: liquidar una remisión (descuento % + flete + devoluciones/daños)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;
    const payload: LiquidatePayload = await request.json();

    const discountPercent = Math.trunc(Number(payload.discount_percent) || 0);
    const freightValue = Number(payload.freight_value) || 0;
    const returnsValue = Number(payload.returns_value) || 0;
    const returnsReason = payload.returns_reason?.trim() || null;

    if (discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json(
        { success: false, message: 'El descuento debe ser un porcentaje entre 0 y 100' },
        { status: 400 }
      );
    }
    if (freightValue < 0 || returnsValue < 0) {
      return NextResponse.json(
        { success: false, message: 'El flete y las devoluciones no pueden ser negativos' },
        { status: 400 }
      );
    }
    if (returnsValue > 0 && !returnsReason) {
      return NextResponse.json(
        { success: false, message: 'Indica el motivo de la devolución o daño' },
        { status: 400 }
      );
    }

    const { data: rem, error: fetchErr } = await getSupabase()
      .from('remissions')
      .select('id, total')
      .eq('id', remissionId)
      .single();

    if (fetchErr || !rem) {
      return NextResponse.json(
        { success: false, message: 'Remisión no encontrada' },
        { status: 404 }
      );
    }

    const total = rem.total || 0;
    const discountAmount = Math.round(total * discountPercent / 100);
    const liquidatedTotal = total - discountAmount - freightValue - returnsValue;

    const { data: updated, error: updateErr } = await getSupabase()
      .from('remissions')
      .update({
        discount_percent: discountPercent,
        freight_value: freightValue,
        returns_value: returnsValue,
        returns_reason: returnsReason,
        liquidated_total: liquidatedTotal,
        liquidated_at: new Date().toISOString(),
      })
      .eq('id', remissionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      remission: updated,
      message: `Remisión ${remissionId} liquidada`,
    });
  } catch (error) {
    console.error('POST /api/remissions/[id]/liquidate error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error liquidando remisión' },
      { status: 500 }
    );
  }
}
