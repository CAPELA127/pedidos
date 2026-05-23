# ⚡ Quick Start - App de Pedidos

## 1. Configuración Inicial

### Prerrequisitos
- Node.js 18+
- Cuenta Supabase
- Git

### Variables de Entorno
Crea archivo `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Obtener credenciales
1. Ve a https://supabase.com
2. Abre tu proyecto
3. Settings → API → `NEXT_PUBLIC_SUPABASE_URL` y copia URL
4. Copia `anon` key (public/client-side)
5. Pega en `.env.local`

---

## 2. Crear Tablas en Supabase

Ve a SQL Editor en Supabase y ejecuta:

```sql
-- 1. Tabla Customers
CREATE TABLE Customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla Products
CREATE TABLE Products (
    ref_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla Orders
CREATE TABLE Orders (
    id TEXT PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES Customers(id),
    status TEXT NOT NULL DEFAULT 'Pendiente',
    total NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla OrderItems
CREATE TABLE OrderItems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES Orders(id) ON DELETE CASCADE,
    product_ref TEXT NOT NULL REFERENCES Products(ref_code),
    quantity INTEGER NOT NULL,
    price_at_time NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Insertar producto de prueba
INSERT INTO Products (ref_code, name, price, stock) VALUES 
('25872-2', 'CINTA CAPITAN COLORES SURTIDOS', 1500, 1000);

-- 6. Crear índices
CREATE INDEX idx_customers_email ON Customers(email);
CREATE INDEX idx_orders_customer_id ON Orders(customer_id);
CREATE INDEX idx_orderitems_order_id ON OrderItems(order_id);
```

---

## 3. Instalar Dependencias

```bash
npm install
```

---

## 4. Iniciar Servidor

```bash
npm run dev
```

Abre http://localhost:3000 (o el puerto que te diga)

---

## 5. Probar la App

### 👤 Chat - Crear Pedido

1. **Abre http://localhost:3000**
2. Bot pregunta: "¿Cuál es tu nombre?"
3. Escribe: `Juan Pérez`
4. Bot pregunta: "¿Cuál es tu email?"
5. Escribe: `juan@ejemplo.com`
6. Bot dice: "¡Bienvenido, Juan Pérez! 🎉"
7. Sube imagen (o pega Ctrl+V) con referencia
   - Bot hace OCR, detecta REF: `25872-2`
   - Bot pregunta: "¿Cuántas unidades?"
8. Escribe: `24`
9. Bot confirma: "✅ Agregado: 24 und de CINTA CAPITAN"
10. Repite con más productos (opcional)
11. Presiona: **Confirmar Pedido**
12. Bot dice: "🎉 ¡Pedido ORD-1234 confirmado!"

✅ **Pedido guardado en tabla `Orders`**

---

### 🛠️ Admin - Editar Pedido

1. **Abre http://localhost:3000/admin**
2. Deberías ver tu pedido en tabla (ORD-1234)
3. Columnas: Pedido | Cliente | Email | Productos | Total Und. | Fecha | Acción
4. Presiona: **"Editar Items"** (botón púrpura)
5. Se abre modal con:
   - Nombre producto
   - Cantidad: `24` (editable)
   - Precio: `$1.500` (editable)
   - Subtotal: `$36.000` (calculado)
6. Presiona: **"Editar"** (botón púrpura)
7. Cambia valores:
   - Cantidad: `30`
   - Precio: `$2.000`
8. Presiona: **"Guardar Cambios"** (botón verde)
9. Notificación: "✅ Pedido ORD-1234 actualizado. Total: $60.000"
10. Tabla se actualiza automáticamente

✅ **Cambios guardados en BD**

---

## 6. Verificar en Supabase

1. Ve a https://supabase.com
2. Abre tu proyecto
3. Table Editor
4. Verifica:

**Customers**
```
id: uuid-xxx
name: Juan Pérez
email: juan@ejemplo.com
phone: null
```

**Orders**
```
id: ORD-1234
customer_id: uuid-xxx
status: Pendiente
total: 60000 (después de edición)
```

**OrderItems**
```
order_id: ORD-1234
product_ref: 25872-2
quantity: 30
price_at_time: 2000
```

---

## 7. Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview build
npm run preview

# Lint
npm run lint

# Ver logs del servidor
# Verás en la terminal donde ejecutaste npm run dev
```

---

## 8. Troubleshooting

### Error: "NEXT_PUBLIC_SUPABASE_URL is not set"
- ✅ Verifica .env.local existe
- ✅ Verifica variables están presentes
- ✅ Reinicia servidor (Ctrl+C, npm run dev)

### Error: "relation 'customers' does not exist"
- ✅ Verifica tablas fueron creadas en Supabase
- ✅ Verifica estás usando nombre correcto (case sensitive)
- ✅ Intenta refrescar página

### Email no se guarda / Cliente no aparece
- ✅ Verifica en Supabase → Customers
- ✅ Revisa logs en consola (F12)
- ✅ Intenta con email diferente

### Modal no guarda cambios
- ✅ Verifica formulario está en modo "editar"
- ✅ Mira botón "Editar" (púrpura) vs "Guardar Cambios" (verde)
- ✅ Espera loading (no presiones 2 veces)

### Botón "Editar Items" deshabilitado
- ✅ ¿No hay items en el pedido? Agrega primero
- ✅ ¿Pendiente de carga? Espera a que cargue la tabla

---

## 9. Próximos Pasos

Después de verificar que funciona:

1. **Agregar más productos** (insert en tabla Products)
2. **Enviar email** con detalles del pedido
3. **Reportes** de ventas
4. **Dashboard** de métricas
5. **Integración** con sistema contable

Ver `IMPLEMENTATION.md` para detalles técnicos.

---

## 10. Estructura de Carpetas

```
pedidos-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── customers/route.ts    → Gestión clientes
│   │   │   ├── orders/
│   │   │   │   ├── route.ts          → GET/POST pedidos
│   │   │   │   └── [id]/route.ts     → GET/PUT pedido individual
│   │   │   ├── ocr/route.ts          → OCR server-side
│   │   │   └── export/route.ts       → Excel export
│   │   ├── admin/
│   │   │   └── page.tsx              → Dashboard admin
│   │   ├── layout.tsx                → Root layout
│   │   └── page.tsx                  → Home (chat)
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatInterface.tsx     → Chat principal
│   │   └── admin/
│   │       └── Dashboard.tsx         → Panel admin
│   ├── lib/
│   │   ├── supabase.ts              → Cliente Supabase
│   │   └── schema.sql               → Schema de BD
│   └── globals.css
├── .env.local                        → Variables de entorno
├── DATABASE.md                       → Documentación de BD
├── IMPLEMENTATION.md                 → Detalles técnicos
└── QUICKSTART.md                     → Este archivo
```

---

## 📞 URLs Importantes

| Recurso | URL |
|---------|-----|
| App Chat | http://localhost:3000 |
| Admin | http://localhost:3000/admin |
| Supabase | https://supabase.com |
| Documentación | `DATABASE.md` |

---

**¡Listo para comenzar! 🚀**

Si tienes dudas, revisa:
1. **QUICKSTART.md** (este archivo) - Setup rápido
2. **DATABASE.md** - Estructura de datos
3. **IMPLEMENTATION.md** - Detalles técnicos
4. **Logs en consola** (F12 en navegador)
5. **Logs del servidor** (terminal)
