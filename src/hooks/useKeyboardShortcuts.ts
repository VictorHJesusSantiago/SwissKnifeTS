import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

export type ShortcutAction = 'palette' | 'toggleTheme' | 'help' | 'navOverview' | 'navPipelines' | 'navTickets' | 'navSettings'

export interface ShortcutBinding {
  action: ShortcutAction
  description: string
  keys: string
}

export const defaultBindings: ShortcutBinding[] = [
  { action: 'palette', description: 'Abrir busca global (command palette)', keys: 'mod+k' },
  { action: 'navOverview', description: 'Ir para Visão geral', keys: 'g o' },
  { action: 'navPipelines', description: 'Ir para Pipelines', keys: 'g p' },
  { action: 'navTickets', description: 'Ir para Tickets', keys: 'g t' },
  { action: 'navSettings', description: 'Ir para Configurações', keys: 'g s' },
  { action: 'toggleTheme', description: 'Alternar tema claro/escuro', keys: 'shift+t' },
  { action: 'help', description: 'Mostrar esta lista de atalhos', keys: '?' },
]

export function useShortcutBindings() {
  return useLocalStorage<ShortcutBinding[]>('opsphere-shortcut-bindings', defaultBindings)
}

export function formatKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('mod')
  if (e.shiftKey && e.key.toLowerCase() !== 'shift') parts.push('shift')
  if (e.altKey) parts.push('alt')
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  if (!['control', 'meta', 'shift', 'alt'].includes(key)) parts.push(key)
  return parts.join('+')
}

// globalShortcuts kept for backwards-compatible display; prefer useShortcutBindings() for live data.
export const globalShortcuts: ShortcutBinding[] = defaultBindings

export function useKeyboardShortcuts(handlers: {
  onPalette: () => void
  onNavigate: (id: 'overview' | 'pipelines' | 'tickets' | 'settings') => void
  onToggleTheme: () => void
  onHelp: () => void
}) {
  const [bindings] = useShortcutBindings()

  useEffect(() => {
    let pendingG = false
    let timeout: ReturnType<typeof setTimeout>
    const find = (action: ShortcutAction) => bindings.find(b => b.action === action)?.keys

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      const combo = formatKeyEvent(e)

      if (combo === find('palette')) { e.preventDefault(); handlers.onPalette(); return }
      if (isTyping) return
      if (pendingG) {
        pendingG = false
        clearTimeout(timeout)
        const navMap: Partial<Record<ShortcutAction, 'overview' | 'pipelines' | 'tickets' | 'settings'>> = {
          navOverview: 'overview', navPipelines: 'pipelines', navTickets: 'tickets', navSettings: 'settings',
        }
        const letter = e.key.toLowerCase()
        const action = (['navOverview', 'navPipelines', 'navTickets', 'navSettings'] as ShortcutAction[])
          .find(a => find(a) === `g ${letter}`)
        if (action) handlers.onNavigate(navMap[action]!)
        return
      }
      if (e.key.toLowerCase() === 'g' && bindings.some(b => b.keys.startsWith('g '))) { pendingG = true; timeout = setTimeout(() => { pendingG = false }, 900); return }
      if (combo === find('toggleTheme')) { handlers.onToggleTheme(); return }
      if (e.key === find('help')) { handlers.onHelp(); return }
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); clearTimeout(timeout) }
  }, [handlers, bindings])
}
