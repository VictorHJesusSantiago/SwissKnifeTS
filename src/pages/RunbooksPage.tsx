import { AlertTriangle, BookOpen, Check, ChevronRight, Clock3, Copy, FileDown, GitBranch, GitFork, History, ImagePlus, Link2, Maximize, Minimize, Pencil, PlayCircle, Plus, RotateCcw, Search, Star, Timer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { serviceNodes } from '../data/mockData'
import { incidentTypes, initialRunbooks, isStale, type ExecutionRecord, type Runbook, type RunbookVersion } from '../data/runbooksExtraData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import { classNames } from '../utils/format'
import '../styles/runbooks-extra.css'
import '../styles/runbooksExtra3.css'

interface StepImage { url: string; name: string; type: string }

function diffSteps(oldSteps: string[], newSteps: string[]) {
  const added = newSteps.filter(s => !oldSteps.includes(s))
  const removed = oldSteps.filter(s => !newSteps.includes(s))
  return { added, removed }
}

function fmtMs(ms: number) {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function runbookToMarkdown(rb: Runbook) {
  const lines = [
    `# ${rb.title}`,
    '',
    `- Categoria: ${rb.category}`,
    `- Tipo de incidente: ${rb.incidentType}`,
    `- Duração estimada: ${rb.duration}`,
    `- Execuções registradas: ${rb.runs}`,
    `- Serviço vinculado: ${rb.serviceId ?? '—'}`,
    `- Última edição: ${new Date(rb.lastEditedAt).toLocaleDateString('pt-BR')}`,
    '',
    '## Passos',
    '',
    ...rb.steps.map((s, i) => {
      const meta = rb.stepMeta?.[i]
      const branch = meta?.branchTargetStep ? ` _(se "${meta.branchCondition}", pular para o passo ${meta.branchTargetStep})_` : ''
      return `- [ ] ${s}${branch}`
    }),
    '',
  ]
  return lines.join('\n')
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

  const [branchEditIndex, setBranchEditIndex] = useState<number | null>(null)
  const [branchCondition, setBranchCondition] = useState('')
  const [branchTarget, setBranchTarget] = useState('')

  const [stepImages, setStepImages] = useState<Record<string, Record<number, StepImage>>>({})

  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState('')

  // Item 4 — ranking de eficácia + Item 5 — sugestão por tipo de incidente
  const [suggestionType, setSuggestionType] = useState('')

  const playerRef = useRef<HTMLElement>(null)
  const [presenting, setPresenting] = useState(false)

  useEffect(() => {
    const handler = () => setPresenting(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const selected = runbooks.find(r => r.id === selectedId) || runbooks[0]
  const checks = completed[selected.id] || []

  const q = query.trim().toLowerCase()
  const visible = runbooks.filter(rb => {
    const inTitle = `${rb.title} ${rb.category}`.toLowerCase().includes(q)
    const inSteps = q.length > 0 && rb.steps.some(s => s.toLowerCase().includes(q))
    return (!q || inTitle || inSteps) && (!incidentFilter || rb.incidentType === incidentFilter)
  })

  const selectRunbook = (rb: Runbook) => {
    setSelectedId(rb.id); setEditingIndex(null); setShowVersions(false); setDiffA(null); setDiffB(null)
    setTimerRunning(false); setStartedAt(null); setLastStepAt(null); setStepDurations([])
    setBranchEditIndex(null)
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

  const skipViaBranch = (i: number, targetStep: number, condition?: string) => {
    const targetIdx = targetStep - 1
    if (targetIdx <= i) return
    const toMark: number[] = []
    for (let k = i; k < targetIdx; k++) toMark.push(k)
    setCompleted(v => ({ ...v, [selected.id]: Array.from(new Set([...(v[selected.id] || []), ...toMark])) }))
    if (timerRunning && lastStepAt) setLastStepAt(Date.now())
    logAction(t('runbooks.audit.branchSkipped'), `"${selected.title}": ${t('runbooks.branch.conditionLabel')} "${condition ?? ''}" → ${t('runbooks.branch.skipButton')} ${targetStep}.`)
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
      setPendingRatingId(record.id); setRatingValue(0); setRatingComment('')
    }
    setCompleted(v => ({ ...v, [selected.id]: [] }))
    setTimerRunning(false); setStartedAt(null); setLastStepAt(null); setStepDurations([])
  }

  const submitRating = () => {
    if (!pendingRatingId) return
    setExecutions(list => list.map(e => e.id === pendingRatingId ? { ...e, rating: ratingValue || undefined, feedback: ratingComment.trim() || undefined } : e))
    logAction(t('runbooks.audit.ratingSubmitted'), `"${selected.title}": ${ratingValue}/5${ratingComment.trim() ? ` — ${ratingComment.trim()}` : ''}`)
    setPendingRatingId(null); setRatingValue(0); setRatingComment('')
  }
  const skipRating = () => { setPendingRatingId(null); setRatingValue(0); setRatingComment('') }

  const startEdit = (i: number) => { setEditingIndex(i); setEditValue(selected.steps[i]) }
  const saveEdit = () => {
    if (editingIndex === null) return
    const oldSteps = selected.steps
    const newSteps = oldSteps.map((s, i) => i === editingIndex ? editValue : s)
    const nextVersion: RunbookVersion = { version: selected.versions.length + 1, steps: oldSteps, savedAt: new Date().toLocaleString('pt-BR') }
    setRunbooks(list => list.map(rb => rb.id === selected.id ? { ...rb, steps: newSteps, versions: [...rb.versions, nextVersion], lastEditedAt: new Date().toISOString() } : rb))
    logAction(t('runbooks.audit.edited'), `Passo ${editingIndex + 1} ${t('runbooks.audit.stepOf')} "${selected.title}" ${t('runbooks.audit.updatedVersion')}${nextVersion.version + 1} ${t('runbooks.audit.created')}`)
    setEditingIndex(null)
  }

  const startBranchEdit = (i: number) => {
    const meta = selected.stepMeta?.[i]
    setBranchEditIndex(i)
    setBranchCondition(meta?.branchCondition ?? '')
    setBranchTarget(meta?.branchTargetStep ? String(meta.branchTargetStep) : '')
  }
  const saveBranch = () => {
    if (branchEditIndex === null) return
    const target = parseInt(branchTarget, 10)
    const validTarget = !isNaN(target) && target >= 1 && target <= selected.steps.length ? target : undefined
    setRunbooks(list => list.map(rb => rb.id === selected.id
      ? { ...rb, stepMeta: { ...rb.stepMeta, [branchEditIndex]: { ...rb.stepMeta?.[branchEditIndex], branchCondition: branchCondition.trim() || undefined, branchTargetStep: validTarget } } }
      : rb))
    logAction(t('runbooks.audit.edited'), `"${selected.title}" — ${t('runbooks.branch.edit')} ${t('runbooks.stepLabel')} ${branchEditIndex + 1}.`)
    setBranchEditIndex(null)
  }

  const attachImage = (i: number, file: File) => {
    const url = URL.createObjectURL(file)
    setStepImages(prev => ({ ...prev, [selected.id]: { ...(prev[selected.id] || {}), [i]: { url, name: file.name, type: file.type } } }))
    setRunbooks(list => list.map(rb => rb.id === selected.id
      ? { ...rb, stepMeta: { ...rb.stepMeta, [i]: { ...rb.stepMeta?.[i], imageName: file.name, imageType: file.type } } }
      : rb))
    logAction(t('runbooks.audit.imageAttached'), `"${selected.title}" — ${t('runbooks.stepLabel')} ${i + 1}: ${file.name}`)
  }

  const linkService = (serviceId: string) => {
    setRunbooks(list => list.map(rb => rb.id === selected.id ? { ...rb, serviceId: serviceId || undefined } : rb))
    logAction(t('runbooks.audit.serviceLinked'), `"${selected.title}" → ${serviceId || t('runbooks.service.none')}`)
  }

  const togglePresent = async () => {
    if (!presenting) await playerRef.current?.requestFullscreen?.()
    else if (document.fullscreenElement) await document.exitFullscreen()
  }

  const exportSelectedMarkdown = () => {
    downloadTextFile(`${selected.id}-${selected.title.replace(/\s+/g, '-').toLowerCase()}.md`, runbookToMarkdown(selected))
    logAction(t('runbooks.audit.mdExported'), `"${selected.title}".`)
  }

  const exportPlaybook = () => {
    const content = runbooks.map(runbookToMarkdown).join('\n---\n\n')
    downloadTextFile('playbook-completo.md', content)
    logAction(t('runbooks.audit.playbookExported'), `${runbooks.length} runbooks.`)
  }

  const duplicateAsTemplate = () => {
    if (!templateName.trim()) return
    const id = `rb${Date.now()}`
    const newRunbook: Runbook = { id, title: templateName, category: selected.category, incidentType: selected.incidentType, duration: selected.duration, runs: 0, versions: [], steps: [...selected.steps], lastEditedAt: new Date().toISOString(), serviceId: selected.serviceId }
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
  const avgMs = runbookExecutions.length ? runbookExecutions.reduce((a, e) => a + e.totalMs, 0) / runbookExecutions.length : 0
  const ratedExecutions = runbookExecutions.filter(e => typeof e.rating === 'number')
  const avgRating = ratedExecutions.length ? ratedExecutions.reduce((a, e) => a + (e.rating || 0), 0) / ratedExecutions.length : 0
  const selectedIsStale = isStale(selected.lastEditedAt)
  const stepImagesForSelected = stepImages[selected.id] || {}

  // Item 4 — ranking de eficácia dos runbooks (nota média das avaliações pós-execução)
  const effectivenessRanking = useMemo(() => runbooks.map(rb => {
    const execs = executions.filter(e => e.runbookId === rb.id)
    const rated = execs.filter(e => typeof e.rating === 'number')
    const avg = rated.length ? rated.reduce((a, e) => a + (e.rating || 0), 0) / rated.length : 0
    return { runbook: rb, avgRating: avg, ratedCount: rated.length, execCount: execs.length }
  }).sort((a, b) => b.avgRating - a.avgRating || b.execCount - a.execCount), [runbooks, executions])

  // Item 5 — sugestão automática por tipo de incidente (compatibilidade de tipo + nota de eficácia)
  const suggestedRunbooks = useMemo(() => {
    if (!suggestionType) return []
    return effectivenessRanking
      .filter(r => r.runbook.incidentType === suggestionType)
      .sort((a, b) => b.avgRating - a.avgRating || b.execCount - a.execCount)
  }, [effectivenessRanking, suggestionType])

  return <>
    <PageHeader eyebrow={t('runbooks.eyebrow')} title={t('runbooks.title')} description={t('runbooks.description')} actions={<>
      <button className="button button--compact" onClick={exportPlaybook}><FileDown size={15} /> {t('runbooks.exportPlaybook')}</button>
      <button className="button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={() => setTemplateModal(true)}><Plus size={16} /> {t('runbooks.duplicateTemplate')}</button>
    </>} />
    <section className="runbook-layout">
      <aside className="panel runbook-list">
        <div className="panel__header"><div><span className="eyebrow">{t('runbooks.library.eyebrow')}</span><h2>{t('runbooks.library.title')}</h2></div><BookOpen size={18} /></div>
        <div className="runbook-toolbar">
          <label className="search-input"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('runbooks.searchPlaceholder')} title={t('runbooks.searchStepsHint')} /></label>
          <select value={incidentFilter} onChange={e => setIncidentFilter(e.target.value)}><option value="">{t('runbooks.allTypes')}</option>{incidentTypes.map(it => <option key={it}>{it}</option>)}</select>
        </div>
        {visible.map(rb => <button className={selected.id === rb.id ? 'is-selected' : ''} key={rb.id} onClick={() => selectRunbook(rb)}>
          <span className="resource-icon"><PlayCircle /></span>
          <span className="grow"><strong>{rb.title}</strong><small>{rb.category} · {rb.steps.length} {t('runbooks.stepsSuffix')} <span className="incident-tag">{rb.incidentType}</span></small>
            {isStale(rb.lastEditedAt) && <div><span className="stale-badge" title={t('runbooks.stale.tooltip')}><AlertTriangle size={10} /> {t('runbooks.stale.badge')}</span></div>}
          </span>
          <ChevronRight />
        </button>)}
      </aside>

      <article className={classNames('panel', 'runbook-player', presenting && 'is-presenting')} ref={playerRef}>
        <header>
          <div>
            <Badge tone="info">{selected.category}</Badge> <Badge tone="neutral">{selected.incidentType}</Badge>
            {selectedIsStale && <Badge tone="warning"><AlertTriangle size={11} /> {t('runbooks.stale.badge')}</Badge>}
            <h2>{selected.title}</h2>
            <p><Clock3 size={14} /> {selected.duration} {t('runbooks.estimatedSuffix')} {selected.runs} {t('runbooks.timesSuffix')}</p>
            <p className="last-edited-hint">{t('runbooks.lastEdited')}: {new Date(selected.lastEditedAt).toLocaleDateString('pt-BR')}</p>
            <div className="service-select-row">
              <Link2 size={13} />
              <select value={selected.serviceId ?? ''} disabled={!canEdit} onChange={e => linkService(e.target.value)}>
                <option value="">{t('runbooks.service.none')}</option>
                {serviceNodes.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-button" title="Favoritar" onClick={() => toggleFavorite({ id: selected.id, module: 'runbooks', label: selected.title })}><Star fill={isFavorite('runbooks', selected.id) ? 'currentColor' : 'none'} size={17} /></button>
            <button className="icon-button" title={t('runbooks.version')} onClick={() => setShowVersions(v => !v)}><GitBranch size={17} /></button>
            <button className="icon-button" title={t('runbooks.restartChecklist')} onClick={() => setCompleted(v => ({ ...v, [selected.id]: [] }))}><RotateCcw size={17} /></button>
            <button className="icon-button" title={presenting ? t('runbooks.present.exit') : t('runbooks.present.enter')} onClick={togglePresent}>{presenting ? <Minimize size={17} /> : <Maximize size={17} />}</button>
          </div>
        </header>

        <div className="runbook-toolbar-row">
          {!timerRunning
            ? <button className="button" onClick={startExecution}><Timer size={15} /> {t('runbooks.runWithTimer')}</button>
            : <span className="timer-badge"><Timer size={13} /> {t('runbooks.runningBy')} Victor Lima</span>}
          <button className="button button--compact" onClick={exportSelectedMarkdown}><FileDown size={14} /> {t('runbooks.exportMd')}</button>
        </div>

        <div className="progress-header"><span>{t('runbooks.progress')}</span><strong>{checks.length} {t('runbooks.progressOf')} {selected.steps.length}</strong></div>
        <div className="progress-track"><i style={{ width: `${checks.length / selected.steps.length * 100}%` }} /></div>

        <div className="checklist">{selected.steps.map((step, i) => {
          const meta = selected.stepMeta?.[i]
          const img = stepImagesForSelected[i]
          return <label className={checks.includes(i) ? 'is-done' : ''} key={i}>
            <input type="checkbox" checked={checks.includes(i)} onChange={() => toggle(i)} />
            <span><Check /></span>
            {editingIndex === i
              ? <div className="step-edit-row" onClick={e => e.stopPropagation()}>
                  <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                  <button className="button button--small" onClick={saveEdit}>{t('runbooks.save')}</button>
                </div>
              : <div>
                  <small>{t('runbooks.stepLabel')} {i + 1}</small><strong>{step}</strong>
                  {branchEditIndex === i && <div className="branch-row" onClick={e => e.stopPropagation()}>
                    <input value={branchCondition} onChange={e => setBranchCondition(e.target.value)} placeholder={t('runbooks.branch.conditionPlaceholder')} />
                    <input value={branchTarget} onChange={e => setBranchTarget(e.target.value)} placeholder={t('runbooks.branch.targetPlaceholder')} type="number" min={1} max={selected.steps.length} style={{ width: 90 }} />
                    <button className="button button--small" onClick={saveBranch}>{t('runbooks.branch.save')}</button>
                  </div>}
                  {meta?.branchTargetStep && editingIndex !== i && branchEditIndex !== i && !checks.includes(i) &&
                    <div className="branch-row" onClick={e => e.stopPropagation()}>
                      <button className="branch-skip-button" onClick={() => skipViaBranch(i, meta.branchTargetStep!, meta.branchCondition)}>
                        <GitFork size={11} /> {t('runbooks.branch.conditionLabel')} "{meta.branchCondition}" → {t('runbooks.branch.skipButton')} {meta.branchTargetStep}
                      </button>
                    </div>}
                  <div className="step-image-row" onClick={e => e.stopPropagation()}>
                    {img && <img src={img.url} alt={img.name} />}
                    <label className="attach-image">
                      <ImagePlus size={12} /> {t('runbooks.image.attach')}
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) attachImage(i, f) }} />
                    </label>
                  </div>
                </div>}
            {stepDurations[i] > 0 && <span className="step-duration">{fmtMs(stepDurations[i])}</span>}
            {editingIndex !== i && <>
              <button className="icon-button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : t('runbooks.branch.edit')} onClick={e => { e.preventDefault(); e.stopPropagation(); if (canEdit) startBranchEdit(i) }}><GitFork size={14} /></button>
              <button className="icon-button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={e => { e.preventDefault(); e.stopPropagation(); if (canEdit) startEdit(i) }}><Pencil size={14} /></button>
            </>}
          </label>
        })}</div>

        <button disabled={checks.length !== selected.steps.length} className="button button--primary button--full" onClick={finish}>{t('runbooks.finishExecution')}</button>

        <div className="stats-panel">
          <div className="stats-panel__tile"><small>{t('runbooks.stats.avgTime')}</small><strong>{runbookExecutions.length ? fmtMs(avgMs) : '—'}</strong></div>
          <div className="stats-panel__tile"><small>{t('runbooks.stats.totalRuns')}</small><strong>{runbookExecutions.length}</strong></div>
          <div className="stats-panel__tile"><small>{t('runbooks.stats.avgRating')}</small><strong>{ratedExecutions.length ? `${avgRating.toFixed(1)}/5` : '—'}</strong></div>
        </div>

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
              {typeof ex.rating === 'number' && <small className="exec-history-item__rating">{'★'.repeat(ex.rating)}{'☆'.repeat(5 - ex.rating)}</small>}
              {ex.feedback && <small className="exec-history-item__feedback">"{ex.feedback}"</small>}
            </div>)
          : <div className="empty-compact"><Clock3 /><span>{t('runbooks.history.empty')}</span></div>}
      </aside>
    </section>

    <section className="runbook-layout">
      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">{t('runbooks.ranking.eyebrow')}</span><h2>{t('runbooks.ranking.title')}</h2></div><Star size={18} /></div>
        <div className="ranking-list">
          {effectivenessRanking.map((r, i) => <div className="ranking-list__row" key={r.runbook.id}>
            <span className="rank-badge">{i + 1}</span>
            <span><strong>{r.runbook.title}</strong><small>{r.runbook.category} · {r.runbook.incidentType}</small></span>
            <span className="ranking-list__stars">{r.ratedCount > 0 ? `${r.avgRating.toFixed(1)}/5` : t('runbooks.ranking.noRatings')}</span>
            <span>{r.execCount} {t('runbooks.ranking.executions')}</span>
          </div>)}
        </div>
      </article>

      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">{t('runbooks.suggestions.eyebrow')}</span><h2>{t('runbooks.suggestions.title')}</h2></div><GitFork size={18} /></div>
        <label className="suggestions-panel__select">{t('runbooks.suggestions.selectLabel')}
          <select value={suggestionType} onChange={e => setSuggestionType(e.target.value)}>
            <option value="">{t('runbooks.suggestions.selectPlaceholder')}</option>
            {incidentTypes.map(it => <option key={it}>{it}</option>)}
          </select>
        </label>
        {!suggestionType
          ? <div className="empty-compact"><Search /><span>{t('runbooks.suggestions.empty')}</span></div>
          : suggestedRunbooks.length === 0
            ? <div className="empty-compact"><Search /><span>{t('runbooks.suggestions.noneForType')}</span></div>
            : <div className="suggestions-panel__list">
                {suggestedRunbooks.map(r => <div className="suggestions-panel__item" key={r.runbook.id}>
                  <span><strong>{r.runbook.title}</strong><small>{r.ratedCount > 0 ? `${r.avgRating.toFixed(1)}/5 · ${r.execCount} ${t('runbooks.ranking.executions')}` : t('runbooks.ranking.noRatings')}</small></span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="suggestions-panel__match">{t('runbooks.suggestions.matchLabel')}</span>
                    <button className="button button--small" onClick={() => selectRunbook(r.runbook)}>{t('runbooks.suggestions.view')}</button>
                  </span>
                </div>)}
              </div>}
      </article>
    </section>

    {templateModal && <Modal title={t('runbooks.modal.title')} onClose={() => setTemplateModal(false)}>
      <div className="form-grid">
        <label className="span-2">{t('runbooks.modal.nameLabel')} "{selected.title}")<input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder={t('runbooks.modal.namePlaceholder')} /></label>
        <div className="form-actions span-2"><button className="button" onClick={() => setTemplateModal(false)}>{t('runbooks.cancel')}</button><button className="button button--primary" onClick={duplicateAsTemplate}><Copy size={14} /> {t('runbooks.duplicate')}</button></div>
      </div>
    </Modal>}

    {pendingRatingId && <Modal title={t('runbooks.rating.title')} onClose={skipRating}>
      <div className="form-grid">
        <label className="span-2">{t('runbooks.rating.question')}
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} className={n <= ratingValue ? 'is-active' : ''} onClick={() => setRatingValue(n)}><Star size={20} fill={n <= ratingValue ? 'currentColor' : 'none'} /></button>)}
          </div>
        </label>
        <label className="span-2">{t('runbooks.rating.commentPlaceholder')}
          <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder={t('runbooks.rating.commentPlaceholder')} rows={3} />
        </label>
        <div className="form-actions span-2">
          <button className="button" onClick={skipRating}>{t('runbooks.rating.skip')}</button>
          <button className="button button--primary" disabled={!ratingValue} onClick={submitRating}>{t('runbooks.rating.submit')}</button>
        </div>
      </div>
    </Modal>}
  </>
}
