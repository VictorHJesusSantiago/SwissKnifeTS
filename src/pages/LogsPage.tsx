import { Bookmark, Download, Pause, Play, Search, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { buildLiveMessage, liveLevels, liveServices, randomTraceId } from '../data/logsExtra'
import { logs as initialLogs } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import type { LogEntry } from '../types'
import '../styles/logs-extra.css'

interface SavedQuery { id: string; label: string; query: string }

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
    }, 2000)
    return () => clearInterval(interval)
  }, [live])

  const filtered = useMemo(() => logList.filter(log =>
    (level === 'TODOS' || log.level === level) &&
    (`${log.message} ${log.service} ${log.trace}`.toLowerCase().includes(query.toLowerCase())),
  ), [logList, query, level])

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

    <section className="logs-toolbar panel">
      <label className="search-input"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('logs.searchPlaceholder')} />{query && <button onClick={() => setQuery('')}><Trash2 size={15} /></button>}</label>
      <select value={level} onChange={e => setLevel(e.target.value)}><option>{t('logs.levelAll')}</option><option>ERROR</option><option>WARN</option><option>INFO</option><option>DEBUG</option></select>
      <select><option>{t('logs.allServices')}</option><option>gateway</option><option>checkout-api</option></select>
      <label className={`regex-input ${regexError ? 'is-invalid' : ''}`}>
        <input value={regexInput} onChange={e => setRegexInput(e.target.value)} placeholder={t('logs.regexPlaceholder')} />
        {regexInput && <button onClick={() => setRegexInput('')}><Trash2 size={13} /></button>}
      </label>
      <button className={`button button--compact ${live ? 'button--live' : ''}`} onClick={() => setLive(!live)}>{live ? <Pause size={14} /> : <Play size={14} />} {live ? t('logs.liveTailOn') : t('logs.liveTailOff')}</button>
    </section>

    <div className="log-summary"><span><strong>{filtered.length}</strong> {t('logs.eventsFound')}</span><span className={live ? 'text-success' : ''}><i className="pulse-dot" /> {live ? t('logs.receivingEvents') : t('logs.streamPaused')}</span><span>{t('logs.window60min')}</span></div>

    <section className="log-console" ref={consoleRef}>
      {filtered.length ? filtered.map(log => <div className={`log-row ${selectedTrace === log.trace ? 'is-trace-match' : ''}`} key={log.id} onClick={() => setSelectedTrace(log.trace)}>
        <time>{log.timestamp}</time>
        <Badge tone={log.level}>{log.level}</Badge>
        <strong>[{log.service}]</strong>
        <span>{highlight(log.message)}</span>
        <button onClick={event => { event.stopPropagation(); setQuery(log.trace) }}>{log.trace}</button>
        <button className="icon-button" title={t('pipelines.favorite')} onClick={event => { event.stopPropagation(); toggleFavorite({ id: String(log.id), module: 'logs', label: `[${log.service}] ${log.message.slice(0, 60)}` }) }}><Star fill={isFavorite('logs', String(log.id)) ? 'currentColor' : 'none'} size={14} /></button>
      </div>) : <EmptyState message={t('logs.emptyState')} />}
    </section>

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
