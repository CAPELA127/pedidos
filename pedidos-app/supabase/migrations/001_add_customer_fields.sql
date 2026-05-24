-- Migration: Add customer data fields
-- Description: Adds phone, local_name, city, neighborhood, address fields to customers table
-- Run this in Supabase SQL Editor

-- Add new columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS local_name TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS address_normalized TEXT;

-- Create unique index on local_name + address_normalized
-- This allows same email in different locations
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_local_address
ON customers(local_name, address_normalized)
WHERE local_name IS NOT NULL AND address_normalized IS NOT NULL;

-- Update orders table to ensure it has updated_at
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
