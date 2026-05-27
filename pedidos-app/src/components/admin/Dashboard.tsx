"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, CheckCircle, Package, Truck, RefreshCw, X, Edit2, Save } from 'lucide-react';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  id: string;
  customer: string;
  email?: string;
  customer_id?: string;
  phone?: string;
  local_name?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  items: OrderItem[];
  status: string;
  date: string;
  total: number;
  total_items: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Pendiente');
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Actualiza estado y persiste en BD + envía email si es "Empacado"
  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Pedido no encontrado');

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Error al actualizar estado');

      // Enviar email si cambia a "Empacado"
      if (newStatus === 'Empacado' && order.email) {
        const emailPayload = {
          orderId: order.id,
          customerEmail: order.email,
          customerName: order.customer,
          localName: order.local_name || 'Bodega',
          items: order.items.map(item => ({
            product_name: item.name,
            quantity: item.quantity,
            price_at_time: item.price
          })),
          totalPrice: order.total,
          status: 'Empacado'
        };

        try {
          const emailRes = await fetch('/api/email/send-order-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
          });
          if (!emailRes.ok) {
            console.warn('Email no se envió, pero el pedido fue actualizado');
          }
        } catch (emailError) {
          console.warn('Error enviando email:', emailError);
        }
      }

      setOrders(prev =>
        prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
      );
    } catch (e) {
      alert('❌ No se pudo actualizar el estado. Intenta nuevamente.');
      console.error(e);
    }
  };

  const openEditModal = (order: Order) => {
    setSelectedOrder(order);
    setEditingItems([...order.items]);
    setIsEditing(false);
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setEditingItems([]);
    setIsEditing(false);
  };

  const updateItemQuantity = (index: number, newQuantity: number) => {
    setEditingItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, newQuantity) } : item
      )
    );
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    setEditingItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, price: Math.max(0, newPrice) } : item
      )
    );
  };

  const saveItemChanges = async () => {
    if (!selectedOrder) return;
    const hasChanges = JSON.stringify(selectedOrder.items) !== JSON.stringify(editingItems);
    if (!hasChanges) {
      const proceed = window.confirm('No hay cambios. ¿Guardar de todas formas?');
      if (!proceed) { closeModal(); return; }
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editingItems, status: selectedOrder.status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error al guardar cambios');

      setOrders(prev =>
        prev.map(o =>
          o.id === selectedOrder.id
            ? { ...o, items: editingItems, total_items: editingItems.reduce((s, i) => s + i.quantity, 0), total: data.total || 0 }
            : o
        )
      );
      alert(`✅ Pedido ${selectedOrder.id} actualizado. Total: $${data.total?.toLocaleString('es-CO') || '0'}`);
      closeModal();
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Intenta nuevamente'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = orders.filter(o => {
    const matchesTab = o.status === activeTab;
    const matchesSearch = !search ||
      o.customer?.toLowerCase().includes(search.toLowerCase()) ||
      o.id?.toLowerCase().includes(search.toLowerCase()) ||
      o.items?.some(i => i.ref?.toLowerCase().includes(search.toLowerCase()) || i.name?.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const handleExport = () => window.open('/api/export', '_blank');

  const downloadPDF = (orderId: string) => {
    const link = document.createElement('a');
    link.href = `/api/orders/${orderId}/pdf`;
    link.download = `pedido-${orderId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TABS = [
    { key: 'Pendiente', label: 'Pendientes', Icon: Package, color: 'text-orange-500' },
    { key: 'Enviado', label: 'Enviados', Icon: Truck, color: 'text-green-500' },
  ];

  const counts = {
    Pendiente: orders.filter(o => o.status === 'Pendiente').length,
    Enviado: orders.filter(o => o.status === 'Enviado').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Panel de Bodega</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Gestión de pedidos en tiempo real</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm">
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm">
            <Download size={14} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      <div className="px-4 md:px-8 py-4 md:py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {TABS.map(({ key, label, Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`bg-white rounded-xl p-3 md:p-4 shadow-sm border-2 transition-all text-left ${activeTab === key ? 'border-[#00a884]' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-0.5">{counts[key as keyof typeof counts]}</p>
                </div>
                <Icon size={20} className={color} />
              </div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, REF o número de pedido..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#00a884]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabla — scroll horizontal en mobile */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Cargando órdenes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay pedidos en estado "{activeTab}"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[680px]">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 font-medium">Productos</th>
                    <th className="px-4 py-3 font-medium">Und.</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Fecha</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-gray-800 text-sm">{order.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 text-sm">{order.customer}</p>
                        <p className="text-xs text-gray-400 md:hidden">{order.email}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-gray-600">{order.email || 'N/A'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 max-w-[200px]">
                          {(order.items || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="font-medium text-gray-700">{item.name}</span>
                              <span className="text-gray-400 ml-1">×{item.quantity}</span>
                            </div>
                          ))}
                          {(order.items || []).length > 3 && (
                            <p className="text-xs text-[#00a884]">+{order.items.length - 3} más</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-800">{order.total_items}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{order.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-col">
                          <button
                            onClick={() => openEditModal(order)}
                            className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 transition-colors font-medium inline-flex items-center justify-center gap-1 whitespace-nowrap"
                          >
                            <Edit2 size={11} />
                            Editar
                          </button>
                          {activeTab === 'Pendiente' && (
                            <button
                              onClick={() => updateStatus(order.id, 'Enviado')}
                              className="text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors font-medium whitespace-nowrap"
                            >
                              Enviar
                            </button>
                          )}
                          {activeTab === 'Enviado' && (
                            <span className="text-xs text-gray-400 italic">✓ Listo</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal editar items */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 sm:p-6 z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-800">{selectedOrder.id}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selectedOrder.customer} • {selectedOrder.email}
                  </p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-2">
                  <X size={22} />
                </button>
              </div>

              {/* Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
                {selectedOrder.phone && (
                  <div className="text-sm">
                    <span className="text-gray-600">Teléfono:</span>
                    <p className="font-medium text-gray-800">{selectedOrder.phone}</p>
                  </div>
                )}
                {selectedOrder.local_name && (
                  <div className="text-sm">
                    <span className="text-gray-600">Local/Negocio:</span>
                    <p className="font-medium text-gray-800">{selectedOrder.local_name}</p>
                  </div>
                )}
                {selectedOrder.city && (
                  <div className="text-sm">
                    <span className="text-gray-600">Ciudad:</span>
                    <p className="font-medium text-gray-800">{selectedOrder.city}</p>
                  </div>
                )}
                {selectedOrder.neighborhood && (
                  <div className="text-sm">
                    <span className="text-gray-600">Barrio:</span>
                    <p className="font-medium text-gray-800">{selectedOrder.neighborhood}</p>
                  </div>
                )}
                {selectedOrder.address && (
                  <div className="text-sm sm:col-span-2">
                    <span className="text-gray-600">Dirección:</span>
                    <p className="font-medium text-gray-800">{selectedOrder.address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="p-4 sm:p-6 space-y-3">
              {editingItems.map((item, index) => (
                <div key={index} className="border rounded-xl p-4 space-y-3 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">REF: {item.ref}</p>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => setEditingItems(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 text-xs font-medium ml-2 flex-shrink-0"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                      {isEditing ? (
                        <input
                          type="number" min="1" value={item.quantity}
                          onChange={e => updateItemQuantity(index, parseInt(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-[#00a884] focus:outline-none focus:border-[#00a884]"
                        />
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-[#00a884]">
                          {item.quantity} und
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unitario</label>
                      {isEditing ? (
                        <input
                          type="number" min="0" value={item.price || 0}
                          onChange={e => updateItemPrice(index, parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-blue-600 focus:outline-none focus:border-[#00a884]"
                        />
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-blue-600">
                          ${(item.price || 0).toLocaleString('es-CO')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="text-xs text-gray-500">Subtotal:</span>
                    <span className="text-sm font-bold text-gray-800">
                      ${((item.price || 0) * item.quantity).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ))}

              {editingItems.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Package size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay items en este pedido</p>
                </div>
              )}
            </div>

            {/* Total */}
            {editingItems.length > 0 && (
              <div className="border-t bg-gray-50 px-4 sm:px-6 py-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total unidades:</span>
                  <span className="font-bold text-gray-800">{editingItems.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800">Total pedido:</span>
                  <span className="text-xl font-bold text-[#00a884]">
                    ${editingItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="border-t bg-white p-4 sm:p-6 space-y-3 sticky bottom-0">
              {/* Estado dropdown */}
              {selectedOrder.status === 'Pendiente' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <select
                    value={selectedOrder.status}
                    onChange={e => updateStatus(selectedOrder.id, e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:border-[#00a884] bg-white"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Empacado">Empacar</option>
                  </select>
                </div>
              )}
              {selectedOrder.status === 'Empacado' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <select
                    value={selectedOrder.status}
                    onChange={e => updateStatus(selectedOrder.id, e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:border-[#00a884] bg-white"
                  >
                    <option value="Empacado">Empacado</option>
                    <option value="Enviado">Enviar</option>
                  </select>
                </div>
              )}

              {/* Botones edición */}
              <div className="flex gap-2 justify-end flex-wrap">
                <button
                  onClick={() => downloadPDF(selectedOrder.id)}
                  className="px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center gap-1.5"
                >
                  <Download size={14} /> Descargar PDF
                </button>
                <button onClick={closeModal} className="px-4 py-2 border rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Cerrar
                </button>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-1.5"
                  >
                    <Edit2 size={14} /> Editar productos
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setIsEditing(false); setEditingItems([...selectedOrder!.items]); }}
                      className="px-4 py-2 border rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={saveItemChanges}
                      disabled={isProcessing}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${isProcessing ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                      {isProcessing ? 'Guardando...' : <><Save size={14} /> Guardar</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
