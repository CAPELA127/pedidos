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
        order_items (product_ref, product_name, quantity, price_at_time)
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
      name: inventarioMap[oi.product_ref] || oi.product_name || oi.product_ref,
      quantity: oi.quantity,
      price: oi.price_at_time,
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
      return [
        item.ref,
        item.name,
        item.quantity,
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
      head: [['REF', 'Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
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
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 32, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [248, 252, 250] },
      margin: { left: margin, right: margin },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
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
