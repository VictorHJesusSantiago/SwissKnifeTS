import { Bookmark, LayoutGrid, Link2, List, Paperclip, Plus, Redo2, Search, Send, Star, ThumbsUp, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { PrintButton } from '../components/ui/PrintButton'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useGlobalUndo } from '../context/GlobalUndoContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { assigneeOptions, findDuplicateCandidates, parseAgeToHours, slaHoursByPriority, ticketTemplates } from '../data/ticketsExtra'
import type { AttachmentMeta, ChecklistItem, SavedView, TicketComment } from '../data/ticketsExtra'
import { ageBucketFor, ageBuckets, buildPostmortemMarkdown, type PostmortemDraft } from '../data/ticketsExtra3'
import { initialTickets } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUndoable } from '../hooks/useUndoable'
import { useI18n } from '../i18n/I18nContext'
import type { Ticket } from '../types'
import '../styles/tickets-extra.css'
import '../styles/tickets-extra2.css'
import '../styles/tickets-extra3.css'

function loadStoredTickets(): Ticket[] {
  try {
    const stored = localStorage.getItem('opsphere-tickets')
    return stored ? JSON.parse(stored) as Ticket[] : initialTickets
  } catch { return initialTickets }
}

const columns: Ticket['status'][] = ['Backlog', 'Em andamento', 'Revisão', 'Concluído']
const reactionEmojis = ['👍', '🔥', '👀']
const STALE_THRESHOLD_HOURS = 48

function initials(name: string) {
  return name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
}

function isSlaBreached(ticket: Ticket): boolean {
  const totalHours = slaHoursByPriority[ticket.priority]
  const elapsed = parseAgeToHours(ticket.age)
  return elapsed >= totalHours
}

function SlaBar({ ticket }: { ticket: Ticket }) {
  const { t } = useI18n()
  const totalHours = slaHoursByPriority[ticket.priority]
  const elapsed = parseAgeToHours(ticket.age)
  const remaining = Math.max(0, totalHours - elapsed)
  const pctRemaining = Math.max(0, Math.min(100, (remaining / totalHours) * 100))
  const isBreached = remaining <= 0
  const isWarning = !isBreached && pctRemaining < 20
  const tone = isBreached ? 'is-critical' : isWarning ? 'is-warning' : ''
  const label = isBreached ? t('tickets.slaBreached') : `${remaining.toFixed(1)}h ${t('tickets.slaRemaining')} ${totalHours}h`
  return <div>
    <div className={`sla-bar ${tone}`}><i style={{ width: `${pctRemaining}%` }} /></div>
    <div className={`sla-label ${tone}`}><span>SLA {ticket.priority}</span><span>{label}</span></div>
  </div>
}

export default function TicketsPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { addNotification } = useNotifications()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()
  const { state: tickets, set: setTickets, undo: undoTickets, redo: redoTickets, canUndo, canRedo } = useUndoable<Ticket[]>(loadStoredTickets())
  useEffect(() => { localStorage.setItem('opsphere-tickets', JSON.stringify(tickets)) }, [tickets])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      if (isTyping) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoTickets() }
      else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoTickets() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undoTickets, redoTickets])
  const [comments, setComments] = useLocalStorage<Record<string, TicketComment[]>>('opsphere-ticket-comments', {})
  const [attachments, setAttachments] = useLocalStorage<Record<string, AttachmentMeta[]>>('opsphere-ticket-attachments', {})
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>('opsphere-ticket-views', [])

  // --- 13. Round-robin auto-atribuição ---
  const [roundRobinIndex, setRoundRobinIndex] = useLocalStorage<number>('opsphere-tickets-round-robin-index', 0)
  const assignableOptions = assigneeOptions.filter(name => name !== 'Não atribuído')

  // --- 14. Dependências entre tickets ---
  const [dependencies, setDependencies] = useLocalStorage<Record<string, string>>('opsphere-ticket-dependencies', {})

  // --- 15. Checklist ---
  const [checklists, setChecklists] = useLocalStorage<Record<string, ChecklistItem[]>>('opsphere-ticket-checklists', {})
  const [checklistDraft, setChecklistDraft] = useState('')

  // --- 17. Story points ---
  const [storyPoints, setStoryPoints] = useLocalStorage<Record<string, number>>('opsphere-ticket-points', {})

  // --- 19. Reações em comentários ---
  const [reactions, setReactions] = useLocalStorage<Record<string, Record<string, number>>>('opsphere-ticket-comment-reactions', {})

  // --- Votos de priorização ("concordo com a prioridade") ---
  const [votes, setVotes] = useLocalStorage<Record<string, number>>('opsphere-ticket-votes', {})
  const [votedByMe, setVotedByMe] = useLocalStorage<Record<string, boolean>>('opsphere-ticket-voted-by-me', {})
  const [sortByVotes, setSortByVotes] = useState(false)

  // --- Pós-mortem automático ---
  const [postmortems, setPostmortems] = useLocalStorage<Record<string, PostmortemDraft>>('opsphere-ticket-postmortems', {})
  const [showPostmortem, setShowPostmortem] = useState(false)

  // --- Histograma de idade por coluna ---
  const [showAgeHistogram, setShowAgeHistogram] = useState(false)

  const { registerUndo } = useGlobalUndo()

  // --- 16. Modo lista ---
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [sortColumn, setSortColumn] = useState<'id' | 'priority' | 'status' | 'assignee' | 'age'>('id')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const [modal, setModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('TODAS')
  const [tagFilter, setTagFilter] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', priority: 'P2' as Ticket['priority'], assignee: '', tags: [] as string[] })
  const [duplicateCandidates, setDuplicateCandidates] = useState<{ ticket: { id: string; title: string }; score: number }[]>([])
  const [recurringMatch, setRecurringMatch] = useState<{ id: string; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const allTags = useMemo(() => Array.from(new Set(tickets.flatMap(t => t.tags))), [tickets])

  const visible = useMemo(() => tickets.filter(t =>
    (t.title.toLowerCase().includes(query.toLowerCase()) || t.id.toLowerCase().includes(query.toLowerCase())) &&
    (priorityFilter === 'TODAS' || t.priority === priorityFilter) &&
    (!tagFilter || t.tags.includes(tagFilter)),
  ), [tickets, query, priorityFilter, tagFilter])

  const sortedVisible = useMemo(() => {
    const list = [...visible]
    list.sort((a, b) => {
      let cmp = 0
      if (sortColumn === 'id') cmp = a.id.localeCompare(b.id)
      else if (sortColumn === 'priority') cmp = a.priority.localeCompare(b.priority)
      else if (sortColumn === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortColumn === 'assignee') cmp = a.assignee.localeCompare(b.assignee)
      else if (sortColumn === 'age') cmp = parseAgeToHours(a.age) - parseAgeToHours(b.age)
      return cmp * sortDir
    })
    return list
  }, [visible, sortColumn, sortDir])

  const detailTicket = tickets.find(t => t.id === detailId) || null
  const detailComments = detailId ? (comments[detailId] || []) : []
  const detailAttachments = detailId ? (attachments[detailId] || []) : []
  const detailChecklist = detailId ? (checklists[detailId] || []) : []
  const blockerTicket = detailId ? tickets.find(t => t.id === dependencies[detailId]) : null

  const applyTemplate = (templateId: string) => {
    const template = ticketTemplates.find(t => t.id === templateId)
    if (!template) return
    setSelectedTemplate(templateId)
    setForm({ title: template.title, priority: template.priority, assignee: '', tags: template.tags })
  }

  // --- 11. Detecção de duplicados ao digitar título ---
  const handleTitleChange = (value: string) => {
    setForm({ ...form, title: value })
    setDuplicateCandidates(value.trim().length > 3 ? findDuplicateCandidates(value, tickets) : [])
    const closedMatches = value.trim().length > 3 ? findDuplicateCandidates(value, tickets.filter(tk => tk.status === 'Concluído')) : []
    setRecurringMatch(closedMatches[0]?.ticket || null)
  }

  const create = () => {
    if (!form.title.trim()) return
    const id = `OPS-${419 + tickets.length}`
    let assignee = form.assignee
    if (!assignee) {
      assignee = assignableOptions[roundRobinIndex % assignableOptions.length]
      setRoundRobinIndex(i => (i + 1) % assignableOptions.length)
    }
    setTickets(list => [{ id, title: form.title, priority: form.priority, status: 'Backlog', assignee, tags: form.tags.length ? form.tags : ['novo'], age: 'agora' }, ...list])
    logAction('Ticket criado', `${id} · ${form.title}`)
    addNotification('Ticket criado', `${id} foi adicionado ao backlog e atribuído a ${assignee}.`, 'info')

    // --- Detecção de tickets recorrentes: ticket "Concluído" com título muito similar ---
    const closedMatches = findDuplicateCandidates(form.title, tickets.filter(tk => tk.status === 'Concluído'))
    if (closedMatches.length > 0) {
      const match = closedMatches[0]
      addNotification('Problema recorrente detectado', `Este problema já ocorreu antes, ticket ${match.ticket.id}.`, 'warning')
    }

    setModal(false)
    setSelectedTemplate(null)
    setForm({ title: '', priority: 'P2', assignee: '', tags: [] })
    setDuplicateCandidates([])
    setRecurringMatch(null)
  }

  const move = (ticket: Ticket, direction: number) => {
    const index = columns.indexOf(ticket.status)
    const next = columns[Math.max(0, Math.min(3, index + direction))]
    setTickets(ts => ts.map(t => t.id === ticket.id ? { ...t, status: next } : t))
  }

  const reassign = (ticketId: string, assignee: string) => {
    setTickets(ts => ts.map(t => t.id === ticketId ? { ...t, assignee } : t))
    logAction('Ticket reatribuído', `${ticketId} atribuído a ${assignee}`)
    addNotification('Responsável alterado', `${ticketId} agora é responsabilidade de ${assignee}.`, 'info')
  }

  const addComment = () => {
    if (!detailId || !commentDraft.trim()) return
    const comment: TicketComment = { id: `c${Date.now()}`, author: 'Victor Lima', text: commentDraft.trim(), time: new Date().toLocaleString('pt-BR') }
    setComments(map => ({ ...map, [detailId]: [...(map[detailId] || []), comment] }))
    logAction('Comentário adicionado', `${detailId}: "${commentDraft.trim().slice(0, 60)}"`)
    setCommentDraft('')
  }

  const toggleReaction = (commentId: string, emoji: string) => {
    setReactions(map => {
      const current = map[commentId] || {}
      const next = { ...current, [emoji]: (current[emoji] || 0) + 1 }
      return { ...map, [commentId]: next }
    })
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!detailId || !fileList) return
    const items: AttachmentMeta[] = Array.from(fileList).map(file => ({
      id: `att${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setAttachments(map => ({ ...map, [detailId]: [...(map[detailId] || []), ...items] }))
    logAction('Anexo adicionado', `${items.length} arquivo(s) anexado(s) a ${detailId}`)
  }

  const saveCurrentView = () => {
    const name = window.prompt('Nome da view (ex: "Meus tickets", "Críticos abertos")')
    if (!name) return
    const view: SavedView = { id: `v${Date.now()}`, name, query, priority: priorityFilter, tag: tagFilter }
    setSavedViews(list => [view, ...list].slice(0, 15))
    logAction('View salva', `View "${name}" criada`)
  }
  const applyView = (view: SavedView) => { setQuery(view.query); setPriorityFilter(view.priority); setTagFilter(view.tag) }
  const removeView = (id: string) => setSavedViews(list => list.filter(v => v.id !== id))

  const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  // --- 12. Métricas de time-to-resolution por prioridade ---
  const ttrByPriority = useMemo(() => {
    const priorities: Ticket['priority'][] = ['P0', 'P1', 'P2', 'P3']
    return priorities.map(priority => {
      const done = tickets.filter(tk => tk.status === 'Concluído' && tk.priority === priority)
      const avg = done.length ? done.reduce((sum, tk) => sum + parseAgeToHours(tk.age), 0) / done.length : 0
      return { priority, avg, count: done.length }
    })
  }, [tickets])

  // --- 17. Pontos restantes por coluna ---
  const columnPoints = (column: Ticket['status']) => visible.filter(tk => tk.status === column).reduce((sum, tk) => sum + (storyPoints[tk.id] || 0), 0)

  // --- 18. Ticket "esquecido" ---
  const isStale = (ticket: Ticket) => parseAgeToHours(ticket.age) > STALE_THRESHOLD_HOURS && (comments[ticket.id] || []).length === 0

  // --- Votos de priorização ---
  const toggleVote = (ticket: Ticket, event: MouseEvent) => {
    event.stopPropagation()
    const alreadyVoted = !!votedByMe[ticket.id]
    setVotes(map => ({ ...map, [ticket.id]: Math.max(0, (map[ticket.id] || 0) + (alreadyVoted ? -1 : 1)) }))
    setVotedByMe(map => ({ ...map, [ticket.id]: !alreadyVoted }))
    registerUndo(`Voto em ${ticket.id} desfeito`, () => {
      setVotes(map => ({ ...map, [ticket.id]: Math.max(0, (map[ticket.id] || 0) + (alreadyVoted ? 1 : -1)) }))
      setVotedByMe(map => ({ ...map, [ticket.id]: alreadyVoted }))
    })
  }

  // --- Pós-mortem automático ---
  const currentPostmortem: PostmortemDraft = (detailId && postmortems[detailId]) || { causaRaiz: '', acaoCorretiva: '' }
  const updatePostmortem = (patch: Partial<PostmortemDraft>) => {
    if (!detailId) return
    setPostmortems(map => ({ ...map, [detailId]: { ...currentPostmortem, ...patch } }))
  }
  const downloadPostmortem = () => {
    if (!detailTicket) return
    const totalHours = slaHoursByPriority[detailTicket.priority]
    const elapsed = parseAgeToHours(detailTicket.age)
    const markdown = buildPostmortemMarkdown(detailTicket, totalHours, elapsed, currentPostmortem)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `postmortem-${detailTicket.id}.md`
    a.click()
    URL.revokeObjectURL(a.href)
    logAction('Pós-mortem gerado', `${detailTicket.id} · pós-mortem baixado`)
  }

  // --- Histograma de idade por coluna ---
  const ageHistogramByColumn = useMemo(() => columns.map(column => {
    const counts: Record<string, number> = { '0-4h': 0, '4-12h': 0, '12-24h': 0, '24h+': 0 }
    for (const ticket of tickets.filter(tk => tk.status === column)) counts[ageBucketFor(parseAgeToHours(ticket.age))]++
    return { column, data: ageBuckets.map(bucket => ({ label: bucket, value: counts[bucket] })) }
  }), [tickets])

  // --- 15. Checklist helpers ---
  const addChecklistItem = () => {
    if (!detailId || !checklistDraft.trim()) return
    const item: ChecklistItem = { id: `chk${Date.now()}`, text: checklistDraft.trim(), done: false }
    setChecklists(map => ({ ...map, [detailId]: [...(map[detailId] || []), item] }))
    setChecklistDraft('')
  }
  const toggleChecklistItem = (itemId: string) => {
    if (!detailId) return
    setChecklists(map => ({ ...map, [detailId]: (map[detailId] || []).map(item => item.id === itemId ? { ...item, done: !item.done } : item) }))
  }

  // --- 14. Dependências helpers ---
  const setBlockedBy = (blockerId: string) => {
    if (!detailId) return
    setDependencies(map => {
      const next = { ...map }
      if (blockerId) next[detailId] = blockerId
      else delete next[detailId]
      return next
    })
    logAction('Dependência definida', `${detailId} bloqueado por ${blockerId || 'nenhum'}`)
  }

  return <>
    <PageHeader eyebrow={t('tickets.eyebrow')} title={t('tickets.title')} description={t('tickets.subtitle')} actions={<button className="button button--primary" disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={() => setModal(true)}><Plus size={16} /> {t('tickets.newTicket')}</button>} />

    <div className="ttr-panel">
      <span className="saved-queries__label">{t('tickets.ttrPanel')}</span>
      {ttrByPriority.map(row => <div className="ttr-panel__item" key={row.priority}>
        <span>{row.priority} ({row.count})</span>
        <strong>{row.count ? `${row.avg.toFixed(1)}h` : '—'}</strong>
      </div>)}
    </div>

    <div className="board-toolbar">
      <label className="search-input"><Search size={16} /><input placeholder={t('tickets.searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="filter-bar">
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="TODAS">{t('tickets.allPriorities')}</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select>
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}><option value="">{t('tickets.allTags')}</option>{allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select>
        <button className="button button--compact" onClick={saveCurrentView}><Bookmark size={13} /> {t('tickets.saveView')}</button>
        <button className="button button--compact" disabled={!canUndo} title={t('tickets.undo')} onClick={() => undoTickets()}><Undo2 size={13} /></button>
        <button className="button button--compact" disabled={!canRedo} title={t('tickets.redo')} onClick={() => redoTickets()}><Redo2 size={13} /></button>
        <button className={`button button--compact ${sortByVotes ? 'button--live' : ''}`} onClick={() => setSortByVotes(v => !v)}><ThumbsUp size={13} /> {t('tickets.sortByVotes')}</button>
        <button className={`button button--compact ${showAgeHistogram ? 'button--live' : ''}`} onClick={() => setShowAgeHistogram(v => !v)}>{t('tickets.ageHistogram')}</button>
        <div className="view-toggle">
          <button className={viewMode === 'kanban' ? 'is-active' : ''} onClick={() => setViewMode('kanban')}><LayoutGrid size={13} /> {t('tickets.viewKanban')}</button>
          <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={13} /> {t('tickets.viewList')}</button>
        </div>
      </div>
      <span>{tickets.filter(tk => tk.status !== 'Concluído').length} {t('tickets.openCount')}</span>
    </div>

    {showAgeHistogram && <div className="age-histogram-panel">
      {ageHistogramByColumn.map(row => <div className="age-histogram-panel__column" key={row.column}>
        <h4>{row.column}</h4>
        <BarChart data={row.data} />
      </div>)}
    </div>}

    {savedViews.length > 0 && <section className="saved-views" style={{ marginBottom: 12 }}>
      {savedViews.map(view => <span className="saved-view-chip" key={view.id} onClick={() => applyView(view)}>
        {view.name}
        <button onClick={event => { event.stopPropagation(); removeView(view.id) }}><X size={11} /></button>
      </span>)}
    </section>}

    {viewMode === 'kanban' && <section className="kanban">{columns.map((column, columnIndex) => <div className="kanban-column" key={column}><header><h2>{column}</h2><span>{visible.filter(t => t.status === column).length}</span></header>
      {column !== 'Concluído' && <div className="column-points">{columnPoints(column)} {t('tickets.pointsRemaining')}</div>}
      <div className="kanban-column__body">{visible.filter(t => t.status === column).sort((a, b) => sortByVotes ? (votes[b.id] || 0) - (votes[a.id] || 0) : 0).map(ticket => <article className="ticket-card" key={ticket.id} onClick={() => setDetailId(ticket.id)}>
        <div><Badge tone={ticket.priority}>{ticket.priority}</Badge><span>{ticket.id}</span>{isStale(ticket) && <span className="stale-badge">{t('tickets.staleBadge')}</span>}{!!storyPoints[ticket.id] && <span className="points-badge">{storyPoints[ticket.id]} pts</span>}<button className="icon-button" title={t('pipelines.favorite')} onClick={event => { event.stopPropagation(); toggleFavorite({ id: ticket.id, module: 'tickets', label: ticket.title }) }}><Star fill={isFavorite('tickets', ticket.id) ? 'currentColor' : 'none'} size={14} /></button></div>
        <h3>{ticket.title}</h3>
        <div className="tag-list">{ticket.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <SlaBar ticket={ticket} />
        <footer><div className="mini-avatar">{initials(ticket.assignee)}</div><span>{ticket.assignee}</span><time>{ticket.age}</time></footer>
        <div className="ticket-actions">
          <button disabled={columnIndex === 0} onClick={event => { event.stopPropagation(); move(ticket, -1) }}>←</button>
          <button className={`vote-button ${votedByMe[ticket.id] ? 'is-voted' : ''}`} title={t('tickets.upvotePriority')} onClick={event => toggleVote(ticket, event)}><ThumbsUp size={12} /> {votes[ticket.id] || 0}</button>
          <button disabled={columnIndex === 3} onClick={event => { event.stopPropagation(); move(ticket, 1) }}>{t('tickets.advance')}</button>
        </div>
      </article>)}</div>
    </div>)}</section>}

    {viewMode === 'list' && <table className="ticket-table">
      <thead><tr>
        {(['id', 'priority', 'status', 'assignee', 'age'] as const).map(col => <th key={col} onClick={() => { if (sortColumn === col) setSortDir(d => d === 1 ? -1 : 1); else { setSortColumn(col); setSortDir(1) } }}>{col}{sortColumn === col ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}</th>)}
      </tr></thead>
      <tbody>{sortedVisible.map(ticket => <tr key={ticket.id} onClick={() => setDetailId(ticket.id)}>
        <td>{ticket.id}</td>
        <td><Badge tone={ticket.priority}>{ticket.priority}</Badge></td>
        <td>{ticket.status}</td>
        <td>{ticket.assignee}</td>
        <td>{ticket.age}</td>
      </tr>)}</tbody>
    </table>}

    {modal && <Modal title={t('tickets.createTitle')} onClose={() => setModal(false)}>
      <div className="template-picker">
        {ticketTemplates.map(template => <button type="button" key={template.id} className={`template-card ${selectedTemplate === template.id ? 'is-selected' : ''}`} onClick={() => applyTemplate(template.id)}>
          <strong>{template.name}</strong><span>{template.description}</span>
        </button>)}
      </div>
      {duplicateCandidates.length > 0 && <div className="duplicate-warning">
        <strong>{t('tickets.duplicateWarning')}</strong>
        {duplicateCandidates.slice(0, 3).map(candidate => <span key={candidate.ticket.id}>{candidate.ticket.id} · {candidate.ticket.title} ({Math.round(candidate.score * 100)}%)</span>)}
      </div>}
      {recurringMatch && <div className="recurring-warning">
        <strong>{t('tickets.recurringWarning')}</strong>
        <span>{recurringMatch.id} · {recurringMatch.title}</span>
      </div>}
      <div className="form-grid">
        <label className="span-2">{t('tickets.formTitle')}<input autoFocus value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder={t('tickets.formTitlePlaceholder')} /></label>
        <label>{t('tickets.formPriority')}<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Ticket['priority'] })}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></label>
        <label>{t('tickets.formAssignee')}<select value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}><option value="">{t('tickets.formSelect')}</option>{assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <div className="form-actions span-2"><button className="button" onClick={() => setModal(false)}>{t('tickets.cancelForm')}</button><button className="button button--primary" onClick={create}>{t('tickets.create')}</button></div>
      </div>
    </Modal>}

    {detailTicket && <Modal title={`${detailTicket.id} · ${detailTicket.title}`} onClose={() => setDetailId(null)}>
      <div className="ticket-detail">
        <div className="ticket-detail__body">
          <div className="ticket-detail__row">
            <label>{t('tickets.priority')}</label>
            <Badge tone={detailTicket.priority}>{detailTicket.priority}</Badge>
            <PrintButton label={t('tickets.print')} />
          </div>
          <div className="ticket-detail__row">
            <label>{t('tickets.assignee')}</label>
            <select value={detailTicket.assignee} disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onChange={e => reassign(detailTicket.id, e.target.value)}>
              {assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="ticket-detail__row">
            <label>{t('tickets.storyPoints')}</label>
            <input type="number" min={0} value={storyPoints[detailTicket.id] || 0} disabled={!canEdit} onChange={e => setStoryPoints(map => ({ ...map, [detailTicket.id]: Number(e.target.value) || 0 }))} />
          </div>
          <SlaBar ticket={detailTicket} />

          {isSlaBreached(detailTicket) && <>
            <button className="button button--compact" onClick={() => setShowPostmortem(v => !v)}>{t('tickets.generatePostmortem')}</button>
            {showPostmortem && <div className="postmortem-panel">
              <strong>{t('tickets.postmortemTitle')}</strong>
              <label>{t('tickets.rootCause')}
                <textarea value={currentPostmortem.causaRaiz} disabled={!canEdit} onChange={e => updatePostmortem({ causaRaiz: e.target.value })} placeholder={t('tickets.rootCausePlaceholder')} />
              </label>
              <label>{t('tickets.correctiveAction')}
                <textarea value={currentPostmortem.acaoCorretiva} disabled={!canEdit} onChange={e => updatePostmortem({ acaoCorretiva: e.target.value })} placeholder={t('tickets.correctiveActionPlaceholder')} />
              </label>
              <button className="button button--primary" onClick={downloadPostmortem}>{t('tickets.downloadPostmortem')}</button>
            </div>}
          </>}

          <h3>{t('tickets.blockedBy')}</h3>
          <div className="dependency-row">
            <select value={dependencies[detailTicket.id] || ''} disabled={!canEdit} onChange={e => setBlockedBy(e.target.value)}>
              <option value="">{t('tickets.noneOption')}</option>
              {tickets.filter(tk => tk.id !== detailTicket.id).map(tk => <option key={tk.id} value={tk.id}>{tk.id} · {tk.title}</option>)}
            </select>
          </div>
          {blockerTicket && <div className="dependency-link" onClick={() => setDetailId(blockerTicket.id)}><Link2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{blockerTicket.id} · {blockerTicket.title}</div>}

          <h3>{t('tickets.checklist')}</h3>
          <div className="checklist">
            {detailChecklist.map(item => <label className={`checklist-item ${item.done ? 'is-done' : ''}`} key={item.id}>
              <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id)} />
              <span>{item.text}</span>
            </label>)}
            {detailChecklist.length === 0 && <span className="saved-queries__label">{t('tickets.noneOption')}</span>}
          </div>
          <div className="checklist-add">
            <input value={checklistDraft} onChange={e => setChecklistDraft(e.target.value)} placeholder={t('tickets.checklistPlaceholder')} onKeyDown={e => { if (e.key === 'Enter') addChecklistItem() }} />
            <button className="button button--compact" onClick={addChecklistItem}><Plus size={13} /></button>
          </div>

          <h3>{t('tickets.attachments')}</h3>
          <div className="attachment-list">
            {detailAttachments.map(att => <div className="attachment-item" key={att.id}>
              {att.previewUrl ? <img src={att.previewUrl} alt={att.name} /> : <Paperclip size={13} />}
              <span><strong>{att.name}</strong><small>{formatSize(att.size)}</small></span>
            </div>)}
            {detailAttachments.length === 0 && <span className="saved-queries__label">{t('tickets.noAttachmentsYet')}</span>}
          </div>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <button className="button button--compact" onClick={() => fileInputRef.current?.click()}><Paperclip size={13} /> {t('tickets.attachFile')}</button>

          <h3>{t('tickets.activity')}</h3>
          <div className="comment-list">
            {detailComments.map(comment => <div className="comment-item" key={comment.id}>
              <header><strong>{comment.author}</strong><span>{comment.time}</span></header>
              <p>{comment.text}</p>
              <div className="reaction-row">
                {reactionEmojis.map(emoji => <span className={`reaction-chip ${(reactions[comment.id]?.[emoji] || 0) > 0 ? 'is-active' : ''}`} key={emoji} onClick={() => toggleReaction(comment.id, emoji)}>
                  {emoji} {reactions[comment.id]?.[emoji] || ''}
                </span>)}
              </div>
            </div>)}
            {detailComments.length === 0 && <span className="saved-queries__label">{t('tickets.noCommentsYet')}</span>}
          </div>
          <div className="comment-form">
            <textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder={t('tickets.commentPlaceholder')} />
            <button className="button button--primary" disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={addComment}><Send size={14} /></button>
          </div>
        </div>
      </div>
    </Modal>}
  </>
}
