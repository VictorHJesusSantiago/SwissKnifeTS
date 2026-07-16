import { AlertTriangle, Bookmark, ChevronDown, ChevronRight, Download, Pause, Play, Plus, Search, Star, StickyNote, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ExportCsvButton } from '../components/ui/ExportCsvButton'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { buildLiveMessage, liveLevels, liveServices, normalizeLogMessage, randomTraceId, type AlertRule } from '../data/logsExtra'
import { logLevelColors, logLevelOrder, simulateLogAgeDays, type LogDashboard } from '../data/logsExtra3'
import { logs as initialLogs } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import type { LogEntry } from '../types'
import '../styles/logs-extra.css'
import '../styles/logs-extra2.css'
import '../styles/logs-extra3.css'

interface SavedQuery { id: string; label: string; query: string }

const availableTags = ['falso-positivo', 'conhecido']
const ANOMALY_WINDOW = 15

let liveIdSeed = 1000000

export default function LogsPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { addNotification } = useNotifications()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()
  const [logList, setLogList] = useState<LogEntry[]>(initialLogs)
  const [query, setQuery] = useState(''), [level, setLevel] = useState('TODOS'), [live, setLive] = useState(false)
  const [savedQueries, setSavedQueries] = useLocalStorage<SavedQuery[]>('opsphere-logs-saved-queries', [])
  const [regexInput, setRegexInput] = useState('')
  const [regexError, setRegexError] = useState(false)
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const consoleRef = useRef<HTMLElement | null>(null)

  // --- 1. Alertas configuráveis ---
  const [alertRules, setAlertRules] = useLocalStorage<AlertRule[]>('opsphere-logs-alert-rules', [])
  const [ruleLevel, setRuleLevel] = useState<AlertRule['level']>('ERROR')
  const [ruleService, setRuleService] = useState(liveServices[0])

  // --- 2. Anotações/bookmarks ---
  const [notes, setNotes] = useLocalStorage<Record<number, string>>('opsphere-logs-notes', {})

  // --- 3/6. Comparação de janelas de tempo + diff ---
  const [compareMode, setCompareMode] = useState(false)

  // --- 4. Agrupamento automático ---
  const [groupMode, setGroupMode] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // --- 7. Tags manuais ---
  const [logTags, setLogTags] = useLocalStorage<Record<number, string[]>>('opsphere-logs-tags', {})
  const [tagFilter, setTagFilter] = useState('')

  // --- 9. Exportação de selecionados ---
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({})

  // --- panels visibility ---
  const [showAnomaly, setShowAnomaly] = useState(false)
  const [showTopServices, setShowTopServices] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showLevelChart, setShowLevelChart] = useState(false)

  // --- Dashboards salvos (combinação de filtros) ---
  const [dashboards, setDashboards] = useLocalStorage<LogDashboard[]>('opsphere-logs-dashboards', [])

  // --- Histórico de buscas recentes ---
  const [searchHistory, setSearchHistory] = useLocalStorage<string[]>('opsphere-logs-search-history', [])

  // --- Simulador de retenção ---
  const [retentionDays, setRetentionDays] = useState(30)
  const [appliedRetentionDays, setAppliedRetentionDays] = useState<number | null>(null)

  useEffect(() => {
    if (!live) return
    const interval = setInterval(() => {
      const service = liveServices[Math.floor(Math.random() * liveServices.length)]
      const level = liveLevels[Math.floor(Math.random() * liveLevels.length)]
      const entry: LogEntry = {
        id: liveIdSeed++,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        level,
        service,
        message: buildLiveMessage(),
        trace: randomTraceId(),
      }
      setLogList(list => [entry, ...list].slice(0, 500))
      if (consoleRef.current) consoleRef.current.scrollTop = 0
      const matchedRule = alertRules.find(rule => rule.active && rule.level === entry.level && rule.service === entry.service)
      if (matchedRule) {
        addNotification(`Alerta: ${entry.level} em ${entry.service}`, entry.message, entry.level === 'ERROR' ? 'critical' : 'warning')
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [live, alertRules])

  const filtered = useMemo(() => logList.filter(log =>
    (level === 'TODOS' || log.level === level) &&
    (`${log.message} ${log.service} ${log.trace}`.toLowerCase().includes(query.toLowerCase())) &&
    (!tagFilter || (logTags[log.id] || []).includes(tagFilter)),
  ), [logList, query, level, tagFilter, logTags])

  const regex = useMemo(() => {
    if (!regexInput.trim()) { setRegexError(false); return null }
    try {
      const r = new RegExp(regexInput, 'gi')
      setRegexError(false)
      return r
    } catch {
      setRegexError(true)
      return null
    }
  }, [regexInput])

  const highlight = (message: string) => {
    if (!regex) return message
    const parts: Array<string | { match: string }> = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    const localRegex = new RegExp(regex.source, regex.flags)
    while ((match = localRegex.exec(message))) {
      if (match.index === lastIndex && match[0] === '') { localRegex.lastIndex++; continue }
      parts.push(message.slice(lastIndex, match.index))
      parts.push({ match: match[0] })
      lastIndex = match.index + match[0].length
      if (match[0] === '') localRegex.lastIndex++
    }
    parts.push(message.slice(lastIndex))
    return <>{parts.map((part, index) => typeof part === 'string' ? <span key={index}>{part}</span> : <mark key={index}>{part.match}</mark>)}</>
  }

  const saveCurrentQuery = () => {
    if (!query.trim()) return
    const exists = savedQueries.some(saved => saved.query === query)
    if (exists) return
    setSavedQueries(list => [{ id: `sq${Date.now()}`, label: query, query }, ...list].slice(0, 20))
    logAction('Log query salva', `"${query}" foi salva como busca favorita`)
    addNotification('Busca salva', `A busca "${query}" foi adicionada aos favoritos.`, 'healthy')
  }
  const applySavedQuery = (saved: SavedQuery) => setQuery(saved.query)
  const removeSavedQuery = (id: string) => setSavedQueries(list => list.filter(saved => saved.id !== id))

  const traceMatches = useMemo(() => selectedTrace ? logList.filter(log => log.trace === selectedTrace) : [], [selectedTrace, logList])

  const exportAs = (format: 'json' | 'csv' | 'txt') => {
    let blob: Blob, filename: string
    if (format === 'json') {
      blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
      filename = 'opsphere-logs.json'
    } else if (format === 'csv') {
      const header = 'timestamp,level,service,message,trace'
      const rows = filtered.map(log => [log.timestamp, log.level, log.service, `"${log.message.replace(/"/g, '""')}"`, log.trace].join(','))
      blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
      filename = 'opsphere-logs.csv'
    } else {
      blob = new Blob([filtered.map(l => `${l.timestamp} ${l.level} [${l.service}] ${l.message}`).join('\n')], { type: 'text/plain' })
      filename = 'opsphere-logs.txt'
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
    setExportOpen(false)
    logAction('Logs exportados', `${filtered.length} eventos exportados em formato ${format.toUpperCase()}`)
  }

  // --- Alert rules helpers ---
  const addRule = () => {
    const rule: AlertRule = { id: `rule${Date.now()}`, level: ruleLevel, service: ruleService, active: true }
    setAlertRules(list => [rule, ...list].slice(0, 30))
    logAction('Regra de alerta criada', `Notificar quando ${ruleLevel} em ${ruleService}`)
  }
  const toggleRule = (id: string) => setAlertRules(list => list.map(rule => rule.id === id ? { ...rule, active: !rule.active } : rule))
  const removeRule = (id: string) => setAlertRules(list => list.filter(rule => rule.id !== id))

  // --- Notes helpers ---
  const addNote = (log: LogEntry) => {
    const current = notes[log.id] || ''
    const note = window.prompt('Anotação para esta linha:', current)
    if (note === null) return
    setNotes(map => {
      const next = { ...map }
      if (note.trim()) next[log.id] = note.trim()
      else delete next[log.id]
      return next
    })
    logAction('Anotação de log', `Log #${log.id} anotado`)
  }

  // --- Tags helpers ---
  const toggleTag = (logId: number, tag: string) => {
    if (!canEdit) return
    setLogTags(map => {
      const current = map[logId] || []
      const next = current.includes(tag) ? current.filter(x => x !== tag) : [...current, tag]
      return { ...map, [logId]: next }
    })
  }

  // --- Selection helpers ---
  const toggleSelect = (logId: number) => setSelectedIds(map => ({ ...map, [logId]: !map[logId] }))
  const selectedRows = useMemo(() => filtered.filter(log => selectedIds[log.id]), [filtered, selectedIds])
  const selectedRowsForExport = selectedRows.map(log => ({ timestamp: log.timestamp, level: log.level, service: log.service, message: log.message, trace: log.trace }))

  // --- Comparação de janelas de tempo (3/6) ---
  const comparison = useMemo(() => {
    const mid = Math.floor(logList.length / 2)
    const periodA = logList.slice(0, mid)
    const periodB = logList.slice(mid)
    const countBy = (list: LogEntry[], lvl: string) => list.filter(l => l.level === lvl).length
    const normalizedA = new Set(periodA.map(l => normalizeLogMessage(l.message)))
    const normalizedB = new Set(periodB.map(l => normalizeLogMessage(l.message)))
    const onlyInA = [...normalizedA].filter(m => !normalizedB.has(m))
    const onlyInB = [...normalizedB].filter(m => !normalizedA.has(m))
    return {
      periodA, periodB,
      errorA: countBy(periodA, 'ERROR'), warnA: countBy(periodA, 'WARN'),
      errorB: countBy(periodB, 'ERROR'), warnB: countBy(periodB, 'WARN'),
      onlyInA, onlyInB,
    }
  }, [logList])

  // --- Agrupamento (4) ---
  const groups = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    for (const log of filtered) {
      const key = normalizeLogMessage(log.message)
      const list = map.get(key) || []
      list.push(log)
      map.set(key, list)
    }
    return [...map.entries()].map(([key, entries]) => ({ key, entries, count: entries.length })).sort((a, b) => b.count - a.count)
  }, [filtered])

  // --- Anomalia (5) ---
  const anomalyWindows = useMemo(() => {
    const chronological = [...logList].reverse()
    const chunks: LogEntry[][] = []
    for (let i = 0; i < chronological.length; i += ANOMALY_WINDOW) chunks.push(chronological.slice(i, i + ANOMALY_WINDOW))
    const counts = chunks.map(chunk => chunk.filter(l => l.level === 'ERROR').length)
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
    return counts.map((count, index) => ({ index, count, isSpike: avg > 0 && count > avg * 2 }))
  }, [logList])

  // --- Top serviços com erro (10) ---
  const topServices = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of logList) if (log.level === 'ERROR') counts.set(log.service, (counts.get(log.service) || 0) + 1)
    return [...counts.entries()].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [logList])

  // --- Timeline de volume por serviço (8) ---
  const timelineData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of logList) counts.set(log.service, (counts.get(log.service) || 0) + 1)
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [logList])

  // --- Distribuição de níveis (donut/bar) ---
  const levelDistribution = useMemo(() => {
    const total = filtered.length
    return logLevelOrder.map(lvl => {
      const count = filtered.filter(log => log.level === lvl).length
      return { label: `${lvl} (${total ? Math.round((count / total) * 100) : 0}%)`, value: count, color: logLevelColors[lvl] }
    })
  }, [filtered])

  // --- Simulador de retenção ---
  const purgeCandidateIds = useMemo(() => {
    if (appliedRetentionDays === null) return new Set<number>()
    const ids = logList.filter(log => simulateLogAgeDays(log.id) > appliedRetentionDays).map(log => log.id)
    return new Set(ids)
  }, [logList, appliedRetentionDays])

  const applyRetention = () => {
    setAppliedRetentionDays(retentionDays)
    logAction('Retenção simulada aplicada', `Reter logs por ${retentionDays} dias`)
  }
  const resetRetention = () => setAppliedRetentionDays(null)

  // --- Dashboards salvos ---
  const saveDashboard = () => {
    const name = window.prompt(t('logs.dashboardNamePrompt'))
    if (!name) return
    const dashboard: LogDashboard = { id: `dash${Date.now()}`, name, query, regex: regexInput, level, tagFilter, createdAt: Date.now() }
    setDashboards(list => [dashboard, ...list].slice(0, 20))
    logAction('Dashboard de logs salvo', `"${name}" salvo com filtros combinados`)
    addNotification('Dashboard salvo', `O dashboard "${name}" foi salvo.`, 'healthy')
  }
  const applyDashboard = (dashboard: LogDashboard) => {
    setQuery(dashboard.query)
    setRegexInput(dashboard.regex)
    setLevel(dashboard.level)
    setTagFilter(dashboard.tagFilter)
  }
  const removeDashboard = (id: string) => setDashboards(list => list.filter(d => d.id !== id))

  // --- Histórico de buscas ---
  const commitSearchHistory = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSearchHistory(list => [trimmed, ...list.filter(item => item !== trimmed)].slice(0, 10))
  }
  const applyHistoryEntry = (value: string) => setQuery(value)

  return <>
    <PageHeader eyebrow={t('logs.eyebrow')} title={t('logs.title')} description={t('logs.subtitle')} actions={
      <div className="export-menu">
        <button className="button" onClick={() => setExportOpen(open => !open)}><Download size={16} /> {t('logs.export')}</button>
        {exportOpen && <div className="export-menu__list">
          <button onClick={() => exportAs('json')}>{t('logs.exportJson')}</button>
          <button onClick={() => exportAs('csv')}>{t('logs.exportCsv')}</button>
          <button onClick={() => exportAs('txt')}>{t('logs.exportTxt')}</button>
        </div>}
      </div>
    } />

    <section className="saved-queries">
      <span className="saved-queries__label"><Bookmark size={12} /> {t('logs.savedQueries')}</span>
      {savedQueries.length === 0 && <span className="saved-queries__label">{t('logs.noneYet')}</span>}
      {savedQueries.map(saved => <span className="saved-query-chip" key={saved.id} onClick={() => applySavedQuery(saved)}>
        {saved.label}
        <button onClick={event => { event.stopPropagation(); removeSavedQuery(saved.id) }}><X size={11} /></button>
      </span>)}
      <button className="button button--compact" onClick={saveCurrentQuery} disabled={!query.trim() || !canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined}><Bookmark size={13} /> {t('logs.saveCurrentQuery')}</button>
    </section>

    {searchHistory.length > 0 && <section className="search-history">
      <span className="saved-queries__label">{t('logs.searchHistory')}</span>
      {searchHistory.map(entry => <span className="search-history-chip" key={entry} onClick={() => applyHistoryEntry(entry)}>{entry}</span>)}
    </section>}

    <section className="log-dashboards">
      <span className="saved-queries__label">{t('logs.dashboards')}</span>
      {dashboards.length === 0 && <span className="saved-queries__label">{t('logs.noneYet')}</span>}
      {dashboards.map(dashboard => <span className="log-dashboard-chip" key={dashboard.id} onClick={() => applyDashboard(dashboard)}>
        {dashboard.name}
        <button onClick={event => { event.stopPropagation(); removeDashboard(dashboard.id) }}><X size={11} /></button>
      </span>)}
      <button className="button button--compact" onClick={saveDashboard} disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined}><Bookmark size={13} /> {t('logs.saveDashboard')}</button>
    </section>

    <section className="retention-panel">
      <span className="saved-queries__label">{t('logs.retentionPanel')}</span>
      <label>{t('logs.retentionDaysLabel')}<input type="number" min={1} value={retentionDays} onChange={e => setRetentionDays(Math.max(1, Number(e.target.value) || 1))} /></label>
      <button className="button button--compact" onClick={applyRetention} disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined}>{t('logs.retentionApply')}</button>
      {appliedRetentionDays !== null && <>
        <span className="retention-panel__count">{purgeCandidateIds.size} {t('logs.retentionPurgeCount')}</span>
        <button className="button button--compact" onClick={resetRetention}>{t('logs.retentionReset')}</button>
      </>}
    </section>

    <section className="alert-rules">
      <span className="saved-queries__label"><AlertTriangle size={12} /> {t('logs.alertRules')}</span>
      <select value={ruleLevel} onChange={e => setRuleLevel(e.target.value as AlertRule['level'])}>
        {liveLevels.map(lvl => <option key={lvl}>{lvl}</option>)}
      </select>
      <select value={ruleService} onChange={e => setRuleService(e.target.value)}>
        {liveServices.map(svc => <option key={svc}>{svc}</option>)}
      </select>
      <button className="button button--compact" onClick={addRule} disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined}><Plus size={13} /> {t('logs.addRule')}</button>
      {alertRules.length === 0 && <span className="saved-queries__label">{t('logs.noRulesYet')}</span>}
      {alertRules.map(rule => <span className={`alert-rule-chip ${rule.active ? '' : 'is-inactive'}`} key={rule.id} onClick={() => toggleRule(rule.id)}>
        {rule.level} · {rule.service}
        <button onClick={event => { event.stopPropagation(); removeRule(rule.id) }}><X size={11} /></button>
      </span>)}
    </section>

    <section className="logs-toolbar panel">
      <label className="search-input"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitSearchHistory(query) }} onBlur={() => commitSearchHistory(query)} placeholder={t('logs.searchPlaceholder')} />{query && <button onClick={() => setQuery('')}><Trash2 size={15} /></button>}</label>
      <select value={level} onChange={e => setLevel(e.target.value)}><option>{t('logs.levelAll')}</option><option>ERROR</option><option>WARN</option><option>INFO</option><option>DEBUG</option></select>
      <select><option>{t('logs.allServices')}</option><option>gateway</option><option>checkout-api</option></select>
      <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
        <option value="">{t('logs.allTagsOption')}</option>
        {availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
      </select>
      <label className={`regex-input ${regexError ? 'is-invalid' : ''}`}>
        <input value={regexInput} onChange={e => setRegexInput(e.target.value)} placeholder={t('logs.regexPlaceholder')} />
        {regexInput && <button onClick={() => setRegexInput('')}><Trash2 size={13} /></button>}
      </label>
      <button className={`button button--compact ${live ? 'button--live' : ''}`} onClick={() => setLive(!live)}>{live ? <Pause size={14} /> : <Play size={14} />} {live ? t('logs.liveTailOn') : t('logs.liveTailOff')}</button>
    </section>

    <div className="logs-panels">
      <button className={`button button--compact ${compareMode ? 'button--live' : ''}`} onClick={() => setCompareMode(v => !v)}>{t('logs.compareMode')}</button>
      <button className={`button button--compact ${groupMode ? 'button--live' : ''}`} onClick={() => setGroupMode(v => !v)}>{t('logs.groupMode')}</button>
      <button className={`button button--compact ${showAnomaly ? 'button--live' : ''}`} onClick={() => setShowAnomaly(v => !v)}>{t('logs.anomalyPanel')}</button>
      <button className={`button button--compact ${showTopServices ? 'button--live' : ''}`} onClick={() => setShowTopServices(v => !v)}>{t('logs.topServices')}</button>
      <button className={`button button--compact ${showTimeline ? 'button--live' : ''}`} onClick={() => setShowTimeline(v => !v)}>{t('logs.timeline')}</button>
      <button className={`button button--compact ${showLevelChart ? 'button--live' : ''}`} onClick={() => setShowLevelChart(v => !v)}>{t('logs.levelChart')}</button>
      <ExportCsvButton filename="opsphere-logs-selecionados" rows={selectedRowsForExport} label={`${t('logs.exportSelected')} (${selectedRows.length})`} />
    </div>

    {compareMode && <div className="compare-grid">
      <div className="compare-col">
        <h4>{t('logs.periodA')} ({comparison.periodA.length})</h4>
        <dl><div><dt>ERROR</dt><dd>{comparison.errorA}</dd></div><div><dt>WARN</dt><dd>{comparison.warnA}</dd></div></dl>
        <h4>{t('logs.onlyInA')}</h4>
        <ul className="diff-list">{comparison.onlyInA.slice(0, 15).map((m, i) => <li key={i}>{m}</li>)}</ul>
      </div>
      <div className="compare-col">
        <h4>{t('logs.periodB')} ({comparison.periodB.length})</h4>
        <dl><div><dt>ERROR</dt><dd>{comparison.errorB}</dd></div><div><dt>WARN</dt><dd>{comparison.warnB}</dd></div></dl>
        <h4>{t('logs.onlyInB')}</h4>
        <ul className="diff-list">{comparison.onlyInB.slice(0, 15).map((m, i) => <li key={i}>{m}</li>)}</ul>
      </div>
    </div>}

    {showAnomaly && <div className="anomaly-panel">
      {anomalyWindows.map(win => <span className={`anomaly-chip ${win.isSpike ? 'is-spike' : ''}`} key={win.index}>
        #{win.index + 1}: {win.count} ERROR{win.isSpike ? ' · pico' : ''}
      </span>)}
      {anomalyWindows.length === 0 && <EmptyState message={t('logs.emptyState')} />}
    </div>}

    {showTopServices && <div className="top-services-panel">
      {topServices.map((row, index) => <div className="top-services-panel__row" key={row.service}><span>{index + 1}.</span>{row.service}<strong>{row.count}</strong></div>)}
      {topServices.length === 0 && <span className="saved-queries__label">{t('logs.noneYet')}</span>}
    </div>}

    {showTimeline && <div className="top-services-panel"><BarChart data={timelineData} /></div>}

    {showLevelChart && <div className="level-chart-panel"><BarChart data={levelDistribution} /></div>}

    <div className="log-summary"><span><strong>{filtered.length}</strong> {t('logs.eventsFound')}</span><span className={live ? 'text-success' : ''}><i className="pulse-dot" /> {live ? t('logs.receivingEvents') : t('logs.streamPaused')}</span><span>{t('logs.window60min')}</span></div>

    {!groupMode && <section className="log-console" ref={consoleRef}>
      {filtered.length ? filtered.map(log => <div className={`log-row ${selectedTrace === log.trace ? 'is-trace-match' : ''} ${purgeCandidateIds.has(log.id) ? 'is-purge-candidate' : ''}`} key={log.id} onClick={() => setSelectedTrace(log.trace)}>
        <input className="log-select-checkbox" type="checkbox" checked={!!selectedIds[log.id]} onClick={event => event.stopPropagation()} onChange={() => toggleSelect(log.id)} />
        <time>{log.timestamp}</time>
        <Badge tone={log.level}>{log.level}</Badge>
        <strong>[{log.service}]</strong>
        <span>{highlight(log.message)}</span>
        {(logTags[log.id] || []).map(tag => <span className="log-tag-chip is-active" key={tag}>{tag}</span>)}
        {availableTags.filter(tag => !(logTags[log.id] || []).includes(tag)).map(tag => <span className="log-tag-chip" key={tag} onClick={event => { event.stopPropagation(); toggleTag(log.id, tag) }}>{tag}</span>)}
        <button onClick={event => { event.stopPropagation(); setQuery(log.trace) }}>{log.trace}</button>
        <button className="icon-button" title={t('logs.addNote')} onClick={event => { event.stopPropagation(); addNote(log) }}><StickyNote size={14} className={notes[log.id] ? 'log-note-indicator' : ''} /></button>
        <button className="icon-button" title={t('pipelines.favorite')} onClick={event => { event.stopPropagation(); toggleFavorite({ id: String(log.id), module: 'logs', label: `[${log.service}] ${log.message.slice(0, 60)}` }) }}><Star fill={isFavorite('logs', String(log.id)) ? 'currentColor' : 'none'} size={14} /></button>
      </div>) : <EmptyState message={t('logs.emptyState')} />}
    </section>}

    {groupMode && <section className="log-console">
      {groups.length ? groups.map(group => <div key={group.key}>
        <div className="group-row" onClick={() => setExpandedGroups(map => ({ ...map, [group.key]: !map[group.key] }))}>
          {expandedGroups[group.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Badge tone={group.entries[0].level}>{group.entries[0].level}</Badge>
          <strong>{group.entries[0].message}</strong>
          <span className="group-row__count">{group.count}x</span>
        </div>
        {expandedGroups[group.key] && <div className="group-expanded">
          {group.entries.map(entry => <div key={entry.id}><time>{entry.timestamp}</time>[{entry.service}] {entry.message}</div>)}
        </div>}
      </div>) : <EmptyState message={t('logs.emptyState')} />}
    </section>}

    {selectedTrace && <div className="trace-panel">
      <header><h3>{t('logs.traceTitle')} {selectedTrace} ({traceMatches.length} {t('logs.events')})</h3><button className="icon-button" onClick={() => setSelectedTrace(null)}><X size={16} /></button></header>
      <div className="trace-panel__list">
        {traceMatches.map(log => <div className="trace-panel__item" key={log.id}>
          <time>{log.timestamp} · <Badge tone={log.level}>{log.level}</Badge> [{log.service}]</time>
          {log.message}
        </div>)}
      </div>
    </div>}
  </>
}
