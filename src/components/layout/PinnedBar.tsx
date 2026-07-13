import { Pin } from 'lucide-react'
import { useFavorites } from '../../context/FavoritesContext'
import type { ModuleId } from '../../types'

export function PinnedBar({ onNavigate }: { onNavigate: (id: ModuleId) => void }) {
  const { favorites } = useFavorites()
  if (favorites.length === 0) return null
  return <div className="pinned-bar">
    <span className="pinned-bar__label"><Pin size={11}/> Fixados</span>
    {favorites.slice(0, 12).map(f => <button key={`${f.module}-${f.id}`} className="pinned-bar__chip" onClick={() => onNavigate(f.module)}>{f.label}</button>)}
  </div>
}
