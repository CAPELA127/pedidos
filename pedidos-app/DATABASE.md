# Diseño de Base de Datos - Pedidos App

## Arquitectura General

La base de datos está diseñada con **separación de responsabilidades** usando 4 tablas principales:

```
Customers (Clientes)
    ↓ (customer_id)
Orders (Pedidos)
    ↓ (order_id)
OrderItems (Items del Pedido)
    ↓ (product_ref)
Products (Catálogo de Productos)
```

---

## Tablas y Estructura

### 1. **Customers** (Clientes)
Almacena información de los clientes que hacen pedidos.

```sql
CREATE TABLE Customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id` - UUID único (generado automáticamente)
- `name` - Nombre completo del cliente
- `phone` - Teléfono (único, no puede haber duplicados)
- `email` - Email (único, RECOMENDADO para identificar clientes)
- `created_at` - Fecha de registro

**Ejemplo:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Juan Pérez",
  "phone": "+573001234567",
  "email": "juan@ejemplo.com",
  "created_at": "2026-05-22T10:30:00Z"
}
```

---

### 2. **Products** (Catálogo de Productos)
Almacena el catálogo maestro de productos disponibles.

```sql
CREATE TABLE Products (
    ref_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `ref_code` - Referencia/SKU (clave primaria, ej: "25872-2")
- `name` - Nombre del producto
- `price` - Precio unitario (en COP)
- `stock` - Unidades disponibles
- `created_at` - Fecha de creación

**Ejemplo:**
```json
{
  "ref_code": "25872-2",
  "name": "CINTA CAPITAN COLORES SURTIDOS",
  "price": 1500,
  "stock": 1000,
  "created_at": "2026-05-22T10:30:00Z"
}
```

---

### 3. **Orders** (Encabezado del Pedido)
Almacena la información general de cada pedido.

```sql
CREATE TABLE Orders (
    id TEXT PRIMARY KEY,                    -- ORD-1002
    customer_id UUID NOT NULL,              -- Vinculado a Customers
    status TEXT DEFAULT 'Pendiente',        -- Pendiente, Empacado, Enviado
    total NUMERIC DEFAULT 0,                -- Total del pedido (suma de items)
    created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE Orders ADD CONSTRAINT fk_orders_customer 
  FOREIGN KEY (customer_id) REFERENCES Customers(id);
```

**Campos:**
- `id` - ID del pedido (texto legible: ORD-1002)
- `customer_id` - FK a Customers (quién hizo el pedido)
- `status` - Estado actual (Pendiente → Empacado → Enviado)
- `total` - Total del pedido (calculado automáticamente)
- `created_at` - Fecha del pedido

**Ejemplo:**
```json
{
  "id": "ORD-1002",
  "customer_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "Pendiente",
  "total": 36000,
  "created_at": "2026-05-22T15:45:00Z"
}
```

---

### 4. **OrderItems** (Detalles de cada Item del Pedido)
Almacena cada línea de producto en un pedido.

```sql
CREATE TABLE OrderItems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,                 -- FK a Orders
    product_ref TEXT NOT NULL,              -- FK a Products
    quantity INTEGER NOT NULL,              -- Cantidad pedida
    price_at_time NUMERIC NOT NULL,         -- Precio en el momento del pedido
    created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE OrderItems ADD CONSTRAINT fk_orderitems_order 
  FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE;

ALTER TABLE OrderItems ADD CONSTRAINT fk_orderitems_product 
  FOREIGN KEY (product_ref) REFERENCES Products(ref_code);
```

**Campos:**
- `id` - UUID único del item
- `order_id` - FK a Orders (a qué pedido pertenece)
- `product_ref` - FK a Products (qué producto)
- `quantity` - Cantidad solicitada
- `price_at_time` - Precio en el momento (congelado, no cambia si el precio de catálogo cambia)
- `created_at` - Fecha de creación

**Ejemplo:**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "order_id": "ORD-1002",
  "product_ref": "25872-2",
  "quantity": 24,
  "price_at_time": 1500,
  "created_at": "2026-05-22T15:45:00Z"
}
```

---

## Flujo de Datos: Del Chat al Admin

### 1️⃣ **Chat - Captura de Cliente**
```
Usuario escribe nombre + email
    ↓
POST /api/customers (nombre, email)
    ↓
Busca cliente por email en BD
  - Si existe: devuelve customer_id existente
  - Si no: crea nuevo cliente
    ↓
Se guarda customer_id en estado del chat (customerData)
```

### 2️⃣ **Chat - Captura de Productos**
```
Usuario sube foto
    ↓
OCR extrae REF (ej: "25872-2")
    ↓
Consulta Products tabla por ref_code
    ↓
Bot pregunta cantidad
    ↓
Se agregan items a orderItems[] (ref, name, quantity)
```

### 3️⃣ **Chat - Confirmación de Pedido**
```
Usuario presiona "Confirmar Pedido"
    ↓
POST /api/orders {
  id: "ORD-1002",
  customer_id: "uuid",
  customer_email: "juan@ejemplo.com",
  items: [
    { ref: "25872-2", quantity: 24, price: 1500 }
  ]
}
    ↓
Backend crea:
  1. Fila en Orders (customer_id, total = 1500*24 = 36000)
  2. Fila en OrderItems para cada item
```

### 4️⃣ **Admin - Ver Pedidos**
```
GET /api/orders
    ↓
JOINs automáticos:
  Orders → Customers (nombre, email)
  Orders → OrderItems → Products (nombre, ref)
    ↓
Dashboard muestra tabla con:
  - Nombre del cliente
  - Email del cliente
  - Cada item: nombre, ref, cantidad, precio unitario, subtotal
```

### 5️⃣ **Admin - Editar Pedido**
```
Admin abre modal de edición
    ↓
Cambia cantidades, precios de items
    ↓
Presiona "Guardar Cambios"
    ↓
PUT /api/orders/ORD-1002 {
  items: [ { ref, quantity, price } ],
  status: "Pendiente"
}
    ↓
Backend:
  1. Actualiza OrderItems (cantidad, precio)
  2. Recalcula total en Orders
  3. Retorna éxito
    ↓
Dashboard se actualiza sin recargar
```

---

## Relaciones y Constraints

### Claves Foráneas (Foreign Keys)

| De | Hacia | Campo | Comportamiento |
|---|---|---|---|
| Orders | Customers | customer_id | Restricción (no puedes eliminar cliente si tiene pedidos) |
| OrderItems | Orders | order_id | CASCADE (al eliminar pedido, se eliminan sus items) |
| OrderItems | Products | product_ref | Restricción (item debe referenciar producto válido) |

### Índices Recomendados

```sql
-- Para búsquedas rápidas
CREATE INDEX idx_customers_email ON Customers(email);
CREATE INDEX idx_orders_customer_id ON Orders(customer_id);
CREATE INDEX idx_orderitems_order_id ON OrderItems(order_id);
CREATE INDEX idx_orderitems_product_ref ON OrderItems(product_ref);
CREATE INDEX idx_orders_status ON Orders(status);
```

---

## Separación Cliente ↔ Pedido

### ¿Por qué separar?

```
❌ MALO (todo en una tabla):
┌─────────────────────────────────────┐
│ Orders                              │
├─────────────────────────────────────┤
│ id, customer_name, customer_email,  │
│ phone, item1_ref, item1_qty,        │
│ item2_ref, item2_qty, ...           │
└─────────────────────────────────────┘
❌ Datos duplicados, difícil de actualizar

✅ BIEN (tablas separadas):
┌──────────────┐      ┌────────────┐      ┌──────────────┐
│ Customers    │ ←─→  │ Orders     │ ←─→  │ OrderItems   │
├──────────────┤      ├────────────┤      ├──────────────┤
│ id           │      │ id         │      │ id           │
│ name         │      │ customer_id│      │ order_id     │
│ email        │      │ status     │      │ product_ref  │
│ phone        │      │ total      │      │ quantity     │
└──────────────┘      └────────────┘      └──────────────┘
✅ Datos centralizados, fácil de actualizar
```

### Ventajas de la Separación

| Aspecto | Beneficio |
|---------|-----------|
| **Integridad** | Cambiar email del cliente no afecta histórico de pedidos |
| **Escalabilidad** | Un cliente puede tener múltiples pedidos sin duplicación |
| **Actualizaciones** | Editar nombre del cliente se hace en 1 lugar |
| **Queries** | JOINs permiten obtener datos complejos fácilmente |
| **Auditoría** | Se ve exactamente qué cliente hizo qué pedido, cuándo |

---

## Queries Útiles

### Obtener todos los pedidos con cliente e items

```sql
SELECT 
  o.id,
  c.name,
  c.email,
  STRING_AGG(p.name || ' (×' || oi.quantity || ')', ', ') as items,
  o.status,
  o.total
FROM Orders o
JOIN Customers c ON o.customer_id = c.id
LEFT JOIN OrderItems oi ON o.id = oi.order_id
LEFT JOIN Products p ON oi.product_ref = p.ref_code
GROUP BY o.id, c.id, o.status, o.total
ORDER BY o.created_at DESC;
```

### Obtener un pedido con todos sus detalles

```sql
SELECT 
  o.*,
  c.name as customer_name,
  c.email as customer_email,
  json_agg(
    json_build_object(
      'ref', oi.product_ref,
      'name', p.name,
      'quantity', oi.quantity,
      'price', oi.price_at_time,
      'subtotal', oi.quantity * oi.price_at_time
    )
  ) as items
FROM Orders o
JOIN Customers c ON o.customer_id = c.id
LEFT JOIN OrderItems oi ON o.id = oi.order_id
LEFT JOIN Products p ON oi.product_ref = p.ref_code
WHERE o.id = 'ORD-1002'
GROUP BY o.id, c.id;
```

### Pedidos por cliente

```sql
SELECT 
  c.name,
  c.email,
  COUNT(o.id) as total_orders,
  SUM(o.total) as total_spent
FROM Customers c
LEFT JOIN Orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.email
ORDER BY total_spent DESC;
```

---

## Notas Importantes

1. **Email como identificador único** - Se usa email en el chat para buscar/crear clientes
2. **Price snapshot** - `price_at_time` en OrderItems congela el precio del momento
3. **Total automático** - El backend calcula el total al crear/actualizar pedido
4. **Cascading deletes** - Eliminar un Order elimina automáticamente sus OrderItems
5. **Status workflow** - Pendiente → Empacado → Enviado (unidireccional)

