import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;

    const { data: rem, error } = await getSupabase()
      .from('remissions')
      .select(`
        id, order_id, total, packer_name, verifier_name, packing_time,
        packing_location, packing_date, boxes_count, notes, created_at,
        orders (
          id, vendor_name, delivery_address,
          customers (name, email, phone, local_name, city, neighborhood, address)
        ),
        remission_items (product_ref, product_name, ordered_quantity, packed_quantity, price_at_time, unit_type, item_status, notes)
      `)
      .eq('id', remissionId)
      .single();

    if (error || !rem) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 });
    }

    const order = (Array.isArray(rem.orders) ? rem.orders[0] : rem.orders) as any;
    const rawCustomers = order?.customers;
    const c = (Array.isArray(rawCustomers) ? rawCustomers[0] : rawCustomers) as any;
    const items = ((rem.remission_items as any[]) || []).sort((a, b) =>
      String(a.product_ref).localeCompare(String(b.product_ref)));

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Header azul (distinto al verde del pedido para diferenciar documentos)
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('REMISIÓN', margin, 16);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(`${rem.id}  ·  Pedido ${rem.order_id}`, margin, 26);

    doc.setFontSize(9);
    const fechaStr = rem.created_at ? new Date(rem.created_at).toLocaleDateString('es-CO') : 'N/A';
    doc.text(`Fecha: ${fechaStr}`, pageWidth - margin, 16, { align: 'right' });
    doc.text(
      `Total empacado: COP $${(rem.total || 0).toLocaleString('es-CO')}`,
      pageWidth - margin, 22, { align: 'right' }
    );
    if (rem.boxes_count) {
      doc.text(`Cajas: ${rem.boxes_count}`, pageWidth - margin, 28, { align: 'right' });
    }

    let y = 40;

    // Datos del cliente
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', margin, y);
    y += 3;

    const clienteRows = [
      ['Cliente', c?.name || 'Sin nombre'],
      ['Email', c?.email || 'N/A'],
      ['Teléfono', c?.phone || 'N/A'],
      ['Ciudad', c?.city || 'N/A'],
      ['Dirección', order?.delivery_address || c?.address || 'N/A'],
      ['Vendedor', order?.vendor_name || 'N/A'],
    ];

    autoTable(doc, {
      startY: y,
      body: clienteRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38, fillColor: [245, 245, 245] },
        1: { cellWidth: contentWidth - 38 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // Datos de empaque
    doc.setFont('helvetica', 'bold');
    doc.text('CONTROL DE EMPAQUE', margin, y);
    y += 3;
    const empaqueRows = [
      ['Sacó', rem.packer_name || 'N/A', 'Verificó', rem.verifier_name || 'N/A'],
      ['Hora', rem.packing_time || 'N/A', 'Bodega', rem.packing_location || 'N/A'],
      ['Fecha empaque', rem.packing_date || 'N/A', 'Cajas', rem.boxes_count != null ? String(rem.boxes_count) : 'N/A'],
    ];
    autoTable(doc, {
      startY: y,
      body: empaqueRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30, fillColor: [245, 245, 245] },
        1: { cellWidth: contentWidth / 2 - 30 },
        2: { fontStyle: 'bold', cellWidth: 30, fillColor: [245, 245, 245] },
        3: { cellWidth: contentWidth / 2 - 30 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Tabla de productos con pedido vs empacado
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTOS EMPACADOS', margin, y);
    y += 3;

    const statusLabel: Record<string, string> = {
      completo: 'Completo',
      modificado: 'Modificado',
      agotado: 'AGOTADO',
      agregado: 'Agregado',
    };

    const productBody = items.map((item) => {
      const subtotal = (item.price_at_time || 0) * (item.packed_quantity || 0);
      const displayName = item.notes ? `${item.product_name}\n(${item.notes})` : item.product_name;
      return [
        item.product_ref,
        displayName,
        item.ordered_quantity,
        item.packed_quantity,
        item.unit_type || 'unidad',
        statusLabel[item.item_status] || item.item_status,
        item.price_at_time ? `$${item.price_at_time.toLocaleString('es-CO')}` : '-',
        `$${subtotal.toLocaleString('es-CO')}`,
      ];
    });

    productBody.push([
      { content: '', colSpan: 8, styles: { fillColor: [255, 255, 255], minCellHeight: 6 } } as any,
    ]);
    productBody.push([
      '', '', '', '', '', '',
      { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'right' } } as any,
      {
        content: `$${(rem.total || 0).toLocaleString('es-CO')}`,
        styles: { fontStyle: 'bold', textColor: [30, 64, 175] },
      } as any,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['REF', 'Producto', 'Pedido', 'Empacado', 'Unidad', 'Estado', 'Precio', 'Subtotal']],
      body: productBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      // Colorear filas según estado
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = items[data.row.index];
        if (!row) return;
        if (row.item_status === 'agotado') {
          data.cell.styles.textColor = [185, 28, 28];
          if (data.column.index === 5) data.cell.styles.fontStyle = 'bold';
        } else if (row.item_status === 'modificado') {
          data.cell.styles.fillColor = [254, 249, 195];
        } else if (row.item_status === 'agregado') {
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
      margin: { left: margin, right: margin },
    });

    // Resumen de diferencias
    const pageHeight = doc.internal.pageSize.getHeight();
    let yR = (doc as any).lastAutoTable.finalY + 8;
    if (yR + 30 > pageHeight - 12) {
      doc.addPage();
      yR = 20;
    }

    const counts = {
      completo: items.filter(i => i.item_status === 'completo').length,
      modificado: items.filter(i => i.item_status === 'modificado').length,
      agotado: items.filter(i => i.item_status === 'agotado').length,
      agregado: items.filter(i => i.item_status === 'agregado').length,
    };

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RESUMEN', margin, yR);
    yR += 3;
    autoTable(doc, {
      startY: yR,
      body: [[
        `Completos: ${counts.completo}`,
        `Modificados: ${counts.modificado}`,
        `Agotados: ${counts.agotado}`,
        `Agregados: ${counts.agregado}`,
        `Total unidades: ${items.reduce((s, i) => s + (i.packed_quantity || 0), 0)}`,
      ]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'center', fontStyle: 'bold' },
      margin: { left: margin, right: margin },
    });

    // Footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}`,
      margin,
      pageHeight - 8
    );

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="remision-${rem.id}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating remission PDF:', error);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
