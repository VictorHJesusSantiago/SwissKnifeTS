import { createContext, useContext, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { AuditEntry } from '../types'
import { useCurrentUser } from './CurrentUserContext'

interface AuditCtx {
  entries: AuditEntry[]
  logAction: (action: string, detail: string) => void
  clear: () => void
}

const Ctx = createContext<AuditCtx | null>(null)

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useLocalStorage<AuditEntry[]>('opsphere-audit', [])
  const { user } = useCurrentUser()

  const logAction = (action: string, detail: string) => {
    const entry: AuditEntry = { id: `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`, action, detail, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), actor: user.name }
    setEntries(list => [entry, ...list].slice(0, 200))
  }
  const clear = () => setEntries([])

  return <Ctx.Provider value={{ entries, logAction, clear }}>{children}</Ctx.Provider>
}

export function useAudit() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAudit deve ser usado dentro de AuditProvider')
  return ctx
}
