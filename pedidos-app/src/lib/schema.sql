-- Supabase Schema para la App de Pedidos

-- 1. Tabla Customers (actualizada con datos de local y dirección)
CREATE TABLE Customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    local_name TEXT,              -- Nombre del local/negocio
    city TEXT,                    -- Ciudad (ej: Medellín)
    neighborhood TEXT,            -- Barrio (ej: Laureles)
    address TEXT,                 -- Dirección completa
    address_normalized TEXT,      -- Dirección normalizada para UNIQUE (minúsculas, sin espacios)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear índice único: mismo local + dirección = cliente único (permite múltiples emails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_local_address
ON Customers(local_name, address_normalized)
WHERE local_name IS NOT NULL AND address_normalized IS NOT NULL;

-- 2. Tabla Products (Catálogo Maestro)
CREATE TABLE Products (
    ref_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla Orders (con tracking de estado)
CREATE TABLE Orders (
    id TEXT PRIMARY KEY, -- Generaremos IDs legibles como ORD-1002
    customer_id UUID REFERENCES Customers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Empacado', 'Enviado')),
    total NUMERIC NOT NULL DEFAULT 0,
    delivery_address TEXT,             -- Dirección de entrega diferente a la del cliente (opcional)
    notes TEXT,                        -- Notas adicionales del pedido (instrucciones especiales, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MIGRACIÓN (ejecutar en Supabase SQL editor si la tabla ya existe):
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Tabla OrderItems
CREATE TABLE OrderItems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES Orders(id) ON DELETE CASCADE,
    product_ref TEXT REFERENCES Products(ref_code),
    quantity INTEGER NOT NULL,
    price_at_time NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserción de Datos de Prueba (Opcional, según la imagen)
INSERT INTO Products (ref_code, name, price, stock) VALUES 
('25872-2', 'CINTA CAPITAN COLORES SURTIDOS', 1500, 1000);
