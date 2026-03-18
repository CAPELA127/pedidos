import React from 'react';
import { clsx } from 'clsx';
import { useStore } from '../../store/useStore';
import { IES } from '../../data/initial-data';

const COMUNAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ComunasView() {
  const allSlots = useStore(s => s.slots);
  const profes = useStore(s => s.profes);

  // Compute coverage per IE
  const coveredIEMap = new Map<string, string>(); // ieId -> profeId
  for (const slot of allSlots) {
    if ((slot.status === 'assigned' || slot.status === 'blocked') && slot.ieId) {
      if (!coveredIEMap.has(slot.ieId)) {
        coveredIEMap.set(slot.ieId, slot.profeId);
      }
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Vista por Comunas</h2>
        <p className="text-sm text-slate-500">Comunas 1-7 activas · Comunas 8-10 disponibles para expansión futura</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {COMUNAS.map(comunaNum => {
          const communaIEs = IES.filter(ie => ie.comuna === comunaNum);
          const profe = profes.find(p => p.comuna === comunaNum);
          // Profes who have this as apoyo
          const apoyoProfes = profes.filter(p => p.comunasApoyo.includes(comunaNum));
          const isActive = communaIEs.length > 0;

          const coveredCount = communaIEs.filter(ie => coveredIEMap.has(ie.id)).length;
          const coverage = communaIEs.length > 0
            ? Math.round((coveredCount / communaIEs.length) * 100)
            : 0;

          return (
            <div
              key={comunaNum}
              className={clsx(
                'bg-white rounded-xl shadow-sm border overflow-hidden transition-all',
                isActive
                  ? 'border-slate-200 hover:shadow-md'
                  : 'border-slate-100 opacity-60'
              )}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={
                  isActive && profe
                    ? { backgroundColor: profe.color + '18', borderBottom: `2px solid ${profe.color}33` }
                    : { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }
                }
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Comuna {comunaNum}
                    {!isActive && <span className="ml-2 text-xs text-slate-400">(futura)</span>}
                  </h3>
                  {profe && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: profe.color }} />
                      <span className="text-xs font-medium" style={{ color: profe.color }}>{profe.nombre}</span>
                      {apoyoProfes.map(ap => (
                        <span key={ap.id} className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: ap.color }}>
                          {ap.nombre.substring(0,3)} <span className="opacity-80 text-xs">Apoyo</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {isActive && (
                  <div className="text-right">
                    <div
                      className="text-lg font-bold"
                      style={{ color: profe?.color ?? '#94a3b8' }}
                    >
                      {coverage}%
                    </div>
                    <div className="text-xs text-slate-400">{coveredCount}/{communaIEs.length} IEs</div>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {isActive && (
                <div className="px-4 py-2">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${coverage}%`,
                        backgroundColor: coverage >= 80 ? '#22c55e' : coverage >= 50 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* IE list */}
              <div className="px-4 pb-3">
                {isActive ? (
                  <div className="space-y-1">
                    {communaIEs.map(ie => {
                      const assignedProfeId = coveredIEMap.get(ie.id);
                      const assignedProfe = assignedProfeId
                        ? PROFES.find(p => p.id === assignedProfeId)
                        : null;
                      const covered = !!assignedProfe;

                      return (
                        <div
                          key={ie.id}
                          className="flex items-center justify-between py-1 border-b border-slate-50 last:border-b-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={clsx(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              covered ? 'bg-green-400' : 'bg-red-300'
                            )} />
                            <span className="text-xs text-slate-700 truncate">{ie.nombre}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            <span className={clsx(
                              'text-xs px-1 py-0.5 rounded',
                              ie.tipo === 'Fijo'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-amber-50 text-amber-600'
                            )}>
                              {ie.tipo === 'Fijo' ? 'F' : 'R'}
                            </span>
                            {assignedProfe && (
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: assignedProfe.color, fontSize: '9px' }}
                                title={assignedProfe.nombre}
                              >
                                {assignedProfe.nombre[0]}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-300">
                    Sin IEs asignadas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
