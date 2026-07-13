import '../styles/overview-extra.css'
import '../styles/overview-extra2.css'
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, DollarSign, GitBranch, Maximize2,
  Minimize2, Rocket, Server, ShieldAlert, ShieldCheck, Sliders, Smile, TicketCheck, Trophy, Zap,
} from 'lucide-react'
import type { DragEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { DonutChart } from '../components/charts/DonutChart'
import { Sparkline } from '../components/charts/Sparkline'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { PrintButton } from '../components/ui/PrintButton'
import { navigation } from '../config/navigation'
import { useAudit } from '../context/AuditContext'
import { useRole } from '../context/RoleContext'
import { pipelines, initialTickets, vulnerabilities } from '../data/mockData'
import {
  computeCostByEnv, computeTopIncidentServices, computeWarrantyAlerts, daysSince,
  lastResolvedCriticalIncidentDate, upcomingEvents, type DailySnapshot,
} from '../data/overviewExtra2'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import type { ModuleId } from '../types'
import { classNames, formatCurrency } from '../utils/format'

type BasePanelId = 'traffic' | 'health' | 'delivery' | 'consumption' | 'timeline'
type ExtraId = 'okr' | 'streak' | 'mood' | 'events' | 'topIncidents' | 'costByEnv' | 'warrantyAlerts'
type PanelId = BasePanelId | ExtraId
type PanelSize = 'sm' | 'md' | 'lg'
type ViewMode = 'executive' | 'operational'

const BASE_ORDER: BasePanelId[] = ['traffic', 'health', 'delivery', 'consumption', 'timeline']
const EXTRA_IDS: ExtraId[] = ['okr', 'streak', 'mood', 'events', 'topIncidents', 'costByEnv', 'warrantyAlerts']
const DEFAULT_ORDER: PanelId[] = [...BASE_ORDER, ...EXTRA_IDS]
const ESSENTIAL_PANELS: PanelId[] = ['health', 'delivery', 'okr', 'streak']
const CURRENT_AVAILABILITY = 99.97

const WIDGET_LABEL_KEYS: Record<ExtraId, TranslationKey> = {
  topIncidents: 'overview.widgetTopIncidents',
  costByEnv: 'overview.widgetCostByEnv',
  warrantyAlerts: 'overview.widgetWarranty',
  okr: 'overview.widgetOkr',
  mood: 'overview.widgetMood',
  streak: 'overview.widgetStreak',
  events: 'overview.widgetEvents',
}

interface TimelineEvent {
  id: string
  kind: 'deploy' | 'ticket' | 'alert'
  title: string
  detail: string
  time: string
  sortKey: number
}

function buildTimeline(t: (key: TranslationKey) => string): TimelineEvent[] {
  const events: TimelineEvent[] = []
  pipelines.forEach((p, i) => events.push({
    id: `deploy-${p.id}`, kind: 'deploy',
    title: `${p.name} · ${p.status === 'success' ? t('overview.deploySuccess') : p.status === 'failed' ? t('overview.deployFailed') : t('overview.deployRunning')}`,
    detail: `${p.branch} · ${p.owner}`, time: p.updated, sortKey: 1000 - i * 7,
  }))
  initialTickets.forEach((tk, i) => events.push({
    id: `ticket-${tk.id}`, kind: 'ticket',
    title: `${tk.id} · ${tk.title}`, detail: `${tk.priority} · ${tk.assignee}`, time: tk.age, sortKey: 900 - i * 11,
  }))
  vulnerabilities.forEach((v, i) => events.push({
    id: `alert-${v.id}`, kind: 'alert',
    title: `${v.cve} em ${v.asset}`, detail: `${v.severity} · CVSS ${v.cvss}`, time: v.due, sortKey: 800 - i * 9,
  }))
  return events.sort((a, b) => b.sortKey - a.sortKey)
}

function SizeSwitcher({ id, sizes, onChange }: { id: string; sizes: Record<string, PanelSize>; onChange: (id: string, size: PanelSize) => void }) {
  const cur = sizes[id] ?? 'md'
  return <div className="size-switcher">
    {(['sm', 'md', 'lg'] as PanelSize[]).map(s => <button key={s} className={classNames('size-switcher__btn', cur === s && 'is-active')} onClick={() => onChange(id, s)}>{s.toUpperCase()}</button>)}
  </div>
}

function DashboardPanel({ id, wide, sizeClass, dragged, overId, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, children }: {
  id: string; wide?: boolean; sizeClass: string; dragged: string | null; overId: string | null
  onDragStart: () => void; onDragOver: (e: DragEvent) => void; onDragLeave: () => void; onDrop: () => void; onDragEnd: () => void
  children: ReactNode
}) {
  return <article className={classNames('panel', wide && 'panel--wide', sizeClass, 'dashboard-panel', dragged === id && 'dashboard-panel--dragging', overId === id && 'dashboard-panel--over')}
    draggable onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onDragEnd={onDragEnd}>
    {children}
  </article>
}

export default function OverviewPage({ onNavigate = () => undefined }: { onNavigate?: (id: ModuleId) => void }) {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { canEdit } = useRole()
  const [order, setOrder] = useLocalStorage<PanelId[]>('opsphere-overview-panel-order', DEFAULT_ORDER)
  const [panelSizes, setPanelSizes] = useLocalStorage<Record<string, PanelSize>>('opsphere-overview-panel-sizes', {})
  const [widgetActive, setWidgetActive] = useLocalStorage<Record<ExtraId, boolean>>('opsphere-overview-widget-toggles', {
    topIncidents: true, costByEnv: true, warrantyAlerts: true, okr: true, mood: true, streak: true, events: true,
  })
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('opsphere-overview-view-mode', 'operational')
  const [meetingMode, setMeetingMode] = useLocalStorage('opsphere-overview-meeting-mode', false)
  const [okrGoal, setOkrGoal] = useLocalStorage('opsphere-overview-okr-goal', 99.9)
  const [okrEditing, setOkrEditing] = useState(false)
  const [moodLog, setMoodLog] = useLocalStorage<Record<string, number>>('opsphere-overview-mood', {})
  const [snapshots, setSnapshots] = useLocalStorage<Record<string, DailySnapshot>>('opsphere-overview-snapshots', {})

  const [dragged, setDragged] = useState<PanelId | null>(null)
  const [overId, setOverId] = useState<PanelId | null>(null)
  const [kiosk, setKiosk] = useState(false)
  const kioskTimer = useRef<number | null>(null)

  const criticalTickets = initialTickets.filter(tk => tk.priority === 'P0' && tk.status !== 'Concluído')
  const criticalVulns = vulnerabilities.filter(v => v.severity === 'Crítica' && v.status !== 'Resolvida')
  const failingPipelines = pipelines.filter(p => p.status === 'failed')
  const totalAlerts = criticalTickets.length + criticalVulns.length + failingPipelines.length
  const statusTone = totalAlerts === 0 ? 'ok' : (criticalVulns.length > 0 || criticalTickets.length > 0) ? 'critical' : 'warn'
  const hasOpenCritical = criticalTickets.length > 0 || criticalVulns.length > 0
  const streakDays = hasOpenCritical ? 0 : daysSince(lastResolvedCriticalIncidentDate)

  const timeline = useMemo(() => buildTimeline(t), [t])
  const topIncidentServices = useMemo(() => computeTopIncidentServices(), [])
  const costByEnv = useMemo(() => computeCostByEnv(), [])
  const warrantyAlerts = useMemo(() => computeWarrantyAlerts(), [])

  useEffect(() => {
    const today = new Date().toDateString()
    if (!snapshots[today]) {
      const snap: DailySnapshot = { date: today, availability: CURRENT_AVAILABILITY, deploysToday: 47, incidents: totalAlerts, costK: 184 }
      setSnapshots(s => ({ ...s, [today]: snap }))
      logAction('Snapshot diário salvo', `Métricas principais registradas para ${today}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todayKey = new Date().toDateString()
  const yesterdayKey = new Date(Date.now() - 86_400_000).toDateString()
  const yesterdaySnap = snapshots[yesterdayKey]
  const todaySnap = snapshots[todayKey]

  const stopKiosk = () => {
    setKiosk(false)
    if (kioskTimer.current) { window.clearInterval(kioskTimer.current); kioskTimer.current = null }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  }

  const startKiosk = async () => {
    try { await document.documentElement.requestFullscreen() } catch { /* fullscreen unavailable, continue without it */ }
    setKiosk(true)
    logAction('Modo TV ativado', 'Rotação automática entre módulos iniciada')
    let idx = 0
    kioskTimer.current = window.setInterval(() => {
      idx = (idx + 1) % navigation.length
      window.location.hash = `/${navigation[idx].id}`
    }, 8000)
  }

  useEffect(() => {
    if (!kiosk) return
    const onFsChange = () => { if (!document.fullscreenElement) stopKiosk() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stopKiosk() }
    document.addEventListener('fullscreenchange', onFsChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosk])

  useEffect(() => () => { if (kioskTimer.current) window.clearInterval(kioskTimer.current) }, [])

  const handleDrop = (target: PanelId) => {
    if (!dragged || dragged === target) { setOverId(null); return }
    setOrder(prev => {
      const next = [...prev]
      const from = next.indexOf(dragged)
      const to = next.indexOf(target)
      next.splice(from, 1)
      next.splice(to, 0, dragged)
      return next
    })
    logAction('Layout reordenado', `Painel "${dragged}" movido para posição de "${target}"`)
    setDragged(null)
    setOverId(null)
  }

  const dragHandlers = (id: PanelId) => ({
    dragged, overId,
    onDragStart: () => setDragged(id),
    onDragOver: (e: DragEvent) => { e.preventDefault(); setOverId(id) },
    onDragLeave: () => setOverId(cur => cur === id ? null : cur),
    onDrop: () => handleDrop(id),
    onDragEnd: () => { setDragged(null); setOverId(null) },
  })

  const sizeClassOf = (id: string) => `panel--size-${panelSizes[id] ?? 'md'}`
  const onSizeChange = (id: string, size: PanelSize) => setPanelSizes(s => ({ ...s, [id]: size }))

  const setTodayMood = (val: number) => {
    setMoodLog(m => ({ ...m, [todayKey]: val }))
    logAction('Humor do plantão registrado', `Nota ${val}/5 registrada para hoje`)
  }
  const last7Mood = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toDateString()
    return { key, value: moodLog[key] ?? 0, label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') }
  })

  const saveOkr = () => {
    if (okrEditing) logAction('Meta atualizada', `Meta de disponibilidade definida para ${okrGoal.toFixed(2)}%`)
    setOkrEditing(v => !v)
  }

  const panelBody: Record<PanelId, ReactNode> = {
    traffic: <DashboardPanel id="traffic" wide sizeClass={sizeClassOf('traffic')} {...dragHandlers('traffic')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.trafficEyebrow')}</span><h2>{t('overview.trafficTitle')}</h2></div>
        <div className="panel-header-actions"><select><option>{t('overview.last24h')}</option><option>{t('overview.last7d')}</option></select><SizeSwitcher id="traffic" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="traffic-kpis"><div><span>{t('overview.requests')}</span><strong>12,8M</strong><Sparkline values={[22,30,27,41,36,54,51,64,60,72,68,82,77,90]}/></div><div><span>{t('overview.latencyP95')}</span><strong>182ms</strong><Sparkline values={[44,40,52,49,61,47,43,50,39,42,35,38,31,34]} color="#f8c56a"/></div></div>
      <div className="activity-chart">{[44,58,42,68,52,75,64,82,61,91,78,88,68,76,94,84,70,89,74,96,81,87,72,80].map((v,i)=><i key={i} style={{height:`${v}%`}}/>)}</div>
      <div className="chart-axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>{t('overview.axisNow')}</span></div>
    </DashboardPanel>,

    health: <DashboardPanel id="health" sizeClass={sizeClassOf('health')} {...dragHandlers('health')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.healthEyebrow')}</span><h2>{t('overview.healthTitle')}</h2></div>
        <div className="panel-header-actions"><button className="link-button" onClick={() => onNavigate('services')}>{t('overview.viewMap')}</button><SizeSwitcher id="health" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <DonutChart value={94} label={t('overview.donutLabel')}/>
      <div className="legend-list"><span><i className="dot dot--success"/>31 {t('overview.legendHealthy')}</span><span><i className="dot dot--warning"/>2 {t('overview.legendDegraded')}</span><span><i className="dot dot--danger"/>1 {t('overview.legendDown')}</span></div>
    </DashboardPanel>,

    delivery: <DashboardPanel id="delivery" wide sizeClass={sizeClassOf('delivery')} {...dragHandlers('delivery')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.deliveryEyebrow')}</span><h2>{t('overview.deliveryTitle')}</h2></div>
        <div className="panel-header-actions"><button className="link-button" onClick={() => onNavigate('pipelines')}>{t('overview.viewAll')} <ArrowRight size={14}/></button><SizeSwitcher id="delivery" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="data-list">{pipelines.slice(0,3).map(p=><div className="data-list__row" key={p.id}><div className={`status-icon status-icon--${p.status}`}>{p.status==='success'?<CheckCircle2 size={17}/>:p.status==='running'?<Clock3 size={17}/>:<ShieldAlert size={17}/>}</div><div className="grow"><strong>{p.name}</strong><span>{p.branch} · {p.owner}</span></div><Badge tone={p.status}>{p.status==='success'?t('overview.statusSuccess'):p.status==='running'?t('overview.statusRunning'):t('overview.statusFailed')}</Badge><time>{p.updated}</time></div>)}</div>
    </DashboardPanel>,

    consumption: <DashboardPanel id="consumption" sizeClass={sizeClassOf('consumption')} {...dragHandlers('consumption')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.consumptionEyebrow')}</span><h2>{t('overview.consumptionTitle')}</h2></div>
        <div className="panel-header-actions"><Server size={19}/><SizeSwitcher id="consumption" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <BarChart suffix="%" data={[{label:t('overview.envProd'),value:84},{label:t('overview.envStaging'),value:56,color:'#8097ff'},{label:t('overview.envDev'),value:38,color:'#f8c56a'},{label:t('overview.envSandbox'),value:22,color:'#b98aff'}]}/>
      <div className="insight"><Zap size={16}/><span><strong>{t('overview.insightOpportunity')}</strong> {t('overview.insightText')}</span></div>
    </DashboardPanel>,

    timeline: <DashboardPanel id="timeline" wide sizeClass={sizeClassOf('timeline')} {...dragHandlers('timeline')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.timelineEyebrow')}</span><h2>{t('overview.timelineTitle')}</h2></div><SizeSwitcher id="timeline" sizes={panelSizes} onChange={onSizeChange}/></div>
      <div className="timeline-feed">{timeline.map(ev => <div className="timeline-feed__row" key={ev.id}>
        <div className={`timeline-feed__icon timeline-feed__icon--${ev.kind}`}>{ev.kind==='deploy'?<Rocket size={14}/>:ev.kind==='ticket'?<TicketCheck size={14}/>:<AlertTriangle size={14}/>}</div>
        <div className="timeline-feed__body"><strong>{ev.title}</strong><span>{ev.detail}</span></div>
        <time className="timeline-feed__time">{ev.time}</time>
      </div>)}</div>
    </DashboardPanel>,

    okr: <DashboardPanel id="okr" sizeClass={sizeClassOf('okr')} {...dragHandlers('okr')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.okrEyebrow')}</span><h2>{t('overview.okrTitle')}</h2></div>
        <div className="panel-header-actions"><Trophy size={18}/><SizeSwitcher id="okr" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="okr-widget">
        <div className="okr-widget__row"><span>{t('overview.okrCurrent')}</span><strong>{CURRENT_AVAILABILITY.toFixed(2).replace('.', ',')}%</strong></div>
        <div className="okr-progress"><div className="okr-progress__bar" style={{ width: `${Math.min(100, (CURRENT_AVAILABILITY / okrGoal) * 100)}%` }}/></div>
        <div className="okr-widget__row"><span>{t('overview.okrTarget')}</span>
          {okrEditing
            ? <input type="number" step="0.01" min={0} max={100} value={okrGoal} disabled={!canEdit} onChange={e => setOkrGoal(Number(e.target.value) || 0)}/>
            : <strong>{okrGoal.toFixed(2).replace('.', ',')}%</strong>}
        </div>
        <button className="button button--tiny" disabled={!canEdit} onClick={saveOkr}>{okrEditing ? t('overview.okrSave') : t('overview.okrEdit')}</button>
      </div>
    </DashboardPanel>,

    streak: <DashboardPanel id="streak" sizeClass={sizeClassOf('streak')} {...dragHandlers('streak')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.streakEyebrow')}</span><h2>{t('overview.widgetStreak')}</h2></div>
        <div className="panel-header-actions"><ShieldCheck size={18}/><SizeSwitcher id="streak" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="streak-poster">
        <span className="streak-poster__label">{t('overview.streakLabel')}</span>
        <strong className="streak-poster__number">{streakDays}</strong>
        <span className="streak-poster__unit">{t('overview.streakUnit')}</span>
        {hasOpenCritical && <Badge tone="critical">{t('overview.streakActiveCritical')}</Badge>}
      </div>
    </DashboardPanel>,

    mood: <DashboardPanel id="mood" sizeClass={sizeClassOf('mood')} {...dragHandlers('mood')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.moodEyebrow')}</span><h2>{t('overview.moodTitle')}</h2></div>
        <div className="panel-header-actions"><Smile size={18}/><SizeSwitcher id="mood" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="mood-widget">
        <span className="eyebrow">{t('overview.moodQuestion')}</span>
        <div className="mood-widget__picker">
          {[1,2,3,4,5].map(v => <button key={v} className={classNames(moodLog[todayKey] === v && 'is-active')} onClick={() => setTodayMood(v)}>{['😞','🙁','😐','🙂','😄'][v-1]}</button>)}
        </div>
        <div className="mood-chart">
          {last7Mood.map(d => <div className="mood-chart__col" key={d.key}>
            <div className="mood-chart__bar" style={{ height: `${Math.max(4, (d.value/5)*100)}%` }}/>
            <span>{d.label}</span>
          </div>)}
        </div>
      </div>
    </DashboardPanel>,

    events: <DashboardPanel id="events" sizeClass={sizeClassOf('events')} {...dragHandlers('events')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.eventsEyebrow')}</span><h2>{t('overview.eventsTitle')}</h2></div>
        <div className="panel-header-actions"><CalendarClock size={18}/><SizeSwitcher id="events" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="events-widget">{upcomingEvents.map(ev => <div className="events-widget__row" key={ev.id}>
        <div className="events-widget__icon"><CalendarClock size={14}/></div>
        <div className="events-widget__body"><strong>{ev.title}</strong><span>{ev.date}</span></div>
      </div>)}</div>
    </DashboardPanel>,

    topIncidents: <DashboardPanel id="topIncidents" sizeClass={sizeClassOf('topIncidents')} {...dragHandlers('topIncidents')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.topIncidentsEyebrow')}</span><h2>{t('overview.topIncidentsTitle')}</h2></div><SizeSwitcher id="topIncidents" sizes={panelSizes} onChange={onSizeChange}/></div>
      <BarChart data={topIncidentServices.map(s => ({ label: s.name, value: s.score }))}/>
    </DashboardPanel>,

    costByEnv: <DashboardPanel id="costByEnv" sizeClass={sizeClassOf('costByEnv')} {...dragHandlers('costByEnv')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.costByEnvEyebrow')}</span><h2>{t('overview.costByEnvTitle')}</h2></div>
        <div className="panel-header-actions"><DollarSign size={18}/><SizeSwitcher id="costByEnv" sizes={panelSizes} onChange={onSizeChange}/></div>
      </div>
      <div className="data-list">{costByEnv.map(c => <div className="data-list__row" key={c.label}><span className="grow"><strong>{c.label}</strong></span><strong>{formatCurrency(c.value)}</strong></div>)}</div>
    </DashboardPanel>,

    warrantyAlerts: <DashboardPanel id="warrantyAlerts" sizeClass={sizeClassOf('warrantyAlerts')} {...dragHandlers('warrantyAlerts')}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.warrantyEyebrow')}</span><h2>{t('overview.warrantyTitle')}</h2></div><SizeSwitcher id="warrantyAlerts" sizes={panelSizes} onChange={onSizeChange}/></div>
      {warrantyAlerts.length === 0
        ? <p className="warranty-empty">{t('overview.warrantyEmpty')}</p>
        : warrantyAlerts.map(a => <div className="warranty-row" key={a.id}><span>{a.name}</span><strong>{a.warranty}</strong></div>)}
    </DashboardPanel>,
  }

  const visibleOrder = order.filter(id => {
    if ((EXTRA_IDS as string[]).includes(id) && !widgetActive[id as ExtraId]) return false
    if ((viewMode === 'executive' || meetingMode) && !ESSENTIAL_PANELS.includes(id)) return false
    return true
  })

  return <div className={classNames('overview-page', meetingMode && 'overview-meeting-mode')}>
    <PageHeader eyebrow={t('overview.dateEyebrow')} title={t('overview.greeting')} description={t('overview.subtitle')} actions={<>
      <PrintButton/>
      <div className="view-toggle">
        <button className={classNames(viewMode === 'executive' && 'is-active')} onClick={() => setViewMode('executive')}>{t('overview.viewExecutive')}</button>
        <button className={classNames(viewMode === 'operational' && 'is-active')} onClick={() => setViewMode('operational')}>{t('overview.viewOperational')}</button>
      </div>
      <button className="button button--compact" onClick={() => setMeetingMode(v => !v)}><Sliders size={14}/> {meetingMode ? t('overview.meetingModeExit') : t('overview.meetingMode')}</button>
      <button className="button kiosk-toggle" onClick={kiosk ? stopKiosk : startKiosk}>{kiosk ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {kiosk ? t('overview.kioskExit') : t('overview.kioskEnter')}</button>
      <button className="button button--primary" onClick={() => onNavigate('tickets')}>{t('overview.openIncident')} <ArrowRight size={16}/></button>
    </>}/>

    <div className={`status-banner status-banner--${statusTone}`}>
      <div className="status-banner__icon">{statusTone === 'ok' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}</div>
      <div className="status-banner__body">
        <strong>{totalAlerts === 0 ? t('overview.allOk') : `${totalAlerts} ${totalAlerts > 1 ? t('overview.alerts') : t('overview.alert')} ${t('overview.requiringAttention')}`}</strong>
        <span>{t('overview.statusDesc')}</span>
      </div>
      <div className="status-banner__chips">
        <Badge tone={criticalTickets.length ? 'critical' : 'healthy'}><GitBranch size={10}/> {criticalTickets.length} {t('overview.chipTicketsP0')}</Badge>
        <Badge tone={criticalVulns.length ? 'critical' : 'healthy'}><ShieldAlert size={10}/> {criticalVulns.length} {t('overview.chipVulnsCritical')}</Badge>
        <Badge tone={failingPipelines.length ? 'warning' : 'healthy'}><Clock3 size={10}/> {failingPipelines.length} {t('overview.chipPipelinesFailing')}</Badge>
      </div>
    </div>

    {yesterdaySnap && todaySnap && <div className="snapshot-banner">
      <span className="eyebrow">{t('overview.snapshotVsYesterday')}</span>
      <div className="snapshot-banner__item"><span>{t('overview.metricAvailability')}</span><strong className={todaySnap.availability >= yesterdaySnap.availability ? 'up' : 'down'}>{todaySnap.availability.toFixed(2)}% ({todaySnap.availability >= yesterdaySnap.availability ? '+' : ''}{(todaySnap.availability - yesterdaySnap.availability).toFixed(2)})</strong></div>
      <div className="snapshot-banner__item"><span>{t('overview.metricDeploysToday')}</span><strong className={todaySnap.deploysToday >= yesterdaySnap.deploysToday ? 'up' : 'down'}>{todaySnap.deploysToday} ({todaySnap.deploysToday >= yesterdaySnap.deploysToday ? '+' : ''}{todaySnap.deploysToday - yesterdaySnap.deploysToday})</strong></div>
      <div className="snapshot-banner__item"><span>{t('overview.metricIncidents')}</span><strong className={todaySnap.incidents <= yesterdaySnap.incidents ? 'up' : 'down'}>{todaySnap.incidents} ({todaySnap.incidents - yesterdaySnap.incidents >= 0 ? '+' : ''}{todaySnap.incidents - yesterdaySnap.incidents})</strong></div>
      <div className="snapshot-banner__item"><span>{t('overview.metricCost')}</span><strong className={todaySnap.costK <= yesterdaySnap.costK ? 'up' : 'down'}>R$ {todaySnap.costK}k ({todaySnap.costK - yesterdaySnap.costK >= 0 ? '+' : ''}{todaySnap.costK - yesterdaySnap.costK}k)</strong></div>
    </div>}

    <section className="metric-grid" data-tour="overview-content">
      <MetricCard label={t('overview.metricAvailability')} value="99,97%" delta="+0,04%" hint={t('overview.metricAvailabilityHint')} tone="healthy"/>
      <MetricCard label={t('overview.metricDeploysToday')} value="47" delta="+12,8%" hint={t('overview.metricDeploysHint')} tone="info"/>
      <MetricCard label={t('overview.metricIncidents')} value="3" delta="-25%" hint={t('overview.metricIncidentsHint')} tone="critical"/>
      <MetricCard label={t('overview.metricCost')} value="R$ 184k" delta="+2,1%" hint={t('overview.metricCostHint')} tone="warning"/>
    </section>

    <article className="panel" style={{ marginBottom: 14 }}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.customizeEyebrow')}</span><h2>{t('overview.customizeTitle')}</h2></div></div>
      <div className="widget-catalog">
        {EXTRA_IDS.map(id => <label key={id}>
          <input type="checkbox" checked={widgetActive[id]} onChange={() => setWidgetActive(w => ({ ...w, [id]: !w[id] }))}/>
          {t(WIDGET_LABEL_KEYS[id])}
        </label>)}
      </div>
    </article>

    <section className="dashboard-grid">
      {visibleOrder.map(id => panelBody[id])}
    </section>

    {kiosk && <div className="kiosk-overlay">
      <div className="kiosk-overlay__bar">
        <span>{t('overview.kioskActiveText')}</span>
        <button className="button button--tiny" onClick={stopKiosk}><Minimize2 size={14}/> {t('overview.exit')}</button>
      </div>
      <div className="kiosk-overlay__frame">
        <p>{t('overview.kioskOverlayText')}</p>
      </div>
    </div>}
  </div>
}
