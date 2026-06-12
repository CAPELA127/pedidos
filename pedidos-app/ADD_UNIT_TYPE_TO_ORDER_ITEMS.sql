-- Agregar columna unit_type a order_items para guardar el tipo de unidad de venta
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'unidad';

-- Valores esperados: 'unidad' | 'docena' | 'box'
-- Ejemplo: R1998 vendido por 'docena' vs R2000 vendido por 'unidad'
