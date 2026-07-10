import { createContext, useContext, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { Role } from './RoleContext'

export interface MockUser {
  id: string
  name: string
  initials: string
  role: Role
}

export const mockUsers: MockUser[] = [
  { id: 'u1', name: 'Victor Lima', initials: 'VL', role: 'admin' },
  { id: 'u2', name: 'Ana Lima', initials: 'AL', role: 'admin' },
  { id: 'u3', name: 'Caio Nunes', initials: 'CN', role: 'viewer' },
  { id: 'u4', name: 'Bia Reis', initials: 'BR', role: 'viewer' },
]

interface CurrentUserCtx {
  user: MockUser
  switchUser: (id: string) => void
}

const Ctx = createContext<CurrentUserCtx | null>(null)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useLocalStorage('opsphere-current-user', mockUsers[0].id)
  const user = mockUsers.find(u => u.id === userId) ?? mockUsers[0]
  return <Ctx.Provider value={{ user, switchUser: setUserId }}>{children}</Ctx.Provider>
}

export function useCurrentUser() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCurrentUser deve ser usado dentro de CurrentUserProvider')
  return ctx
}
