import { Bookmark, Paperclip, Plus, Redo2, Search, Send, Star, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { assigneeOptions, parseAgeToHours, slaHoursByPriority, ticketTemplates } from '../data/ticketsExtra'
import type { AttachmentMeta, SavedView, TicketComment } from '../data/ticketsExtra'
import { initialTickets } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUndoable } from '../hooks/useUndoable'
import { useI18n } from '../i18n/I18nContext'
import type { Ticket } from '../types'
import '../styles/tickets-extra.css'

function loadStoredTickets(): Ticket[] {
  try {
    const stored = localStorage.getItem('opsphere-tickets')
    return stored ? JSON.parse(stored) as Ticket[] : initialTickets
  } catch { return initialTickets }
}

const columns: Ticket['status'][] = ['Backlog', 'Em andamento', 'Revisão', 'Concluído']

function initials(name: string) {
  return name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
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

  const [modal, setModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('TODAS')
  const [tagFilter, setTagFilter] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', priority: 'P2' as Ticket['priority'], assignee: '', tags: [] as string[] })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const allTags = useMemo(() => Array.from(new Set(tickets.flatMap(t => t.tags))), [tickets])

  const visible = useMemo(() => tickets.filter(t =>
    (t.title.toLowerCase().includes(query.toLowerCase()) || t.id.toLowerCase().includes(query.toLowerCase())) &&
    (priorityFilter === 'TODAS' || t.priority === priorityFilter) &&
    (!tagFilter || t.tags.includes(tagFilter)),
  ), [tickets, query, priorityFilter, tagFilter])

  const detailTicket = tickets.find(t => t.id === detailId) || null
  const detailComments = detailId ? (comments[detailId] || []) : []
  const detailAttachments = detailId ? (attachments[detailId] || []) : []

  const applyTemplate = (templateId: string) => {
    const template = ticketTemplates.find(t => t.id === templateId)
    if (!template) return
    setSelectedTemplate(templateId)
    setForm({ title: template.title, priority: template.priority, assignee: '', tags: template.tags })
  }

  const create = () => {
    if (!form.title.trim()) return
    const id = `OPS-${419 + tickets.length}`
    setTickets(list => [{ id, title: form.title, priority: form.priority, status: 'Backlog', assignee: form.assignee || t('tickets.unassigned'), tags: form.tags.length ? form.tags : ['novo'], age: 'agora' }, ...list])
    logAction('Ticket criado', `${id} · ${form.title}`)
    addNotification('Ticket criado', `${id} foi adicionado ao backlog.`, 'info')
    setModal(false)
    setSelectedTemplate(null)
    setForm({ title: '', priority: 'P2', assignee: '', tags: [] })
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

  return <>
    <PageHeader eyebrow={t('tickets.eyebrow')} title={t('tickets.title')} description={t('tickets.subtitle')} actions={<button className="button button--primary" disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={() => setModal(true)}><Plus size={16} /> {t('tickets.newTicket')}</button>} />

    <div className="board-toolbar">
      <label className="search-input"><Search size={16} /><input placeholder={t('tickets.searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="filter-bar">
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="TODAS">{t('tickets.allPriorities')}</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select>
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}><option value="">{t('tickets.allTags')}</option>{allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select>
        <button className="button button--compact" onClick={saveCurrentView}><Bookmark size={13} /> {t('tickets.saveView')}</button>
        <button className="button button--compact" disabled={!canUndo} title={t('tickets.undo')} onClick={() => undoTickets()}><Undo2 size={13} /></button>
        <button className="button button--compact" disabled={!canRedo} title={t('tickets.redo')} onClick={() => redoTickets()}><Redo2 size={13} /></button>
      </div>
      <span>{tickets.filter(tk => tk.status !== 'Concluído').length} {t('tickets.openCount')}</span>
    </div>

    {savedViews.length > 0 && <section className="saved-views" style={{ marginBottom: 12 }}>
      {savedViews.map(view => <span className="saved-view-chip" key={view.id} onClick={() => applyView(view)}>
        {view.name}
        <button onClick={event => { event.stopPropagation(); removeView(view.id) }}><X size={11} /></button>
      </span>)}
    </section>}

    <section className="kanban">{columns.map((column, columnIndex) => <div className="kanban-column" key={column}><header><h2>{column}</h2><span>{visible.filter(t => t.status === column).length}</span></header>
      <div className="kanban-column__body">{visible.filter(t => t.status === column).map(ticket => <article className="ticket-card" key={ticket.id} onClick={() => setDetailId(ticket.id)}>
        <div><Badge tone={ticket.priority}>{ticket.priority}</Badge><span>{ticket.id}</span><button className="icon-button" title={t('pipelines.favorite')} onClick={event => { event.stopPropagation(); toggleFavorite({ id: ticket.id, module: 'tickets', label: ticket.title }) }}><Star fill={isFavorite('tickets', ticket.id) ? 'currentColor' : 'none'} size={14} /></button></div>
        <h3>{ticket.title}</h3>
        <div className="tag-list">{ticket.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <SlaBar ticket={ticket} />
        <footer><div className="mini-avatar">{initials(ticket.assignee)}</div><span>{ticket.assignee}</span><time>{ticket.age}</time></footer>
        <div className="ticket-actions"><button disabled={columnIndex === 0} onClick={event => { event.stopPropagation(); move(ticket, -1) }}>←</button><button disabled={columnIndex === 3} onClick={event => { event.stopPropagation(); move(ticket, 1) }}>{t('tickets.advance')}</button></div>
      </article>)}</div>
    </div>)}</section>

    {modal && <Modal title={t('tickets.createTitle')} onClose={() => setModal(false)}>
      <div className="template-picker">
        {ticketTemplates.map(template => <button type="button" key={template.id} className={`template-card ${selectedTemplate === template.id ? 'is-selected' : ''}`} onClick={() => applyTemplate(template.id)}>
          <strong>{template.name}</strong><span>{template.description}</span>
        </button>)}
      </div>
      <div className="form-grid">
        <label className="span-2">{t('tickets.formTitle')}<input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('tickets.formTitlePlaceholder')} /></label>
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
          </div>
          <div className="ticket-detail__row">
            <label>{t('tickets.assignee')}</label>
            <select value={detailTicket.assignee} disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onChange={e => reassign(detailTicket.id, e.target.value)}>
              {assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <SlaBar ticket={detailTicket} />

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
