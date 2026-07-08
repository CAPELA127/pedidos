import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Mismos encabezados y orden que "facturaA-971.xlsx" (formato real de facturación) —
// la secretaría importa este archivo directo al sistema contable, así que
// el formato debe calzar exactamente (nombres de columna, orden).
const HEADERS = [
  'Referencia/Cod. Barras',
  'Cod. Barras',
  'Nombre',
  'Cantidad',
  'Unidad de Medida',
  'Precio Unitario',
  'Descuento',
  'Impuesto',
  'Total',
  'Atributo',
  'Costo',
  'Costo_real',
  'cantidad_develta',
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
      .select('id, order_items (product_ref, product_name, quantity, unit_type, notes, price_at_time, discount_percent, tax_percent, barcode, cost, real_cost, returned_quantity)')
      .eq('id', orderId)
      .single();

    if (error?.code === '42703') {
      return NextResponse.json(
        { error: 'Falta correr la migración ADD_SECRETARIA_FACTURA_FIELDS.sql en Supabase.' },
        { status: 500 }
      );
    }
    if (error || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const items = (order.order_items || []) as {
      product_ref: string; product_name: string | null; quantity: number; unit_type: string | null;
      notes: string | null; price_at_time: number; discount_percent: number | null; tax_percent: number | null;
      barcode: string | null; cost: number | null; real_cost: number | null; returned_quantity: number | null;
    }[];

    type Cell = string | number;
    const rows: Cell[][] = [HEADERS];
    items.forEach((item) => {
      const price = item.price_at_time || 0;
      const qty = item.quantity || 0;
      const discount = item.discount_percent || 0;
      const tax = item.tax_percent || 0;
      const subtotal = price * qty * (1 - discount / 100);
      const total = subtotal * (1 + tax / 100);
      rows.push([
        item.product_ref || '',
        item.barcode || '',
        item.product_name || '',
        qty,
        item.unit_type || 'unidad',
        price,
        discount,
        tax,
        total,
        item.notes || '',
        item.cost || 0,
        item.real_cost || 0,
        item.returned_quantity || 0,
      ]);
    });

    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 16 },
      { wch: 14 }, { wch: 11 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 16 },
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Hoja1');
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
