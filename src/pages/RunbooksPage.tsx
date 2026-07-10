import { BookOpen, Check, ChevronRight, Clock3, Copy, GitBranch, History, Pencil, PlayCircle, Plus, RotateCcw, Search, Star, Timer } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import '../styles/runbooks-extra.css'

interface RunbookVersion { version: number; steps: string[]; savedAt: string }
interface ExecutionRecord { id: string; runbookId: string; startedAt: string; finishedAt: string; totalMs: number; stepDurationsMs: number[]; executedBy: string }
interface Runbook { id: string; title: string; category: string; steps: string[]; duration: string; runs: number; incidentType: string; versions: RunbookVersion[] }

const incidentTypes = ['Latência', 'Outage', 'Segurança', 'Banco de dados', 'Geral']

const initialRunbooks: Runbook[] = [
  { id: 'rb1', title: 'Failover do PostgreSQL primário', category: 'Banco de dados', incidentType: 'Outage', versions: [], duration: '12 min', runs: 18, steps: ['Confirmar indisponibilidade do primary', 'Verificar lag das réplicas', 'Promover réplica mais atual', 'Atualizar endpoint no secrets manager', 'Validar queries e latência', 'Registrar timeline do incidente'] },
  { id: 'rb2', title: 'Mitigação de latência no checkout', category: 'Incidente', incidentType: 'Latência', versions: [], duration: '8 min', runs: 31, steps: ['Validar métricas RED', 'Identificar dependência degradada', 'Ativar circuit breaker', 'Escalar réplicas do checkout', 'Validar taxa de erros'] },
  { id: 'rb3', title: 'Rotação de credenciais de produção', category: 'Segurança', incidentType: 'Segurança', versions: [], duration: '20 min', runs: 9, steps: ['Gerar novas credenciais', 'Atualizar secrets manager', 'Reiniciar workloads gradualmente', 'Revogar credenciais anteriores', 'Validar auditoria'] },
]

function diffSteps(oldSteps: string[], newSteps: string[]) {
  const added = newSteps.filter(s => !oldSteps.includes(s))
  const removed = oldSteps.filter(s => !newSteps.includes(s))
  return { added, removed }
}

function fmtMs(ms: number) {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

export default function RunbooksPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { addNotification } = useNotifications()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()

  const [runbooks, setRunbooks] = useLocalStorage<Runbook[]>('opsphere-runbooks-lib', initialRunbooks)
  const [selectedId, setSelectedId] = useState(initialRunbooks[0].id)
  const [completed, setCompleted] = useLocalStorage<Record<string, number[]>>('opsphere-runbooks', {})
  const [executions, setExecutions] = useLocalStorage<ExecutionRecord[]>('opsphere-runbooks-executions', [])

  const [query, setQuery] = useState('')
  const [incidentFilter, setIncidentFilter] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const [diffA, setDiffA] = useState<number | null>(null)
  const [diffB, setDiffB] = useState<number | null>(null)
  const [templateModal, setTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const [timerRunning, setTimerRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [lastStepAt, setLastStepAt] = useState<number | null>(null)
  const [stepDurations, setStepDurations] = useState<number[]>([])

  const selected = runbooks.find(r => r.id === selectedId) || runbooks[0]
  const checks = completed[selected.id] || []

  const visible = runbooks.filter(rb =>
    `${rb.title} ${rb.category}`.toLowerCase().includes(query.toLowerCase()) &&
    (!incidentFilter || rb.incidentType === incidentFilter))

  const selectRunbook = (rb: Runbook) => {
    setSelectedId(rb.id); setEditingIndex(null); setShowVersions(false); setDiffA(null); setDiffB(null)
    setTimerRunning(false); setStartedAt(null); setLastStepAt(null); setStepDurations([])
  }

  const toggle = (i: number) => {
    const isChecking = !checks.includes(i)
    setCompleted(v => ({ ...v, [selected.id]: isChecking ? [...checks, i] : checks.filter(x => x !== i) }))
    if (isChecking && timerRunning && lastStepAt) {
      const now = Date.now()
      setStepDurations(d => { const next = [...d]; next[i] = now - lastStepAt; return next })
      setLastStepAt(now)
    }
  }

  const startExecution = () => {
    setCompleted(v => ({ ...v, [selected.id]: [] }))
    const now = Date.now()
    setTimerRunning(true); setStartedAt(now); setLastStepAt(now); setStepDurations(Array(selected.steps.length).fill(0))
    logAction(t('runbooks.audit.executionStarted'), `${t('runbooks.audit.timerStartedFor')} "${selected.title}".`)
  }

  const finish = () => {
    if (timerRunning && startedAt) {
      const now = Date.now()
      const record: ExecutionRecord = { id: `ex${now}`, runbookId: selected.id, startedAt: new Date(startedAt).toLocaleString('pt-BR'), finishedAt: new Date(now).toLocaleString('pt-BR'), totalMs: now - startedAt, stepDurationsMs: stepDurations, executedBy: 'Victor Lima' }
      setExecutions(list => [record, ...list])
      setRunbooks(list => list.map(rb => rb.id === selected.id ? { ...rb, runs: rb.runs + 1 } : rb))
      logAction(t('runbooks.audit.completed'), `"${selected.title}" ${t('runbooks.audit.executedBy')} ${fmtMs(record.totalMs)}.`)
      addNotification(t('runbooks.notify.executionDoneTitle'), `${selected.title} ${t('runbooks.notify.finishedBy')} ${fmtMs(record.totalMs)} ${t('runbooks.notify.by')}`, 'healthy')
    }
    setCompleted(v => ({ ...v, [selected.id]: [] }))
    setTimerRunning(false); setStartedAt(null); setLastStepAt(null); setStepDurations([])
  }

  const startEdit = (i: number) => { setEditingIndex(i); setEditValue(selected.steps[i]) }
  const saveEdit = () => {
    if (editingIndex === null) return
    const oldSteps = selected.steps
    const newSteps = oldSteps.map((s, i) => i === editingIndex ? editValue : s)
    const nextVersion: RunbookVersion = { version: selected.versions.length + 1, steps: oldSteps, savedAt: new Date().toLocaleString('pt-BR') }
    setRunbooks(list => list.map(rb => rb.id === selected.id ? { ...rb, steps: newSteps, versions: [...rb.versions, nextVersion] } : rb))
    logAction(t('runbooks.audit.edited'), `Passo ${editingIndex + 1} ${t('runbooks.audit.stepOf')} "${selected.title}" ${t('runbooks.audit.updatedVersion')}${nextVersion.version + 1} ${t('runbooks.audit.created')}`)
    setEditingIndex(null)
  }

  const duplicateAsTemplate = () => {
    if (!templateName.trim()) return
    const id = `rb${Date.now()}`
    const newRunbook: Runbook = { id, title: templateName, category: selected.category, incidentType: selected.incidentType, duration: selected.duration, runs: 0, versions: [], steps: [...selected.steps] }
    setRunbooks(list => [newRunbook, ...list])
    logAction(t('runbooks.audit.templateDuplicated'), `"${templateName}" ${t('runbooks.audit.createdFrom')} "${selected.title}".`)
    addNotification(t('runbooks.notify.newRunbookTitle'), `"${templateName}" ${t('runbooks.notify.createdFromTemplate')}`, 'info')
    setTemplateModal(false); setTemplateName(''); selectRunbook(newRunbook)
  }

  const versionDiff = diffA !== null && diffB !== null
    ? diffSteps(diffA === 0 ? selected.versions[0]?.steps ?? [] : selected.versions.find(v => v.version === diffA)?.steps ?? selected.steps,
                diffB === 0 ? selected.versions[0]?.steps ?? [] : diffB === selected.versions.length + 1 ? selected.steps : selected.versions.find(v => v.version === diffB)?.steps ?? selected.steps)
    : null

  const runbookExecutions = executions.filter(e => e.runbookId === selected.id)

  return <>
    <PageHeader eyebrow={t('runbooks.eyebrow')} title={t('runbooks.title')} description={t('runbooks.description')} actions={<button className="button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={() => setTemplateModal(true)}><Plus size={16} /> {t('runbooks.duplicateTemplate')}</button>} />
    <section className="runbook-layout">
      <aside className="panel runbook-list">
        <div className="panel__header"><div><span className="eyebrow">{t('runbooks.library.eyebrow')}</span><h2>{t('runbooks.library.title')}</h2></div><BookOpen size={18} /></div>
        <div className="runbook-toolbar">
          <label className="search-input"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('runbooks.searchPlaceholder')} /></label>
          <select value={incidentFilter} onChange={e => setIncidentFilter(e.target.value)}><option value="">{t('runbooks.allTypes')}</option>{incidentTypes.map(it => <option key={it}>{it}</option>)}</select>
        </div>
        {visible.map(rb => <button className={selected.id === rb.id ? 'is-selected' : ''} key={rb.id} onClick={() => selectRunbook(rb)}>
          <span className="resource-icon"><PlayCircle /></span>
          <span className="grow"><strong>{rb.title}</strong><small>{rb.category} · {rb.steps.length} {t('runbooks.stepsSuffix')} <span className="incident-tag">{rb.incidentType}</span></small></span>
          <ChevronRight />
        </button>)}
      </aside>

      <article className="panel runbook-player">
        <header>
          <div><Badge tone="info">{selected.category}</Badge> <Badge tone="neutral">{selected.incidentType}</Badge><h2>{selected.title}</h2><p><Clock3 size={14} /> {selected.duration} {t('runbooks.estimatedSuffix')} {selected.runs} {t('runbooks.timesSuffix')}</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-button" title="Favoritar" onClick={() => toggleFavorite({ id: selected.id, module: 'runbooks', label: selected.title })}><Star fill={isFavorite('runbooks', selected.id) ? 'currentColor' : 'none'} size={17} /></button>
            <button className="icon-button" title={t('runbooks.version')} onClick={() => setShowVersions(v => !v)}><GitBranch size={17} /></button>
            <button className="icon-button" title={t('runbooks.restartChecklist')} onClick={() => setCompleted(v => ({ ...v, [selected.id]: [] }))}><RotateCcw size={17} /></button>
          </div>
        </header>

        <div className="runbook-toolbar-row">
          {!timerRunning
            ? <button className="button" onClick={startExecution}><Timer size={15} /> {t('runbooks.runWithTimer')}</button>
            : <span className="timer-badge"><Timer size={13} /> {t('runbooks.runningBy')} Victor Lima</span>}
        </div>

        <div className="progress-header"><span>{t('runbooks.progress')}</span><strong>{checks.length} {t('runbooks.progressOf')} {selected.steps.length}</strong></div>
        <div className="progress-track"><i style={{ width: `${checks.length / selected.steps.length * 100}%` }} /></div>

        <div className="checklist">{selected.steps.map((step, i) => <label className={checks.includes(i) ? 'is-done' : ''} key={i}>
          <input type="checkbox" checked={checks.includes(i)} onChange={() => toggle(i)} />
          <span><Check /></span>
          {editingIndex === i
            ? <div className="step-edit-row" onClick={e => e.stopPropagation()}>
                <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                <button className="button button--small" onClick={saveEdit}>{t('runbooks.save')}</button>
              </div>
            : <div><small>{t('runbooks.stepLabel')} {i + 1}</small><strong>{step}</strong></div>}
          {stepDurations[i] > 0 && <span className="step-duration">{fmtMs(stepDurations[i])}</span>}
          {editingIndex !== i && <button className="icon-button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={e => { e.preventDefault(); e.stopPropagation(); if (canEdit) startEdit(i) }}><Pencil size={14} /></button>}
        </label>)}</div>

        <button disabled={checks.length !== selected.steps.length} className="button button--primary button--full" onClick={finish}>{t('runbooks.finishExecution')}</button>

        {showVersions && <div className="version-panel">
          <div className="panel__header" style={{ padding: 0, border: 'none' }}><div><span className="eyebrow">{t('runbooks.versionHistory.eyebrow')}</span><h2>{selected.versions.length + 1} {t('runbooks.versionHistory.countSuffix')}</h2></div></div>
          <div className="version-panel__list">
            {[...selected.versions.map(v => v.version), selected.versions.length + 1].map(v => <button key={v} className={diffA === v ? 'is-active' : ''} onClick={() => setDiffA(v)}>v{v}{v === selected.versions.length + 1 ? ` ${t('runbooks.current')}` : ''}</button>)}
          </div>
          <small>{t('runbooks.compareWith')}</small>
          <div className="version-panel__list">
            {[...selected.versions.map(v => v.version), selected.versions.length + 1].map(v => <button key={v} className={diffB === v ? 'is-active' : ''} onClick={() => setDiffB(v)}>v{v}{v === selected.versions.length + 1 ? ` ${t('runbooks.current')}` : ''}</button>)}
          </div>
          {versionDiff && <div className="diff-view">
            {versionDiff.added.map((s, i) => <div className="diff-view__added" key={`a${i}`}>+ {s}</div>)}
            {versionDiff.removed.map((s, i) => <div className="diff-view__removed" key={`r${i}`}>- {s}</div>)}
            {!versionDiff.added.length && !versionDiff.removed.length && <div><small>{t('runbooks.noDiff')}</small></div>}
          </div>}
        </div>}
      </article>

      <aside className="panel history-panel">
        <div className="panel__header"><div><span className="eyebrow">{t('runbooks.history.eyebrow')}</span><h2>{t('runbooks.history.title')}</h2></div><History size={18} /></div>
        {runbookExecutions.length
          ? runbookExecutions.map(ex => <div className="exec-history-item" key={ex.id}>
              <span><Check size={13} /> {ex.executedBy} · {fmtMs(ex.totalMs)}</span>
              <small>{ex.startedAt} → {ex.finishedAt}</small>
            </div>)
          : <div className="empty-compact"><Clock3 /><span>{t('runbooks.history.empty')}</span></div>}
      </aside>
    </section>

    {templateModal && <Modal title={t('runbooks.modal.title')} onClose={() => setTemplateModal(false)}>
      <div className="form-grid">
        <label className="span-2">{t('runbooks.modal.nameLabel')} "{selected.title}")<input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder={t('runbooks.modal.namePlaceholder')} /></label>
        <div className="form-actions span-2"><button className="button" onClick={() => setTemplateModal(false)}>{t('runbooks.cancel')}</button><button className="button button--primary" onClick={duplicateAsTemplate}><Copy size={14} /> {t('runbooks.duplicate')}</button></div>
      </div>
    </Modal>}
  </>
}
