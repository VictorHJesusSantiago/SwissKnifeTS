import type { ReactNode } from 'react'
import type { ModuleId } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useLocalStorage } from '../../hooks/useLocalStorage'

export function AppShell({ active, onNavigate, children }: { active: ModuleId; onNavigate: (id: ModuleId) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage('opsphere-sidebar', false)
  return <div className="app-shell">
    <Sidebar active={active} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} onNavigate={onNavigate}/>
    <div className="app-main"><Topbar onSearch={() => undefined}/><main className="content">{children}</main></div>
  </div>
}
