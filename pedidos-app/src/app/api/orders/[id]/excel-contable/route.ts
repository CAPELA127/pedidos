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

interface OrderItemRow {
  product_ref: string; product_name: string | null; quantity: number; unit_type: string | null;
  notes: string | null; price_at_time: number; discount_percent: number | null; tax_percent: number | null;
  barcode: string | null; cost: number | null; real_cost: number | null; returned_quantity: number | null;
}

interface RemissionItemRow {
  product_ref: string; product_name: string | null; ordered_quantity: number; packed_quantity: number;
  price_at_time: number; unit_type: string | null; item_status: string;
}

// Une pedido original + remisión: la referencia+nombre identifica el mismo renglón
// en ambas tablas (una misma referencia puede tener presentaciones distintas).
const itemKey = (ref: string, name: string | null) => `${ref}::${name || ''}`;

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

    const orderItems = (order.order_items || []) as OrderItemRow[];
    const orderItemByKey = new Map(orderItems.map((oi) => [itemKey(oi.product_ref, oi.product_name), oi]));

    // Si bodega ya empacó el pedido, la remisión refleja lo que realmente se
    // despachó (cantidad empacada, faltantes, agregados) — eso es lo que la
    // secretaría corrige en el tablero de Remisiones, así que el Excel debe
    // salir de ahí y no de las cantidades originales del pedido.
    // Se toma la PRIMERA remisión creada (no la más reciente): un mismo
    // pedido no debería generar más de una remisión, pero cuando ocurre por
    // un duplicado, la original (más antigua) es la que trae las ediciones
    // reales de bodega/secretaría — las posteriores son duplicados vacíos.
    const { data: remission } = await supabase
      .from('remissions')
      .select('id, remission_items (product_ref, product_name, ordered_quantity, packed_quantity, price_at_time, unit_type, item_status)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const remissionItems = (remission?.remission_items || []) as RemissionItemRow[];

    type Cell = string | number;
    const rows: Cell[][] = [HEADERS];

    const buildRow = (opts: {
      ref: string; name: string | null; qty: number; unitType: string | null;
      price: number; returnedQty: number; orig?: OrderItemRow;
    }) => {
      const discount = opts.orig?.discount_percent || 0;
      const tax = opts.orig?.tax_percent || 0;
      const subtotal = opts.price * opts.qty * (1 - discount / 100);
      const total = subtotal * (1 + tax / 100);
      return [
        opts.ref || '',
        opts.orig?.barcode || '',
        opts.name || '',
        opts.qty,
        opts.unitType || 'unidad',
        opts.price,
        discount,
        tax,
        total,
        opts.orig?.notes || '',
        opts.orig?.cost || 0,
        opts.orig?.real_cost || 0,
        opts.returnedQty,
      ];
    };

    if (remissionItems.length > 0) {
      remissionItems.forEach((ri) => {
        const orig = orderItemByKey.get(itemKey(ri.product_ref, ri.product_name));
        rows.push(buildRow({
          ref: ri.product_ref,
          name: ri.product_name || orig?.product_name || null,
          qty: ri.packed_quantity || 0,
          unitType: ri.unit_type || orig?.unit_type || null,
          price: orig?.price_at_time ?? ri.price_at_time ?? 0,
          returnedQty: Math.max(0, (ri.ordered_quantity || 0) - (ri.packed_quantity || 0)),
          orig,
        }));
      });
    } else {
      orderItems.forEach((item) => {
        rows.push(buildRow({
          ref: item.product_ref,
          name: item.product_name,
          qty: item.quantity || 0,
          unitType: item.unit_type,
          price: item.price_at_time || 0,
          returnedQty: item.returned_quantity || 0,
          orig: item,
        }));
      });
    }

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
