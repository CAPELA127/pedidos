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
        )
      `)
      .eq('id', remissionId)
      .single();

    if (error || !rem) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 });
    }
    if (!rem.liquidated_at) {
      return NextResponse.json({ error: 'La remisión aún no ha sido liquidada' }, { status: 400 });
    }

    const { data: returnItems } = await getSupabase()
      .from('remission_returns')
      .select('product_ref, product_name, quantity, price, reason')
      .eq('remission_id', remissionId);

    const order = (Array.isArray(rem.orders) ? rem.orders[0] : rem.orders) as any;
    const rawCustomers = order?.customers;
    const c = (Array.isArray(rawCustomers) ? rawCustomers[0] : rawCustomers) as any;

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

    // Liquidación: total, deducciones y total liquidado
    const pageHeight = doc.internal.pageSize.getHeight();
    let yL = y;
    if (yL + 45 > pageHeight - 12) {
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
      ['Devoluciones / garantías', `- ${fmt(returnsValue)}`],
    ];
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
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Detalle de devoluciones/garantías por referencia
    if (returnItems && returnItems.length > 0) {
      let yR = y;
      if (yR + 20 + returnItems.length * 7 > pageHeight - 12) {
        doc.addPage();
        yR = 20;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('DETALLE DE DEVOLUCIONES / GARANTÍAS', margin, yR);
      yR += 3;

      autoTable(doc, {
        startY: yR,
        head: [['Ref', 'Producto', 'Cant.', 'Precio', 'Subtotal', 'Motivo']],
        body: returnItems.map(r => [
          r.product_ref,
          r.product_name || '',
          String(r.quantity),
          fmt(r.price),
          fmt(r.quantity * r.price),
          r.reason || '',
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [109, 40, 217] },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
        },
        margin: { left: margin, right: margin },
      });
    }

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
