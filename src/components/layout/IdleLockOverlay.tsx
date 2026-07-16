import { Lock } from 'lucide-react'
import { useIdleLock } from '../../context/IdleLockContext'
import { useCurrentUser } from '../../context/CurrentUserContext'

export function IdleLockOverlay() {
  const { locked, unlock } = useIdleLock()
  const { user } = useCurrentUser()
  if (!locked) return null
  return <div className="idle-lock-overlay">
    <div className="idle-lock-card">
      <Lock size={28}/>
      <h2>Sessão pausada por inatividade</h2>
      <p>Olá, {user.name}. Por segurança, a tela foi bloqueada após um período sem interação.</p>
      <button className="button button--primary button--full" onClick={unlock}>Retomar sessão</button>
    </div>
  </div>
}
