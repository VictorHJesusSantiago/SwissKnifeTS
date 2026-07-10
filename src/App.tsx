import { lazy, Suspense, useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ThemeProvider } from './context/ThemeContext'
import { I18nProvider } from './i18n/I18nContext'
import { NotificationProvider } from './context/NotificationContext'
import { AuditProvider } from './context/AuditContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { RoleProvider } from './context/RoleContext'
import { CurrentUserProvider } from './context/CurrentUserContext'
import { TourProvider, useTour } from './context/TourContext'
import { TourOverlay } from './components/tour/TourOverlay'
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
  settings: lazy(() => import('./pages/SettingsPage')),
  comparator: lazy(() => import('./pages/ComparatorPage')),
}

function currentRoute(): ModuleId {
  const route = window.location.hash.replace('#/', '') as ModuleId
  return route in pages ? route : 'overview'
}

function Shell() {
  const [active, setActive] = useState<ModuleId>(currentRoute)
  const { start, hasSeenTour } = useTour()
  useEffect(() => {
    const sync = () => setActive(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    if (active === 'overview' && !hasSeenTour) {
      const timer = setTimeout(() => start(), 600)
      return () => clearTimeout(timer)
    }
  }, [active, hasSeenTour, start])
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

export default function App() {
  return <ThemeProvider>
    <I18nProvider>
      <RoleProvider>
        <CurrentUserProvider>
          <NotificationProvider>
            <AuditProvider>
              <FavoritesProvider>
                <TourProvider>
                  <Shell/>
                  <TourOverlay/>
                </TourProvider>
              </FavoritesProvider>
            </AuditProvider>
          </NotificationProvider>
        </CurrentUserProvider>
      </RoleProvider>
    </I18nProvider>
  </ThemeProvider>
}
