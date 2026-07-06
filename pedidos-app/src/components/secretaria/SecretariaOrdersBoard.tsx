'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, RefreshCw, X, Save, FileSpreadsheet, Package } from 'lucide-react';

interface OrderListItem {
  id: string;
  customer: string;
  email?: string;
  status: string;
  date: string;
  total: number;
  total_items: number;
}

interface SecretariaItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  unit_type?: string;
  notes?: string;
  discount_percent: number;
  tax_percent: number;
  estampilla: number;
  impoconsumo: number;
  id_plan_cuenta: string;
}

interface OrderDetail {
  id: string;
  customer: string;
  status: string;
  items: SecretariaItem[];
}

// Misma fórmula que la plantilla de importación contable y que el backend —
// se recalcula en vivo mientras la secretaria edita, antes de guardar.
const computeSubtotal = (item: SecretariaItem) => {
  const price = item.price || 0;
  const qty = item.quantity || 0;
  return price * qty - (price * qty) * ((item.discount_percent || 0) / 100);
};
const computeTotal = (item: SecretariaItem) => {
  const qty = item.quantity || 0;
  const subtotal = computeSubtotal(item);
  return subtotal * ((item.tax_percent || 0) / 100 + 1) + (item.estampilla || 0) * qty + (item.impoconsumo || 0) * qty;
};

export default function SecretariaOrdersBoard() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [editingItems, setEditingItems] = useState<SecretariaItem[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openOrder = async (orderId: string) => {
    setIsLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error cargando el pedido');
      const order = data.order;
      setSelectedOrder({ id: order.id, customer: order.customer, status: order.status, items: order.items });
      setEditingItems(order.items.map((i: SecretariaItem) => ({
        ref: i.ref, name: i.name, quantity: i.quantity, price: i.price, unit_type: i.unit_type, notes: i.notes,
        discount_percent: i.discount_percent || 0,
        tax_percent: i.tax_percent || 0,
        estampilla: i.estampilla || 0,
        impoconsumo: i.impoconsumo || 0,
        id_plan_cuenta: i.id_plan_cuenta || '',
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando el pedido');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeOrder = () => {
    setSelectedOrder(null);
    setEditingItems([]);
    setError(null);
  };

  const updateItem = (index: number, patch: Partial<SecretariaItem>) => {
    setEditingItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const save = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editingItems, status: selectedOrder.status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error guardando el pedido');
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, total: data.total || 0 } : o));
      setSelectedOrder(prev => prev ? { ...prev, items: editingItems } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando el pedido');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = orders.filter(o =>
    !search || o.customer?.toLowerCase().includes(search.toLowerCase()) || o.id?.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = editingItems.reduce((s, i) => s + computeTotal(i), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white p-4 shadow-lg sticky top-0 z-10" style={{ background: '#7c3aed' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">🗂️ Secretaría — Pedidos</h1>
            <p className="text-xs text-white/80">Revisa, corrige y exporta cada pedido en el formato contable</p>
          </div>
          <button onClick={fetchOrders} className="p-2 bg-white/15 rounded-full hover:bg-white/25 active:scale-95 transition-all" title="Actualizar">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente o número de pedido..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Cargando pedidos...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay pedidos</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(order => (
                <button
                  key={order.id}
                  onClick={() => openOrder(order.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-800 text-sm">{order.id}</p>
                    <p className="text-sm text-gray-600 truncate">{order.customer}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#7c3aed]">${(order.total || 0).toLocaleString('es-CO')}</p>
                    <p className="text-[10px] text-gray-400">{order.total_items} und · {order.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal editor formato contable */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-5xl max-h-[94vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 sm:p-6 z-10 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedOrder.id}</h2>
                <p className="text-sm text-gray-500">{selectedOrder.customer}</p>
              </div>
              <button onClick={closeOrder} className="text-gray-400 hover:text-gray-600 p-2">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {isLoadingDetail ? (
              <div className="p-12 text-center text-gray-400">Cargando...</div>
            ) : (
              <div className="p-4 sm:p-6">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                        <th className="px-2 py-2 text-left">Referencia</th>
                        <th className="px-2 py-2 text-left">Nombre</th>
                        <th className="px-2 py-2 text-right">P. Unitario</th>
                        <th className="px-2 py-2 text-right">Cant.</th>
                        <th className="px-2 py-2 text-right">Desc. %</th>
                        <th className="px-2 py-2 text-right">Imp. %</th>
                        <th className="px-2 py-2 text-right">SubTotal</th>
                        <th className="px-2 py-2 text-right">Estampilla</th>
                        <th className="px-2 py-2 text-right">Impoconsumo</th>
                        <th className="px-2 py-2 text-right">Total</th>
                        <th className="px-2 py-2 text-left">id_plan_cuenta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editingItems.map((item, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 font-mono">{item.ref}</td>
                          <td className="px-2 py-1.5">{item.name}</td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={item.price ?? 0}
                              onChange={e => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                              className="w-24 px-1.5 py-1 border rounded text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={item.quantity}
                              onChange={e => updateItem(i, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-16 px-1.5 py-1 border rounded text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" max="100" value={item.discount_percent}
                              onChange={e => updateItem(i, { discount_percent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                              className="w-16 px-1.5 py-1 border rounded text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={item.tax_percent}
                              onChange={e => updateItem(i, { tax_percent: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-16 px-1.5 py-1 border rounded text-right" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-700 bg-gray-50">
                            ${computeSubtotal(item).toLocaleString('es-CO')}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={item.estampilla}
                              onChange={e => updateItem(i, { estampilla: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-20 px-1.5 py-1 border rounded text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={item.impoconsumo}
                              onChange={e => updateItem(i, { impoconsumo: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-20 px-1.5 py-1 border rounded text-right" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-[#7c3aed] bg-purple-50">
                            ${computeTotal(item).toLocaleString('es-CO')}
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={item.id_plan_cuenta}
                              onChange={e => updateItem(i, { id_plan_cuenta: e.target.value })}
                              className="w-20 px-1.5 py-1 border rounded" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-4 border-t pt-4">
                  <span className="text-sm text-gray-600">Total del pedido</span>
                  <span className="text-xl font-bold text-[#7c3aed]">${grandTotal.toLocaleString('es-CO')}</span>
                </div>
              </div>
            )}

            <div className="border-t bg-white p-4 sm:p-6 flex gap-2 justify-end flex-wrap sticky bottom-0">
              <a
                href={`/api/orders/${selectedOrder.id}/excel-contable`}
                className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center gap-1.5"
              >
                <FileSpreadsheet size={14} /> Descargar Excel
              </a>
              <a
                href={`/api/orders/${selectedOrder.id}/pdf`}
                className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-1.5"
              >
                <Download size={14} /> Descargar PDF
              </a>
              <button onClick={closeOrder} className="px-4 py-2 border rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
                Cerrar
              </button>
              <button
                onClick={save}
                disabled={isSaving}
                className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm font-medium hover:bg-[#6d28d9] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? 'Guardando...' : <><Save size={14} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
