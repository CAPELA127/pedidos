import React, { Suspense, lazy } from 'react';
import { Layout } from './components/layout/Layout';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProfeView } from './components/profe/ProfeView';
import { IEView } from './components/ie/IEView';
import { ComunasView } from './components/comunas/ComunasView';
import { ConflictosView } from './components/conflictos/ConflictosView';
import { AutoAssignModal } from './components/AutoAssignModal';
import { useStore } from './store/useStore';

// xlsx es muy pesado (~400KB) — carga lazy solo cuando se navega a Exportar
const ExportarView = lazy(() => import('./components/exportar/ExportarView').then(m => ({ default: m.ExportarView })));

const VIEW_TITLES: Record<string, string> = {
  'dashboard':   'Dashboard',
  'por-profe':   'Por Profe',
  'por-ie':      'Por IE',
  'comunas':     'Comunas',
  'conflictos':  'Conflictos',
  'exportar':    'Exportar',
};

function CurrentView() {
  const currentView = useStore(s => s.currentView);

  switch (currentView) {
    case 'dashboard':  return <DashboardView />;
    case 'por-profe':  return <ProfeView />;
    case 'por-ie':     return <IEView />;
    case 'comunas':    return <ComunasView />;
    case 'conflictos': return <ConflictosView />;
    case 'exportar':   return (
      <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Cargando exportación…</div>}>
        <ExportarView />
      </Suspense>
    );
    default:           return <DashboardView />;
  }
}

function App() {
  return (
    <>
      <Layout>
        <CurrentView />
      </Layout>
      <AutoAssignModal />
    </>
  );
}

export default App;
