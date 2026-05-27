'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ProductCardProps {
  imageUrl: string;
  productRef: string;
  name: string;
  price?: number;
  onAddToCart: (quantity: number, price: number, name: string) => void;
  onClose?: () => void;
  loading?: boolean;
}

export default function ProductCard({
  imageUrl,
  productRef,
  name,
  price,
  onAddToCart,
  onClose,
  loading = false
}: ProductCardProps) {
  const [quantity, setQuantity] = useState<string>('1');
  const [editPrice, setEditPrice] = useState<string>(price ? String(price) : '');
  const [editName, setEditName] = useState<string>(name === 'Producto Desconocido' ? '' : name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddToCart = async () => {
    const qty = parseInt(quantity, 10);
    if (qty <= 0 || isNaN(qty)) {
      alert('Ingresa una cantidad válida');
      return;
    }
    const finalPrice = parseInt(editPrice, 10);
    if (!finalPrice || finalPrice <= 0) {
      alert('Ingresa un precio válido');
      return;
    }
    const finalName = editName.trim() || productRef;

    setIsSubmitting(true);
    try {
      await onAddToCart(qty, finalPrice, finalName);
      setQuantity('1');
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = editPrice && quantity
    ? parseInt(editPrice, 10) * parseInt(quantity, 10)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 w-full max-w-sm">
      {/* Imagen */}
      <div className="relative bg-gray-100 h-36">
        <img src={imageUrl} alt={editName || productRef} className="w-full h-full object-cover" />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100"
          >
            <X size={16} className="text-gray-600" />
          </button>
        )}
        <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-mono px-2 py-0.5 rounded">
          {productRef}
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Nombre editable */}
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Producto</label>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Nombre del producto..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent"
            disabled={loading || isSubmitting}
          />
        </div>

        {/* Precio + Cantidad en fila */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Precio (COP)</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#00a884]">
              <span className="px-2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
                placeholder="0"
                className="flex-1 py-2 pr-2 text-sm bg-transparent outline-none"
                disabled={loading || isSubmitting}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Cantidad</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              min="1"
              placeholder="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
              disabled={loading || isSubmitting}
            />
          </div>
        </div>

        {/* Subtotal */}
        {subtotal > 0 && (
          <div className="bg-[#e8f8f4] px-3 py-1.5 rounded-lg flex justify-between items-center">
            <span className="text-xs text-gray-600">Subtotal:</span>
            <span className="text-sm font-bold text-[#00a884]">
              ${subtotal.toLocaleString('es-CO')}
            </span>
          </div>
        )}

        {/* Botón */}
        <button
          onClick={handleAddToCart}
          disabled={loading || isSubmitting || !editPrice || !quantity}
          className={`w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm ${
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
