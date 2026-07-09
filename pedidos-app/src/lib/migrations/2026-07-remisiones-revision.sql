-- Migración: Revisión de secretaría antes de pasar la remisión al vendedor
-- Ejecutar en Supabase SQL Editor

ALTER TABLE remissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE; -- cuándo secretaría la guardó lista para facturar
