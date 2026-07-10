import '../styles/overview-extra.css'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, GitBranch, Maximize2, Minimize2, Rocket, Server, ShieldAlert, TicketCheck, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { DonutChart } from '../components/charts/DonutChart'
import { Sparkline } from '../components/charts/Sparkline'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { navigation } from '../config/navigation'
import { useAudit } from '../context/AuditContext'
import { pipelines, initialTickets, vulnerabilities } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import type { ModuleId } from '../types'
import { classNames } from '../utils/format'

type PanelId = 'traffic' | 'health' | 'delivery' | 'consumption' | 'timeline'

const DEFAULT_ORDER: PanelId[] = ['traffic', 'health', 'delivery', 'consumption', 'timeline']

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
  initialTickets.forEach((t, i) => events.push({
    id: `ticket-${t.id}`, kind: 'ticket',
    title: `${t.id} · ${t.title}`, detail: `${t.priority} · ${t.assignee}`, time: t.age, sortKey: 900 - i * 11,
  }))
  vulnerabilities.forEach((v, i) => events.push({
    id: `alert-${v.id}`, kind: 'alert',
    title: `${v.cve} em ${v.asset}`, detail: `${v.severity} · CVSS ${v.cvss}`, time: v.due, sortKey: 800 - i * 9,
  }))
  return events.sort((a, b) => b.sortKey - a.sortKey)
}

export default function OverviewPage({ onNavigate = () => undefined }: { onNavigate?: (id: ModuleId) => void }) {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const [order, setOrder] = useLocalStorage<PanelId[]>('opsphere-overview-panel-order', DEFAULT_ORDER)
  const [dragged, setDragged] = useState<PanelId | null>(null)
  const [overId, setOverId] = useState<PanelId | null>(null)
  const [kiosk, setKiosk] = useState(false)
  const kioskTimer = useRef<number | null>(null)

  const criticalTickets = initialTickets.filter(t => t.priority === 'P0' && t.status !== 'Concluído')
  const criticalVulns = vulnerabilities.filter(v => v.severity === 'Crítica' && v.status !== 'Resolvida')
  const failingPipelines = pipelines.filter(p => p.status === 'failed')
  const totalAlerts = criticalTickets.length + criticalVulns.length + failingPipelines.length
  const statusTone = totalAlerts === 0 ? 'ok' : (criticalVulns.length > 0 || criticalTickets.length > 0) ? 'critical' : 'warn'

  const timeline = useMemo(() => buildTimeline(t), [t])

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

  const panelBody: Record<PanelId, JSX.Element> = {
    traffic: <article className={classNames('panel panel--wide dashboard-panel', dragged === 'traffic' && 'dashboard-panel--dragging', overId === 'traffic' && 'dashboard-panel--over')}
      key="traffic" draggable onDragStart={() => setDragged('traffic')} onDragOver={e => { e.preventDefault(); setOverId('traffic') }} onDragLeave={() => setOverId(cur => cur === 'traffic' ? null : cur)} onDrop={() => handleDrop('traffic')} onDragEnd={() => { setDragged(null); setOverId(null) }}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.trafficEyebrow')}</span><h2>{t('overview.trafficTitle')}</h2></div><select><option>{t('overview.last24h')}</option><option>{t('overview.last7d')}</option></select></div>
      <div className="traffic-kpis"><div><span>{t('overview.requests')}</span><strong>12,8M</strong><Sparkline values={[22,30,27,41,36,54,51,64,60,72,68,82,77,90]}/></div><div><span>{t('overview.latencyP95')}</span><strong>182ms</strong><Sparkline values={[44,40,52,49,61,47,43,50,39,42,35,38,31,34]} color="#f8c56a"/></div></div>
      <div className="activity-chart">{[44,58,42,68,52,75,64,82,61,91,78,88,68,76,94,84,70,89,74,96,81,87,72,80].map((v,i)=><i key={i} style={{height:`${v}%`}}/>)}</div>
      <div className="chart-axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>{t('overview.axisNow')}</span></div>
    </article>,
    health: <article className={classNames('panel dashboard-panel', dragged === 'health' && 'dashboard-panel--dragging', overId === 'health' && 'dashboard-panel--over')}
      key="health" draggable onDragStart={() => setDragged('health')} onDragOver={e => { e.preventDefault(); setOverId('health') }} onDragLeave={() => setOverId(cur => cur === 'health' ? null : cur)} onDrop={() => handleDrop('health')} onDragEnd={() => { setDragged(null); setOverId(null) }}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.healthEyebrow')}</span><h2>{t('overview.healthTitle')}</h2></div><button className="link-button" onClick={() => onNavigate('services')}>{t('overview.viewMap')}</button></div>
      <DonutChart value={94} label={t('overview.donutLabel')}/>
      <div className="legend-list"><span><i className="dot dot--success"/>31 {t('overview.legendHealthy')}</span><span><i className="dot dot--warning"/>2 {t('overview.legendDegraded')}</span><span><i className="dot dot--danger"/>1 {t('overview.legendDown')}</span></div>
    </article>,
    delivery: <article className={classNames('panel panel--wide dashboard-panel', dragged === 'delivery' && 'dashboard-panel--dragging', overId === 'delivery' && 'dashboard-panel--over')}
      key="delivery" draggable onDragStart={() => setDragged('delivery')} onDragOver={e => { e.preventDefault(); setOverId('delivery') }} onDragLeave={() => setOverId(cur => cur === 'delivery' ? null : cur)} onDrop={() => handleDrop('delivery')} onDragEnd={() => { setDragged(null); setOverId(null) }}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.deliveryEyebrow')}</span><h2>{t('overview.deliveryTitle')}</h2></div><button className="link-button" onClick={() => onNavigate('pipelines')}>{t('overview.viewAll')} <ArrowRight size={14}/></button></div>
      <div className="data-list">{pipelines.slice(0,3).map(p=><div className="data-list__row" key={p.id}><div className={`status-icon status-icon--${p.status}`}>{p.status==='success'?<CheckCircle2 size={17}/>:p.status==='running'?<Clock3 size={17}/>:<ShieldAlert size={17}/>}</div><div className="grow"><strong>{p.name}</strong><span>{p.branch} · {p.owner}</span></div><Badge tone={p.status}>{p.status==='success'?t('overview.statusSuccess'):p.status==='running'?t('overview.statusRunning'):t('overview.statusFailed')}</Badge><time>{p.updated}</time></div>)}</div>
    </article>,
    consumption: <article className={classNames('panel dashboard-panel', dragged === 'consumption' && 'dashboard-panel--dragging', overId === 'consumption' && 'dashboard-panel--over')}
      key="consumption" draggable onDragStart={() => setDragged('consumption')} onDragOver={e => { e.preventDefault(); setOverId('consumption') }} onDragLeave={() => setOverId(cur => cur === 'consumption' ? null : cur)} onDrop={() => handleDrop('consumption')} onDragEnd={() => { setDragged(null); setOverId(null) }}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.consumptionEyebrow')}</span><h2>{t('overview.consumptionTitle')}</h2></div><Server size={19}/></div>
      <BarChart suffix="%" data={[{label:t('overview.envProd'),value:84},{label:t('overview.envStaging'),value:56,color:'#8097ff'},{label:t('overview.envDev'),value:38,color:'#f8c56a'},{label:t('overview.envSandbox'),value:22,color:'#b98aff'}]}/>
      <div className="insight"><Zap size={16}/><span><strong>{t('overview.insightOpportunity')}</strong> {t('overview.insightText')}</span></div>
    </article>,
    timeline: <article className={classNames('panel panel--wide dashboard-panel', dragged === 'timeline' && 'dashboard-panel--dragging', overId === 'timeline' && 'dashboard-panel--over')}
      key="timeline" draggable onDragStart={() => setDragged('timeline')} onDragOver={e => { e.preventDefault(); setOverId('timeline') }} onDragLeave={() => setOverId(cur => cur === 'timeline' ? null : cur)} onDrop={() => handleDrop('timeline')} onDragEnd={() => { setDragged(null); setOverId(null) }}>
      <div className="panel__header"><div><span className="eyebrow">{t('overview.timelineEyebrow')}</span><h2>{t('overview.timelineTitle')}</h2></div></div>
      <div className="timeline-feed">{timeline.map(ev => <div className="timeline-feed__row" key={ev.id}>
        <div className={`timeline-feed__icon timeline-feed__icon--${ev.kind}`}>{ev.kind==='deploy'?<Rocket size={14}/>:ev.kind==='ticket'?<TicketCheck size={14}/>:<AlertTriangle size={14}/>}</div>
        <div className="timeline-feed__body"><strong>{ev.title}</strong><span>{ev.detail}</span></div>
        <time className="timeline-feed__time">{ev.time}</time>
      </div>)}</div>
    </article>,
  }

  return <>
    <PageHeader eyebrow={t('overview.dateEyebrow')} title={t('overview.greeting')} description={t('overview.subtitle')} actions={<>
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

    <section className="metric-grid" data-tour="overview-content">
      <MetricCard label={t('overview.metricAvailability')} value="99,97%" delta="+0,04%" hint={t('overview.metricAvailabilityHint')} tone="healthy"/>
      <MetricCard label={t('overview.metricDeploysToday')} value="47" delta="+12,8%" hint={t('overview.metricDeploysHint')} tone="info"/>
      <MetricCard label={t('overview.metricIncidents')} value="3" delta="-25%" hint={t('overview.metricIncidentsHint')} tone="critical"/>
      <MetricCard label={t('overview.metricCost')} value="R$ 184k" delta="+2,1%" hint={t('overview.metricCostHint')} tone="warning"/>
    </section>
    <section className="dashboard-grid">
      {order.map(id => panelBody[id])}
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
  </>
}
