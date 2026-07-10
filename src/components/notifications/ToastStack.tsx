import { CheckCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'

const icon = { critical: TriangleAlert, warning: TriangleAlert, healthy: CheckCheck, info: Info } as const

export function ToastStack() {
  const { toasts, dismissToast } = useNotifications()
  return <div className="toast-stack">
    {toasts.map(t => {
      const Icon = icon[t.tone]
      return <div className={`toast toast--${t.tone}`} key={t.id}>
        <Icon size={16}/>
        <div><strong>{t.title}</strong><span>{t.message}</span></div>
        <button onClick={() => dismissToast(t.id)}><X size={14}/></button>
      </div>
    })}
  </div>
}
