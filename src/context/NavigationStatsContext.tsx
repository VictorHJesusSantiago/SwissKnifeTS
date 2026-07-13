import { createContext, useContext, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { ModuleId } from '../types'

interface NavigationStatsCtx {
  recentModules: ModuleId[]
  visitCounts: Partial<Record<ModuleId, number>>
  recordVisit: (id: ModuleId) => void
}

const Ctx = createContext<NavigationStatsCtx | null>(null)

export function NavigationStatsProvider({ children }: { children: ReactNode }) {
  const [recentModules, setRecentModules] = useLocalStorage<ModuleId[]>('opsphere-recent-modules', [])
  const [visitCounts, setVisitCounts] = useLocalStorage<Partial<Record<ModuleId, number>>>('opsphere-visit-counts', {})

  const recordVisit = (id: ModuleId) => {
    setRecentModules(list => [id, ...list.filter(m => m !== id)].slice(0, 8))
    setVisitCounts(counts => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }))
  }

  return <Ctx.Provider value={{ recentModules, visitCounts, recordVisit }}>{children}</Ctx.Provider>
}

export function useNavigationStats() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNavigationStats deve ser usado dentro de NavigationStatsProvider')
  return ctx
}
