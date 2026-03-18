import React from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, AlertCircle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import type { Conflicto } from '../../types';
import { useStore } from '../../store/useStore';
import { PROFES, IES } from '../../data/initial-data';

function ConflictoCard({ conflicto }: { conflicto: Conflicto }) {
  const profe = conflicto.profeId ? PROFES.find(p => p.id === conflicto.profeId) : null;
  const ie = conflicto.ieId ? IES.find(i => i.id === conflicto.ieId) : null;

  const config = {
    doble_profe: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: 'text-red-500',
      label: 'Doble asignación profe',
      labelColor: 'text-red-700',
      badgeBg: 'bg-red-100 text-red-700',
    },
    doble_ie: {
      icon: AlertCircle,
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      iconColor: 'text-orange-500',
      label: 'Doble asignación IE',
      labelColor: 'text-orange-700',
      badgeBg: 'bg-orange-100 text-orange-700',
    },
    ie_sin_cubrir: {
      icon: Info,
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      iconColor: 'text-slate-400',
      label: 'IE sin cobertura',
      labelColor: 'text-slate-600',
      badgeBg: 'bg-slate-100 text-slate-600',
    },
  }[conflicto.tipo];

  const Icon = config.icon;

  return (
    <div className={clsx('rounded-lg border p-3 flex items-start gap-3', config.bg, config.border)}>
      <Icon size={16} className={clsx('mt-0.5 shrink-0', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded', config.badgeBg)}>
            {config.label}
          </span>
          {profe && (
            <span
              className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: profe.color }}
            >
              {profe.nombre}
            </span>
          )}
          {ie && (
            <span className="text-xs text-slate-500">
              {ie.nombre}
            </span>
          )}
        </div>
        <p className={clsx('text-xs mt-1', config.labelColor)}>{conflicto.descripcion}</p>
        {conflicto.date && (
          <p className="text-xs text-slate-400 mt-0.5">
            {conflicto.date}
            {conflicto.hour !== undefined ? ` · ${conflicto.hour}:00h` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export function ConflictosView() {
  const conflictos = useStore(s => s.conflictos);
  const refreshConflicts = useStore(s => s.refreshConflicts);

  const critical = conflictos.filter(c => c.tipo === 'doble_profe' || c.tipo === 'doble_ie');
  const warnings = conflictos.filter(c => c.tipo === 'ie_sin_cubrir');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Conflictos y alertas</h2>
          <p className="text-sm text-slate-500">
            {conflictos.length === 0
              ? 'No hay conflictos detectados'
              : `${critical.length} crítico${critical.length !== 1 ? 's' : ''} · ${warnings.length} aviso${warnings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={refreshConflicts}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-600">
            {conflictos.filter(c => c.tipo === 'doble_profe').length}
          </div>
          <div className="text-xs text-red-500 mt-1">Doble asignación profe</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-600">
            {conflictos.filter(c => c.tipo === 'doble_ie').length}
          </div>
          <div className="text-xs text-orange-500 mt-1">Doble asignación IE</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-600">{warnings.length}</div>
          <div className="text-xs text-slate-500 mt-1">IEs sin cobertura</div>
        </div>
      </div>

      {conflictos.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-green-700">Todo en orden</h3>
          <p className="text-sm text-green-600 mt-1">No se detectaron conflictos en el horario actual.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {critical.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500" />
                Conflictos críticos ({critical.length})
              </h3>
              <div className="space-y-2">
                {critical.map(c => <ConflictoCard key={c.id} conflicto={c} />)}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Info size={14} className="text-slate-400" />
                IEs sin cobertura ({warnings.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-auto">
                {warnings.map(c => <ConflictoCard key={c.id} conflicto={c} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
