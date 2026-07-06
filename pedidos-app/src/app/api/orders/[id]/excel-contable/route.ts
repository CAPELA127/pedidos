import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Mismos encabezados y fórmulas que "plantilla-importar-documento.xlsx" —
// la secretaría importa este archivo directo al sistema contable, así que
// el formato debe calzar exactamente (nombres de columna, orden, fórmulas).
const HEADERS = [
  'Referencia o codigo de barras',
  'Nombre',
  'Precio Unitario',
  'Cantidad',
  'Descuento',
  'Impuesto',
  'SubTotal (No modificar)',
  'Estampilla(sino Aplica 0)',
  'Impoconsumo(sino Aplica 0)',
  'Total (No modificar)',
  'id_plan_cuenta (opcional solo Egresos)',
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = getSupabase();

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_items (product_ref, product_name, quantity, price_at_time, discount_percent, tax_percent, estampilla, impoconsumo, id_plan_cuenta)')
      .eq('id', orderId)
      .single();

    if (error?.code === '42703') {
      return NextResponse.json(
        { error: 'Falta correr la migración ADD_SECRETARIA_ACCOUNTING_FIELDS.sql en Supabase.' },
        { status: 500 }
      );
    }
    if (error || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const items = (order.order_items || []) as {
      product_ref: string; product_name: string | null; quantity: number; price_at_time: number;
      discount_percent: number | null; tax_percent: number | null; estampilla: number | null;
      impoconsumo: number | null; id_plan_cuenta: string | null;
    }[];

    type Cell = string | number | { f: string };
    const rows: Cell[][] = [HEADERS];
    items.forEach((item) => {
      const r = rows.length + 1; // fila de Excel (1-indexed, la fila 1 es el encabezado)
      rows.push([
        item.product_ref || '',
        item.product_name || '',
        item.price_at_time || 0,
        item.quantity || 0,
        item.discount_percent || 0,
        item.tax_percent || 0,
        { f: `(C${r}*D${r})-((C${r}*D${r})*(E${r}/100))` },
        item.estampilla || 0,
        item.impoconsumo || 0,
        { f: `(G${r})*(F${r}/100+1)+(H${r}*D${r})+(I${r}*D${r})` },
        item.id_plan_cuenta || '',
      ]);
    });

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 11 },
      { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 },
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Plantilla para importar');
    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Disposition': `attachment; filename="pedido-${order.id}-contable.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('GET /api/orders/[id]/excel-contable error:', error);
    return NextResponse.json({ error: 'Error generando el Excel' }, { status: 500 });
  }
}
