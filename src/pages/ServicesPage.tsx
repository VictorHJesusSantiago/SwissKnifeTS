import { Activity, AlertTriangle, ArrowUpRight, Box, Download, Play, Radio, Star } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { TopologyGraph, type TopologyGraphHandle } from '../components/graph/TopologyGraph'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { extraServiceLinks } from '../data/networkExtra'
import '../styles/network-extra.css'
import { serviceLinks, serviceNodes } from '../data/mockData'
import { useI18n } from '../i18n/I18nContext'
import type { GraphNode } from '../types'
import { blastRadius, detectCycle } from '../utils/graphAnalysis'

const links=[...serviceLinks,...extraServiceLinks]
const TRACE_PATH=['gateway','checkout','payments','ledger']
const groups=Array.from(new Set(serviceNodes.map(n=>n.group)))

export default function ServicesPage(){
 const { t } = useI18n()
 const { logAction } = useAudit()
 const { addNotification } = useNotifications()
 const { isFavorite, toggleFavorite } = useFavorites()
 const graphRef = useRef<TopologyGraphHandle>(null)
 const [selected,setSelected]=useState<GraphNode>(serviceNodes[2]),[environment,setEnvironment]=useState('Produção')
 const [playing,setPlaying]=useState(false)
 const [hiddenGroups,setHiddenGroups]=useState<Set<string>>(new Set())

 const cycle = useMemo(()=>detectCycle(serviceNodes,links),[])
 const blast = useMemo(()=>blastRadius(selected.id,links),[selected])

 const select=useCallback((node:GraphNode)=>{setSelected(node);logAction('Serviços: nó selecionado',node.id)},[logAction])
 const incoming=links.filter(l=>l.target===selected.id).length,outgoing=links.filter(l=>l.source===selected.id).length

 const traceRequest=()=>{
  setPlaying(true)
  graphRef.current?.playTrace(TRACE_PATH,()=>setPlaying(false))
  logAction('Serviços: trace de requisição',TRACE_PATH.join(' → '))
 }
 const toggleGroup=(g:string)=>setHiddenGroups(prev=>{const next=new Set(prev);next.has(g)?next.delete(g):next.add(g);return next})
 const exportImage=()=>{
  graphRef.current?.exportPng('mapa-servicos.png')
  addNotification('Exportação concluída','O mapa de microsserviços foi exportado como PNG.','healthy')
  logAction('Serviços: grafo exportado','mapa-servicos.png')
 }

 return <><PageHeader eyebrow={t('services.eyebrow')} title={t('services.title')} description={t('services.subtitle')} actions={<><button className="button" onClick={exportImage}><Download size={16}/> {t('services.exportPng')}</button><button className="button button--primary" disabled={playing} onClick={traceRequest}><Play size={16}/> {t('services.traceRequest')}</button><select value={environment} onChange={e=>setEnvironment(e.target.value)}><option>{t('services.envProduction')}</option><option>{t('services.envStaging')}</option></select></>}/>
 {cycle.hasCycle && <div className="cycle-warning"><AlertTriangle size={18}/><span><strong>{t('services.cycleWarning')}</strong> {Array.from(cycle.cycleNodes).join(' → ')} → {Array.from(cycle.cycleNodes)[0]}. {t('services.cycleWarningSuffix')}</span></div>}
 <div className="tier-filter">{groups.map(g=><button key={g} className={hiddenGroups.has(g)?'':'is-active'} onClick={()=>toggleGroup(g)}>{g}</button>)}</div>
 <section className="graph-layout"><article className="panel graph-panel"><div className="graph-toolbar"><span><i className="dot dot--success"/>{t('services.healthy')}</span><span><i className="dot dot--warning"/>{t('services.degraded')}</span><span><i className="dot dot--danger"/>{t('services.critical')}</span><span className="push-right"><Radio size={14}/> {t('services.liveTraffic')}</span></div><TopologyGraph ref={graphRef} nodes={serviceNodes} links={links} onSelect={select} hiddenGroups={hiddenGroups} blastNodeIds={blast} cycleNodeIds={cycle.cycleNodes} cycleLinkKeys={cycle.cycleLinks} selectedId={selected.id}/></article>
 <aside className="panel service-detail"><div className="resource-icon"><Box/></div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span className="eyebrow">{t('services.service')}</span><button className="icon-button" title={t('pipelines.favorite')} onClick={()=>toggleFavorite({ id: selected.id, module: 'services', label: selected.id })}><Star fill={isFavorite('services', selected.id) ? 'currentColor' : 'none'} size={15}/></button></div><h2>{selected.id}</h2><span className={`health-label health-label--${selected.health}`}><i/>{selected.health==='healthy'?t('services.healthy'):selected.health==='warning'?t('services.degraded'):t('services.critical')}</span><div className="service-kpis"><div><span>{t('services.requestsPerMin')}</span><strong>{selected.id==='checkout'?'18.420':'8.210'}</strong></div><div><span>{t('services.error')}</span><strong className={selected.health==='critical'?'text-danger':''}>{selected.health==='critical'?'8,4%':'0,12%'}</strong></div><div><span>P95</span><strong>{selected.health==='critical'?'842ms':'118ms'}</strong></div><div><span>{t('services.version')}</span><strong>v2.14.3</strong></div></div><div className="dependency-counts"><span><ArrowUpRight/> {outgoing} {t('services.dependencies')}</span><span><Activity/> {incoming} {t('services.consumers')}</span></div>{blast.size>0 && <div className="blast-badge"><AlertTriangle size={13}/> {blast.size} {t('services.blastRadius')}</div>}<button className="button button--full">{t('services.openObservability')}</button></aside></section></>
}
