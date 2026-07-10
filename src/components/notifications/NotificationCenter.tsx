import { Bug, CheckCheck, Info, Trash2, TriangleAlert } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import { classNames } from '../../utils/format'

const icon = { critical: TriangleAlert, warning: TriangleAlert, healthy: CheckCheck, info: Info } as const

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, markRead, markAllRead, clearAll } = useNotifications()
  if (!open) return null
  return <div className="notif-backdrop" onMouseDown={onClose}>
    <section className="notif-center" onMouseDown={e => e.stopPropagation()}>
      <header>
        <h2>Notificações</h2>
        <div className="notif-center__actions">
          <button className="link-button" onClick={markAllRead}>Marcar todas como lidas</button>
          <button className="link-button" onClick={clearAll}><Trash2 size={12}/> Limpar</button>
        </div>
      </header>
      <div className="notif-center__list">
        {notifications.length === 0 && <div className="empty-compact"><Bug size={20}/><span>Sem notificações</span></div>}
        {notifications.map(n => {
          const Icon = icon[n.tone]
          return <button key={n.id} className={classNames('notif-item', !n.read && 'is-unread')} onClick={() => markRead(n.id)}>
            <Icon size={15}/>
            <div><strong>{n.title}</strong><span>{n.message}</span><time>{n.time}</time></div>
          </button>
        })}
      </div>
    </section>
  </div>
}
