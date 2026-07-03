'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Clock, Check, RefreshCw } from 'lucide-react';
import RemissionModal from '@/components/admin/RemissionModal';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  unit_type?: string;
  notes?: string;
}

interface Order {
  id: string;
  customer: string;
  city?: string;
  vendor_name?: string;
  delivery_address?: string;
  items: OrderItem[];
  status: string;
  date: string;
  total_items: number;
}

export default function BodegaBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Pendiente' | 'Empacado'>('Pendiente');
  const [remissionOrder, setRemissionOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error cargando pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(fetchOrders, 0);
    const interval = setInterval(fetchOrders, 8000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [fetchOrders]);

  const filteredOrders = orders.filter(o => o.status === filter);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#00a884] to-[#008f6f] text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📦 Bodega — Remisiones</h1>
            <p className="text-xs text-white/80">Empaca el pedido, toma la foto y envía</p>
          </div>
          <button onClick={fetchOrders} className="p-2 bg-white/15 rounded-full hover:bg-white/25 active:scale-95 transition-all" title="Actualizar">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 shadow-sm sticky top-[72px] z-10">
        <div className="max-w-3xl mx-auto flex gap-2">
          {([
            { key: 'Pendiente', label: '⏳ Por empacar', icon: <Clock size={14} /> },
            { key: 'Empacado', label: '✅ Empacados', icon: <Check size={14} /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${
                filter === tab.key
                  ? 'bg-[#00a884] text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              <span className="bg-white/25 px-1.5 py-0.5 rounded-full text-[11px] font-bold">
                {orders.filter(o => o.status === tab.key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-[#00a884] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Cargando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 font-medium">
                {filter === 'Pendiente' ? 'No hay pedidos por empacar 🎉' : 'Aún no hay pedidos empacados'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-100">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">{order.id}</p>
                    <p className="text-sm text-gray-600 truncate">{order.customer}</p>
                    <p className="text-xs text-gray-400">
                      {order.date}
                      {order.vendor_name ? ` · Vendedor: ${order.vendor_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[#00a884]">{order.total_items}</p>
                    <p className="text-[10px] text-gray-400 uppercase">unidades</p>
                  </div>
                </div>

                {/* Items resumidos */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 max-h-36 overflow-y-auto">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1">
                      <span className="text-gray-700 truncate">
                        <span className="font-mono text-gray-400">{item.ref}</span> · {item.name}
                        {item.notes ? <span className="italic text-gray-400"> ({item.notes})</span> : null}
                      </span>
                      <span className="font-bold text-gray-800 flex-shrink-0 ml-2">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3">
                  <button
                    onClick={() => setRemissionOrder(order)}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.99] transition-all"
                  >
                    <Camera size={17} />
                    {filter === 'Pendiente' ? 'Tomar foto y enviar remisión' : 'Nueva remisión'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de remisión (foto → IA → corregir → enviar) */}
      {remissionOrder && (
        <RemissionModal
          orderId={remissionOrder.id}
          customerName={remissionOrder.customer}
          onClose={() => setRemissionOrder(null)}
          onSaved={() => {
            setOrders(prev => prev.map(o => o.id === remissionOrder.id ? { ...o, status: 'Empacado' } : o));
          }}
        />
      )}
    </div>
  );
}
