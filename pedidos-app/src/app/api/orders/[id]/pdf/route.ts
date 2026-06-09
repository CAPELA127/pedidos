import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const { data: raw, error } = await getSupabase()
      .from('orders')
      .select(`
        id,
        status,
        total,
        created_at,
        vendor_name,
        delivery_address,
        notes,
        customers (name, email, phone, local_name, city, neighborhood, address),
        order_items (product_ref, product_name, quantity, unit_type, notes, price_at_time)
      `)
      .eq('id', orderId)
      .single();

    if (error || !raw) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    type CustomerRow = { name: string; email: string; phone: string; local_name: string; city: string; neighborhood: string; address: string };
    const rawCustomers = raw.customers as unknown as CustomerRow | CustomerRow[] | null;
    const c: CustomerRow | null = Array.isArray(rawCustomers)
      ? rawCustomers[0] ?? null
      : rawCustomers ?? null;

    const rawItems = (raw.order_items as any[]) || [];

    // Buscar nombres completos en inventario por referencia
    const refs = rawItems.map((oi) => oi.product_ref).filter(Boolean);
    let inventarioMap: Record<string, string> = {};
    if (refs.length > 0) {
      const { data: inv } = await getSupabase()
        .from('INVENTARIO EL PUNTAZO')
        .select('Referencia, Producto, "P. Venta"')
        .in('Referencia', refs);
      if (inv) {
        inv.forEach((row: any) => {
          inventarioMap[row.Referencia] = row.Producto;
        });
      }
    }

    const items = rawItems.map((oi) => ({
      ref: oi.product_ref,
      name: oi.product_name || inventarioMap[oi.product_ref] || oi.product_ref,
      quantity: oi.quantity,
      price: oi.price_at_time,
      unit_type: oi.unit_type || 'unidad',
      notes: oi.notes || null,
    }));

    // ── PDF ────────────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Header verde
    doc.setFillColor(0, 168, 132);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PEDIDO', margin, 16);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(raw.id, margin, 26);

    // Fecha y estado arriba a la derecha
    doc.setFontSize(9);
    const fechaStr = raw.created_at
      ? new Date(raw.created_at).toLocaleDateString('es-CO')
      : 'N/A';
    doc.text(`Fecha: ${fechaStr}`, pageWidth - margin, 16, { align: 'right' });
    doc.text(`Estado: ${raw.status}`, pageWidth - margin, 22, { align: 'right' });
    doc.text(
      `Total: COP $${(raw.total || 0).toLocaleString('es-CO')}`,
      pageWidth - margin,
      28,
      { align: 'right' }
    );

    let y = 40;

    // ── Datos del cliente ──────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', margin, y);
    y += 3;

    const clienteRows = [
      ['Cliente', c?.name || 'Sin nombre'],
      ['Email', c?.email || 'N/A'],
      ['Teléfono', c?.phone || 'N/A'],
      ['Local / Negocio', c?.local_name || 'N/A'],
      ['Ciudad', c?.city || 'N/A'],
      ['Barrio', c?.neighborhood || 'N/A'],
      ['Dirección', c?.address || 'N/A'],
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

    // ── Vendedor (resaltado verde) ────────────────────────────────────────────
    if (raw.vendor_name) {
      autoTable(doc, {
        startY: y,
        body: [['VENDEDOR', raw.vendor_name]],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        columnStyles: {
          0: {
            fontStyle: 'bold',
            cellWidth: 58,
            fillColor: [0, 168, 132],    // verde app
            textColor: [255, 255, 255],
          },
          1: {
            cellWidth: contentWidth - 58,
            fillColor: [209, 250, 229],  // verde claro
            textColor: [6, 78, 59],
            fontStyle: 'bold',
          },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // ── Dirección de entrega diferente (resaltado naranja) ─────────────────────
    if (raw.delivery_address) {
      autoTable(doc, {
        startY: y,
        body: [['ENTREGA EN DIRECCIÓN DIFERENTE', raw.delivery_address]],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3.5, overflow: 'linebreak' },
        columnStyles: {
          0: {
            fontStyle: 'bold',
            cellWidth: 58,
            fillColor: [251, 146, 60],   // naranja
            textColor: [255, 255, 255],
          },
          1: {
            cellWidth: contentWidth - 58,
            fillColor: [255, 237, 213],  // naranja claro
            textColor: [124, 45, 18],
            fontStyle: 'bold',
          },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // ── Notas adicionales (resaltado amarillo) ─────────────────────────────────
    if (raw.notes) {
      autoTable(doc, {
        startY: y,
        body: [['NOTAS DEL PEDIDO', raw.notes]],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3.5, overflow: 'linebreak' },
        columnStyles: {
          0: {
            fontStyle: 'bold',
            cellWidth: 58,
            fillColor: [234, 179, 8],    // amarillo oscuro
            textColor: [255, 255, 255],
          },
          1: {
            cellWidth: contentWidth - 58,
            fillColor: [254, 252, 232],  // amarillo claro
            textColor: [92, 68, 0],
            fontStyle: 'bold',
          },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    y += 4;

    // ── Tabla de productos ─────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTOS', margin, y);
    y += 3;

    const productBody = items.map((item) => {
      const subtotal = (item.price || 0) * item.quantity;
      // Si hay notas (variación), agrégalas al nombre
      const displayName = item.notes ? `${item.name}\n(${item.notes})` : item.name;
      return [
        item.ref,
        displayName,
        item.quantity,
        item.unit_type || 'unidad',
        item.price ? `$${(item.price).toLocaleString('es-CO')}` : '-',
        `$${subtotal.toLocaleString('es-CO')}`,
      ];
    });

    // Fila de total
    productBody.push([
      '', '', '', { content: 'TOTAL', styles: { fontStyle: 'bold' } } as any,
      {
        content: `$${(raw.total || 0).toLocaleString('es-CO')}`,
        styles: { fontStyle: 'bold', textColor: [0, 100, 80] },
      } as any,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['REF', 'Producto', 'Cant.', 'Unidad', 'Precio Unit.', 'Subtotal']],
      body: productBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: {
        fillColor: [0, 168, 132],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 252, 250] },
      margin: { left: margin, right: margin },
    });

    // ── Sección Control de Empaque ─────────────────────────────────────────────
    const pageHeight = doc.internal.pageSize.getHeight();
    let yE = (doc as any).lastAutoTable.finalY + 10;

    // Si queda poco espacio en la página, saltar a nueva página
    if (yE + 70 > pageHeight - 12) {
      doc.addPage();
      yE = 20;
    }

    // Título sección
    doc.setFillColor(30, 30, 30);
    doc.rect(margin, yE, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTROL DE EMPAQUE Y ENVÍO', margin + 3, yE + 5);
    yE += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Función helper: dibuja un campo con label + línea para firma
    const drawField = (label: string, x: number, y: number, w: number, h: number = 14) => {
      // Borde del campo
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h);
      // Label pequeño arriba
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label.toUpperCase(), x + 2, y + 4.5);
      // Línea de escritura
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.line(x + 2, y + 10, x + w - 2, y + 10);
    };

    const colW = contentWidth / 2 - 1; // dos columnas con 2mm gap
    const col1x = margin;
    const col2x = margin + colW + 2;
    const fieldH = 16;
    const gap = 3;

    // Fila 1: Nombre de quien sacó | Nombre de quien verificó
    drawField('Nombre de quien sacó', col1x, yE, colW, fieldH);
    drawField('Nombre de quien verificó', col2x, yE, colW, fieldH);
    yE += fieldH + gap;

    // Fila 2: Hora de empaque | Cámara de empaque
    drawField('Hora de empaque', col1x, yE, colW, fieldH);
    drawField('Cámara de empaque', col2x, yE, colW, fieldH);
    yE += fieldH + gap;

    // Fila 3: Fecha (media columna) + espacio
    drawField('Fecha', col1x, yE, colW, fieldH);
    yE += fieldH + gap;

    // Fila 4: Número de cajas — fila completa con casillas numeradas
    const cajasH = 18;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(col1x, yE, contentWidth, cajasH);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('NÚMERO DE CAJAS', col1x + 2, yE + 4.5);

    // Casillas numeradas 1-20
    const totalCajas = 20;
    const cajasStartX = col1x + 36;
    const cajasAreaW = contentWidth - 38;
    const cajaW = cajasAreaW / totalCajas;
    const cajaY = yE + 5;
    const cajaH = 9;

    for (let i = 1; i <= totalCajas; i++) {
      const cx = cajasStartX + (i - 1) * cajaW;
      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.25);
      doc.rect(cx, cajaY, cajaW, cajaH);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(String(i), cx + cajaW / 2, cajaY + 6, { align: 'center' });
    }

    yE += cajasH + 2;

    // Footer generado
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
        'Content-Disposition': `attachment; filename="pedido-${raw.id}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
