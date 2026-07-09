-- Migración: devoluciones/garantías por referencia (en vez de un monto suelto)
-- Cada renglón queda asociado a una referencia realmente facturada en esa
-- remisión, con su propia cantidad, precio y motivo.
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS remission_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remission_id TEXT REFERENCES remissions(id) ON DELETE CASCADE,
    product_ref TEXT NOT NULL,
    product_name TEXT,
    quantity NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remission_returns_remission ON remission_returns(remission_id);
