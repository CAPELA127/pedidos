interface OrderConfirmationData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  localName: string;
  items: Array<{ productName: string; quantity: number; price?: number }>;
  totalPrice: number;
  status: 'Empacado' | 'Enviado';
}

export function generateOrderConfirmationHtml(data: OrderConfirmationData): string {
  const formattedTotal = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(data.totalPrice);

  const statusEmoji = data.status === 'Empacado' ? '📦' : '🚚';
  const statusText = data.status === 'Empacado' ? 'Empacado' : 'Enviado';

  const itemsHtml = data.items
    .map(item => {
      const itemTotal = item.price ? item.price * item.quantity : 0;
      const formattedPrice = item.price
        ? new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
          }).format(item.price)
        : 'N/A';
      const formattedItemTotal = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(itemTotal);

      return `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px; text-align: left;">${item.productName}</td>
          <td style="padding: 12px; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; text-align: right;">$${formattedPrice}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">$${formattedItemTotal}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pedido ${data.orderId}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #00a884 0%, #00c885 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 30px 20px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .status-badge {
          display: inline-block;
          background-color: #e8f5e9;
          border-left: 4px solid #00a884;
          padding: 12px 16px;
          margin: 20px 0;
          border-radius: 4px;
          font-weight: 600;
          color: #00a884;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        .order-details {
          background-color: #f9f9f9;
          padding: 16px;
          border-radius: 4px;
          margin: 16px 0;
          font-size: 14px;
        }
        .order-details p {
          margin: 8px 0;
        }
        .order-details strong {
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
        }
        table th {
          background-color: #f0f0f0;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #666;
          border-bottom: 2px solid #e0e0e0;
        }
        .total-row {
          background-color: #f9f9f9;
          font-weight: 600;
          font-size: 16px;
          color: #00a884;
        }
        .total-row td {
          padding: 12px;
          border-top: 2px solid #e0e0e0;
        }
        .footer {
          background-color: #f5f5f5;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
          border-top: 1px solid #e0e0e0;
        }
        .footer p {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusEmoji} Pedido #${data.orderId}</h1>
          <p>${data.localName}</p>
        </div>

        <div class="content">
          <div class="greeting">
            Hola <strong>${data.customerName}</strong>,
          </div>

          <p>Tu pedido ha sido <strong>${statusText.toLowerCase()}</strong> y está listo para continuar el proceso de envío.</p>

          <div class="status-badge">
            ${statusEmoji} Estado: ${statusText}
          </div>

          <div class="section-title">📦 Detalles del Pedido</div>
          <div class="order-details">
            <p><strong>Número de Pedido:</strong> ${data.orderId}</p>
            <p><strong>Local:</strong> ${data.localName}</p>
            <p><strong>Correo:</strong> ${data.customerEmail}</p>
          </div>

          <div class="section-title">📋 Productos</div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align: center;">Cantidad</th>
                <th style="text-align: right;">Precio Unit.</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Total:</td>
                <td style="text-align: right;">${formattedTotal}</td>
              </tr>
            </tbody>
          </table>

          <p style="margin-top: 24px; padding: 16px; background-color: #f0fef8; border-left: 4px solid #00a884; border-radius: 4px; font-size: 14px;">
            ✨ Gracias por tu pedido. Nos aseguramos de que llegue a ti en las mejores condiciones.
          </p>
        </div>

        <div class="footer">
          <p>Este es un mensaje automático de Bodega Principal</p>
          <p>Si tienes preguntas, responde a este correo</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateOrderConfirmationSubject(orderId: string, status: string): string {
  const statusText = status === 'Empacado' ? 'Empacado' : 'Enviado';
  return `Pedido #${orderId} ${statusText} - Bodega Principal`;
}
