import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface ReturnItemPayload {
  ref: string;
  name: string;
  quantity: number;
  price: number;
  reason: string;
}

interface LiquidatePayload {
  discount_percent?: number;
  freight_value?: number;
  returns?: ReturnItemPayload[];
}

// POST: liquidar una remisión (descuento % + flete + devoluciones/garantías por
// referencia). Repetible: cada llamada reemplaza la liquidación anterior sobre
// la misma remisión (mismo número, no crea filas nuevas).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;
    const payload: LiquidatePayload = await request.json();

    const discountPercent = Math.trunc(Number(payload.discount_percent) || 0);
    const freightValue = Number(payload.freight_value) || 0;
    const returns = Array.isArray(payload.returns) ? payload.returns : [];

    if (discountPercent < 0 || discountPercent > 100) {
      return NextResponse.json(
        { success: false, message: 'El descuento debe ser un porcentaje entre 0 y 100' },
        { status: 400 }
      );
    }
    if (freightValue < 0) {
      return NextResponse.json(
        { success: false, message: 'El flete no puede ser negativo' },
        { status: 400 }
      );
    }
    for (const r of returns) {
      if (!r.ref || !(r.quantity > 0) || r.price < 0 || !r.reason?.trim()) {
        return NextResponse.json(
          { success: false, message: 'Cada devolución necesita referencia, cantidad, precio y motivo' },
          { status: 400 }
        );
      }
    }

    const { data: rem, error: fetchErr } = await getSupabase()
      .from('remissions')
      .select('id, total, remission_items (product_ref)')
      .eq('id', remissionId)
      .single();

    if (fetchErr || !rem) {
      return NextResponse.json(
        { success: false, message: 'Remisión no encontrada' },
        { status: 404 }
      );
    }

    // El descuento por devolución/garantía solo puede salir de referencias
    // realmente facturadas en esta remisión.
    const invoicedRefs = new Set((rem.remission_items || []).map((i: { product_ref: string }) => i.product_ref.toUpperCase()));
    const invalidReturn = returns.find(r => !invoicedRefs.has(r.ref.toUpperCase()));
    if (invalidReturn) {
      return NextResponse.json(
        { success: false, message: `La referencia "${invalidReturn.ref}" no está facturada en esta remisión` },
        { status: 400 }
      );
    }

    const total = rem.total || 0;
    const returnsValue = returns.reduce((s, r) => s + r.quantity * r.price, 0);
    const discountAmount = Math.round(total * discountPercent / 100);
    const liquidatedTotal = total - discountAmount - freightValue - returnsValue;

    // Escribir primero las devoluciones (reemplazando la lista anterior) — si
    // falta la migración o algo sale mal aquí, la remisión no queda a medias
    // liquidada con datos inconsistentes.
    const { error: delRetErr } = await getSupabase()
      .from('remission_returns')
      .delete()
      .eq('remission_id', remissionId);
    if (delRetErr) throw delRetErr;

    if (returns.length > 0) {
      const { error: insRetErr } = await getSupabase()
        .from('remission_returns')
        .insert(returns.map(r => ({
          remission_id: remissionId,
          product_ref: r.ref,
          product_name: r.name,
          quantity: r.quantity,
          price: r.price,
          reason: r.reason,
        })));
      if (insRetErr) throw insRetErr;
    }

    const { data: updated, error: updateErr } = await getSupabase()
      .from('remissions')
      .update({
        discount_percent: discountPercent,
        freight_value: freightValue,
        returns_value: returnsValue,
        returns_reason: returns.map(r => r.reason).join('; ') || null,
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
    const code = (error as { code?: string })?.code;
    if (code === '42P01' || code === 'PGRST205') {
      return NextResponse.json(
        { success: false, message: 'Falta correr la migración 2026-07-remission-returns.sql en Supabase.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error liquidando remisión' },
      { status: 500 }
    );
  }
}
