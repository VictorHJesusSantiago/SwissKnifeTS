import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export interface ErrorLogEntry {
  id: string
  message: string
  stack?: string
  time: string
}

interface ErrorLogCtx {
  errors: ErrorLogEntry[]
  logError: (message: string, stack?: string) => void
  clearErrors: () => void
}

const Ctx = createContext<ErrorLogCtx | null>(null)

export function ErrorLogProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useLocalStorage<ErrorLogEntry[]>('opsphere-error-log', [])

  const logError = (message: string, stack?: string) => {
    const entry: ErrorLogEntry = { id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`, message, stack, time: new Date().toLocaleString('pt-BR') }
    setErrors(list => [entry, ...list].slice(0, 100))
  }
  const clearErrors = () => setErrors([])

  useEffect(() => {
    const onError = (event: ErrorEvent) => logError(event.message, event.error?.stack)
    const onRejection = (event: PromiseRejectionEvent) => logError(`Promise rejeitada: ${String(event.reason)}`)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return <Ctx.Provider value={{ errors, logError, clearErrors }}>{children}</Ctx.Provider>
}

export function useErrorLog() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useErrorLog deve ser usado dentro de ErrorLogProvider')
  return ctx
}
