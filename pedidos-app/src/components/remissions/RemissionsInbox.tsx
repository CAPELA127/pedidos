'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, User, LogOut, Package, CheckCircle2 } from 'lucide-react';
import { VENDORS } from '@/lib/vendors';

interface RemissionListItem {
  id: string;
  ref: string;
  name: string;
  ordered_quantity: number;
  packed_quantity: number;
  price: number;
  unit_type: string;
  status: 'completo' | 'modificado' | 'agotado' | 'agregado';
}

interface Remission {
  id: string;
  order_id: string;
  total: number;
  packer_name?: string | null;
  boxes_count?: number | null;
  created_at: string;
  reviewed_at: string | null;
  vendor_name: string;
  customer: string;
  city: string;
  delivery_address: string;
  total_units: number;
  counts: { completo: number; modificado: number; agotado: number; agregado: number };
  items: RemissionListItem[];
}

const ITEM_STATUSES: RemissionListItem['status'][] = ['completo', 'modificado', 'agotado', 'agregado'];

interface Props {
  role: 'vendedor' | 'secretaria';
}

const STATUS_BADGES: Record<string, { badge: string; label: string }> = {
  completo:   { badge: 'bg-green-100 text-green-700',   label: 'completos' },
  modificado: { badge: 'bg-yellow-100 text-yellow-800', label: 'modificados' },
  agotado:    { badge: 'bg-red-100 text-red-700',       label: 'agotados' },
  agregado:   { badge: 'bg-blue-100 text-blue-700',     label: 'agregados' },
};

const LAST_SEEN_KEY = (role: string, vendor: string) => `pedidos_remissions_seen_${role}_${vendor || 'all'}`;

export default function RemissionsInbox({ role }: Props) {
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [remissions, setRemissions] = useState<Remission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, { packed_quantity: number; status: RemissionListItem['status'] }>>({});
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Marcador de "última vez visto": lo creado después de esto se resalta como nuevo
  const [lastSeenAt, setLastSeenAt] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);

  const isVendor = role === 'vendedor';
  const themeColor = isVendor ? '#00a884' : '#7c3aed';

  // Hidratar el nombre del vendedor desde localStorage (async para no
  // disparar renders en cascada dentro del effect)
  useEffect(() => {
    const stored = isVendor ? localStorage.getItem('pedidos_vendor_name') : null;
    queueMicrotask(() => {
      if (stored) setVendorName(stored);
      setNameLoaded(true);
    });
  }, [isVendor]);

  const fetchRemissions = useCallback(async (vendor: string | null) => {
    try {
      const url = isVendor && vendor
        ? `/api/remissions?vendor=${encodeURIComponent(vendor)}`
        : '/api/remissions';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        const list: Remission[] = data.remissions || [];
        setRemissions(list);
        const seenKey = LAST_SEEN_KEY(role, vendor || '');
        // Fijar el marcador una sola vez por sesión: lo guardado de la visita
        // anterior, o (primera visita) la remisión más reciente actual
        setLastSeenAt(prev =>
          prev || localStorage.getItem(seenKey) || list[0]?.created_at || new Date().toISOString()
        );
        // Guardar para la próxima visita (las nuevas siguen resaltadas en esta
        // sesión porque lastSeenAt ya no cambia)
        if (list[0]) localStorage.setItem(seenKey, list[0].created_at);
      }
    } catch (error) {
      console.error('Error cargando remisiones:', error);
    } finally {
      setLoading(false);
    }
  }, [isVendor, role]);

  useEffect(() => {
    if (!nameLoaded) return;
    if (isVendor && !vendorName) return;

    const initial = setTimeout(() => fetchRemissions(vendorName), 0);
    const interval = setInterval(() => fetchRemissions(vendorName), 10000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [nameLoaded, vendorName, isVendor, fetchRemissions]);

  const isNew = (r: Remission) => !!lastSeenAt && r.created_at > lastSeenAt;
  const newCount = remissions.filter(isNew).length;

  const toggleExpanded = (rem: Remission) => {
    if (expanded === rem.id) {
      setExpanded(null);
      return;
    }
    setExpanded(rem.id);
    setActionError(null);
    if (!isVendor) {
      const drafts: Record<string, { packed_quantity: number; status: RemissionListItem['status'] }> = {};
      rem.items.forEach(item => {
        drafts[item.id] = { packed_quantity: item.packed_quantity, status: item.status };
      });
      setItemDrafts(drafts);
    }
  };

  const saveItemEdits = async (rem: Remission) => {
    setIsSavingItems(true);
    setActionError(null);
    try {
      const items = rem.items.map(item => ({
        id: item.id,
        packed_quantity: itemDrafts[item.id]?.packed_quantity ?? item.packed_quantity,
        item_status: itemDrafts[item.id]?.status ?? item.status,
      }));
      const res = await fetch(`/api/remissions/${rem.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error guardando cambios');
      setRemissions(prev => prev.map(r => r.id !== rem.id ? r : {
        ...r,
        total: data.remission.total,
        items: r.items.map(item => ({
          ...item,
          packed_quantity: itemDrafts[item.id]?.packed_quantity ?? item.packed_quantity,
          status: itemDrafts[item.id]?.status ?? item.status,
        })),
      }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error guardando cambios');
    } finally {
      setIsSavingItems(false);
    }
  };

  const finalizeRemission = async (rem: Remission) => {
    setIsFinalizing(true);
    setActionError(null);
    try {
      await saveItemEdits(rem);
      const res = await fetch(`/api/remissions/${rem.id}/finalize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error finalizando la remisión');
      setRemissions(prev => prev.map(r => r.id === rem.id ? { ...r, reviewed_at: data.remission.reviewed_at } : r));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error finalizando la remisión');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleEnter = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('pedidos_vendor_name', name);
    setLoading(true);
    setLastSeenAt('');
    setVendorName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('pedidos_vendor_name');
    setVendorName(null);
    setNameInput('');
    setRemissions([]);
    setLastSeenAt('');
  };

  // ── Pantalla de identificación del vendedor ──
  if (isVendor && nameLoaded && !vendorName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-[#00a884]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={26} className="text-[#00a884]" />
          </div>
          <h1 className="text-lg font-bold text-gray-800">Portal del Vendedor</h1>
          <p className="text-sm text-gray-500 mt-1 mb-5">
            Selecciona tu nombre para ver tus remisiones
          </p>
          <select
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            className={`w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884] mb-3 bg-white ${nameInput ? 'text-gray-800' : 'text-gray-400'}`}
            autoFocus
          >
            <option value="">Selecciona tu nombre...</option>
            {VENDORS.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button
            onClick={handleEnter}
            disabled={!nameInput.trim()}
            className="w-full py-3 bg-[#00a884] text-white rounded-xl font-semibold text-sm hover:bg-[#008f6f] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Ver mis remisiones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="text-white p-4 shadow-lg sticky top-0 z-10" style={{ background: themeColor }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">
              {isVendor ? `👤 ${vendorName}` : '🗂️ Secretaría'}
            </h1>
            <p className="text-xs text-white/80">
              {isVendor ? 'Remisiones de tus pedidos' : 'Todas las remisiones de bodega'}
              {newCount > 0 && ` · ${newCount} nueva${newCount > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {newCount > 0 && (
              <span className="bg-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse" style={{ color: themeColor }}>
                🔔 {newCount}
              </span>
            )}
            <button onClick={() => fetchRemissions(vendorName)} className="p-2 bg-white/15 rounded-full hover:bg-white/25 active:scale-95 transition-all" title="Actualizar">
              <RefreshCw size={16} />
            </button>
            {isVendor && (
              <button onClick={handleLogout} className="p-2 bg-white/15 rounded-full hover:bg-white/25 active:scale-95 transition-all" title="Cambiar de vendedor">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Lista */}
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-4 border-gray-200 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: themeColor }} />
              <p className="text-sm text-gray-500">Cargando remisiones...</p>
            </div>
          ) : remissions.length === 0 ? (
            <div className="text-center py-16">
              <Package size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">Aún no hay remisiones</p>
              <p className="text-xs text-gray-400 mt-1">
                {isVendor
                  ? 'Cuando bodega empaque tus pedidos, aparecerán aquí'
                  : 'Cuando bodega envíe remisiones, aparecerán aquí'}
              </p>
            </div>
          ) : (
            remissions.map(rem => {
              const highlight = isNew(rem);
              return (
                <div
                  key={rem.id}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                    highlight ? 'border-2 ring-2 ring-offset-1' : 'border-gray-200'
                  }`}
                  style={highlight ? { borderColor: themeColor, ['--tw-ring-color' as string]: `${themeColor}40` } : undefined}
                >
                  <button
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
                    onClick={() => toggleExpanded(rem)}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 flex items-center gap-2">
                        {rem.id}
                        {highlight && (
                          <span className="text-[10px] text-white font-bold px-2 py-0.5 rounded-full" style={{ background: themeColor }}>
                            NUEVA
                          </span>
                        )}
                        {rem.reviewed_at && (
                          <span className="text-[10px] text-green-700 bg-green-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={10} /> Lista para facturar
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {rem.order_id} · {rem.customer}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(rem.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        {!isVendor && rem.vendor_name ? ` · Vendedor: ${rem.vendor_name}` : ''}
                        {rem.packer_name ? ` · Empacó: ${rem.packer_name}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold" style={{ color: themeColor }}>
                        ${(rem.total || 0).toLocaleString('es-CO')}
                      </p>
                      <p className="text-[10px] text-gray-400">{rem.total_units} und</p>
                    </div>
                  </button>

                  {/* Chips de estado */}
                  <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
                    {(['completo', 'modificado', 'agotado', 'agregado'] as const).map(s =>
                      rem.counts[s] > 0 ? (
                        <span key={s} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGES[s].badge}`}>
                          {rem.counts[s]} {STATUS_BADGES[s].label}
                        </span>
                      ) : null
                    )}
                  </div>

                  {/* Detalle expandible — comparativo vendido vs empacado */}
                  {expanded === rem.id && (() => {
                    // Secretaría puede seguir corrigiendo cantidades/estado aunque la
                    // remisión ya se haya marcado como revisada o liquidado antes —
                    // se puede editar y volver a liquidar cuantas veces sea necesario.
                    const canEdit = !isVendor;
                    const soldUnits = rem.items.reduce((s, i) => s + (i.ordered_quantity || 0), 0);
                    const packedUnits = rem.items.reduce((s, i) => s + (itemDrafts[i.id]?.packed_quantity ?? i.packed_quantity ?? 0), 0);
                    const soldTotal = rem.items.reduce((s, i) => s + (i.ordered_quantity || 0) * (i.price || 0), 0);
                    const packedTotal = rem.items.reduce((s, i) => s + (itemDrafts[i.id]?.packed_quantity ?? i.packed_quantity ?? 0) * (i.price || 0), 0);
                    const diffTotal = packedTotal - soldTotal;
                    return (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                      {/* Encabezado de columnas */}
                      <div className="grid grid-cols-[1fr_52px_90px] gap-x-2 items-center mb-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Producto</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Vendido</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Empacado</span>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        {rem.items.map((item) => {
                          const draft = itemDrafts[item.id];
                          const packedQty = canEdit ? (draft?.packed_quantity ?? item.packed_quantity) : item.packed_quantity;
                          const status = canEdit ? (draft?.status ?? item.status) : item.status;
                          const diff = (packedQty || 0) - (item.ordered_quantity || 0);
                          return (
                            <div key={item.id} className="grid grid-cols-[1fr_52px_90px] gap-x-2 items-center text-xs">
                              <span className={`truncate ${status === 'agotado' ? 'text-red-500 line-through' : 'text-gray-700'}`}>
                                <span className="font-mono text-gray-400">{item.ref}</span> · {item.name}
                                <span className="text-gray-400"> · ${(item.price || 0).toLocaleString('es-CO')}</span>
                              </span>
                              <span className="text-center font-medium text-gray-600">
                                {status === 'agregado' ? '—' : item.ordered_quantity}
                              </span>
                              {canEdit ? (
                                <div className="flex flex-col gap-0.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={packedQty}
                                    onChange={e => setItemDrafts(prev => ({
                                      ...prev,
                                      [item.id]: { status, packed_quantity: Math.max(0, parseInt(e.target.value) || 0) }
                                    }))}
                                    className="w-full px-1 py-0.5 border rounded text-right text-xs"
                                  />
                                  <select
                                    value={status}
                                    onChange={e => setItemDrafts(prev => ({
                                      ...prev,
                                      [item.id]: { packed_quantity: packedQty, status: e.target.value as RemissionListItem['status'] }
                                    }))}
                                    className="w-full px-1 py-0.5 border rounded text-[10px]"
                                  >
                                    {ITEM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <span className={`text-center font-bold ${
                                  status === 'agotado' ? 'text-red-600' :
                                  status === 'agregado' ? 'text-blue-600' :
                                  diff !== 0 ? 'text-yellow-700' : 'text-green-700'
                                }`}>
                                  {packedQty}
                                  {status !== 'agregado' && diff !== 0 && (
                                    <span className="font-normal text-[10px]"> ({diff > 0 ? '+' : ''}{diff})</span>
                                  )}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Totales comparados */}
                      <div className="rounded-lg bg-white border border-gray-200 p-3 mb-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">🛒 Vendido</span>
                          <span className="font-semibold text-gray-700">{soldUnits} und · ${soldTotal.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">📦 Empacado</span>
                          <span className="font-semibold text-gray-700">{packedUnits} und · ${packedTotal.toLocaleString('es-CO')}</span>
                        </div>
                        {diffTotal !== 0 && (
                          <div className="flex justify-between border-t border-gray-100 pt-1">
                            <span className="text-gray-500">Diferencia</span>
                            <span className={`font-bold ${diffTotal < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {packedUnits - soldUnits > 0 ? '+' : ''}{packedUnits - soldUnits} und · {diffTotal > 0 ? '+' : '−'}${Math.abs(diffTotal).toLocaleString('es-CO')}
                            </span>
                          </div>
                        )}
                      </div>
                      {rem.delivery_address && (
                        <p className="text-xs text-gray-500 mb-3">📍 Entrega: {rem.delivery_address}</p>
                      )}
                      {expanded === rem.id && actionError && (
                        <p className="text-xs text-red-600 mb-2">{actionError}</p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={`/api/remissions/${rem.id}/pdf`}
                          download={`remision-${rem.id}.pdf`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                          style={{ background: themeColor }}
                        >
                          <Download size={13} /> Descargar PDF
                        </a>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => saveItemEdits(rem)}
                              disabled={isSavingItems || isFinalizing}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                              {isSavingItems ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                            {!rem.reviewed_at && (
                            <button
                              onClick={() => finalizeRemission(rem)}
                              disabled={isSavingItems || isFinalizing}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle2 size={13} /> {isFinalizing ? 'Guardando...' : 'Guardar para facturar'}
                            </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
