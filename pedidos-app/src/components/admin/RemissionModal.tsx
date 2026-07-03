"use client";

import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, Check, AlertTriangle, Download, Trash2, Plus } from 'lucide-react';

interface RemissionItem {
  ref: string;
  name: string;
  ordered_quantity: number;
  packed_quantity: number;
  price: number;
  unit_type: string;
  status: 'completo' | 'modificado' | 'agotado' | 'agregado';
  note?: string | null;
}

interface PackingInfo {
  packer_name: string;
  verifier_name: string;
  packing_time: string;
  packing_location: string;
  packing_date: string;
  boxes_count: number | null;
}

interface Props {
  orderId: string;
  customerName: string;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_STYLES: Record<string, { row: string; badge: string; label: string }> = {
  completo:   { row: 'border-green-200 bg-green-50/40',  badge: 'bg-green-100 text-green-700',   label: 'Completo' },
  modificado: { row: 'border-yellow-300 bg-yellow-50/60', badge: 'bg-yellow-100 text-yellow-800', label: 'Modificado' },
  agotado:    { row: 'border-red-300 bg-red-50/60',       badge: 'bg-red-100 text-red-700',       label: 'Agotado' },
  agregado:   { row: 'border-blue-300 bg-blue-50/60',     badge: 'bg-blue-100 text-blue-700',     label: 'Agregado' },
};

export default function RemissionModal({ orderId, customerName, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RemissionItem[]>([]);
  const [packing, setPacking] = useState<PackingInfo>({
    packer_name: '', verifier_name: '', packing_time: '',
    packing_location: '', packing_date: '', boxes_count: null,
  });
  const [remissionId, setRemissionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const newFiles = Array.from(selected).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const url = URL.createObjectURL(f);
      setPreviews(prev => [...prev, url]);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const analyze = async () => {
    if (files.length === 0) { setError('Sube al menos una foto'); return; }
    setIsAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('images', f));
      const res = await fetch(`/api/orders/${orderId}/remission/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error analizando las fotos');
      setItems(data.items || []);
      if (data.packing) {
        setPacking({
          packer_name: data.packing.packer_name || '',
          verifier_name: data.packing.verifier_name || '',
          packing_time: data.packing.packing_time || '',
          packing_location: data.packing.packing_location || '',
          packing_date: data.packing.packing_date || '',
          boxes_count: data.packing.boxes_count ?? null,
        });
      }
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error analizando las fotos');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateItem = (index: number, patch: Partial<RemissionItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...patch };
      // Recalcular estado si cambia la cantidad manualmente
      if (patch.packed_quantity !== undefined && item.status !== 'agregado') {
        if (updated.packed_quantity === 0) updated.status = 'agotado';
        else if (updated.packed_quantity === updated.ordered_quantity) updated.status = 'completo';
        else updated.status = 'modificado';
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const addManualItem = () => {
    setItems(prev => [...prev, {
      ref: '', name: '', ordered_quantity: 0, packed_quantity: 1,
      price: 0, unit_type: 'unidad', status: 'agregado', note: null,
    }]);
  };

  const total = items.reduce((s, i) => s + (i.price || 0) * (i.packed_quantity || 0), 0);
  const totalUnits = items.reduce((s, i) => s + (i.packed_quantity || 0), 0);
  const counts = {
    completo: items.filter(i => i.status === 'completo').length,
    modificado: items.filter(i => i.status === 'modificado').length,
    agotado: items.filter(i => i.status === 'agotado').length,
    agregado: items.filter(i => i.status === 'agregado').length,
  };

  const save = async () => {
    const invalid = items.find(i => i.status === 'agregado' && !i.ref.trim());
    if (invalid) { setError('Hay un producto agregado sin referencia'); return; }
    // Ningún producto empacado puede ir sin precio — solo si está agotado (empacado = 0)
    const missingPrice = items.find(i => (i.packed_quantity || 0) > 0 && (!i.price || i.price <= 0));
    if (missingPrice) {
      setError(`"${missingPrice.name || missingPrice.ref}" no tiene precio. Ponle precio o márcalo como agotado (empacado = 0).`);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/remission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, packing }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error guardando la remisión');
      setRemissionId(data.remission.id);
      setStep('done');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando la remisión');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPDF = () => {
    if (!remissionId) return;
    const link = document.createElement('a');
    link.href = `/api/remissions/${remissionId}/pdf`;
    link.download = `remision-${remissionId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[94vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white p-4 sm:p-5 z-10 flex justify-between items-start rounded-t-2xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Camera size={20} /> Remisión de empaque
            </h2>
            <p className="text-sm text-blue-100 mt-0.5">{orderId} · {customerName}</p>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white p-1">
            <X size={22} />
          </button>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── Paso 1: subir fotos ── */}
        {step === 'upload' && (
          <div className="p-4 sm:p-6">
            <p className="text-sm text-gray-600 mb-4">
              Sube las fotos de las hojas del pedido con las modificaciones de bodega
              (resaltados = agotados, números manuscritos = cantidades reales, chulos = completos).
              Incluye también la hoja de control de empaque si la tienes.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:bg-blue-50 transition-colors"
            >
              <Camera size={32} className="mx-auto mb-2 text-blue-500" />
              <p className="text-sm font-medium text-blue-700">Tomar foto o seleccionar imágenes</p>
              <p className="text-xs text-gray-400 mt-1">Puedes subir varias a la vez</p>
            </button>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Página ${i + 1}`} className="w-full h-32 object-cover rounded-lg border" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Pág. {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={analyze}
              disabled={isAnalyzing || files.length === 0}
              className={`w-full mt-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isAnalyzing || files.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'
              }`}
            >
              {isAnalyzing
                ? <><Loader2 size={16} className="animate-spin" /> Analizando con IA... (puede tardar ~1 min)</>
                : <>Analizar {files.length > 0 ? `${files.length} foto${files.length > 1 ? 's' : ''}` : 'fotos'} con IA</>}
            </button>
          </div>
        )}

        {/* ── Paso 2: revisión ── */}
        {step === 'review' && (
          <div className="p-4 sm:p-6">
            {/* Resumen */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {(['completo', 'modificado', 'agotado', 'agregado'] as const).map(s => (
                <div key={s} className={`rounded-lg p-2 text-center ${STATUS_STYLES[s].badge}`}>
                  <p className="text-lg font-bold">{counts[s]}</p>
                  <p className="text-[10px] font-medium uppercase">{STATUS_STYLES[s].label}s</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Revisa lo que leyó la IA y corrige lo que haga falta antes de confirmar.
            </p>

            {/* Items */}
            <div className="space-y-2">
              {items.map((item, i) => {
                const style = STATUS_STYLES[item.status];
                return (
                  <div key={i} className={`border rounded-xl p-3 ${style.row}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {item.status === 'agregado' ? (
                          <div className="flex gap-2 mb-1">
                            <input
                              value={item.ref}
                              onChange={e => updateItem(i, { ref: e.target.value.toUpperCase() })}
                              placeholder="REF"
                              className="w-32 px-2 py-1 border rounded text-xs font-mono font-bold bg-white"
                            />
                            <input
                              value={item.name}
                              onChange={e => updateItem(i, { name: e.target.value })}
                              placeholder="Nombre del producto"
                              className="flex-1 px-2 py-1 border rounded text-xs bg-white"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.ref}</p>
                          </>
                        )}
                        {item.note && <p className="text-[11px] text-gray-500 italic mt-0.5">📝 {item.note}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${style.badge}`}>{style.label}</span>
                        <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-0.5">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="text-xs text-gray-500">
                        Pedido: <span className="font-bold text-gray-700">{item.ordered_quantity}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        Empacado:
                        <input
                          type="number" min="0"
                          value={item.packed_quantity}
                          onChange={e => updateItem(i, { packed_quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-16 px-2 py-1 border rounded font-bold text-blue-700 bg-white text-center"
                        />
                        <span>{item.unit_type}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        $
                        <input
                          type="number" min="0"
                          value={item.price || ''}
                          onChange={e => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                          placeholder="Precio"
                          className={`w-20 px-2 py-1 border rounded bg-white ${
                            (item.packed_quantity || 0) > 0 && (!item.price || item.price <= 0)
                              ? 'border-red-400 ring-1 ring-red-300'
                              : ''
                          }`}
                        />
                      </div>
                      {(item.packed_quantity || 0) > 0 && (!item.price || item.price <= 0) && (
                        <span className="text-[10px] font-bold text-red-500">⚠️ Sin precio</span>
                      )}
                      <div className="ml-auto text-xs font-bold text-gray-700">
                        ${((item.price || 0) * (item.packed_quantity || 0)).toLocaleString('es-CO')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addManualItem}
              className="w-full mt-3 py-2 border-2 border-dashed border-blue-200 rounded-xl text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1"
            >
              <Plus size={14} /> Agregar producto manualmente
            </button>

            {/* Datos de empaque */}
            <div className="mt-5 bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Control de empaque</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={packing.packer_name} onChange={e => setPacking(p => ({ ...p, packer_name: e.target.value }))}
                  placeholder="Quien sacó" className="px-3 py-2 border rounded-lg text-sm bg-white" />
                <input value={packing.verifier_name} onChange={e => setPacking(p => ({ ...p, verifier_name: e.target.value }))}
                  placeholder="Quien verificó" className="px-3 py-2 border rounded-lg text-sm bg-white" />
                <input value={packing.packing_time} onChange={e => setPacking(p => ({ ...p, packing_time: e.target.value }))}
                  placeholder="Hora de empaque" className="px-3 py-2 border rounded-lg text-sm bg-white" />
                <input value={packing.packing_location} onChange={e => setPacking(p => ({ ...p, packing_location: e.target.value }))}
                  placeholder="Cámara / bodega" className="px-3 py-2 border rounded-lg text-sm bg-white" />
                <input value={packing.packing_date} onChange={e => setPacking(p => ({ ...p, packing_date: e.target.value }))}
                  placeholder="Fecha" className="px-3 py-2 border rounded-lg text-sm bg-white" />
                <input type="number" min="0" value={packing.boxes_count ?? ''} onChange={e => setPacking(p => ({ ...p, boxes_count: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Número de cajas" className="px-3 py-2 border rounded-lg text-sm bg-white" />
              </div>
            </div>

            {/* Totales + acciones */}
            <div className="sticky bottom-0 bg-white border-t mt-5 pt-4 pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600">{totalUnits} unidades empacadas</span>
                <span className="text-xl font-bold text-blue-700">${total.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Volver
                </button>
                <button
                  onClick={save}
                  disabled={isSaving || items.length === 0}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
                    isSaving ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSaving
                    ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                    : <><Check size={15} /> Confirmar remisión</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Paso 3: listo ── */}
        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={30} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Remisión {remissionId} creada</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              El pedido {orderId} quedó marcado como Empacado.
              Total real: <span className="font-bold text-gray-700">${total.toLocaleString('es-CO')}</span>
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={downloadPDF}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
              >
                <Download size={15} /> Descargar PDF
              </button>
              <button onClick={onClose} className="px-5 py-2.5 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
