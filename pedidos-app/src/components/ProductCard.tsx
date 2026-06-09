'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ProductCardProps {
  imageUrl: string;
  productRef: string;
  name: string;
  price?: number;
  initialQuantity?: number;
  isNewProduct?: boolean;
  onAddToCart: (quantity: number, price: number, name: string, ref: string, notes?: string, unit_type?: string) => void;
  onClose?: () => void;
  loading?: boolean;
  onIsNewChange?: (isNew: boolean) => void;
}

export default function ProductCard({
  imageUrl,
  productRef,
  name,
  price,
  initialQuantity,
  isNewProduct = false,
  onAddToCart,
  onClose,
  loading = false,
  onIsNewChange
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(initialQuantity ? String(initialQuantity) : '1');
  const [editPrice, setEditPrice] = useState(price ? String(price) : '');
  const [editName, setEditName] = useState(name === 'Producto Desconocido' ? '' : name);
  const [editRef, setEditRef] = useState(productRef);
  const [notes, setNotes] = useState('');
  const [unitType, setUnitType] = useState<'unidad' | 'docena' | 'box'>('unidad');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingRef, setIsValidatingRef] = useState(false);
  const [isCurrentlyNew, setIsCurrentlyNew] = useState(isNewProduct);

  const handleAddToCart = async () => {
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) { alert('Ingresa una cantidad válida'); return; }
    const finalPrice = parseInt(editPrice, 10);
    if (!finalPrice || finalPrice <= 0) { alert('Ingresa un precio válido'); return; }
    const finalName = editName.trim() || editRef;
    const finalRef = editRef.trim().toUpperCase() || productRef;

    setIsSubmitting(true);
    try {
      // Guardar automáticamente en inventario si es producto nuevo (sin requerir imagen)
      if (isNewProduct) {
        try {
          const formData = new FormData();
          formData.append('ref', finalRef);
          formData.append('name', finalName);
          formData.append('price', String(finalPrice));
          await fetch('/api/products', { method: 'POST', body: formData });
        } catch (err) {
          // Silencioso — el producto se agregará al pedido aunque falle el inventario
          console.warn('No se pudo guardar en inventario:', err);
        }
      }

      await onAddToCart(qty, finalPrice, finalName, finalRef, notes.trim() || undefined, unitType);
      setQuantity('1');
      setNotes('');
      setUnitType('unidad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = editPrice && quantity
    ? (parseInt(editPrice, 10) || 0) * (parseInt(quantity, 10) || 0)
    : 0;

  const validateRefInInventory = async () => {
    const refToCheck = editRef.trim().toUpperCase();
    if (!refToCheck || refToCheck.length < 1) return;

    setIsValidatingRef(true);
    try {
      const res = await fetch(`/api/inventory?q=${encodeURIComponent(refToCheck)}`);
      const data = await res.json();
      const found = data.products?.some((p: any) => p.ref === refToCheck);

      const newIsNew = !found;
      setIsCurrentlyNew(newIsNew);
      onIsNewChange?.(newIsNew);
    } catch (err) {
      console.warn('Error validating ref:', err);
      // En caso de error, asumir que no existe (es nuevo)
      setIsCurrentlyNew(true);
      onIsNewChange?.(true);
    } finally {
      setIsValidatingRef(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 w-full max-w-sm">
      {/* Imagen */}
      <div className="relative bg-gray-100 h-32">
        <img src={imageUrl} alt={editName || productRef} className="w-full h-full object-cover" />
        {onClose && (
          <button onClick={onClose} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100">
            <X size={15} className="text-gray-600" />
          </button>
        )}
        {!isNewProduct && (
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-mono px-2 py-0.5 rounded">
            {productRef}
          </span>
        )}
        {isNewProduct && (
          <span className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded">
            ⚠ No en inventario
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {/* Referencia editable — solo para productos nuevos */}
        {isNewProduct && (
          <div>
            <label className="text-xs font-semibold text-orange-600 block mb-0.5 flex items-center gap-1">
              ✏️ Referencia
              <span className="text-gray-400 font-normal">(edita si está incorrecta)</span>
            </label>
            <input
              type="text"
              value={editRef}
              onChange={e => setEditRef(e.target.value.toUpperCase())}
              onBlur={validateRefInInventory}
              placeholder="Ej: MASC-001"
              className="w-full px-3 py-1.5 border-2 border-orange-300 bg-orange-50 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase"
              disabled={loading || isSubmitting || isValidatingRef}
            />
            <p className="text-[10px] text-orange-500 mt-0.5">
              {isValidatingRef ? '⏳ Validando...' : '✅ Al agregar, se guardará en inventario automáticamente'}
            </p>
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-0.5">Producto</label>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Nombre del producto..."
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
            disabled={loading || isSubmitting}
          />
        </div>

        {/* Notas (color/variante/tipo) */}
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-0.5">
            Variante / Tipo <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={isNewProduct ? "Ej: Rojo, Talla L, Con cremallera..." : "Ej: BRILLO, TINTA, Color Rojo..."}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
            disabled={loading || isSubmitting}
          />
          {!isNewProduct && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              💡 Usa esto para diferenciar el mismo producto (ej: BRILLO vs TINTA)
            </p>
          )}
        </div>

        {/* Precio + Cantidad + Unidad */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-0.5">Precio (COP)</label>
            <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#00a884] overflow-hidden">
              <span className="pl-2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
                placeholder="0"
                className="flex-1 py-1.5 pr-2 text-sm bg-transparent outline-none"
                disabled={loading || isSubmitting}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-0.5">
              Cantidad
              {initialQuantity && (
                <span className="ml-1 text-[10px] bg-[#e8f8f4] text-[#00a884] px-1.5 py-0.5 rounded-full font-semibold">
                  📷 auto
                </span>
              )}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              min="1"
              placeholder="1"
              className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] ${
                initialQuantity ? 'border-[#00a884] bg-[#f0fdf8]' : 'border-gray-300'
              }`}
              disabled={loading || isSubmitting}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-0.5">Unidad</label>
            <select
              value={unitType}
              onChange={e => setUnitType(e.target.value as 'unidad' | 'docena' | 'box')}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] bg-white"
              disabled={loading || isSubmitting}
            >
              <option value="unidad">Unidad</option>
              <option value="docena">Docena</option>
              <option value="box">Box</option>
            </select>
          </div>
        </div>

        {/* Subtotal */}
        {subtotal > 0 && (
          <div className="bg-[#e8f8f4] px-3 py-1.5 rounded-lg flex justify-between items-center">
            <span className="text-xs text-gray-600">Subtotal:</span>
            <span className="text-sm font-bold text-[#00a884]">${subtotal.toLocaleString('es-CO')}</span>
          </div>
        )}

        {/* Botón */}
        <button
          onClick={handleAddToCart}
          disabled={loading || isSubmitting || !editPrice || !quantity}
          className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm ${
            loading || isSubmitting || !editPrice || !quantity
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
          }`}
        >
          <Plus size={16} />
          {isSubmitting ? 'Agregando...' : 'Agregar al pedido'}
        </button>
      </div>
    </div>
  );
}
