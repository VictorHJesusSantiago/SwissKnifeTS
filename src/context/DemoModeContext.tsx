import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { navigation } from '../config/navigation'
import type { ModuleId } from '../types'

interface DemoModeCtx {
  active: boolean
  start: () => void
  stop: () => void
}

const Ctx = createContext<DemoModeCtx | null>(null)

export function DemoModeProvider({ children, currentModule, onNavigate }: { children: ReactNode; currentModule: ModuleId; onNavigate: (id: ModuleId) => void }) {
  const [active, setActive] = useState(false)
  const timer = useRef<number | null>(null)
  const moduleRef = useRef(currentModule)
  moduleRef.current = currentModule

  const start = () => {
    setActive(true)
    timer.current = window.setInterval(() => {
      const i = navigation.findIndex(n => n.id === moduleRef.current)
      onNavigate(navigation[(i + 1) % navigation.length].id)
    }, 4000)
  }
  const stop = () => {
    setActive(false)
    if (timer.current) window.clearInterval(timer.current)
  }

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current) }, [])

  return <Ctx.Provider value={{ active, start, stop }}>{children}</Ctx.Provider>
}

export function useDemoMode() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDemoMode deve ser usado dentro de DemoModeProvider')
  return ctx
}
