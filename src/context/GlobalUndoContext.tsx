import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useNotifications } from './NotificationContext'

interface UndoableAction {
  id: string
  label: string
  undo: () => void
}

interface GlobalUndoCtx {
  registerUndo: (label: string, undo: () => void) => void
}

const Ctx = createContext<GlobalUndoCtx | null>(null)

export function GlobalUndoProvider({ children }: { children: ReactNode }) {
  const stack = useRef<UndoableAction[]>([])
  const { addNotification } = useNotifications()

  const registerUndo = (label: string, undo: () => void) => {
    stack.current.push({ id: `u${Date.now()}${Math.random().toString(36).slice(2, 5)}`, label, undo })
    if (stack.current.length > 50) stack.current.shift()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (isTyping) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const action = stack.current.pop()
        if (action) {
          e.preventDefault()
          action.undo()
          addNotification('Ação desfeita', action.label, 'info')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addNotification])

  return <Ctx.Provider value={{ registerUndo }}>{children}</Ctx.Provider>
}

export function useGlobalUndo() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGlobalUndo deve ser usado dentro de GlobalUndoProvider')
  return ctx
}
