-- Migración: Liquidación de remisiones (descuento, flete, devoluciones)
-- Ejecutar en Supabase SQL Editor

ALTER TABLE remissions ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;   -- descuento en % (entero)
ALTER TABLE remissions ADD COLUMN IF NOT EXISTS freight_value NUMERIC NOT NULL DEFAULT 0;      -- valor del flete
ALTER TABLE remissions ADD COLUMN IF NOT EXISTS returns_value NUMERIC NOT NULL DEFAULT 0;      -- valor devoluciones / daños
ALTER TABLE remissions ADD COLUMN IF NOT EXISTS returns_reason TEXT;                           -- explicación de la deducción
ALTER TABLE remissions ADD COLUMN IF NOT EXISTS liquidated_total NUMERIC;                      -- total después de deducciones
ALTER TABLE remissions ADD COLUMN IF NOT EXISTS liquidated_at TIMESTAMP WITH TIME ZONE;        -- cuándo se liquidó
