import { AlertTriangle, Camera, Clock, Columns, Download, GitCompareArrows, History, Play, RotateCcw, Router, ShieldAlert, StickyNote, Star, Thermometer, Users, Wifi, Zap } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { TopologyGraph, type TopologyGraphHandle } from '../components/graph/TopologyGraph'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { extraInfraLinks } from '../data/networkExtra'
import { allTeams, nodeOwners, teamColors, type NetworkTeam } from '../data/networkExtra3'
import { useLocalStorage } from '../hooks/useLocalStorage'
import '../styles/network-extra.css'
import '../styles/network-extra3.css'
import { useI18n } from '../i18n/I18nContext'
import type { GraphNode, Severity } from '../types'
import { blastRadius, detectCycle } from '../utils/graphAnalysis'

const nodes: GraphNode[] = [{id:'Internet',group:'edge',health:'healthy'},{id:'WAF',group:'edge',health:'healthy'},{id:'LB-Prod',group:'edge',health:'healthy'},{id:'VPC-App',group:'core',health:'healthy'},{id:'VPC-Data',group:'core',health:'warning'},{id:'NAT-01',group:'edge',health:'healthy'},{id:'DB-Primary',group:'data',health:'warning'},{id:'Redis',group:'data',health:'healthy'},{id:'VPN',group:'edge',health:'healthy'}]
const baseLinks=[{source:'Internet',target:'WAF',value:90},{source:'WAF',target:'LB-Prod',value:85},{source:'LB-Prod',target:'VPC-App',value:75},{source:'VPC-App',target:'VPC-Data',value:60},{source:'VPC-Data',target:'DB-Primary',value:70},{source:'VPC-Data',target:'Redis',value:45},{source:'VPC-App',target:'NAT-01',value:35},{source:'VPN',target:'VPC-App',value:25}]
const links=[...baseLinks,...extraInfraLinks]
const TRACE_PATH=['Internet','WAF','LB-Prod','VPC-App','VPC-Data']
const groups=Array.from(new Set(nodes.map(n=>n.group)))

interface NodeSnapshot { id: string; health: Severity }
type NodeAnnotations = Record<string, string>
/** A named, timestamped snapshot of every node's health — the topology "time machine". */
interface NamedSnapshot { id: string; label: string; timestamp: string; nodes: NodeSnapshot[] }

/** Simple BFS over an undirected view of the link list, used for the critical-path highlight. */
function bfsPath(from: string, to: string): string[] {
 if (from === to) return [from]
 const adjacency = new Map<string, string[]>()
 nodes.forEach(n=>adjacency.set(n.id,[]))
 links.forEach(l=>{
  const s = typeof l.source==='string'?l.source:(l.source as any).id
  const t = typeof l.target==='string'?l.target:(l.target as any).id
  adjacency.get(s)?.push(t)
  adjacency.get(t)?.push(s)
 })
 const visited = new Set([from])
 const prev = new Map<string,string>()
 const queue = [from]
 while(queue.length){
  const cur = queue.shift()!
  if (cur === to) break
  for (const next of adjacency.get(cur)||[]){
   if (!visited.has(next)){ visited.add(next); prev.set(next,cur); queue.push(next) }
  }
 }
 if (!visited.has(to)) return []
 const path=[to]
 let cur=to
 while(cur!==from){ const p=prev.get(cur); if(!p) return []; path.unshift(p); cur=p }
 return path
}

/** Deterministic pseudo-metrics per node id, for the side-by-side comparison panel. */
function metricsFor(id: string) {
 let h = 0
 for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
 return {
  latency: 4 + (h % 40),
  throughput: (1 + (h % 9)).toFixed(1) + ' Gbps',
  errorRate: ((h % 30) / 100).toFixed(2) + '%',
  connections: 100 + (h % 900),
 }
}

function hashOf(id: string): number {
 let h = 0
 for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
 return h
}

/** Item 3: deterministic mock uptime% per node id, derived from a simple string hash. */
function uptimeFor(id: string): number {
 const h = hashOf(id)
 return Number((99.5 - (h % 150) / 100).toFixed(2))
}

function uptimeTone(pct: number): Severity {
 if (pct >= 99.5) return 'healthy'
 if (pct >= 99) return 'warning'
 return 'critical'
}

const endIdOf = (v: string | { id: string }) => typeof v === 'string' ? v : v.id

/** Item 4: nodes with many transitive dependents (blast radius) but at most one incident
 * link are flagged as single-point-of-failure risks (no redundant path in/out). */
function computeSpof(allNodes: GraphNode[], allLinks: typeof links): Set<string> {
 const spof = new Set<string>()
 allNodes.forEach(n => {
  const dependents = blastRadius(n.id, allLinks).size
  const incident = allLinks.filter(l => endIdOf(l.source as any) === n.id || endIdOf(l.target as any) === n.id).length
  if (dependents >= 2 && incident <= 1) spof.add(n.id)
 })
 return spof
}

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

 // --- item 1: snapshot diff ---
 const [snapshot,setSnapshot]=useLocalStorage<NodeSnapshot[]|null>('opsphere-network-snapshot',null)
 const [showDiff,setShowDiff]=useState(false)

 // --- item 1b: topology time machine (multiple named snapshots + time travel) ---
 const [namedSnapshots,setNamedSnapshots]=useLocalStorage<NamedSnapshot[]>('opsphere-network-timeline',[])
 const [timeTravelIndex,setTimeTravelIndex]=useState(-1) // -1 = live state

 // --- item 2: ownership map by team ---
 const [teamFilter,setTeamFilter]=useState<NetworkTeam|'all'>('all')

 // --- item 4: single-point-of-failure risk score ---
 const spofIds = useMemo(()=>computeSpof(nodes,links),[])

 // --- item 2: cascading failure simulation ---
 const [cascadeHealth,setCascadeHealth]=useState<Record<string,Severity>>({})
 const [cascading,setCascading]=useState(false)

 // --- item 3: annotations ---
 const [annotations,setAnnotations]=useLocalStorage<NodeAnnotations>('opsphere-network-notes',{})
 const [noteDraft,setNoteDraft]=useState('')

 // --- item 4: heatmap ---
 const [heatmap,setHeatmap]=useState(false)

 // --- item 5: compare mode ---
 const [compareMode,setCompareMode]=useState(false)
 const [compareIds,setCompareIds]=useState<string[]>([])

 // --- item 6: critical path ---
 const [pathFrom,setPathFrom]=useState(nodes[0].id)
 const [pathTo,setPathTo]=useState(nodes[nodes.length-1].id)
 const [showPath,setShowPath]=useState(false)

 const cycle = useMemo(()=>detectCycle(nodes,links),[])
 const blast = useMemo(()=>blastRadius(selected.id,links),[selected])
 const criticalPath = useMemo(()=>showPath?bfsPath(pathFrom,pathTo):[],[showPath,pathFrom,pathTo])

 const timeTravelSnapshot = timeTravelIndex>=0 ? namedSnapshots[timeTravelIndex] : null

 const effectiveNodes = useMemo(()=>{
  if (timeTravelSnapshot) {
   const prevHealth = new Map(timeTravelSnapshot.nodes.map(s=>[s.id,s.health]))
   return nodes.map(n=>prevHealth.has(n.id)?{...n,health:prevHealth.get(n.id)}:n)
  }
  return nodes.map(n=>cascadeHealth[n.id]?{...n,health:cascadeHealth[n.id]}:n)
 },[cascadeHealth,timeTravelSnapshot])

 const teamHighlightIds = useMemo(()=>{
  if (teamFilter==='all') return new Set<string>()
  return new Set(Object.keys(nodeOwners).filter(id=>nodeOwners[id]===teamFilter))
 },[teamFilter])

 const diffIds = useMemo(()=>{
  if (!showDiff || !snapshot) return new Set<string>()
  const prevHealth = new Map(snapshot.map(s=>[s.id,s.health]))
  const changed = new Set<string>()
  effectiveNodes.forEach(n=>{ const prev=prevHealth.get(n.id); if(prev && prev!==n.health) changed.add(n.id) })
  return changed
 },[showDiff,snapshot,effectiveNodes])

 const select=useCallback((n:GraphNode)=>{
  if (compareMode) {
   setCompareIds(prev=>{
    if (prev.includes(n.id)) return prev.filter(id=>id!==n.id)
    if (prev.length>=2) return [prev[1], n.id]
    return [...prev, n.id]
   })
   return
  }
  setSelected(n)
  setNoteDraft(annotations[n.id] || '')
  logAction('Rede: componente selecionado',n.id)
 },[logAction,compareMode,annotations])

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

 const saveSnapshot=()=>{
  const snap: NodeSnapshot[] = effectiveNodes.map(n=>({id:n.id,health:n.health||'healthy'}))
  setSnapshot(snap)
  setShowDiff(false)
  addNotification('Snapshot salvo','O estado atual da topologia foi salvo para comparação futura.','healthy')
  logAction('Rede: snapshot de topologia salvo',`${snap.length} nós`)
 }

 const saveNamedSnapshot=()=>{
  const label = prompt('Nome do snapshot (ex: Antes da manutenção)', `Snapshot ${namedSnapshots.length+1}`)
  if (label===null) return
  const snap: NamedSnapshot = {
   id: `snap-${Date.now()}`,
   label: label.trim() || `Snapshot ${namedSnapshots.length+1}`,
   timestamp: new Date().toLocaleString('pt-BR'),
   nodes: effectiveNodes.map(n=>({id:n.id,health:n.health||'healthy'})),
  }
  setNamedSnapshots(prev=>[...prev,snap])
  setTimeTravelIndex(-1)
  addNotification('Snapshot da linha do tempo salvo',`"${snap.label}" foi adicionado à máquina do tempo da topologia.`,'healthy')
  logAction('Rede: snapshot da linha do tempo salvo',snap.label)
 }

 const travelTo=(pos:number)=>{
  // pos 0 = live; pos 1..n = namedSnapshots[pos-1]
  const idx = pos<=0 ? -1 : pos-1
  setTimeTravelIndex(idx)
  logAction('Rede: viagem no tempo da topologia', idx<0 ? 'estado ao vivo' : namedSnapshots[idx]?.label || '')
 }

 const compareSnapshot=()=>{
  if (!snapshot) { addNotification('Nenhum snapshot','Salve um snapshot antes de comparar.','warning'); return }
  setShowDiff(v=>!v)
  logAction('Rede: comparação com snapshot',showDiff?'desativada':'ativada')
 }

 const simulateOutage=(node: GraphNode)=>{
  if (cascading) return
  setCascading(true)
  const affected = Array.from(blastRadius(node.id, links))
  setCascadeHealth(prev=>({...prev,[node.id]:'critical'}))
  logAction('Rede: falha simulada',node.id)
  affected.forEach((id,i)=>{
   setTimeout(()=>setCascadeHealth(prev=>({...prev,[id]:'critical'})),(i+1)*550)
  })
  setTimeout(()=>{
   setCascading(false)
   addNotification('Simulação de falha concluída',`${affected.length+1} componente(s) afetados a partir de ${node.id}.`,'critical')
  },(affected.length+1)*550)
 }

 const resetCascade=()=>{ setCascadeHealth({}); logAction('Rede: simulação de falha revertida',selected.id) }

 const saveNote=()=>{
  setAnnotations(prev=>{
   const next={...prev}
   if (noteDraft.trim()) next[selected.id]=noteDraft.trim(); else delete next[selected.id]
   return next
  })
  logAction('Rede: anotação salva',selected.id)
 }

 const annotatedIds = useMemo(()=>new Set(Object.keys(annotations)),[annotations])

 return <><PageHeader eyebrow={t('network.eyebrow')} title={t('network.title')} description={t('network.subtitle')} actions={<><button className="button" onClick={()=>setPacket([])}><RotateCcw size={16}/> {t('network.clear')}</button><button className="button" onClick={exportImage}><Download size={16}/> {t('network.exportPng')}</button><button className="button button--primary" disabled={playing} onClick={simulate}><Play size={16}/> {t('network.simulatePacket')}</button></>}/>
 <section className="metric-grid"><MetricCard label={t('network.metricDevices')} value="42" hint={t('network.metricDevicesHint')}/><MetricCard label={t('network.metricTraffic')} value="8,4 Gbps" delta="+6,2%"/><MetricCard label={t('network.metricPacketLoss')} value="0,03%" tone="healthy"/><MetricCard label={t('network.metricLatency')} value="14ms" tone="healthy"/></section>
 {cycle.hasCycle && <div className="cycle-warning"><AlertTriangle size={18}/><span><strong>{t('network.cycleWarning')}</strong> {Array.from(cycle.cycleNodes).join(' → ')} → {Array.from(cycle.cycleNodes)[0]}. {t('network.cycleWarningSuffix')}</span></div>}
 <div className="tier-filter">{groups.map(g=><button key={g} className={hiddenGroups.has(g)?'':'is-active'} onClick={()=>toggleGroup(g)}>{g}</button>)}</div>

 <div className="network-toolbar-2">
  <button className="button" onClick={saveSnapshot}><Camera size={15}/> Salvar snapshot</button>
  <button className={showDiff?'button button--primary':'button'} onClick={compareSnapshot}><GitCompareArrows size={15}/> Comparar com snapshot</button>
  <button className={heatmap?'button button--primary':'button'} onClick={()=>setHeatmap(v=>!v)}><Thermometer size={15}/> Heatmap de tráfego</button>
  <button className={compareMode?'button button--primary':'button'} onClick={()=>{setCompareMode(v=>!v);setCompareIds([])}}><Columns size={15}/> Comparar 2 nós</button>
  <button className={showPath?'button button--primary':'button'} onClick={()=>setShowPath(v=>!v)}><Zap size={15}/> Caminho crítico</button>
  <button className="button" onClick={saveNamedSnapshot}><History size={15}/> Salvar na linha do tempo</button>
  {cascading && <button className="button" disabled>Falha em propagação…</button>}
  {Object.keys(cascadeHealth).length>0 && <button className="button" onClick={resetCascade}>Reverter simulação de falha</button>}
 </div>
 {heatmap && <div className="heatmap-legend"><span>Baixo tráfego</span><i className="heatmap-legend__bar"/><span>Alto tráfego</span></div>}

 {namedSnapshots.length>0 && <div className="critical-path-controls time-machine">
  <Clock size={15}/>
  <span className="time-machine__label">Máquina do tempo:</span>
  <select value={timeTravelIndex+1} onChange={e=>travelTo(Number(e.target.value))}>
   <option value={0}>Ao vivo (estado atual)</option>
   {namedSnapshots.map((s,i)=><option key={s.id} value={i+1}>{s.label} — {s.timestamp}</option>)}
  </select>
  <input type="range" min={0} max={namedSnapshots.length} value={timeTravelIndex+1} onChange={e=>travelTo(Number(e.target.value))}/>
  {timeTravelSnapshot && <span className="time-machine__label">Visualizando estado salvo em {timeTravelSnapshot.timestamp}</span>}
 </div>}

 <div className="critical-path-controls team-filter">
  <Users size={15}/>
  <span className="time-machine__label">Mapa de propriedade por time:</span>
  <button className={teamFilter==='all'?'button button--primary':'button'} onClick={()=>setTeamFilter('all')}>Todos</button>
  {allTeams.map(team=><button key={team} className={teamFilter===team?'button button--primary':'button'} onClick={()=>setTeamFilter(team)}><i className="team-filter__swatch" style={{background:teamColors[team]}}/>{team}</button>)}
 </div>

 {spofIds.size>0 && <div className="cycle-warning">
  <ShieldAlert size={18}/>
  <span><strong>Pontos únicos de falha detectados:</strong> {Array.from(spofIds).join(', ')}. Estes componentes possuem muitos dependentes e nenhum caminho redundante.</span>
 </div>}
 {showPath && <div className="critical-path-controls">
  <span>Origem</span>
  <select value={pathFrom} onChange={e=>setPathFrom(e.target.value)}>{nodes.map(n=><option key={n.id} value={n.id}>{n.id}</option>)}</select>
  <span>Destino</span>
  <select value={pathTo} onChange={e=>setPathTo(e.target.value)}>{nodes.map(n=><option key={n.id} value={n.id}>{n.id}</option>)}</select>
  <span>{criticalPath.length>0 ? `Caminho: ${criticalPath.join(' → ')}` : 'Sem caminho entre os nós selecionados.'}</span>
 </div>}
 {compareMode && <div className="critical-path-controls"><span>Selecione até 2 nós no grafo para comparar. Selecionados: {compareIds.join(', ')||'nenhum'}</span></div>}

 <section className="graph-layout"><article className="panel graph-panel"><div className="graph-toolbar"><span><i className="dot dot--success"/>{t('network.operational')}</span><span><i className="dot dot--warning"/>{t('network.degraded')}</span><span>{t('network.zoomHint')}</span></div><TopologyGraph ref={graphRef} nodes={effectiveNodes} links={links} onSelect={select} hiddenGroups={hiddenGroups} blastNodeIds={blast} cycleNodeIds={cycle.cycleNodes} cycleLinkKeys={cycle.cycleLinks} selectedId={selected.id} diffNodeIds={diffIds} annotatedNodeIds={annotatedIds} heatmap={heatmap} pathNodeIds={showPath?new Set(criticalPath):undefined} compareNodeIds={compareMode?new Set(compareIds):undefined} teamColor={id=>teamColors[nodeOwners[id]]} teamHighlightIds={teamHighlightIds} spofNodeIds={spofIds}/>{packet.length>0&&<div className="packet-path"><Zap size={15}/>{packet.map((p,i)=><span key={p}>{i>0&&'→'} {p}</span>)}</div>}</article>
 <aside className="panel node-detail"><div className="node-detail__icon"><Router/></div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span className="eyebrow">{t('network.selectedComponent')}</span><button className="icon-button" title={t('pipelines.favorite')} onClick={()=>toggleFavorite({ id: selected.id, module: 'network', label: selected.id })}><Star fill={isFavorite('network', selected.id) ? 'currentColor' : 'none'} size={15}/></button></div><h2>{selected.id}</h2><span className={`health-label health-label--${selected.health}`}><i/>{selected.health==='healthy'?t('network.operational'):t('network.degraded')}</span><dl><div><dt>{t('network.type')}</dt><dd>{selected.group}</dd></div><div><dt>{t('network.privateIp')}</dt><dd>10.28.4.12</dd></div><div><dt>{t('network.region')}</dt><dd>sa-east-1</dd></div><div><dt>{t('network.throughput')}</dt><dd>1,8 Gbps</dd></div></dl><div className="mini-stat"><Wifi size={17}/><span><strong>14ms</strong> {t('network.currentLatency')}</span></div>{blast.size>0 && <div className="blast-badge"><AlertTriangle size={13}/> {blast.size} {t('network.blastRadius')}</div>}
  <div><span className={`uptime-badge uptime-badge--${uptimeTone(uptimeFor(selected.id))}`}>{uptimeFor(selected.id)}% uptime (30d)</span></div>
  {nodeOwners[selected.id] && <div style={{marginTop:6,fontSize:12,color:'var(--muted)'}}>Time responsável: <strong style={{color:teamColors[nodeOwners[selected.id]]}}>{nodeOwners[selected.id]}</strong></div>}
  {spofIds.has(selected.id) && <div className="spof-badge"><ShieldAlert size={14}/> Ponto único de falha (SPOF)</div>}
  <button className="button button--full" style={{marginTop:10}} disabled={cascading} onClick={()=>simulateOutage(selected)}><AlertTriangle size={15}/> Simular queda</button>
  <div className="node-note-field">
   <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--muted)'}}><StickyNote size={14}/> Anotação do componente</label>
   <textarea value={noteDraft} placeholder="ex: revisar em breve" onChange={e=>setNoteDraft(e.target.value)}/>
   <button className="button" onClick={saveNote}>Salvar anotação</button>
  </div>
 </aside></section>

 {compareMode && compareIds.length===2 && <article className="panel compare-panel">
  {compareIds.map(id=>{
   const n = effectiveNodes.find(nn=>nn.id===id)!
   const m = metricsFor(id)
   return <div className="compare-panel__side" key={id}>
    <h3>{id}</h3>
    <dl>
     <dt>Saúde</dt><dd>{n.health}</dd>
     <dt>Grupo</dt><dd>{n.group}</dd>
     <dt>Latência</dt><dd>{m.latency}ms</dd>
     <dt>Throughput</dt><dd>{m.throughput}</dd>
     <dt>Taxa de erro</dt><dd>{m.errorRate}</dd>
     <dt>Conexões ativas</dt><dd>{m.connections}</dd>
    </dl>
   </div>
  })}
 </article>}
 </>
}
