'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ProductCardProps {
  imageUrl: string;
  ref: string;
  name: string;
  price?: number;
  onAddToCart: (quantity: number, price?: number) => void;
  onClose?: () => void;
  loading?: boolean;
}

export default function ProductCard({
  imageUrl,
  ref,
  name,
  price,
  onAddToCart,
  onClose,
  loading = false
}: ProductCardProps) {
  const [quantity, setQuantity] = useState<string>('1');
  const [editPrice, setEditPrice] = useState<string>(price ? String(price) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddToCart = async () => {
    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    const finalPrice = editPrice ? parseInt(editPrice, 10) : price;
    if (!finalPrice || finalPrice <= 0) {
      alert('Ingresa un precio válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddToCart(qty, finalPrice);
      setQuantity('1');
      setEditPrice(price ? String(price) : '');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 max-w-sm">
      {/* Imagen */}
      <div className="relative bg-gray-100 h-40">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-600" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        {/* Nombre */}
        <div>
          <p className="text-sm text-gray-500 font-medium">Producto</p>
          <p className="text-base font-semibold text-gray-800">{name}</p>
        </div>

        {/* Referencia */}
        <div>
          <p className="text-sm text-gray-500 font-medium">Referencia</p>
          <p className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
            {ref}
          </p>
        </div>

        {/* Precio */}
        <div>
          <label className="text-sm text-gray-500 font-medium block mb-1">
            Precio Unitario (COP)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">$</span>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="0"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent"
              disabled={loading || isSubmitting}
            />
          </div>
        </div>

        {/* Cantidad */}
        <div>
          <label className="text-sm text-gray-500 font-medium block mb-1">
            Cantidad
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            placeholder="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent"
            disabled={loading || isSubmitting}
          />
        </div>

        {/* Subtotal */}
        {editPrice && quantity && (
          <div className="bg-gray-50 px-3 py-2 rounded-lg flex justify-between items-center">
            <span className="text-sm text-gray-600">Subtotal:</span>
            <span className="font-semibold text-[#00a884]">
              COP ${(parseInt(editPrice, 10) * parseInt(quantity, 10)).toLocaleString('es-CO')}
            </span>
          </div>
        )}

        {/* Botón */}
        <button
          onClick={handleAddToCart}
          disabled={loading || isSubmitting || !editPrice || !quantity}
          className={`w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
            loading || isSubmitting || !editPrice || !quantity
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
          }`}
        >
          <Plus size={18} />
          {isSubmitting ? 'Agregando...' : 'Agregar al carrito'}
        </button>
      </div>
    </div>
  );
}
