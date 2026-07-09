import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { nextSequentialOrderId } from '@/lib/order-id';

export const dynamic = 'force-dynamic';

// GET: siguiente número consecutivo de pedido (ORD-001, ORD-002, …).
// El chat lo pide al confirmar; sin red usa el id por timestamp como respaldo.
export async function GET() {
  try {
    const id = await nextSequentialOrderId(getSupabase());
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('GET /api/orders/next-id error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error generando número de pedido' },
      { status: 500 }
    );
  }
}
