-- Migration: Add vendor_name, delivery_address and notes to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
