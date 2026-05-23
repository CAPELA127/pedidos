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
  phone: string;
  items: OrderItem[];
  status: string;
  date: string;
  total_items: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Pendientes');
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

  const updateStatus = async (orderId: string, newStatus: string) => {
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    );
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

    // Detectar si hay cambios
    const hasChanges = JSON.stringify(selectedOrder.items) !== JSON.stringify(editingItems);

    if (!hasChanges) {
      const proceed = window.confirm('No hay cambios realizados. ¿Deseas guardar de todas formas?');
      if (!proceed) {
        closeModal();
        return;
      }
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editingItems,
          status: selectedOrder.status
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al guardar cambios');
      }

      // Actualizar el pedido en la tabla
      setOrders(prev =>
        prev.map(o =>
          o.id === selectedOrder.id
            ? {
                ...o,
                items: editingItems,
                total_items: editingItems.reduce((s, i) => s + i.quantity, 0)
              }
            : o
        )
      );

      // Mostrar notificación de éxito
      alert(`✅ Pedido ${selectedOrder.id} actualizado exitosamente. Total: $${data.total?.toLocaleString('es-CO') || '0'}`);

      closeModal();
    } catch (error) {
      alert(`❌ Error al guardar: ${error instanceof Error ? error.message : 'Intenta nuevamente'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = orders.filter(o => {
    const matchesTab = o.status === activeTab;
    const matchesSearch = !search ||
      o.customer?.toLowerCase().includes(search.toLowerCase()) ||
      o.id?.toLowerCase().includes(search.toLowerCase()) ||
      o.items?.some(i => i.ref?.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const handleExport = () => window.open('/api/export', '_blank');

  const TABS = [
    { key: 'Pendientes', label: 'Pendientes', Icon: Package, color: 'text-orange-500' },
    { key: 'Empacado', label: 'Empacados', Icon: CheckCircle, color: 'text-blue-500' },
    { key: 'Enviado', label: 'Enviados', Icon: Truck, color: 'text-green-500' },
  ];

  const counts = {
    Pendientes: orders.filter(o => o.status === 'Pendientes').length,
    Empacado: orders.filter(o => o.status === 'Empacado').length,
    Enviado: orders.filter(o => o.status === 'Enviado').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Panel de Bodega</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de pedidos en tiempo real</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={16} />
            Actualizar
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">
            <Download size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {TABS.map(({ key, label, Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all text-left ${activeTab === key ? 'border-[#00a884]' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{counts[key as keyof typeof counts]}</p>
                </div>
                <Icon size={24} className={color} />
              </div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, REF o número de pedido..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]/20"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Cargando órdenes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay pedidos en estado "{activeTab}"</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">Pedido</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Productos</th>
                  <th className="px-5 py-3 font-medium">Total Und.</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-gray-800">{order.id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{order.customer}</p>
                      <p className="text-xs text-gray-400">{order.phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{order.email || 'N/A'}</p>
                      <p className="text-xs text-gray-400">ID: {order.customer_id?.substring(0, 8) || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        {(order.items || []).map((item, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium text-gray-700">{item.name}</span>
                            <span className="text-xs text-gray-400 ml-1.5 font-mono">REF {item.ref}</span>
                            <span className="text-xs text-[#00a884] ml-1.5 font-semibold">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-800">{order.total_items}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{order.date}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 flex-col">
                        <button
                          onClick={() => openEditModal(order)}
                          className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors font-medium inline-flex items-center justify-center gap-1"
                        >
                          <Edit2 size={12} />
                          Editar Items
                        </button>
                        {activeTab === 'Pendientes' && (
                          <button
                            onClick={() => updateStatus(order.id, 'Empacado')}
                            className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                          >
                            Marcar Empacado
                          </button>
                        )}
                        {activeTab === 'Empacado' && (
                          <button
                            onClick={() => updateStatus(order.id, 'Enviado')}
                            className="text-xs bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors font-medium"
                          >
                            Marcar Enviado
                          </button>
                        )}
                        {activeTab === 'Enviado' && (
                          <span className="text-xs text-gray-400 italic">Completado</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal para editar items */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Editar Items - {selectedOrder.id}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedOrder.customer} • {selectedOrder.email}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2"
              >
                <X size={24} />
              </button>
            </div>

            {/* Items List */}
            <div className="p-6 space-y-4">
              {editingItems.map((item, index) => (
                <div
                  key={index}
                  className="border rounded-xl p-4 space-y-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{item.name}</h3>
                      <p className="text-xs text-gray-500">REF: {item.ref}</p>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => {
                          setEditingItems(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Cantidad */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Cantidad (und)
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateItemQuantity(index, parseInt(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-[#00a884] focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]/20"
                        />
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-[#00a884]">
                          {item.quantity}
                        </div>
                      )}
                    </div>

                    {/* Precio */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Precio Unitario (COP)
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={item.price || 0}
                          onChange={e => updateItemPrice(index, parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-blue-600 focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]/20"
                        />
                      ) : (
                        <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-blue-600">
                          ${(item.price || 0).toLocaleString('es-CO')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 font-medium">Subtotal:</span>
                      <span className="text-sm font-bold text-gray-800">
                        ${((item.price || 0) * item.quantity).toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {editingItems.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No hay items en este pedido</p>
                </div>
              )}
            </div>

            {/* Total */}
            {editingItems.length > 0 && (
              <div className="border-t bg-gray-50 p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-gray-600">Total Unidades:</span>
                  <span className="text-lg font-bold text-gray-800">
                    {editingItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-800">Total Pedido:</span>
                  <span className="text-2xl font-bold text-[#00a884]">
                    ${editingItems
                      .reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
                      .toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="border-t bg-white p-6 flex gap-3 justify-end sticky bottom-0">
              <button
                onClick={closeModal}
                className="px-6 py-2 border rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>

              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Editar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditingItems([...selectedOrder!.items]);
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={saveItemChanges}
                    disabled={isProcessing}
                    className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      isProcessing
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin">⏳</div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
