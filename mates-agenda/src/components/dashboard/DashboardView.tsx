import React from 'react';
import { WeeklyCalendar } from './WeeklyCalendar';
import { useStore } from '../../store/useStore';
import { PROFES, IES } from '../../data/initial-data';

export function DashboardView() {
  const allSlots = useStore(s => s.slots);

  // Quick stats
  const assigned = allSlots.filter(s => s.status === 'assigned' || s.status === 'blocked').length;
  const coveredIEs = new Set(
    allSlots
      .filter(s => (s.status === 'assigned' || s.status === 'blocked') && s.ieId)
      .map(s => s.ieId!)
  ).size;
  const conflictos = useStore(s => s.conflictos);
  const critical = conflictos.filter(c => c.tipo !== 'ie_sin_cubrir').length;

  return (
    <div>
      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-blue-600">{PROFES.length}</div>
          <div className="text-xs text-slate-500 mt-1">Profes activos</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-green-600">{coveredIEs} / {IES.length}</div>
          <div className="text-xs text-slate-500 mt-1">IEs cubiertas</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-slate-700">{assigned}</div>
          <div className="text-xs text-slate-500 mt-1">Horas asignadas</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-red-500">{critical}</div>
          <div className="text-xs text-slate-500 mt-1">Conflictos críticos</div>
        </div>
      </div>

      {/* Profe workload bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Carga por profe</h3>
        <div className="space-y-2">
          {PROFES.map(profe => {
            const hours = allSlots.filter(
              s => s.profeId === profe.id && (s.status === 'assigned' || s.status === 'blocked')
            ).length;
            const maxHours = 20;
            const pct = Math.min(100, Math.round((hours / maxHours) * 100));

            return (
              <div key={profe.id} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: profe.color }}
                >
                  {profe.nombre[0]}
                </div>
                <span className="text-xs font-medium text-slate-700 w-20 shrink-0">{profe.nombre}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: profe.color }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-14 text-right shrink-0">{hours}h</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Calendario semanal</h2>
        <WeeklyCalendar />
      </div>
    </div>
  );
}
