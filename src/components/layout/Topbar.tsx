import { useState } from 'react'
import { Bell, Search, Shield } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import { useI18n } from '../../i18n/I18nContext'
import { useCurrentUser, mockUsers } from '../../context/CurrentUserContext'
import { useRole } from '../../context/RoleContext'
import { classNames } from '../../utils/format'

export function Topbar({ onOpenPalette, onOpenNotifications }: { onOpenPalette: () => void; onOpenNotifications: () => void }) {
  const { unreadCount } = useNotifications()
  const { t } = useI18n()
  const { user, switchUser } = useCurrentUser()
  const { role } = useRole()
  const [menuOpen, setMenuOpen] = useState(false)

  return <header className="topbar">
    <button className="global-search" data-tour="global-search" onClick={onOpenPalette}><Search size={17}/><span>{t('search.placeholder')}</span><kbd>⌘ K</kbd></button>
    <div className="topbar__right">
      {role === 'viewer' && <span className="role-badge"><Shield size={11}/> Somente leitura</span>}
      <span className="live-status"><i/> Sistemas operacionais</span>
      <button className="icon-button" data-tour="notifications" onClick={onOpenNotifications}><Bell size={19}/>{unreadCount > 0 && <b/>}</button>
      <div className="user-switcher" data-tour="user-switcher">
        <div className="avatar" role="button" onClick={() => setMenuOpen(v => !v)} style={{ cursor: 'pointer' }}>{user.initials}</div>
        {menuOpen && <div className="user-switcher__menu" onMouseLeave={() => setMenuOpen(false)}>
          {mockUsers.map(u => <button key={u.id} className={classNames(u.id === user.id && 'is-active')} onClick={() => { switchUser(u.id); setMenuOpen(false) }}>
            <span className="mini-avatar">{u.initials}</span> {u.name}
          </button>)}
        </div>}
      </div>
    </div>
  </header>
}
