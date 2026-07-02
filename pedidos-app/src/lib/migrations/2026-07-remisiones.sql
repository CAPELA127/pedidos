-- Migración: Remisiones de empaque
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla remissions: documento de lo que realmente se empacó de un pedido
CREATE TABLE IF NOT EXISTS remissions (
    id TEXT PRIMARY KEY,                                -- REM-XXXX
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    total NUMERIC NOT NULL DEFAULT 0,                   -- total real empacado
    packer_name TEXT,                                   -- nombre de quien sacó
    verifier_name TEXT,                                 -- nombre de quien verificó
    packing_time TEXT,                                  -- hora de empaque (ej: 11:50 am)
    packing_location TEXT,                              -- cámara/bodega de empaque
    packing_date TEXT,                                  -- fecha escrita en la hoja
    boxes_count INTEGER,                                -- número de cajas
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla remission_items: cada referencia con cantidad pedida vs empacada
CREATE TABLE IF NOT EXISTS remission_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remission_id TEXT REFERENCES remissions(id) ON DELETE CASCADE,
    product_ref TEXT NOT NULL,
    product_name TEXT,
    ordered_quantity INTEGER NOT NULL DEFAULT 0,        -- lo que pedía el pedido original (0 si es agregado)
    packed_quantity INTEGER NOT NULL DEFAULT 0,         -- lo que realmente se empacó (0 si agotado)
    price_at_time NUMERIC NOT NULL DEFAULT 0,
    unit_type TEXT DEFAULT 'unidad',
    item_status TEXT NOT NULL DEFAULT 'completo'
        CHECK (item_status IN ('completo', 'modificado', 'agotado', 'agregado')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remissions_order ON remissions(order_id);
CREATE INDEX IF NOT EXISTS idx_remission_items_remission ON remission_items(remission_id);
