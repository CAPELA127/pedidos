import React from 'react';
import {
  LayoutDashboard,
  Users,
  School,
  Map,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  Wand2,
  RotateCcw,
} from 'lucide-react';
import type { ViewName } from '../../types';
import { useStore, useCurrentWeek, useCoveredIECount } from '../../store/useStore';
import { WEEKS, IES } from '../../data/initial-data';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS: { view: ViewName; label: string; icon: React.ElementType }[] = [
  { view: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { view: 'por-profe',   label: 'Por Profe',   icon: Users },
  { view: 'por-ie',      label: 'Por IE',      icon: School },
  { view: 'comunas',     label: 'Comunas',     icon: Map },
  { view: 'conflictos',  label: 'Conflictos',  icon: AlertTriangle },
  { view: 'exportar',    label: 'Exportar',    icon: Download },
];

export function Layout({ children }: LayoutProps) {
  const { currentView, setView, selectedWeekIndex, setSelectedWeek, previewAutoAssign, resetData } =
    useStore();
  const currentWeek = useCurrentWeek();
  const { covered, total } = useCoveredIECount();
  const conflictos = useStore(s => s.conflictos);
  const criticalCount = conflictos.filter(c => c.tipo !== 'ie_sin_cubrir').length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shadow-sm no-print">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-none">Mates Agenda</h1>
              <p className="text-xs text-slate-400 mt-0.5">Medellín</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                )}
              >
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                {item.label}
                {item.view === 'conflictos' && criticalCount > 0 && (
                  <span className="ml-auto bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {criticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Reset button */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => {
              if (confirm('¿Reiniciar todos los datos al estado inicial?')) resetData();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <RotateCcw size={13} />
            Reiniciar datos
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            {/* Week navigation */}
            <button
              onClick={() => setSelectedWeek(Math.max(0, selectedWeekIndex - 1))}
              disabled={selectedWeekIndex === 0}
              className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} className="text-slate-600" />
            </button>

            <div className="text-center min-w-32">
              <p className="text-sm font-semibold text-slate-800">{currentWeek.label}</p>
              <p className="text-xs text-slate-400">
                {currentWeek.dates[0]} – {currentWeek.dates[currentWeek.dates.length - 1]}
              </p>
            </div>

            <button
              onClick={() => setSelectedWeek(Math.min(WEEKS.length - 1, selectedWeekIndex + 1))}
              disabled={selectedWeekIndex === WEEKS.length - 1}
              className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} className="text-slate-600" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* IE coverage counter */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
              <div className="text-xs text-slate-500">Cobertura IEs</div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-slate-800">{covered}</span>
                <span className="text-xs text-slate-400">/ {total}</span>
              </div>
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(covered / total) * 100}%` }}
                />
              </div>
            </div>

            {/* Auto-assign button */}
            <button
              onClick={previewAutoAssign}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Wand2 size={14} />
              Auto-asignar
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
