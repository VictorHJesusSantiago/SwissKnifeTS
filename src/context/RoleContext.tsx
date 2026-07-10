import { createContext, useContext, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export type Role = 'admin' | 'viewer'

interface RoleCtx {
  role: Role
  setRole: (r: Role) => void
  canEdit: boolean
}

const Ctx = createContext<RoleCtx | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useLocalStorage<Role>('opsphere-role', 'admin')
  return <Ctx.Provider value={{ role, setRole, canEdit: role === 'admin' }}>{children}</Ctx.Provider>
}

export function useRole() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRole deve ser usado dentro de RoleProvider')
  return ctx
}
