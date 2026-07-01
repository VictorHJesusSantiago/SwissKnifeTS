import { lazy, Suspense, useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import type { ModuleId } from './types'

const pages = {
  overview: lazy(() => import('./pages/OverviewPage')),
  pipelines: lazy(() => import('./pages/PipelinesPage')),
  logs: lazy(() => import('./pages/LogsPage')),
  tickets: lazy(() => import('./pages/TicketsPage')),
  network: lazy(() => import('./pages/NetworkPage')),
  terraform: lazy(() => import('./pages/TerraformPage')),
  kubernetes: lazy(() => import('./pages/KubernetesPage')),
  namespaces: lazy(() => import('./pages/NamespacesPage')),
  services: lazy(() => import('./pages/ServicesPage')),
  vulnerabilities: lazy(() => import('./pages/VulnerabilitiesPage')),
  capacity: lazy(() => import('./pages/CapacityPage')),
  runbooks: lazy(() => import('./pages/RunbooksPage')),
  assets: lazy(() => import('./pages/AssetsPage')),
}

function currentRoute(): ModuleId {
  const route = window.location.hash.replace('#/', '') as ModuleId
  return route in pages ? route : 'overview'
}

export default function App() {
  const [active, setActive] = useState<ModuleId>(currentRoute)
  useEffect(() => {
    const sync = () => setActive(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const navigate = (id: ModuleId) => {
    window.location.hash = `/${id}`
    setActive(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const Page = pages[active]
  return <AppShell active={active} onNavigate={navigate}>
    <Suspense fallback={<div className="page-loader"><i/><span>Carregando módulo...</span></div>}>
      {active === 'overview' ? <Page onNavigate={navigate}/> : <Page/>}
    </Suspense>
  </AppShell>
}
