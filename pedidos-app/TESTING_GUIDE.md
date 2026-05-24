# Complete Testing Guide - Phase 5

This guide walks through testing the entire order management system in production (Vercel).

## Prerequisites

1. **Supabase Schema**: Run the migration in `supabase/migrations/001_add_customer_fields.sql`
2. **Email Configuration**: Set `SMTP_*` environment variables in Vercel
3. **Deployment**: Code pushed to GitHub (Vercel auto-deploys)

## Test Flows

### Flow 1: Customer Data Capture (7-Step Conversational Flow)

**URL:** https://pedidos-cami.vercel.app

**Steps:**
1. **Load app** → Bot asks "¿Cuál es tu nombre?"
2. **Enter name** (e.g., "Juan Pelaez") → Next: email
3. **Enter email** (e.g., "juan@example.com") → Next: phone
4. **Enter phone** (e.g., "3115555555") → Next: local name
5. **Enter local name** (e.g., "Tienda Juan") → Next: city
6. **Enter city** (e.g., "Medellín") → Next: neighborhood
7. **Enter neighborhood** (e.g., "Laureles") → Next: address
8. **Enter address** (e.g., "Cra 45 #95-23") → API saves to Supabase

**Expected Results:**
- ✅ Customer data saved in `customers` table
- ✅ Address normalized and stored
- ✅ Chat transitions to "ready" state
- ✅ Welcome message shows: "¡Bienvenido, Juan Pelaez! 🎉"
- ✅ ImageCapture component appears for photo selection

**DB Verification:**
```sql
SELECT id, name, email, phone, local_name, city, neighborhood, address 
FROM customers 
WHERE email = 'juan@example.com';
```

---

### Flow 2: OCR Photo Capture & Product Selection

**From:** Ready state (after completing 7-step flow)

**Steps:**
1. **Upload product photo** (e.g., product box with price/REF visible)
   - Can use camera (mobile) or file picker (desktop)
   - App shows image in chat
2. **OCR processes**:
   - Extracts reference code (REF: 25872-2)
   - Extracts price (e.g., COP 1500)
   - Returns product from INVENTARIO EL PUNTAZO
3. **Show product** with format: "✅ CINTA CAPITAN... 🏷️ 25872-2 💰 COP $1,500"
4. **Enter quantity** (e.g., "24")
5. **Confirm** → Product added to cart

**Expected Results:**
- ✅ Photo displays in chat
- ✅ OCR correctly extracts REF and price
- ✅ Product found in inventory or shows "No en inventario" warning
- ✅ Product displays with name, reference, and price
- ✅ Quantity input accepted (positive numbers only)
- ✅ System message: "✅ Agregado: 24 und de CINTA CAPITAN..."
- ✅ Order summary bar updates with total COP and unit count

**UI Check:**
- Cart shows: "1 productos (24 und) COP $36,000"
- "Confirmar Pedido" button enabled when items present

---

### Flow 3: Order Confirmation

**From:** Cart with items added

**Steps:**
1. **Click "Confirmar Pedido"**
2. **System:**
   - Generates order ID (ORD-XXXX)
   - Saves to `orders` table with status "Pendiente"
   - Saves items to `order_items` table
   - Returns success message

**Expected Results:**
- ✅ Message: "🎉 ¡Pedido ORD-1234 confirmado! La bodega ya lo recibió..."
- ✅ Order appears in admin dashboard (Pendientes tab)
- ✅ Order has correct total and item count

**DB Verification:**
```sql
SELECT id, customer_id, status, total, created_at 
FROM orders 
WHERE id = 'ORD-1234';

SELECT order_id, product_ref, quantity, price_at_time 
FROM order_items 
WHERE order_id = 'ORD-1234';
```

---

### Flow 4: Admin Dashboard & Email Notification

**URL:** https://pedidos-cami.vercel.app/admin

**Steps:**
1. **Load dashboard** → Tabs: Pendientes (1), Empacados (0), Enviados (0)
2. **Click on order** in "Pendientes" tab → Modal opens
3. **Verify customer details:**
   - ✅ Name, email, phone displayed
   - ✅ Local name, city, neighborhood shown
   - ✅ Complete address visible
4. **View products:**
   - ✅ Product list with REF, quantity, price
   - ✅ Calculate subtotal for each item
   - ✅ Total shown
5. **Change status to "Empacado":**
   - Option A: Click "Empacar" button (if Pendiente)
   - Option B: Use status dropdown in modal
6. **Verify order moves:** Pendientes (0) → Empacados (1)
7. **Check email:** Customer receives "Pedido #ORD-1234 Empacado" email

**Email Content Check:**
- ✅ Professional HTML layout
- ✅ Order ID and local name in header
- ✅ Customer name in greeting
- ✅ Status badge: "📦 Estado: Empacado"
- ✅ Complete product list with quantities and prices
- ✅ Total in COP format
- ✅ Professional footer

**Admin Actions:**
- ✅ Click "Editar productos" → Edit product quantities/prices
- ✅ Save changes → Total recalculates
- ✅ Status changes trigger email (only for Empacado)
- ✅ Move from Empacado → Enviado (no email required)

---

### Flow 5: Product Editing

**From:** Order modal in admin

**Steps:**
1. **Click "Editar productos"**
2. **Modify items:**
   - Change quantity (e.g., 24 → 30)
   - Change unit price (e.g., 1500 → 1800)
3. **Remove item** (optional)
4. **Click "Guardar"** → API updates order
5. **Verify total recalculates**

**Expected Results:**
- ✅ Items show in edit mode with input fields
- ✅ Quantities and prices can be modified
- ✅ Items can be deleted
- ✅ Subtotal updates in real-time
- ✅ Total amount recalculates on save
- ✅ Order total reflects changes in DB

---

## Integration Tests

### Test A: Complete Order Lifecycle

```
1. User completes 7-step flow → Customer created ✓
2. User uploads photo → OCR extracts product ✓
3. User enters quantity → Product added to cart ✓
4. User confirms → Order created (Pendiente) ✓
5. Admin edits → Products/prices updated ✓
6. Admin changes to Empacado → Email sent ✓
7. Admin changes to Enviado → Order complete ✓
```

### Test B: Email Delivery

**Setup:**
1. Configure SMTP in Vercel environment:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=your-email@gmail.com
   ```

2. Change order to "Empacado" in admin

3. **Verification:**
   - ✅ Check customer email inbox
   - ✅ Subject: "Pedido #ORD-XXXX Empacado - Bodega Principal"
   - ✅ Email received within 30 seconds
   - ✅ HTML rendered correctly (if using Gmail/Outlook)

### Test C: Mobile Responsiveness

**On mobile device:**
1. ✅ 7-step chat flows smoothly
2. ✅ Camera button available and functional
3. ✅ File picker works for photo selection
4. ✅ Drag & drop zone visible and usable
5. ✅ Order summary bar shows correctly
6. ✅ Admin dashboard table scrolls horizontally
7. ✅ Modal displays full screen (bottom sheet style)
8. ✅ Touch interactions work (dropdown, buttons)

### Test D: Error Handling

**Scenarios:**
1. **Invalid email** in flow:
   - ✅ Bot rejects: "❌ Email inválido"
   - ✅ User can re-enter

2. **Invalid phone** in flow:
   - ✅ Bot rejects: "❌ Teléfono inválido"
   - ✅ User can re-enter

3. **Bad photo quality** for OCR:
   - ✅ Shows: "❌ Imagen poco clara"
   - ✅ User can retake

4. **Network error** on order save:
   - ✅ Shows error message
   - ✅ User can retry

5. **Email service down**:
   - ✅ Order still saves to DB
   - ✅ Email error logged (doesn't block order)

---

## Performance Checks

### Load Times
- ✅ App loads in < 3 seconds
- ✅ Chat interaction latency < 1 second
- ✅ OCR processing: 2-5 seconds (acceptable)
- ✅ Admin dashboard loads in < 2 seconds
- ✅ Email sends in < 5 seconds

### Database
- ✅ No N+1 queries
- ✅ Orders list loads quickly (< 1s for 100 orders)
- ✅ Address normalization works
- ✅ Unique index prevents duplicate customers

---

## Checklist Before "Complete"

- [ ] User can complete 7-step flow
- [ ] Customer data saves to Supabase with all fields
- [ ] Photo OCR extracts REF and price correctly
- [ ] Products add to cart with prices
- [ ] Orders save with correct total
- [ ] Admin can view complete customer details
- [ ] Admin can edit product quantities/prices
- [ ] Admin can change status
- [ ] Email sends when status → "Empacado"
- [ ] Email HTML renders professionally
- [ ] Mobile camera works (if on mobile)
- [ ] Mobile dashboard responsive
- [ ] All error messages display correctly
- [ ] Performance acceptable (load times < 3s)

---

## Troubleshooting

### Issue: "Error al registrar: Could not find the 'address' column"
**Solution:** Run migration in Supabase SQL Editor

### Issue: Email not sending
**Solution:** 
- Check SMTP credentials in Vercel environment variables
- Verify SMTP_FROM is valid
- Check spam folder
- Look at server logs for error

### Issue: OCR very slow
**Solution:**
- Normal for Tesseract.js (2-5s is acceptable)
- User can type reference manually as fallback

### Issue: Admin dashboard shows old data
**Solution:**
- Click "Actualizar" button
- Or refresh page

---

## Production URL

**App:** https://pedidos-cami.vercel.app
**Admin:** https://pedidos-cami.vercel.app/admin

Test and report any issues found!
