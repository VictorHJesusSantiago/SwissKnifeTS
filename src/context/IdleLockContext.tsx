import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface IdleLockCtx {
  locked: boolean
  unlock: () => void
  enabled: boolean
  toggleEnabled: () => void
  timeoutMinutes: number
  setTimeoutMinutes: (n: number) => void
}

const Ctx = createContext<IdleLockCtx | null>(null)

export function IdleLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useLocalStorage('opsphere-idle-lock-enabled', false)
  const [timeoutMinutes, setTimeoutMinutes] = useLocalStorage('opsphere-idle-lock-minutes', 10)
  const [locked, setLocked] = useState(false)
  const timer = useRef<number | null>(null)

  const resetTimer = () => {
    if (timer.current) window.clearTimeout(timer.current)
    if (!enabled || locked) return
    timer.current = window.setTimeout(() => setLocked(true), timeoutMinutes * 60 * 1000)
  }

  useEffect(() => {
    if (!enabled) { if (timer.current) window.clearTimeout(timer.current); return }
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => { events.forEach(e => window.removeEventListener(e, resetTimer)); if (timer.current) window.clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeoutMinutes, locked])

  const unlock = () => setLocked(false)

  return <Ctx.Provider value={{ locked, unlock, enabled, toggleEnabled: () => setEnabled(v => !v), timeoutMinutes, setTimeoutMinutes }}>
    {children}
  </Ctx.Provider>
}

export function useIdleLock() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useIdleLock deve ser usado dentro de IdleLockProvider')
  return ctx
}
