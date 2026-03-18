import React, { useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, Search } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PROFES, IES } from '../../data/initial-data';

export function IEView() {
  const allSlots = useStore(s => s.slots);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | 'Fijo' | 'Rotativo'>('all');
  const [filterCubierta, setFilterCubierta] = useState<'all' | 'cubierta' | 'sin_cubrir'>('all');

  // Compute coverage per IE
  const coveredIEMap = new Map<string, string>(); // ieId -> profeId
  for (const slot of allSlots) {
    if ((slot.status === 'assigned' || slot.status === 'blocked') && slot.ieId) {
      if (!coveredIEMap.has(slot.ieId)) {
        coveredIEMap.set(slot.ieId, slot.profeId);
      }
    }
  }

  const filtered = IES.filter(ie => {
    if (search && !ie.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipo !== 'all' && ie.tipo !== filterTipo) return false;
    const cubierta = coveredIEMap.has(ie.id);
    if (filterCubierta === 'cubierta' && !cubierta) return false;
    if (filterCubierta === 'sin_cubrir' && cubierta) return false;
    return true;
  });

  const coveredCount = IES.filter(ie => coveredIEMap.has(ie.id)).length;

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{IES.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total IEs</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-green-600">{coveredCount}</div>
          <div className="text-xs text-slate-500 mt-1">Con cobertura</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-red-500">{IES.length - coveredCount}</div>
          <div className="text-xs text-slate-500 mt-1">Sin asignar</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-blue-600">
            {Math.round((coveredCount / IES.length) * 100)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">Cobertura</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar IE..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>

        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value as typeof filterTipo)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos los tipos</option>
          <option value="Fijo">Fijo</option>
          <option value="Rotativo">Rotativo</option>
        </select>

        <select
          value={filterCubierta}
          onChange={e => setFilterCubierta(e.target.value as typeof filterCubierta)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todas</option>
          <option value="cubierta">Con cobertura</option>
          <option value="sin_cubrir">Sin cobertura</option>
        </select>

        <span className="text-sm text-slate-500 ml-auto">{filtered.length} IEs</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comuna</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Profe asignado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(ie => {
              const profeId = coveredIEMap.get(ie.id);
              const profe = profeId ? PROFES.find(p => p.id === profeId) : null;
              const cubierta = !!profe;

              return (
                <tr key={ie.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{ie.numero}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{ie.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      ie.tipo === 'Fijo'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      {ie.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">C-{ie.comuna}</td>
                  <td className="px-4 py-2.5">
                    {profe ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: profe.color }}
                        >
                          {profe.nombre[0]}
                        </div>
                        <span className="text-slate-700 font-medium">{profe.nombre}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {cubierta ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={14} />
                        <span className="text-xs font-medium">Cubierta</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-500">
                        <XCircle size={14} />
                        <span className="text-xs font-medium">Sin cubrir</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            No se encontraron IEs con los filtros actuales
          </div>
        )}
      </div>
    </div>
  );
}
