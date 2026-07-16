import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUIPrefs } from './UIPrefsContext'
import { playBeep } from '../utils/sound'
import type { NotificationItem, Severity } from '../types'

interface Toast extends NotificationItem { }

interface NotificationCtx {
  notifications: NotificationItem[]
  unreadCount: number
  addNotification: (title: string, message: string, tone?: Severity) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  toasts: Toast[]
  dismissToast: (id: string) => void
}

const Ctx = createContext<NotificationCtx | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useLocalStorage<NotificationItem[]>('opsphere-notifications', [
    { id: 'n1', title: 'Pipeline falhou', message: 'web-storefront falhou nos testes na branch main.', tone: 'critical', time: 'há 18 min', read: false },
    { id: 'n2', title: 'Vulnerabilidade crítica', message: 'CVE-2026-3182 detectada em checkout-api.', tone: 'critical', time: 'há 1 h', read: false },
    { id: 'n3', title: 'Namespace provisionado', message: 'staging-payments está pronto para uso.', tone: 'healthy', time: 'há 3 h', read: true },
  ])
  const [toasts, setToasts] = useState<Toast[]>([])
  const { soundEnabled } = useUIPrefs()

  const addNotification: NotificationCtx['addNotification'] = (title, message, tone = 'info') => {
    const item: NotificationItem = { id: `n${Date.now()}`, title, message, tone, time: 'agora', read: false }
    setNotifications(list => [item, ...list].slice(0, 50))
    setToasts(list => [...list, item])
    if (soundEnabled) playBeep(tone)
    setTimeout(() => setToasts(list => list.filter(t => t.id !== item.id)), 5000)
  }

  const markRead = (id: string) => setNotifications(list => list.map(n => n.id === id ? { ...n, read: true } : n))
  const markAllRead = () => setNotifications(list => list.map(n => ({ ...n, read: true })))
  const clearAll = () => setNotifications([])
  const dismissToast = (id: string) => setToasts(list => list.filter(t => t.id !== id))

  const unreadCount = notifications.filter(n => !n.read).length

  return <Ctx.Provider value={{ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll, toasts, dismissToast }}>
    {children}
  </Ctx.Provider>
}

export function useNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications deve ser usado dentro de NotificationProvider')
  return ctx
}
