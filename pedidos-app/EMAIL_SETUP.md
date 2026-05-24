# Email Notifications Setup

The app sends order confirmation emails when orders are packed using the `/api/email/send-order-confirmation` endpoint.

## Installation

First, install nodemailer and its types:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Configuration

### 1. Gmail (SMTP)

The easiest way to get started is using Gmail SMTP:

1. **Enable 2-Step Verification** in your Google Account
2. **Create an App Password**: Go to https://myaccount.google.com/apppasswords
3. **Copy the generated 16-character password**
4. **Update `.env.local`**:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=your-email@gmail.com
```

### 2. SendGrid (Recommended for Production)

For production, consider using SendGrid which is more reliable and has better deliverability:

1. **Create SendGrid account** at https://sendgrid.com
2. **Create an API key** in Settings → API Keys
3. **Install SendGrid package**:

```bash
npm install @sendgrid/mail
```

4. **Update the email endpoint** to use SendGrid instead of nodemailer

### 3. Other Providers

Supported providers:
- Resend (for Next.js apps): https://resend.com
- Mailgun: https://mailgun.com
- AWS SES: https://aws.amazon.com/ses/

## How It Works

### Order Status Change Flow

When an admin changes an order status from "Pendiente" to "Empacado":

1. **Admin Dashboard** calls `PATCH /api/orders/:id`
2. **API Route** updates the order status in Supabase
3. **API Route** calls `POST /api/email/send-order-confirmation` with order details
4. **Email Endpoint**:
   - Generates HTML email from template
   - Connects to SMTP server
   - Sends email to customer
   - Returns success/failure status

### Email Template

The email includes:
- Order ID and customer name
- Local/business name
- Product list with quantities and prices
- Total amount
- Order status (Empacado/Enviado)

## Testing

### Local Testing

1. **Use a test SMTP server** like [Ethereal Email](https://ethereal.email):
   - Create a free account
   - Get SMTP credentials
   - Update `.env.local`
   - Check sent emails in Ethereal inbox

2. **Skip email for development**:
   - Leave `SMTP_USER` and `SMTP_PASS` empty
   - Endpoint will return success without actually sending

### Production Testing

1. **Set environment variables in Vercel**:
   - Go to Vercel Project Settings
   - Environment Variables
   - Add: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

2. **Deploy to Vercel**:
   ```bash
   git push
   ```

3. **Test in production**:
   - Create a test order
   - Change status to "Empacado"
   - Verify email is received

## Troubleshooting

### "SMTP_HOST is not defined" Error
- Ensure `.env.local` has `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Restart the dev server after updating `.env.local`

### "Invalid credentials" or "Authentication failed"
- For Gmail: Verify you're using an **App Password**, not your regular Google password
- For other providers: Check your credentials are correct in the provider's dashboard

### Email not being sent
- Check server logs: `npm run dev` and look for errors
- Verify SMTP credentials are correct
- Check if your SMTP provider allows connections from your IP

### Gmail "Less secure apps" error
- Gmail deprecated "Less secure apps" - use **App Passwords** instead
- Generate an App Password at https://myaccount.google.com/apppasswords

## API Endpoint

### POST /api/email/send-order-confirmation

**Request Body:**
```json
{
  "orderId": "ORD-1234",
  "customerEmail": "customer@example.com",
  "customerName": "Juan Pelaez",
  "localName": "Tienda Juan",
  "items": [
    {
      "product_name": "Cinta Capitán Colores",
      "quantity": 24,
      "price_at_time": 1500
    }
  ],
  "totalPrice": 36000,
  "status": "Empacado"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "orderId": "ORD-1234",
  "messageId": "message-id@smtp-server"
}
```

## Next Steps

1. **Install nodemailer**: `npm install nodemailer @types/nodemailer`
2. **Configure SMTP**: Update `.env.local` with your email provider credentials
3. **Update Admin Dashboard**: Integrate email sending when status changes to "Empacado"
4. **Test**: Create an order and change status to verify email is sent
