-- Migration: Remove email unique constraint and ensure local_address unique constraint
-- Description: Removes the old customers_email_key constraint to allow same email in different locations
-- Run this in Supabase SQL Editor

-- Drop the old email unique constraint if it exists
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_email_key;

-- Drop the old local address index if it exists
DROP INDEX IF EXISTS idx_customers_local_address;

-- Create new unique index on local_name + address_normalized
-- This allows same email in different locations but prevents duplicate local+address combinations
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_local_address
ON customers(local_name, address_normalized)
WHERE local_name IS NOT NULL AND address_normalized IS NOT NULL;
