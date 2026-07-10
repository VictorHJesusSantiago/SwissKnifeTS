import { AlertTriangle, Download, Play, RotateCcw, Router, Star, Wifi, Zap } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { TopologyGraph, type TopologyGraphHandle } from '../components/graph/TopologyGraph'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { extraInfraLinks } from '../data/networkExtra'
import '../styles/network-extra.css'
import { useI18n } from '../i18n/I18nContext'
import type { GraphNode } from '../types'
import { blastRadius, detectCycle } from '../utils/graphAnalysis'

const nodes: GraphNode[] = [{id:'Internet',group:'edge',health:'healthy'},{id:'WAF',group:'edge',health:'healthy'},{id:'LB-Prod',group:'edge',health:'healthy'},{id:'VPC-App',group:'core',health:'healthy'},{id:'VPC-Data',group:'core',health:'warning'},{id:'NAT-01',group:'edge',health:'healthy'},{id:'DB-Primary',group:'data',health:'warning'},{id:'Redis',group:'data',health:'healthy'},{id:'VPN',group:'edge',health:'healthy'}]
const baseLinks=[{source:'Internet',target:'WAF',value:90},{source:'WAF',target:'LB-Prod',value:85},{source:'LB-Prod',target:'VPC-App',value:75},{source:'VPC-App',target:'VPC-Data',value:60},{source:'VPC-Data',target:'DB-Primary',value:70},{source:'VPC-Data',target:'Redis',value:45},{source:'VPC-App',target:'NAT-01',value:35},{source:'VPN',target:'VPC-App',value:25}]
const links=[...baseLinks,...extraInfraLinks]
const TRACE_PATH=['Internet','WAF','LB-Prod','VPC-App','VPC-Data']
const groups=Array.from(new Set(nodes.map(n=>n.group)))

export default function NetworkPage(){
 const { t } = useI18n()
 const { logAction } = useAudit()
 const { addNotification } = useNotifications()
 const { isFavorite, toggleFavorite } = useFavorites()
 const graphRef = useRef<TopologyGraphHandle>(null)
 const [selected,setSelected]=useState<GraphNode>(nodes[4])
 const [packet,setPacket]=useState<string[]>([])
 const [playing,setPlaying]=useState(false)
 const [hiddenGroups,setHiddenGroups]=useState<Set<string>>(new Set())

 const cycle = useMemo(()=>detectCycle(nodes,links),[])
 const blast = useMemo(()=>blastRadius(selected.id,links),[selected])

 const select=useCallback((n:GraphNode)=>{setSelected(n);logAction('Rede: componente selecionado',n.id)},[logAction])

 const simulate=()=>{
  setPlaying(true)
  setPacket(['Internet'])
  graphRef.current?.playTrace(TRACE_PATH,()=>setPlaying(false))
  TRACE_PATH.slice(1).forEach((n,i)=>setTimeout(()=>setPacket(p=>[...p,n]),(i+1)*400))
  logAction('Rede: trace de pacote simulado',TRACE_PATH.join(' → '))
 }

 const toggleGroup=(g:string)=>setHiddenGroups(prev=>{const next=new Set(prev);next.has(g)?next.delete(g):next.add(g);return next})

 const exportImage=()=>{
  graphRef.current?.exportPng('topologia-rede.png')
  addNotification('Exportação concluída','A topologia de rede foi exportada como PNG.','healthy')
  logAction('Rede: grafo exportado','topologia-rede.png')
 }

 return <><PageHeader eyebrow={t('network.eyebrow')} title={t('network.title')} description={t('network.subtitle')} actions={<><button className="button" onClick={()=>setPacket([])}><RotateCcw size={16}/> {t('network.clear')}</button><button className="button" onClick={exportImage}><Download size={16}/> {t('network.exportPng')}</button><button className="button button--primary" disabled={playing} onClick={simulate}><Play size={16}/> {t('network.simulatePacket')}</button></>}/>
 <section className="metric-grid"><MetricCard label={t('network.metricDevices')} value="42" hint={t('network.metricDevicesHint')}/><MetricCard label={t('network.metricTraffic')} value="8,4 Gbps" delta="+6,2%"/><MetricCard label={t('network.metricPacketLoss')} value="0,03%" tone="healthy"/><MetricCard label={t('network.metricLatency')} value="14ms" tone="healthy"/></section>
 {cycle.hasCycle && <div className="cycle-warning"><AlertTriangle size={18}/><span><strong>{t('network.cycleWarning')}</strong> {Array.from(cycle.cycleNodes).join(' → ')} → {Array.from(cycle.cycleNodes)[0]}. {t('network.cycleWarningSuffix')}</span></div>}
 <div className="tier-filter">{groups.map(g=><button key={g} className={hiddenGroups.has(g)?'':'is-active'} onClick={()=>toggleGroup(g)}>{g}</button>)}</div>
 <section className="graph-layout"><article className="panel graph-panel"><div className="graph-toolbar"><span><i className="dot dot--success"/>{t('network.operational')}</span><span><i className="dot dot--warning"/>{t('network.degraded')}</span><span>{t('network.zoomHint')}</span></div><TopologyGraph ref={graphRef} nodes={nodes} links={links} onSelect={select} hiddenGroups={hiddenGroups} blastNodeIds={blast} cycleNodeIds={cycle.cycleNodes} cycleLinkKeys={cycle.cycleLinks} selectedId={selected.id}/>{packet.length>0&&<div className="packet-path"><Zap size={15}/>{packet.map((p,i)=><span key={p}>{i>0&&'→'} {p}</span>)}</div>}</article>
 <aside className="panel node-detail"><div className="node-detail__icon"><Router/></div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span className="eyebrow">{t('network.selectedComponent')}</span><button className="icon-button" title={t('pipelines.favorite')} onClick={()=>toggleFavorite({ id: selected.id, module: 'network', label: selected.id })}><Star fill={isFavorite('network', selected.id) ? 'currentColor' : 'none'} size={15}/></button></div><h2>{selected.id}</h2><span className={`health-label health-label--${selected.health}`}><i/>{selected.health==='healthy'?t('network.operational'):t('network.degraded')}</span><dl><div><dt>{t('network.type')}</dt><dd>{selected.group}</dd></div><div><dt>{t('network.privateIp')}</dt><dd>10.28.4.12</dd></div><div><dt>{t('network.region')}</dt><dd>sa-east-1</dd></div><div><dt>{t('network.throughput')}</dt><dd>1,8 Gbps</dd></div></dl><div className="mini-stat"><Wifi size={17}/><span><strong>14ms</strong> {t('network.currentLatency')}</span></div>{blast.size>0 && <div className="blast-badge"><AlertTriangle size={13}/> {blast.size} {t('network.blastRadius')}</div>}</aside></section></>
}
