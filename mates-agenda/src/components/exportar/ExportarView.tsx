import React from 'react';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useStore } from '../../store/useStore';
import { PROFES, IES, HOURS, ALL_DATES } from '../../data/initial-data';

const HOUR_LABELS: Record<number, string> = {
  6: '6:00', 7: '7:00', 8: '8:00', 9: '9:00', 10: '10:00', 11: '11:00',
  12: '12:00', 13: '13:00', 14: '14:00', 15: '15:00', 16: '16:00', 17: '17:00',
};

export function ExportarView() {
  const allSlots = useStore(s => s.slots);

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet per teacher
    for (const profe of PROFES) {
      const profeSlots = allSlots.filter(
        s => s.profeId === profe.id && (s.status === 'assigned' || s.status === 'blocked')
      );

      const rows: string[][] = [
        ['Profe', 'Fecha', 'Hora', 'IE', 'Tipo', 'Estado'],
      ];

      for (const slot of profeSlots.sort((a, b) =>
        a.date.localeCompare(b.date) || a.hour - b.hour
      )) {
        const ie = slot.ieId ? IES.find(i => i.id === slot.ieId) : null;
        rows.push([
          profe.nombre,
          slot.date,
          `${HOUR_LABELS[slot.hour]} - ${HOUR_LABELS[slot.hour + 1] ?? '18:00'}`,
          ie?.nombre ?? '',
          ie?.tipo ?? '',
          slot.status === 'blocked' ? 'Pre-asignado' : 'Asignado',
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Column widths
      ws['!cols'] = [
        { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 10 }, { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, profe.nombre);
    }

    // Summary sheet
    const summaryRows: string[][] = [
      ['IE', 'Tipo', 'Comuna', 'Profe Asignado', 'Horas asignadas'],
    ];

    for (const ie of IES) {
      const ieSlots = allSlots.filter(
        s => s.ieId === ie.id && (s.status === 'assigned' || s.status === 'blocked')
      );
      const profeIds = [...new Set(ieSlots.map(s => s.profeId))];
      const profeNames = profeIds.map(id => PROFES.find(p => p.id === id)?.nombre ?? id).join(', ');

      summaryRows.push([
        ie.nombre,
        ie.tipo,
        `C-${ie.comuna}`,
        profeNames || 'Sin asignar',
        String(ieSlots.length),
      ]);
    }

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 40 }, { wch: 10 }, { wch: 8 }, { wch: 30 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen IEs');

    XLSX.writeFile(wb, `mates-agenda-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportPrint() {
    window.print();
  }

  // Coverage stats
  const coveredIEs = new Set(
    allSlots
      .filter(s => (s.status === 'assigned' || s.status === 'blocked') && s.ieId)
      .map(s => s.ieId!)
  );
  const totalAssigned = allSlots.filter(
    s => s.status === 'assigned' || s.status === 'blocked'
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">Exportar horario</h2>
        <p className="text-sm text-slate-500">Descarga el horario en Excel o imprime el resumen semanal</p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-xl">
        <button
          onClick={exportExcel}
          className="bg-white border border-slate-200 rounded-xl p-6 text-left hover:shadow-md hover:border-green-300 transition-all group"
        >
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
            <FileSpreadsheet size={20} className="text-green-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Exportar Excel</h3>
          <p className="text-xs text-slate-500 mt-1">
            Un hoja por profe + resumen de IEs
          </p>
        </button>

        <button
          onClick={exportPrint}
          className="bg-white border border-slate-200 rounded-xl p-6 text-left hover:shadow-md hover:border-blue-300 transition-all group"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
            <Printer size={20} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Imprimir / PDF</h3>
          <p className="text-xs text-slate-500 mt-1">
            Imprime el resumen semanal visual
          </p>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-slate-800">{totalAssigned}</div>
          <div className="text-xs text-slate-500 mt-1">Total horas asignadas</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-green-600">{coveredIEs.size}</div>
          <div className="text-xs text-slate-500 mt-1">IEs con cobertura</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-red-500">{IES.length - coveredIEs.size}</div>
          <div className="text-xs text-slate-500 mt-1">IEs sin cubrir</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-blue-600">
            {Math.round((coveredIEs.size / IES.length) * 100)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">Cobertura total</div>
        </div>
      </div>

      {/* Print-only summary table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Resumen por profe</h3>
          <span className="text-xs text-slate-400">Vista previa del export</span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Profe</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Comuna</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Horas asignadas</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">IEs cubiertas</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">IEs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PROFES.map(profe => {
              const profeSlots = allSlots.filter(
                s => s.profeId === profe.id && (s.status === 'assigned' || s.status === 'blocked')
              );
              const profeIEs = [...new Set(profeSlots.map(s => s.ieId).filter(Boolean))];
              const ieNames = profeIEs
                .map(id => IES.find(i => i.id === id)?.nombre ?? id)
                .join(', ');

              return (
                <tr key={profe.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: profe.color }}
                      >
                        {profe.nombre[0]}
                      </div>
                      <span className="font-medium text-slate-800">{profe.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">C-{profe.comuna}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: profe.color }}>
                    {profeSlots.length}h
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{profeIEs.length}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate" title={ieNames}>
                    {ieNames || <span className="text-slate-300">Ninguna</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
