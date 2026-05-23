-- Supabase Schema para la App de Pedidos

-- 1. Tabla Customers
CREATE TABLE Customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla Products (Catálogo Maestro)
CREATE TABLE Products (
    ref_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla Orders
CREATE TABLE Orders (
    id TEXT PRIMARY KEY, -- Generaremos IDs legibles como ORD-1002
    customer_id UUID REFERENCES Customers(id),
    status TEXT NOT NULL DEFAULT 'Pendiente', -- Pendiente, Empacado, Enviado
    total NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
