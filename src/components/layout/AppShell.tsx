import { useState, type ReactNode } from 'react'
import type { ModuleId } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { CommandPalette } from '../command/CommandPalette'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { ToastStack } from '../notifications/ToastStack'
import { Modal } from '../ui/Modal'
import { useKeyboardShortcuts, useShortcutBindings } from '../../hooks/useKeyboardShortcuts'
import { useTheme } from '../../context/ThemeContext'
import { PinnedBar } from './PinnedBar'

export function AppShell({ active, onNavigate, children }: { active: ModuleId; onNavigate: (id: ModuleId) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage('opsphere-sidebar', false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { toggleTheme } = useTheme()
  const [bindings] = useShortcutBindings()

  useKeyboardShortcuts({
    onPalette: () => setPaletteOpen(v => !v),
    onNavigate: id => onNavigate(id),
    onToggleTheme: toggleTheme,
    onHelp: () => setHelpOpen(true),
  })

  return <div className="app-shell">
    <Sidebar active={active} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} onNavigate={onNavigate}/>
    <div className="app-main">
      <Topbar onOpenPalette={() => setPaletteOpen(true)} onOpenNotifications={() => setNotifOpen(true)}/>
      <PinnedBar onNavigate={onNavigate}/>
      <main className="content">{children}</main>
    </div>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={onNavigate}/>
    <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)}/>
    <ToastStack/>
    {helpOpen && <Modal title="Atalhos de teclado" onClose={() => setHelpOpen(false)}>
      <div className="shortcut-list" style={{ padding: 18 }}>
        {bindings.map(s => <div key={s.action}><kbd>{s.keys}</kbd><span>{s.description}</span></div>)}
      </div>
    </Modal>}
  </div>
}
