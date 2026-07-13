import { Activity, AlertOctagon, Box, CheckCircle2, Cpu, Minus, MoreHorizontal, Plus, Power, RefreshCcw, RotateCw, Server, ShieldOff, Star, X } from 'lucide-react'
import { useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { DonutChart } from '../components/charts/DonutChart'
import { KubeTerminal } from '../components/kubernetes/KubeTerminal'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { restartingPods } from '../data/kubernetesExtra2'
import { scalableWorkloads, type ScalableWorkload } from '../data/kubernetesExtra'
import { useI18n } from '../i18n/I18nContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import '../styles/kubernetes-extra.css'

const pods=[['checkout-api-7fd8c','commerce','Running','230m','412Mi','2'],['payments-5db77','finance','Running','410m','688Mi','0'],['catalog-6c8b9','commerce','Running','180m','356Mi','1'],['identity-8fd42','platform','Pending','—','—','0'],['worker-queue-4ab22','jobs','CrashLoop','120m','228Mi','12']]

type NodeState = 'Ready' | 'Cordoned' | 'Draining'

interface TerminalTab { id: string; label: string; context: string }

export default function KubernetesPage(){
 const { t } = useI18n()
 const { logAction } = useAudit()
 const { addNotification } = useNotifications()
 const { isFavorite, toggleFavorite } = useFavorites()
 const { canEdit } = useRole()
 const [refreshing,setRefreshing]=useState(false),[cluster,setCluster]=useState('prod-sa-east-1')
 const [workloads,setWorkloads]=useState<ScalableWorkload[]>(scalableWorkloads)
 const [selectedId,setSelectedId]=useState(scalableWorkloads[0].id)
 const selected = workloads.find(w=>w.id===selectedId) || workloads[0]

 // --- item 8: rolling update simulation ---
 const [rollout,setRollout]=useState<{progress:number}|null>(null)

 // --- item 10: node drain/cordon ---
 const [nodeStates,setNodeStates]=useLocalStorage<Record<number,NodeState>>('opsphere-k8s-node-states',{})

 // --- item 16: multi-terminal tabs ---
 const [terminals,setTerminals]=useState<TerminalTab[]>([{id:'t1',label:'Terminal 1',context:'default'}])
 const [activeTerminal,setActiveTerminal]=useState('t1')

 const refresh=()=>{setRefreshing(true);setTimeout(()=>setRefreshing(false),900)}

 const scale=(delta:number)=>{
  setWorkloads(list=>list.map(w=>{
   if(w.id!==selectedId) return w
   const desired=Math.min(w.maxReplicas,Math.max(w.minReplicas,w.desired+delta))
   if(desired===w.desired) return w
   return {...w,desired,history:[...w.history.slice(-9),desired]}
  }))
  const next=workloads.find(w=>w.id===selectedId)
  if(next){
   const desired=Math.min(next.maxReplicas,Math.max(next.minReplicas,next.desired+delta))
   logAction(t('kubernetes.audit.hpaAdjusted'),`${next.id} → ${desired} ${t('kubernetes.scaling.replicas')}`)
   if(desired===next.maxReplicas) addNotification(t('kubernetes.notify.hpaLimitTitle'),`${next.id} ${t('kubernetes.notify.hpaLimitBody')} ${next.maxReplicas} ${t('kubernetes.scaling.replicas')}.`,'warning')
  }
 }

 const rollingUpdate=()=>{
  if (rollout) return
  setRollout({progress:0})
  logAction('Kubernetes: rolling update iniciado',selected.id)
  const step=()=>{
   setRollout(prev=>{
    if (!prev) return prev
    const next = Math.min(100, prev.progress + 8)
    if (next >= 100) {
     setTimeout(()=>{
      setRollout(null)
      addNotification('Rolling update concluído',`${selected.id}: todas as réplicas antigas foram substituídas com sucesso.`,'healthy')
      logAction('Kubernetes: rolling update concluído',selected.id)
     },250)
    } else {
     setTimeout(step,220)
    }
    return {progress:next}
   })
  }
  setTimeout(step,220)
 }

 const oldReplicas = rollout ? Math.max(0, selected.desired - Math.round((rollout.progress/100)*selected.desired)) : 0
 const newReplicas = rollout ? selected.desired - oldReplicas : 0

 const nodeAction=(index:number, action:'drain'|'cordon'|'uncordon')=>{
  setNodeStates(prev=>{
   const next={...prev}
   if (action==='uncordon') delete next[index]
   else next[index]= action==='drain'?'Draining':'Cordoned'
   return next
  })
  logAction(`Kubernetes: node ${action}`,`node-${String(index+1).padStart(2,'0')}`)
  if (action==='drain') {
   addNotification('Node em drain',`node-${String(index+1).padStart(2,'0')} está sendo drenado; os pods serão reagendados.`,'warning')
   setTimeout(()=>setNodeStates(prev=>({...prev,[index]:'Cordoned'})),2500)
  }
 }

 const addTerminalTab=()=>{
  const idx=terminals.length+1
  const id=`t${Date.now()}`
  const context = prompt('Contexto/namespace para o novo terminal (apenas exibição):','default') || 'default'
  const tab={id,label:`Terminal ${idx}`,context}
  setTerminals(list=>[...list,tab])
  setActiveTerminal(id)
 }

 const closeTerminalTab=(id:string)=>{
  setTerminals(list=>{
   const next=list.filter(tb=>tb.id!==id)
   if (next.length===0) return list
   if (activeTerminal===id) setActiveTerminal(next[0].id)
   return next
  })
 }

 return <><PageHeader eyebrow={t('kubernetes.eyebrow')} title={t('kubernetes.title')} description={t('kubernetes.description')} actions={<><select value={cluster} onChange={e=>setCluster(e.target.value)}><option>prod-sa-east-1</option><option>staging-us-east-1</option></select><button className="button" onClick={refresh}><RotateCw className={refreshing?'spin':''} size={16}/> {t('kubernetes.refresh')}</button></>}/>
 <section className="metric-grid"><MetricCard label={t('kubernetes.metric.clusterHealth')} value="98,6%" tone="healthy"/><MetricCard label={t('kubernetes.metric.nodes')} value="18 / 18" hint={t('kubernetes.metric.nodesHint')}/><MetricCard label={t('kubernetes.metric.pods')} value="284 / 288" hint={t('kubernetes.metric.podsHint')} tone="warning"/><MetricCard label={t('kubernetes.metric.restarts')} value="18" delta="-32%"/></section>
 <section className="k8s-grid"><article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('kubernetes.resources.eyebrow')}</span><h2>{t('kubernetes.resources.title')}</h2></div><Cpu size={18}/></div><div className="donut-pair"><DonutChart value={68} label={t('kubernetes.resources.cpu')}/><DonutChart value={74} label={t('kubernetes.resources.memory')} color="#8097ff"/></div><BarChart data={[{label:t('kubernetes.chart.cpuRequests'),value:62},{label:t('kubernetes.chart.cpuLimits'),value:84,color:'#8097ff'},{label:t('kubernetes.chart.memRequests'),value:71,color:'#f8c56a'}]} suffix="%"/></article>
 <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('kubernetes.nodes.eyebrow')}</span><h2>{t('kubernetes.nodes.title')}</h2></div><Server size={18}/></div><div className="node-grid">{Array.from({length:18},(_,i)=>{
  const state = nodeStates[i]
  return <div className={state==='Draining'?'has-warning':state==='Cordoned'?'has-warning':i===14?'has-warning':''} key={i}>
   <Server size={17}/><strong>node-{String(i+1).padStart(2,'0')}</strong><span>{i===14?'82% CPU':`${35+i%6*7}% CPU`}</span>
   {state && <span className="node-badge" style={{display:'block',fontSize:10,marginTop:2,color:state==='Draining'?'var(--warning)':'var(--danger)'}}>{state}</span>}
   <div style={{display:'flex',gap:4,marginTop:6}}>
    {!state && <button className="icon-button" title="Cordon" disabled={!canEdit} onClick={()=>nodeAction(i,'cordon')}><ShieldOff size={13}/></button>}
    {!state && <button className="icon-button" title="Drain" disabled={!canEdit} onClick={()=>nodeAction(i,'drain')}><Power size={13}/></button>}
    {state && <button className="icon-button" title="Reativar node" disabled={!canEdit} onClick={()=>nodeAction(i,'uncordon')}><RefreshCcw size={13}/></button>}
   </div>
  </div>
 })}</div></article></section>

 <article className="panel scaling-panel"><div className="panel__header"><div><span className="eyebrow">{t('kubernetes.scaling.eyebrow')}</span><h2>{t('kubernetes.scaling.title')}</h2></div><Activity size={18}/></div>
 <div className="scaling-panel__body">
  <div className="scaling-controls">
   <label>{t('kubernetes.scaling.workload')}<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{workloads.map(w=><option key={w.id} value={w.id}>{w.id}</option>)}</select></label>
   <button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: selected.id, module: 'kubernetes', label: selected.id })}><Star fill={isFavorite('kubernetes', selected.id) ? 'currentColor' : 'none'} size={16}/></button>
   <div className="scaling-stepper"><button disabled={selected.desired<=selected.minReplicas || !canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>scale(-1)}><Minus size={16}/></button><strong>{selected.desired}</strong><button disabled={selected.desired>=selected.maxReplicas || !canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>scale(1)}><Plus size={16}/></button></div>
   <div className="scaling-meta">
    <span>{t('kubernetes.scaling.namespace')}: <strong>{selected.namespace}</strong></span>
    <span>{t('kubernetes.scaling.limits')}: {selected.minReplicas} – {selected.maxReplicas} {t('kubernetes.scaling.replicas')}</span>
    <span>{t('kubernetes.scaling.cpuTarget')}: {selected.cpuTargetPct}%</span>
   </div>
   <button className="button" disabled={!!rollout || !canEdit} onClick={rollingUpdate}><RefreshCcw size={15}/> Rolling update</button>
   {rollout && <div style={{marginTop:8}}>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)',marginBottom:4}}><span>Antigas: {oldReplicas}</span><span>Novas: {newReplicas}</span></div>
    <div className="quota-track"><i style={{width:`${rollout.progress}%`}}/></div>
   </div>}
  </div>
  <div>
   <span className="eyebrow">{t('kubernetes.scaling.history')}</span>
   <div className="scaling-chart">{selected.history.map((v,i)=><div className={`scaling-chart__bar${i===selected.history.length-1?' is-current':''}`} key={i}><i style={{height:`${(v/selected.maxReplicas)*100}%`}}/><span>{v}</span></div>)}</div>
  </div>
 </div>
 </article>

 <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('kubernetes.tools.eyebrow')}</span><h2>{t('kubernetes.tools.terminal')}</h2></div><button className="icon-button" title="Nova aba de terminal" onClick={addTerminalTab}><Plus size={16}/></button></div>
  <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
   {terminals.map(tb=><button key={tb.id} className={tb.id===activeTerminal?'button button--primary':'button'} style={{fontSize:12,padding:'5px 10px',display:'flex',alignItems:'center',gap:6}} onClick={()=>setActiveTerminal(tb.id)}>
    {tb.label}
    {terminals.length>1 && <X size={12} onClick={e=>{e.stopPropagation();closeTerminalTab(tb.id)}}/>}
   </button>)}
  </div>
  {terminals.map(tb=><div key={tb.id} style={{display:tb.id===activeTerminal?'block':'none'}}><KubeTerminal contextLabel={tb.context} storageKey={tb.id}/></div>)}
 </article>

 <article className="panel table-panel"><div className="panel__header"><div><span className="eyebrow">Confiabilidade</span><h2>Pods reiniciando com frequência</h2></div><AlertOctagon size={15}/></div><div className="data-table"><div className="data-table__head"><span>Pod</span><span>Namespace</span><span>Reinícios</span><span>Último reinício</span></div>{[...restartingPods].sort((a,b)=>b.restarts-a.restarts).map(p=><div className="data-table__row" key={p.name}><span><Box size={15}/><strong>{p.name}</strong></span><span>{p.namespace}</span><span style={{color:p.restarts>=8?'var(--danger)':p.restarts>=4?'var(--warning)':'var(--muted)',fontWeight:600}}>{p.restarts}</span><span>{p.lastRestart}</span></div>)}</div></article>

 <article className="panel table-panel"><div className="panel__header"><div><span className="eyebrow">{t('kubernetes.workloads.eyebrow')}</span><h2>{t('kubernetes.workloads.title')}</h2></div><span className="text-success"><CheckCircle2 size={15}/> {t('kubernetes.workloads.monitoring')}</span></div><div className="data-table"><div className="data-table__head"><span>{t('kubernetes.table.pod')}</span><span>{t('kubernetes.table.namespace')}</span><span>{t('kubernetes.table.status')}</span><span>{t('kubernetes.table.cpu')}</span><span>{t('kubernetes.table.memory')}</span><span>{t('kubernetes.table.restarts')}</span><span/></div>{pods.map(p=><div className="data-table__row" key={p[0]}><span><Box size={15}/><strong>{p[0]}</strong></span><span>{p[1]}</span><span><i className={`dot dot--${p[2]==='Running'?'success':p[2]==='Pending'?'warning':'danger'}`}/>{p[2]}</span><span>{p[3]}</span><span>{p[4]}</span><span>{p[5]}</span><button className="icon-button"><MoreHorizontal size={16}/></button></div>)}</div></article></>
}
