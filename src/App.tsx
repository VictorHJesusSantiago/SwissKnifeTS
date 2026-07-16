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
import { UIPrefsProvider } from './context/UIPrefsContext'
import { NavigationStatsProvider, useNavigationStats } from './context/NavigationStatsContext'
import { ErrorLogProvider } from './context/ErrorLogContext'
import { DemoModeProvider, useDemoMode } from './context/DemoModeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DebugConsole } from './components/debug/DebugConsole'
import { ChangelogModal } from './components/changelog/ChangelogModal'
import { IdleLockProvider } from './context/IdleLockContext'
import { IdleLockOverlay } from './components/layout/IdleLockOverlay'
import { OnlineStatusBanner } from './components/layout/OnlineStatusBanner'
import { GlobalUndoProvider } from './context/GlobalUndoContext'
import { useLocalStorage } from './hooks/useLocalStorage'
import { APP_VERSION } from './data/changelog'
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
  help: lazy(() => import('./pages/HelpPage')),
}

function currentRoute(): ModuleId {
  const route = window.location.hash.replace('#/', '') as ModuleId
  return route in pages ? route : 'overview'
}

function ShellInner() {
  const [active, setActive] = useState<ModuleId>(currentRoute)
  const { start, hasSeenTour } = useTour()
  const { recordVisit } = useNavigationStats()
  const demo = useDemoMode()
  const [seenVersion, setSeenVersion] = useLocalStorage('opsphere-seen-version', '')
  const [showChangelog, setShowChangelog] = useState(false)

  useEffect(() => {
    const sync = () => setActive(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => { recordVisit(active) }, [active, recordVisit])

  useEffect(() => {
    if (active === 'overview' && !hasSeenTour) {
      const timer = setTimeout(() => start(), 600)
      return () => clearTimeout(timer)
    }
  }, [active, hasSeenTour, start])

  useEffect(() => {
    if (seenVersion !== APP_VERSION) {
      setShowChangelog(true)
      setSeenVersion(APP_VERSION)
    }
  }, [seenVersion, setSeenVersion])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') { demo.active ? demo.stop() : demo.start() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [demo])

  const navigate = (id: ModuleId) => {
    window.location.hash = `/${id}`
    setActive(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const Page = pages[active]
  return <>
    <OnlineStatusBanner/>
    {demo.active && <div className="demo-banner">Modo demonstração automática ativo <button onClick={demo.stop}>Parar</button></div>}
    <AppShell active={active} onNavigate={navigate}>
      <ErrorBoundary>
        <Suspense fallback={<div className="page-loader"><i/><span>Carregando módulo...</span></div>}>
          {active === 'overview' ? <Page onNavigate={navigate}/> : <Page/>}
        </Suspense>
      </ErrorBoundary>
    </AppShell>
    {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)}/>}
    <IdleLockOverlay/>
  </>
}

function Shell() {
  const [active, setActive] = useState<ModuleId>(currentRoute)
  useEffect(() => {
    const sync = () => setActive(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return <DemoModeProvider currentModule={active} onNavigate={id => { window.location.hash = `/${id}` }}>
    <ShellInner/>
  </DemoModeProvider>
}

export default function App() {
  return <ThemeProvider>
    <I18nProvider>
      <UIPrefsProvider>
        <RoleProvider>
          <CurrentUserProvider>
            <NotificationProvider>
              <ErrorLogProvider>
                <AuditProvider>
                  <FavoritesProvider>
                    <NavigationStatsProvider>
                      <IdleLockProvider>
                        <GlobalUndoProvider>
                          <TourProvider>
                            <Shell/>
                            <TourOverlay/>
                            <DebugConsole/>
                          </TourProvider>
                        </GlobalUndoProvider>
                      </IdleLockProvider>
                    </NavigationStatsProvider>
                  </FavoritesProvider>
                </AuditProvider>
              </ErrorLogProvider>
            </NotificationProvider>
          </CurrentUserProvider>
        </RoleProvider>
      </UIPrefsProvider>
    </I18nProvider>
  </ThemeProvider>
}
