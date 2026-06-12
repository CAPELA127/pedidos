-- Migration: Add cc_nit (CC/NIT) field to customers table
-- This becomes the primary search/filter identifier for customers

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS cc_nit TEXT;

-- Index for fast search by cc_nit
CREATE INDEX IF NOT EXISTS idx_customers_cc_nit
ON customers(cc_nit)
WHERE cc_nit IS NOT NULL;
