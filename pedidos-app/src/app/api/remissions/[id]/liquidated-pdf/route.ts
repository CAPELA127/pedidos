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
        discount_percent, freight_value, returns_value, returns_reason,
        liquidated_total, liquidated_at,
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
    if (!rem.liquidated_at) {
      return NextResponse.json({ error: 'La remisión aún no ha sido liquidada' }, { status: 400 });
    }

    const order = (Array.isArray(rem.orders) ? rem.orders[0] : rem.orders) as any;
    const rawCustomers = order?.customers;
    const c = (Array.isArray(rawCustomers) ? rawCustomers[0] : rawCustomers) as any;
    const items = ((rem.remission_items as any[]) || []).sort((a, b) =>
      String(a.product_ref).localeCompare(String(b.product_ref)));

    const total = rem.total || 0;
    const discountPercent = rem.discount_percent || 0;
    const discountAmount = Math.round(total * discountPercent / 100);
    const freightValue = rem.freight_value || 0;
    const returnsValue = rem.returns_value || 0;
    const liquidatedTotal = rem.liquidated_total ?? (total - discountAmount - freightValue - returnsValue);
    const fmt = (n: number) => `$${n.toLocaleString('es-CO')}`;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Header morado (distinto al azul de la remisión y al verde del pedido)
    doc.setFillColor(109, 40, 217);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REMISIÓN LIQUIDADA', margin, 16);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(`${rem.id}  ·  Pedido ${rem.order_id}`, margin, 26);

    doc.setFontSize(9);
    const fechaLiq = rem.liquidated_at ? new Date(rem.liquidated_at).toLocaleDateString('es-CO') : 'N/A';
    doc.text(`Liquidada: ${fechaLiq}`, pageWidth - margin, 16, { align: 'right' });
    doc.text(`Total remisión: COP ${fmt(total)}`, pageWidth - margin, 22, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Total liquidado: COP ${fmt(liquidatedTotal)}`, pageWidth - margin, 28, { align: 'right' });

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
    y = (doc as any).lastAutoTable.finalY + 6;

    // Tabla de productos empacados
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTOS', margin, y);
    y += 3;

    const productBody = items.map((item) => {
      const subtotal = (item.price_at_time || 0) * (item.packed_quantity || 0);
      const displayName = item.notes ? `${item.product_name}\n(${item.notes})` : item.product_name;
      return [
        item.product_ref,
        displayName,
        item.packed_quantity,
        item.unit_type || 'unidad',
        item.price_at_time ? fmt(item.price_at_time) : '-',
        fmt(subtotal),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['REF', 'Producto', 'Cantidad', 'Unidad', 'Precio', 'Subtotal']],
      body: productBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: {
        fillColor: [109, 40, 217],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [250, 248, 255] },
      margin: { left: margin, right: margin },
    });

    // Liquidación: total, deducciones y total liquidado
    const pageHeight = doc.internal.pageSize.getHeight();
    let yL = (doc as any).lastAutoTable.finalY + 8;
    const reasonLines = rem.returns_reason ? 1 : 0;
    if (yL + 45 + reasonLines * 8 > pageHeight - 12) {
      doc.addPage();
      yL = 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('LIQUIDACIÓN', margin, yL);
    yL += 3;

    const liqBody: any[] = [
      ['Total remisión', fmt(total)],
      [`Descuento (${discountPercent}%)`, `- ${fmt(discountAmount)}`],
      ['Flete', `- ${fmt(freightValue)}`],
      ['Devoluciones / daños', `- ${fmt(returnsValue)}`],
    ];
    if (rem.returns_reason) {
      liqBody.push(['Motivo devolución/daño', rem.returns_reason]);
    }
    liqBody.push([
      { content: 'TOTAL LIQUIDADO', styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: fmt(liquidatedTotal), styles: { fontStyle: 'bold', fontSize: 10, textColor: [109, 40, 217] } },
    ]);

    autoTable(doc, {
      startY: yL,
      body: liqBody,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60, fillColor: [245, 245, 245] },
        1: { cellWidth: contentWidth - 60, halign: 'right' },
      },
      didParseCell: (data) => {
        // El motivo va alineado a la izquierda, no es una cifra
        if (data.column.index === 1 && typeof data.cell.raw === 'string' && data.cell.raw === rem.returns_reason) {
          data.cell.styles.halign = 'left';
        }
      },
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
        'Content-Disposition': `attachment; filename="remision-liquidada-${rem.id}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating liquidated remission PDF:', error);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
