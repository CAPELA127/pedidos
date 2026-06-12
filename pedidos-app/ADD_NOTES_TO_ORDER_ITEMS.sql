-- Agregar columna notes a order_items para guardar variaciones
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Ejemplo: R1998 con notes='BRILLO' y R1998 con notes='TINTA' serán dos líneas diferentes
