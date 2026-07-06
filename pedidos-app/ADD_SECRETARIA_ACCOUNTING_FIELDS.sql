-- Migration: Add accounting fields for the "Secretaría" order-review workflow
-- Description: Adds discount %, tax %, estampilla, impoconsumo and id_plan_cuenta
-- to order_items, matching the columns of "plantilla-importar-documento.xlsx".
-- Run this in Supabase SQL Editor before using the Secretaría "Pedidos" tab.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS estampilla NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS impoconsumo NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS id_plan_cuenta TEXT;
