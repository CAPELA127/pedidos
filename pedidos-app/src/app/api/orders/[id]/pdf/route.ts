import { jsPDF } from 'jspdf';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  id: string;
  customer: string;
  email?: string;
  phone?: string;
  local_name?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  items: OrderItem[];
  status: string;
  total: number;
  created_at?: string;
}

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
        customers (name, email, phone, local_name, city, neighborhood, address),
        order_items (product_ref, product_name, quantity, price_at_time)
      `)
      .eq('id', orderId)
      .single();

    if (error || !raw) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      );
    }

    const c = raw.customers as unknown as { name: string; email: string; phone: string; local_name: string; city: string; neighborhood: string; address: string } | null;
    const order: Order = {
      id: raw.id,
      customer: c?.name || 'Sin nombre',
      email: c?.email,
      phone: c?.phone,
      local_name: c?.local_name,
      city: c?.city,
      neighborhood: c?.neighborhood,
      address: c?.address,
      status: raw.status,
      total: raw.total,
      created_at: raw.created_at,
      items: ((raw.order_items as any[]) || []).map((oi) => ({
        ref: oi.product_ref,
        name: oi.product_name || oi.product_ref,
        quantity: oi.quantity,
        price: oi.price_at_time,
      })),
    };

    // Generate PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Header
    doc.setFillColor(0, 168, 132); // #00a884
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('Arial', 'bold');
    doc.text('PEDIDO', margin, 15);

    doc.setFontSize(14);
    doc.setFont('Arial', 'normal');
    doc.text(order.id, margin, 25);

    yPosition = 40;

    // Order Info Box
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('Arial', 'bold');
    doc.text('INFORMACIÓN DEL PEDIDO', margin, yPosition);
    yPosition += 6;

    const infoBox = {
      x: margin,
      y: yPosition,
      width: contentWidth / 2 - 2,
      height: 24,
    };

    doc.setDrawColor(200, 200, 200);
    doc.rect(infoBox.x, infoBox.y, infoBox.width, infoBox.height);

    doc.setFontSize(9);
    doc.setFont('Arial', 'normal');
    doc.text(`Estado: ${order.status}`, infoBox.x + 3, infoBox.y + 6);
    doc.text(
      `Fecha: ${order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO') : 'N/A'}`,
      infoBox.x + 3,
      infoBox.y + 12
    );
    doc.text(
      `Total: COP $${(order.total || 0).toLocaleString('es-CO')}`,
      infoBox.x + 3,
      infoBox.y + 18
    );

    yPosition += 28;

    // Customer Details Section
    doc.setFontSize(10);
    doc.setFont('Arial', 'bold');
    doc.text('DATOS DEL CLIENTE', margin, yPosition);
    yPosition += 6;

    const customerDetails = [
      ['Cliente:', order.customer],
      ['Email:', order.email || 'N/A'],
      ['Teléfono:', order.phone || 'N/A'],
      ['Local/Negocio:', order.local_name || 'N/A'],
      ['Ciudad:', order.city || 'N/A'],
      ['Barrio:', order.neighborhood || 'N/A'],
      ['Dirección:', order.address || 'N/A'],
    ];

    doc.setFontSize(9);
    doc.setFont('Arial', 'normal');

    for (const [label, value] of customerDetails) {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFont('Arial', 'bold');
      doc.text(label, margin, yPosition);
      doc.setFont('Arial', 'normal');
      const splitText = doc.splitTextToSize(
        String(value),
        contentWidth - 50
      );
      doc.text(splitText, margin + 50, yPosition);
      yPosition += Math.max(5, splitText.length * 4);
    }

    yPosition += 4;

    // Products Section
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(10);
    doc.setFont('Arial', 'bold');
    doc.text('PRODUCTOS', margin, yPosition);
    yPosition += 8;

    // Table Header
    const col1 = margin;
    const col2 = margin + 50;
    const col3 = margin + 90;
    const col4 = margin + 120;
    const col5 = margin + 150;

    doc.setFillColor(240, 240, 240);
    doc.rect(col1 - 2, yPosition - 5, contentWidth + 4, 8, 'F');

    doc.setFontSize(8);
    doc.setFont('Arial', 'bold');
    doc.text('REF', col1, yPosition);
    doc.text('Producto', col2, yPosition);
    doc.text('Cant', col3, yPosition);
    doc.text('Precio', col4, yPosition);
    doc.text('Subtotal', col5, yPosition);

    yPosition += 6;
    doc.setFont('Arial', 'normal');

    let totalAmount = 0;
    for (const item of order.items) {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }

      const subtotal = (item.price || 0) * item.quantity;
      totalAmount += subtotal;

      doc.setFontSize(8);
      doc.text(item.ref, col1, yPosition);

      const productName = doc.splitTextToSize(item.name, 35);
      doc.text(productName, col2, yPosition);

      doc.text(String(item.quantity), col3, yPosition);
      doc.text(`COP $${(item.price || 0).toLocaleString('es-CO')}`, col4, yPosition);
      doc.text(`COP $${subtotal.toLocaleString('es-CO')}`, col5, yPosition);

      yPosition += Math.max(5, productName.length * 3.5) + 2;
    }

    // Total Line
    yPosition += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(col1 - 2, yPosition, pageWidth - margin + 2, yPosition);
    yPosition += 5;

    doc.setFontSize(10);
    doc.setFont('Arial', 'bold');
    doc.text('TOTAL:', col1, yPosition);
    doc.text(`COP $${order.total.toLocaleString('es-CO')}`, col5 - 20, yPosition);

    // Footer
    yPosition = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('Arial', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Generado: ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}`,
      margin,
      yPosition
    );
    doc.text(
      `Página ${(doc as any).internal.pages.length}`,
      pageWidth - margin - 20,
      yPosition
    );

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pedido-${order.id}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF' },
      { status: 500 }
    );
  }
}
