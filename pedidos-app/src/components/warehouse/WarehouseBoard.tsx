'use client';

import React, { useState, useEffect } from 'react';
import { Check, Clock, Truck, MoreVertical, Printer } from 'lucide-react';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  id: string;
  customer: string;
  email: string;
  phone?: string;
  items: OrderItem[];
  total: number;
  status: 'Pendiente' | 'Empacado' | 'Enviado';
  date: string;
  total_items: number;
}

export default function WarehouseBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Pendiente' | 'Empacado' | 'Enviado' | 'all'>('Pendiente');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: order.items,
          status: newStatus
        })
      });

      if (res.ok) {
        setOrders(prev =>
          prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o)
        );
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter);

  const sortedOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Empacado':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Enviado':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pendiente':
        return <Clock size={16} />;
      case 'Empacado':
        return <Check size={16} />;
      case 'Enviado':
        return <Truck size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#00a884] to-[#008f6f] text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">📦 Bodega Principal</h1>
          <p className="text-sm text-white/80">Gestión de pedidos para empaque</p>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex gap-2 flex-wrap">
          {[
            { key: 'Pendiente', label: '⏳ Pendientes', count: orders.filter(o => o.status === 'Pendiente').length },
            { key: 'Empacado', label: '✅ Empacados', count: orders.filter(o => o.status === 'Empacado').length },
            { key: 'Enviado', label: '🚚 Enviados', count: orders.filter(o => o.status === 'Enviado').length },
            { key: 'all', label: '📊 Todos', count: orders.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                filter === tab.key
                  ? 'bg-[#00a884] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-[#00a884] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-600">Cargando pedidos...</p>
              </div>
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-500 text-lg font-medium">No hay pedidos para mostrar</p>
                <p className="text-gray-400 text-sm">Los pedidos aparecerán aquí cuando lleguen</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedOrders.map(order => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Order Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-lg font-bold text-gray-800">{order.id}</p>
                        <p className="text-xs text-gray-500">{order.date}</p>
                      </div>
                      <span
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="font-semibold text-gray-800">{order.customer}</p>
                    <p className="text-xs text-gray-600 truncate">{order.email}</p>
                    {order.phone && <p className="text-xs text-gray-600">{order.phone}</p>}
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3 border-b border-gray-200 max-h-48 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Items</p>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm bg-gray-50 p-2 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.ref}</p>
                          </div>
                          <div className="text-right whitespace-nowrap ml-2">
                            <p className="font-semibold text-gray-800">{item.quantity}</p>
                            <p className="text-xs text-gray-500">und</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Total unidades:</span>
                      <span className="font-semibold text-gray-800">{order.total_items}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold text-[#00a884]">
                        COP ${order.total.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 flex gap-2">
                    {order.status === 'Pendiente' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'Empacado')}
                        className="flex-1 bg-[#00a884] text-white py-2 rounded-lg font-medium hover:bg-[#008f6f] transition-colors flex items-center justify-center gap-2"
                      >
                        <Check size={16} />
                        Marcar Empacado
                      </button>
                    )}
                    {order.status === 'Empacado' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'Enviado')}
                        className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Truck size={16} />
                        Marcar Enviado
                      </button>
                    )}
                    <button className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2">
                      <Printer size={16} />
                      Imprimir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
