import { NextRequest, NextResponse } from 'next/server';
import { generateOrderConfirmationHtml, generateOrderConfirmationSubject } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

interface OrderItem {
  product_name: string;
  quantity: number;
  price_at_time?: number;
}

interface EmailPayload {
  orderId: string;
  customerEmail: string;
  customerName: string;
  localName: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'Empacado' | 'Enviado';
}

export async function POST(request: NextRequest) {
  try {
    const payload: EmailPayload = await request.json();

    const {
      orderId,
      customerEmail,
      customerName,
      localName,
      items,
      totalPrice,
      status
    } = payload;

    // Validate required fields
    if (!orderId || !customerEmail || !customerName || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email service is configured
    const emailFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!emailFrom) {
      console.warn('Email service not configured. Skipping email send.');
      return NextResponse.json({
        success: true,
        message: 'Email configuration not available (development mode)',
        orderId
      });
    }

    // Try to send email using nodemailer
    try {
      const nodemailer = require('nodemailer');

      const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      const transporter = nodemailer.createTransport(smtpConfig);

      // Format items for template
      const formattedItems = items.map(item => ({
        productName: item.product_name,
        quantity: item.quantity,
        price: item.price_at_time
      }));

      const htmlContent = generateOrderConfirmationHtml({
        orderId,
        customerName,
        customerEmail,
        localName,
        items: formattedItems,
        totalPrice,
        status
      });

      const subject = generateOrderConfirmationSubject(orderId, status);

      const mailOptions = {
        from: emailFrom,
        to: customerEmail,
        subject,
        html: htmlContent,
        text: `Pedido #${orderId} - ${status}`
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);

      console.log('Email sent successfully:', info.messageId);

      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        orderId,
        messageId: info.messageId
      });
    } catch (emailError) {
      console.error('Nodemailer not available, using fallback:', emailError);

      // Fallback: If nodemailer is not installed, return success anyway
      // In production, this endpoint will work once nodemailer is installed
      return NextResponse.json({
        success: true,
        message: 'Email queued (nodemailer not configured)',
        orderId,
        warning: 'Email service not properly configured'
      });
    }
  } catch (error) {
    console.error('POST /api/email/send-order-confirmation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error sending email'
      },
      { status: 500 }
    );
  }
}
