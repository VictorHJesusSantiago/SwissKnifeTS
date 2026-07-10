import { ChevronDown, ChevronRight, Cloud, Copy, Download, FileJson, GitCompare, Layers, Network, History, RotateCcw, Search, Star, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dependencyEdges, dependencyNodes, initialApplies, monthlyCostByType, plans as extraPlans, type ApplyEvent } from '../data/terraformExtra'
import { useI18n } from '../i18n/I18nContext'
import '../styles/terraform-extra.css'

type Resource={id:string;type:string;provider:string;children?:Resource[];attrs?:Record<string,string>}
const tree:Resource[]=[
 {id:'module.network',type:'module',provider:'terraform',children:[{id:'aws_vpc.main',type:'aws_vpc',provider:'AWS',attrs:{cidr_block:'10.0.0.0/16',region:'sa-east-1',environment:'production'}},{id:'aws_subnet.private_a',type:'aws_subnet',provider:'AWS'},{id:'aws_nat_gateway.primary',type:'aws_nat_gateway',provider:'AWS'}]},
 {id:'module.eks',type:'module',provider:'terraform',children:[{id:'aws_eks_cluster.main',type:'aws_eks_cluster',provider:'AWS',attrs:{version:'1.31',endpoint_private_access:'true',node_groups:'3'}},{id:'aws_iam_role.cluster',type:'aws_iam_role',provider:'AWS'}]},
 {id:'module.database',type:'module',provider:'terraform',children:[{id:'aws_rds_cluster.postgres',type:'aws_rds_cluster',provider:'AWS',attrs:{engine:'aurora-postgresql',instances:'3',encrypted:'true'}}]},
]
const flatResources: Resource[] = tree.flatMap(m => m.children ?? [])

type PlanAction='create'|'update'|'destroy'
type PlanChange={address:string;action:PlanAction;detail:string}
const plan:PlanChange[]=[
 {address:'aws_subnet.private_b',action:'create',detail:'+ novo recurso a ser criado (cidr_block = "10.0.2.0/24")'},
 {address:'aws_eks_cluster.main',action:'update',detail:'~ version: "1.30" -> "1.31"'},
 {address:'aws_nat_gateway.primary',action:'update',detail:'~ tags.owner: "platform" -> "infra-core"'},
 {address:'aws_iam_role.legacy',action:'destroy',detail:'- recurso não referenciado na configuração atual'},
]
const planIcon:Record<PlanAction,string>={create:'+',update:'~',destroy:'-'}
const planTone:Record<PlanAction,string>={create:'healthy',update:'warning',destroy:'critical'}

function download(filename:string,content:string,type='application/json'){
 const blob=new Blob([content],{type})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=filename;a.click()
 URL.revokeObjectURL(url)
}

// Camadas topológicas simples para o layout do grafo de dependências: recursos sem
// dependências pendentes entram na camada atual, o restante avança para a próxima.
function buildLayers(nodes: string[], edges: { from: string; to: string }[]): string[][] {
 const remaining = new Set(nodes)
 const layers: string[][] = []
 const resolved = new Set<string>()
 let guard = 0
 while (remaining.size > 0 && guard < 20) {
  guard++
  const layer: string[] = []
  for (const n of remaining) {
   const deps = edges.filter(e => e.from === n).map(e => e.to)
   if (deps.every(d => resolved.has(d) || !remaining.has(d))) layer.push(n)
  }
  if (layer.length === 0) layer.push(...remaining)
  layer.forEach(n => { remaining.delete(n); resolved.add(n) })
  layers.push(layer)
 }
 return layers
}

type ExtraTab = 'diff' | 'graph' | 'history' | 'cost'

export default function TerraformPage(){
 const [open,setOpen]=useState<string[]>(tree.map(t=>t.id)),[selected,setSelected]=useState<Resource>(tree[1].children![0]),[query,setQuery]=useState('')
 const [tab,setTab]=useState<'state'|'plan'|ExtraTab>('state')
 const { t } = useI18n()
 const { logAction } = useAudit()
 const { addNotification } = useNotifications()
 const { isFavorite, toggleFavorite } = useFavorites()
 const { canEdit } = useRole()

 const q=query.trim().toLowerCase()
 const filteredTree=useMemo(()=>{
  if(!q)return tree
  return tree
   .map(module=>{
    const moduleMatches=module.id.toLowerCase().includes(q)
    const children=(module.children||[]).filter(c=>c.id.toLowerCase().includes(q)||c.type.toLowerCase().includes(q))
    if(moduleMatches||children.length)return {...module,children:moduleMatches?module.children:children}
    return null
   })
   .filter((m):m is Resource=>m!==null)
 },[q])
 const autoOpen=q?filteredTree.map(m=>m.id):open

 const planSummary=useMemo(()=>({
  create:plan.filter(p=>p.action==='create').length,
  update:plan.filter(p=>p.action==='update').length,
  destroy:plan.filter(p=>p.action==='destroy').length,
 }),[])

 const fullRepresentation=JSON.stringify({address:selected.id,mode:'managed',type:selected.type,provider:selected.provider,values:selected.attrs||{}},null,2)

 // --- Diff visual entre dois plans mockados ---
 const [planAId, setPlanAId] = useState(extraPlans[0].id)
 const [planBId, setPlanBId] = useState(extraPlans[1].id)
 const planA = extraPlans.find(p => p.id === planAId)!
 const planB = extraPlans.find(p => p.id === planBId)!
 const diff = useMemo(() => {
  const map = new Map<string, { type: string; a?: typeof planA.changes[number]; b?: typeof planB.changes[number] }>()
  planA.changes.forEach(c => map.set(c.address, { type: c.type, a: c }))
  planB.changes.forEach(c => { const existing = map.get(c.address); if (existing) existing.b = c; else map.set(c.address, { type: c.type, b: c }) })
  return Array.from(map.entries()).map(([address, v]) => ({ address, ...v }))
 }, [planA, planB])

 // --- Grafo de dependências ---
 const layers = useMemo(() => buildLayers(dependencyNodes, dependencyEdges), [])
 const [selectedNode, setSelectedNode] = useState<string | null>(dependencyNodes[0])
 const nodePos = useMemo(() => {
  const pos: Record<string, { x: number; y: number }> = {}
  const layerGap = 140
  layers.forEach((layer, li) => {
   const rowGap = 340 / Math.max(layer.length, 1)
   layer.forEach((n, ni) => { pos[n] = { x: 40 + li * layerGap, y: 20 + ni * rowGap + rowGap / 2 } })
  })
  return pos
 }, [layers])
 const related = useMemo(() => {
  if (!selectedNode) return new Set<string>()
  const set = new Set<string>()
  dependencyEdges.forEach(e => { if (e.from === selectedNode) set.add(e.to); if (e.to === selectedNode) set.add(e.from) })
  return set
 }, [selectedNode])

 // --- Histórico de applies com rollback simulado (persistido em localStorage) ---
 const [applies, setApplies] = useLocalStorage<ApplyEvent[]>('opsphere-terraform-applies', initialApplies)
 const rollback = (id: string) => {
  const target = applies.find(a => a.id === id)
  if (!target || target.status === 'rolled-back') return
  setApplies(list => list.map(a => a.id === id ? { ...a, status: 'rolled-back' as const } : a))
  addNotification(t('terraform.notify.rollbackTitle'), `Apply ${id} (${target.summary}) ${t('terraform.notify.rollbackReverted')}`, 'warning')
  logAction(t('terraform.audit.rollback'), `Reverteu o apply ${id}: ${target.summary}`)
 }

 // --- Estimativa de custo mockado por recurso ---
 const costRows = flatResources.map(r => ({ ...r, cost: monthlyCostByType[r.type] ?? 0 }))
 const totalCost = costRows.reduce((sum, r) => sum + r.cost, 0)

 return <><PageHeader eyebrow={t('terraform.eyebrow')} title={t('terraform.title')} description={t('terraform.description')} actions={<>
  <button className="button" onClick={()=>download('terraform-state.json',JSON.stringify({modules:tree},null,2))}><Download size={16}/> {t('terraform.exportState')}</button>
  <button className="button button--primary"><FileJson size={16}/> {t('terraform.loadState')}</button>
 </>}/>
 <div className="tab-strip">
  <button className={tab==='state'?'is-active':''} onClick={()=>setTab('state')}><Layers size={14}/> {t('terraform.tab.state')}</button>
  <button className={tab==='plan'?'is-active':''} onClick={()=>setTab('plan')}><GitCompare size={14}/> {t('terraform.tab.plan')} ({plan.length})</button>
  <button className={tab==='diff'?'is-active':''} onClick={()=>setTab('diff')}><GitCompare size={14}/> {t('terraform.tab.diff')}</button>
  <button className={tab==='graph'?'is-active':''} onClick={()=>setTab('graph')}><Network size={14}/> {t('terraform.tab.graph')}</button>
  <button className={tab==='history'?'is-active':''} onClick={()=>setTab('history')}><History size={14}/> {t('terraform.tab.history')}</button>
  <button className={tab==='cost'?'is-active':''} onClick={()=>setTab('cost')}><Wallet size={14}/> {t('terraform.tab.cost')}</button>
 </div>
 {tab==='state'&&
 <section className="terraform-layout"><aside className="panel resource-tree"><label className="search-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('terraform.filterPlaceholder')}/></label><div className="tree-summary"><span>{t('terraform.stateLabel')}: <strong>production</strong></span><span>{t('terraform.updatedAgo')}</span></div>
 {filteredTree.length===0&&<p className="empty-hint">{t('terraform.noResourcesFound')} "{query}".</p>}
 {filteredTree.map(module=><div className="tree-module" key={module.id}><button onClick={()=>setOpen(o=>o.includes(module.id)?o.filter(x=>x!==module.id):[...o,module.id])}>{autoOpen.includes(module.id)?<ChevronDown/>:<ChevronRight/>}<Cloud/><strong>{module.id}</strong><span>{module.children?.length}</span></button>{autoOpen.includes(module.id)&&<div>{module.children?.map(child=><button key={child.id} className={selected.id===child.id?'is-selected':''} onClick={()=>setSelected(child)}><i/>{child.id}</button>)}</div>}</div>)}</aside>
 <article className="panel resource-detail"><div className="panel__header"><div><span className="eyebrow">{t('terraform.resourceEyebrow')}</span><h2>{selected.id}</h2><p>{selected.provider} · {t('terraform.managed')}</p></div><div style={{display:'flex',gap:8}}><button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: selected.id, module: 'terraform', label: selected.id })}><Star fill={isFavorite('terraform', selected.id) ? 'currentColor' : 'none'} size={17}/></button><button className="icon-button" onClick={()=>navigator.clipboard?.writeText(selected.id)}><Copy size={17}/></button></div></div><div className="resource-visual"><Cloud size={34}/><div><strong>{selected.type}</strong><span>{selected.provider}</span></div></div><h3>{t('terraform.attributes')}</h3><div className="attribute-table">{Object.entries(selected.attrs||{id:'r-0d8f21a3',status:'available',tags:'environment=production'}).map(([key,value])=><div key={key}><code>{key}</code><span>{value}</span></div>)}</div><div className="panel__header"><h3>{t('terraform.representation')}</h3><button className="icon-button" title={t('terraform.copyJson')} onClick={()=>navigator.clipboard?.writeText(fullRepresentation)}><Copy size={15}/></button></div><pre className="state-code">{fullRepresentation}</pre></article></section>}
 {tab==='plan'&&
 <section className="panel plan-panel">
  <div className="plan-summary"><span className="badge badge--healthy">{planSummary.create} {t('terraform.plan.toCreate')}</span><span className="badge badge--warning">{planSummary.update} {t('terraform.plan.toChange')}</span><span className="badge badge--critical">{planSummary.destroy} {t('terraform.plan.toDestroy')}</span></div>
  <div className="plan-list">{plan.map(change=><div className={`plan-row plan-row--${change.action}`} key={change.address}><b className={`plan-marker badge--${planTone[change.action]}`}>{planIcon[change.action]}</b><div><strong>{change.address}</strong><span>{change.detail}</span></div></div>)}</div>
  <div className="plan-actions"><button className="button" onClick={()=>download('terraform-plan.json',JSON.stringify(plan,null,2))}><Download size={16}/> {t('terraform.exportPlan')}</button><button className="button button--primary" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined}>{t('terraform.applyPlan')}</button></div>
 </section>}

 {tab === 'diff' && <section className="panel table-panel">
   <div className="tf-diff-toolbar">
     <label>{t('terraform.diff.planA')}<select value={planAId} onChange={e=>setPlanAId(e.target.value)}>{extraPlans.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
     <label>{t('terraform.diff.planB')}<select value={planBId} onChange={e=>setPlanBId(e.target.value)}>{extraPlans.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
   </div>
   <div className="tf-diff-list">
     {diff.length === 0 && <div className="tf-diff-empty">{t('terraform.diff.noChanges')}</div>}
     {diff.map(row => {
       const change = row.b ?? row.a
       if (!change) return null
       const allKeys = Array.from(new Set([...Object.keys(row.a?.before ?? row.a?.after ?? {}), ...Object.keys(row.b?.before ?? row.b?.after ?? {})]))
       return <div className={`tf-diff-resource tf-diff-resource--${change.action}`} key={row.address}>
         <header><code>{row.address}</code><span className={`tf-diff-tag tf-diff-tag--${change.action}`}>{change.action}</span><span>{row.type}</span></header>
         {change.action === 'change' && allKeys.length > 0 && <div className="tf-diff-attrs">
           {allKeys.map(k => {
             const before = change.before?.[k]
             const after = change.after?.[k]
             if (before === after) return null
             return <div key={k}><span className="tf-attr-key">{k}</span>{before !== undefined && <span className="tf-attr-before">{before}</span>}{after !== undefined && <span className="tf-attr-after">{after}</span>}</div>
           })}
         </div>}
         {change.action === 'add' && change.after && <div className="tf-diff-attrs">{Object.entries(change.after).map(([k,v]) => <div key={k}><span className="tf-attr-key">{k}</span><span/><span className="tf-attr-after">{v}</span></div>)}</div>}
         {change.action === 'destroy' && change.before && <div className="tf-diff-attrs">{Object.entries(change.before).map(([k,v]) => <div key={k}><span className="tf-attr-key">{k}</span><span className="tf-attr-before">{v}</span><span/></div>)}</div>}
       </div>
     })}
   </div>
 </section>}

 {tab === 'graph' && <section className="tf-graph-layout">
   <div className="panel">
     <svg className="tf-graph-svg" viewBox="0 0 480 380" preserveAspectRatio="xMidYMid meet">
       {dependencyEdges.map((e, i) => {
         const from = nodePos[e.from], to = nodePos[e.to]
         if (!from || !to) return null
         const isRelated = selectedNode === e.from || selectedNode === e.to
         return <line key={i} className={`tf-graph-edge${isRelated ? ' is-related' : ''}`} x1={from.x + 60} y1={from.y + 12} x2={to.x} y2={to.y + 12} markerEnd="url(#arrow)" />
       })}
       <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#35506a" /></marker></defs>
       {dependencyNodes.map(n => {
         const pos = nodePos[n]
         if (!pos) return null
         const isSelected = selectedNode === n
         const isRelated = related.has(n)
         const isDimmed = selectedNode !== null && !isSelected && !isRelated
         return <g key={n} className={`tf-graph-node${isSelected ? ' is-selected' : ''}${isRelated ? ' is-related' : ''}${isDimmed ? ' is-dimmed' : ''}`} onClick={() => setSelectedNode(n)} transform={`translate(${pos.x},${pos.y})`}>
           <rect width={120} height={26} rx={6} />
           <text x={60} y={17} textAnchor="middle">{n.replace('aws_', '').slice(0, 20)}</text>
         </g>
       })}
     </svg>
     <div className="tf-graph-legend">
       <span><i style={{background:'#123c3a',border:'1px solid #2a5d55'}}/> {t('terraform.graph.resource')}</span>
       <span><i style={{background:'#16403e',border:'1px solid #6ce5c4'}}/> {t('terraform.graph.selected')}</span>
       <span><i style={{background:'#2b2f1e',border:'1px solid #f2a33f'}}/> {t('terraform.graph.related')}</span>
     </div>
   </div>
   <aside className="panel tf-graph-detail">
     {selectedNode ? <>
       <h4>{selectedNode}</h4>
       <dl>
         <div><span>{t('terraform.graph.dependsOn')}</span><b>{dependencyEdges.filter(e=>e.from===selectedNode).length}</b></div>
         <div><span>{t('terraform.graph.dependents')}</span><b>{dependencyEdges.filter(e=>e.to===selectedNode).length}</b></div>
       </dl>
       <h3 style={{fontSize:'9px',margin:'14px 0 6px',color:'var(--muted)'}}>{t('terraform.graph.directDependencies')}</h3>
       {dependencyEdges.filter(e=>e.from===selectedNode).map(e=><div key={e.to} style={{fontSize:'8px',color:'#aab7c5',padding:'3px 0'}}>→ {e.to}</div>)}
       {dependencyEdges.filter(e=>e.from===selectedNode).length===0 && <div style={{fontSize:'8px',color:'var(--muted)'}}>{t('terraform.graph.none')}</div>}
       <h3 style={{fontSize:'9px',margin:'14px 0 6px',color:'var(--muted)'}}>{t('terraform.graph.directDependents')}</h3>
       {dependencyEdges.filter(e=>e.to===selectedNode).map(e=><div key={e.from} style={{fontSize:'8px',color:'#aab7c5',padding:'3px 0'}}>← {e.from}</div>)}
       {dependencyEdges.filter(e=>e.to===selectedNode).length===0 && <div style={{fontSize:'8px',color:'var(--muted)'}}>{t('terraform.graph.noneMasc')}</div>}
     </> : <p style={{fontSize:'9px',color:'var(--muted)'}}>{t('terraform.graph.selectResource')}</p>}
   </aside>
 </section>}

 {tab === 'history' && <section className="panel table-panel">
   <div className="tf-apply-list">
     {applies.map(a => <div className="tf-apply-item" key={a.id}>
       <time>{a.date}</time>
       <div style={{flex:1}}><strong>{a.summary}</strong><small>{a.author} · {a.id}</small></div>
       <span className={`badge badge--${a.status === 'success' ? 'success' : a.status === 'failed' ? 'failed' : 'warning'}`}>{a.status === 'rolled-back' ? t('terraform.history.rolledBack') : a.status}</span>
       <button className="button button--tiny" disabled={a.status === 'rolled-back' || !canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={() => rollback(a.id)}><RotateCcw size={13}/> {t('terraform.history.revert')}</button>
     </div>)}
   </div>
 </section>}

 {tab === 'cost' && <section className="panel table-panel">
   <div className="tf-cost-total"><span>{t('terraform.cost.total')}</span><strong>R$ {totalCost.toLocaleString('pt-BR')}</strong></div>
   <div className="tf-cost-table data-table">
     <div className="data-table__head" style={{gridTemplateColumns:'2fr 1.4fr 1fr'}}><span>{t('terraform.cost.resource')}</span><span>{t('terraform.cost.type')}</span><span>{t('terraform.cost.monthly')}</span></div>
     {costRows.map(r => <div className="data-table__row" key={r.id} style={{gridTemplateColumns:'2fr 1.4fr 1fr'}}>
       <span>{r.id}</span><span>{r.type}</span><span>R$ {r.cost.toLocaleString('pt-BR')}</span>
     </div>)}
   </div>
 </section>}
 </>
}
