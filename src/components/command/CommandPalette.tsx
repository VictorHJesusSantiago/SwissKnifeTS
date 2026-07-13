import { useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, Bug, Clock, CornerDownLeft, GitBranch, Search, Star, TicketCheck } from 'lucide-react'
import { navigation } from '../../config/navigation'
import type { ModuleId } from '../../types'
import { useFavorites } from '../../context/FavoritesContext'
import { useNavigationStats } from '../../context/NavigationStatsContext'
import { classNames } from '../../utils/format'
import { searchEntities, type SearchEntityType } from '../../utils/searchIndex'

const entityIcons: Record<SearchEntityType, typeof GitBranch> = {
  pipeline: GitBranch,
  ticket: TicketCheck,
  vulnerability: Bug,
  asset: Boxes,
}

export function CommandPalette({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (id: ModuleId) => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { favorites } = useFavorites()
  const { recentModules } = useNavigationStats()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = navigation.map(n => ({ id: n.id, label: n.label, section: n.section, icon: n.icon }))
    if (!q) return items
    return items.filter(i => i.label.toLowerCase().includes(q) || i.section.toLowerCase().includes(q))
  }, [query])

  const entityResults = useMemo(() => searchEntities(query), [query])

  const combinedCount = results.length + entityResults.length

  useEffect(() => { if (open) { setQuery(''); setIndex(0); setTimeout(() => inputRef.current?.focus(), 10) } }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, combinedCount - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') {
        if (index < results.length && results[index]) { onNavigate(results[index].id); onClose() }
        else if (entityResults[index - results.length]) { onNavigate(entityResults[index - results.length].module); onClose() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, entityResults, combinedCount, index, onClose, onNavigate])

  if (!open) return null

  return <div className="modal-backdrop palette-backdrop" onMouseDown={onClose}>
    <section className="command-palette" onMouseDown={e => e.stopPropagation()}>
      <div className="command-palette__input">
        <Search size={17}/>
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setIndex(0) }} placeholder="Ir para módulo, buscar recurso..."/>
        <kbd>ESC</kbd>
      </div>
      {favorites.length > 0 && !query && <div className="command-palette__section">
        <span>FAVORITOS</span>
        {favorites.slice(0, 5).map(f => <button key={`${f.module}-${f.id}`} onClick={() => { onNavigate(f.module); onClose() }}><Star size={14}/>{f.label}</button>)}
      </div>}
      {recentModules.length > 0 && !query && <div className="command-palette__section">
        <span>NAVEGAÇÃO RECENTE</span>
        {recentModules.slice(0, 5).map(id => {
          const nav = navigation.find(n => n.id === id)
          if (!nav) return null
          return <button key={id} onClick={() => { onNavigate(id); onClose() }}><Clock size={14}/>{nav.label}</button>
        })}
      </div>}
      <div className="command-palette__list">
        {results.map((r, i) => <button key={r.id} className={classNames('command-palette__item', i === index && 'is-active')} onMouseEnter={() => setIndex(i)} onClick={() => { onNavigate(r.id); onClose() }}>
          <r.icon size={16}/><span>{r.label}</span><small>{r.section}</small>{i === index && <CornerDownLeft size={13}/>}
        </button>)}
        {results.length === 0 && !query && <div className="command-palette__empty">Nenhum módulo encontrado</div>}
      </div>
      {query && entityResults.length > 0 && <div className="command-palette__section">
        <span>RESULTADOS</span>
        <div className="command-palette__list">
          {entityResults.map((r, i) => {
            const combinedIndex = results.length + i
            const Icon = entityIcons[r.type]
            return <button key={r.id} className={classNames('command-palette__item', combinedIndex === index && 'is-active')} onMouseEnter={() => setIndex(combinedIndex)} onClick={() => { onNavigate(r.module); onClose() }}>
              <Icon size={16}/><span>{r.label}</span><small>{r.sublabel}</small>{combinedIndex === index && <CornerDownLeft size={13}/>}
            </button>
          })}
        </div>
      </div>}
      {query && results.length === 0 && entityResults.length === 0 && <div className="command-palette__empty">Nenhum resultado encontrado</div>}
    </section>
  </div>
}
