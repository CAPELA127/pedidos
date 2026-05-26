import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabase();

    // Traer todos los pedidos con sus items
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        customer,
        email,
        phone,
        local_name,
        city,
        neighborhood,
        address,
        status,
        total,
        created_at,
        order_items (
          product_ref,
          product_name,
          quantity,
          price_at_time
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aplanar: una fila por item de pedido
    const rows: Record<string, string | number>[] = [];

    for (const order of orders || []) {
      const items = (order.order_items as {
        product_ref: string;
        product_name: string;
        quantity: number;
        price_at_time: number;
      }[]) || [];

      if (items.length === 0) {
        rows.push({
          'Pedido ID':   order.id,
          'Estado':      order.status,
          'Fecha':       order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO') : '',
          'Cliente':     order.customer || '',
          'Email':       order.email || '',
          'Teléfono':    order.phone || '',
          'Local':       order.local_name || '',
          'Ciudad':      order.city || '',
          'Barrio':      order.neighborhood || '',
          'Dirección':   order.address || '',
          'REF':         '',
          'Producto':    '',
          'Cantidad':    0,
          'Precio Unit': 0,
          'Subtotal':    0,
          'Total Pedido': order.total || 0,
        });
      } else {
        items.forEach((item, idx) => {
          rows.push({
            'Pedido ID':   order.id,
            'Estado':      order.status,
            'Fecha':       order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO') : '',
            'Cliente':     order.customer || '',
            'Email':       order.email || '',
            'Teléfono':    order.phone || '',
            'Local':       order.local_name || '',
            'Ciudad':      order.city || '',
            'Barrio':      order.neighborhood || '',
            'Dirección':   order.address || '',
            'REF':         item.product_ref || '',
            'Producto':    item.product_name || '',
            'Cantidad':    item.quantity || 0,
            'Precio Unit': item.price_at_time || 0,
            'Subtotal':    (item.price_at_time || 0) * (item.quantity || 0),
            'Total Pedido': idx === 0 ? (order.total || 0) : '',
          });
        });
      }
    }

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

    worksheet['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
      { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 28 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];

    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fecha = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      headers: {
        'Content-Disposition': `attachment; filename="pedidos_${fecha}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Error al exportar pedidos' },
      { status: 500 }
    );
  }
}
