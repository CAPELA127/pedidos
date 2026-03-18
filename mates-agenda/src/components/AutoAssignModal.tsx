import React from 'react';
import { Wand2, Check, X, ArrowRight } from 'lucide-react';
import type { AutoAssignChange } from '../types';
import { useStore } from '../store/useStore';
import { PROFES, IES } from '../data/initial-data';

export function AutoAssignModal() {
  const { pendingAutoAssign, confirmAutoAssign, cancelAutoAssign } = useStore();

  if (!pendingAutoAssign) return null;

  const changes = pendingAutoAssign;

  // Group by profe
  const byProfe = new Map<string, AutoAssignChange[]>();
  for (const c of changes) {
    const group = byProfe.get(c.profeId) ?? [];
    group.push(c);
    byProfe.set(c.profeId, group);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-blue-800">Auto-asignación propuesta</h2>
          </div>
          <button
            onClick={cancelAutoAssign}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {changes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Check size={32} className="text-green-500 mx-auto mb-3" />
              <p className="font-medium text-slate-700">Todas las IEs ya están cubiertas.</p>
              <p className="text-sm mt-1">No se generaron asignaciones adicionales.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4">
                Se proponen <strong>{changes.length} asignaciones</strong> para cubrir IEs sin cobertura.
                Revisa y confirma.
              </p>

              <div className="max-h-80 overflow-auto space-y-3">
                {Array.from(byProfe.entries()).map(([profeId, profeChanges]) => {
                  const profe = PROFES.find(p => p.id === profeId);
                  if (!profe) return null;
                  return (
                    <div key={profeId} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div
                        className="px-3 py-2 flex items-center gap-2"
                        style={{ backgroundColor: profe.color + '18' }}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: profe.color }}
                        >
                          {profe.nombre[0]}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: profe.color }}>
                          {profe.nombre}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          +{profeChanges.length} asignación{profeChanges.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {profeChanges.map(c => {
                          const ie = IES.find(i => i.id === c.ieId);
                          return (
                            <div key={c.slotId} className="px-3 py-2 flex items-center gap-2 text-xs">
                              <span className="text-slate-500">{c.date}</span>
                              <span className="text-slate-400">{c.hour}:00h</span>
                              <ArrowRight size={10} className="text-slate-300" />
                              <span className="font-medium text-slate-700 truncate">{ie?.nombre}</span>
                              {ie && (
                                <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-xs ${
                                  ie.tipo === 'Fijo'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {ie.tipo}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={cancelAutoAssign}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmAutoAssign}
            disabled={changes.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check size={14} />
            Confirmar {changes.length > 0 ? `${changes.length} asignaciones` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
