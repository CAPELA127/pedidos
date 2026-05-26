-- Migration: Add Excel customer fields
-- Adds columns from "BASE DE DATOS CLIENTES" Excel to match all 949 customer records

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tipo_identificacion TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS primer_nombre TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segundo_nombre TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS primer_apellido TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segundo_apellido TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'Colombia';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telefono_2 TEXT;

-- Replace non-unique cc_nit index with unique (needed for upsert on import)
DROP INDEX IF EXISTS idx_customers_cc_nit;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_cc_nit_unique
ON customers(cc_nit)
WHERE cc_nit IS NOT NULL;
