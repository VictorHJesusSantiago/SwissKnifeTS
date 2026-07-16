import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { ModuleId } from '../types'

interface NavigationStatsCtx {
  recentModules: ModuleId[]
  visitCounts: Partial<Record<ModuleId, number>>
  recordVisit: (id: ModuleId) => void
  usageSecondsToday: number
}

const Ctx = createContext<NavigationStatsCtx | null>(null)

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function NavigationStatsProvider({ children }: { children: ReactNode }) {
  const [recentModules, setRecentModules] = useLocalStorage<ModuleId[]>('opsphere-recent-modules', [])
  const [visitCounts, setVisitCounts] = useLocalStorage<Partial<Record<ModuleId, number>>>('opsphere-visit-counts', {})
  const [usageByDay, setUsageByDay] = useLocalStorage<Record<string, number>>('opsphere-usage-seconds', {})

  const recordVisit = (id: ModuleId) => {
    setRecentModules(list => [id, ...list.filter(m => m !== id)].slice(0, 8))
    setVisitCounts(counts => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }))
  }

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      const key = todayKey()
      setUsageByDay(days => ({ ...days, [key]: (days[key] ?? 0) + 1 }))
    }
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Ctx.Provider value={{ recentModules, visitCounts, recordVisit, usageSecondsToday: usageByDay[todayKey()] ?? 0 }}>{children}</Ctx.Provider>
}

export function useNavigationStats() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNavigationStats deve ser usado dentro de NavigationStatsProvider')
  return ctx
}
