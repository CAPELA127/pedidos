-- Migración: campos para que el Excel exportado por secretaría calce EXACTO
-- con el formato real de facturación (ver guía facturaA-971.xlsx):
-- Referencia/Cod. Barras, Cod. Barras, Nombre, Cantidad, Unidad de Medida,
-- Precio Unitario, Descuento, Impuesto, Total, Atributo, Costo, Costo_real, cantidad_develta.
--
-- Reemplaza el intento anterior (ADD_SECRETARIA_ACCOUNTING_FIELDS.sql: estampilla,
-- impoconsumo, id_plan_cuenta) que no existen en el formato real y ya no se usan
-- en el export ni en el editor de secretaría. Esas columnas quedan huérfanas en la
-- tabla pero no se tocan (no se borran datos existentes).
--
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS real_cost NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC DEFAULT 0;

-- "Atributo" de la guía se cubre con la columna `notes` que ya existe
-- (ADD_NOTES_TO_ORDER_ITEMS.sql, usada para variaciones como BRILLO/TINTA).
