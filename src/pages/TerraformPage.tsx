import { AlertOctagon, ChevronDown, ChevronRight, Cloud, Copy, Download, FileJson, FlaskConical, GitCompare, Layers, Lock, Network, History, Package, PiggyBank, RotateCcw, Search, Skull, Star, StickyNote, Tags, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { BarChart } from '../components/charts/BarChart'
import { useAudit } from '../context/AuditContext'
import { useCurrentUser } from '../context/CurrentUserContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dependencyEdges, dependencyNodes, initialApplies, monthlyCostByType, plans as extraPlans, type ApplyEvent } from '../data/terraformExtra'
import { costHistory } from '../data/terraformExtra2'
import { isProviderOutdated, providerVersions, rightsizingSuggestions } from '../data/terraformExtra3'
import { useI18n } from '../i18n/I18nContext'
import '../styles/terraform-extra.css'
import '../styles/terraform-extra2.css'
import '../styles/terraform-extra3.css'

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

// Tags customizadas persistidas por recurso.
interface ResourceTagSet { environment: string; owner: string; criticality: string }

function download(filename:string,content:string,type='application/json'){
 const blob=new Blob([content],{type})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=filename;a.click()
 URL.revokeObjectURL(url)
}

// Gera um HCL simplificado a partir dos recursos do state mockado.
function generateHcl(resources: Resource[]): string {
 return resources.map(r => {
  const attrs = Object.entries(r.attrs || {}).map(([k, v]) => `  ${k} = "${v}"`).join('\n')
  const name = r.id.includes('.') ? r.id.split('.').slice(1).join('.') : r.id
  return `resource "${r.type}" "${name}" {\n${attrs}\n}`
 }).join('\n\n')
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

type ExtraTab = 'diff' | 'graph' | 'history' | 'cost' | 'providers' | 'rightsizing'

export default function TerraformPage(){
 const [open,setOpen]=useState<string[]>(tree.map(t=>t.id)),[selected,setSelected]=useState<Resource>(tree[1].children![0]),[query,setQuery]=useState('')
 const [tab,setTab]=useState<'state'|'plan'|ExtraTab>('state')
 const { t } = useI18n()
 const { logAction } = useAudit()
 const { addNotification } = useNotifications()
 const { isFavorite, toggleFavorite } = useFavorites()
 const { canEdit } = useRole()
 const { user } = useCurrentUser()

 // --- Detecção de drift: recursos com mudança "change"/"destroy" pendente no plan-a que já
 // deveriam ter sido aplicadas mas ainda divergem do state atual. ---
 const driftAddresses = useMemo(() => new Set(extraPlans[0].changes.filter(c => c.action !== 'add').map(c => c.address)), [])

 // --- Anotações livres por módulo (persistidas) ---
 const [annotations, setAnnotations] = useLocalStorage<Record<string, string>>('opsphere-terraform-annotations', {})

 // --- Tags customizadas por recurso (persistidas) + filtro ---
 const [resourceTags, setResourceTags] = useLocalStorage<Record<string, ResourceTagSet>>('opsphere-terraform-tags', {})
 const [tagFilter, setTagFilter] = useState('all')
 const allTagValues = useMemo(() => {
  const set = new Set<string>()
  Object.values(resourceTags).forEach(tg => { [tg.environment, tg.owner, tg.criticality].forEach(v => { if (v) set.add(v) }) })
  return Array.from(set)
 }, [resourceTags])
 const [tagForm, setTagForm] = useState<ResourceTagSet>({ environment: '', owner: '', criticality: '' })

 // --- Destroy simulado (com dupla confirmação) ---
 const [destroyed, setDestroyed] = useLocalStorage<boolean>('opsphere-terraform-destroyed', false)
 const [destroyStep, setDestroyStep] = useState<0 | 1 | 2>(0)
 const [destroyConfirmText, setDestroyConfirmText] = useState('')

 // --- Sandbox: rascunho isolado de edição de atributos, não afeta o state oficial ---
 const [sandboxDrafts, setSandboxDrafts] = useLocalStorage<Record<string, Record<string, string>>>('opsphere-terraform-sandbox', {})
 const [sandboxOpen, setSandboxOpen] = useState(false)
 const [sandboxKey, setSandboxKey] = useState('')
 const [sandboxValue, setSandboxValue] = useState('')

 // --- Grafo: modo de visualização por custo ---
 const [graphMode, setGraphMode] = useState<'default' | 'cost'>('default')

 const q=query.trim().toLowerCase()
 const filteredTree=useMemo(()=>{
  let source = tree
  if (q) {
   source = tree
    .map(module=>{
     const moduleMatches=module.id.toLowerCase().includes(q)
     const children=(module.children||[]).filter(c=>c.id.toLowerCase().includes(q)||c.type.toLowerCase().includes(q)||Object.values(c.attrs||{}).some(v=>v.toLowerCase().includes(q)))
     if(moduleMatches||children.length)return {...module,children:moduleMatches?module.children:children}
     return null
    })
    .filter((m):m is Resource=>m!==null)
  }
  if (tagFilter !== 'all') {
   source = source
    .map(module => ({ ...module, children: (module.children || []).filter(c => Object.values(resourceTags[c.id] || {}).includes(tagFilter)) }))
    .filter(m => (m.children || []).length > 0)
  }
  return source
 },[q,tagFilter,resourceTags])
 const autoOpen=q?filteredTree.map(m=>m.id):open

 const planSummary=useMemo(()=>({
  create:plan.filter(p=>p.action==='create').length,
  update:plan.filter(p=>p.action==='update').length,
  destroy:plan.filter(p=>p.action==='destroy').length,
 }),[])

 const favoritedDestroyWarnings = plan.filter(p => p.action === 'destroy' && isFavorite('terraform', p.address))

 const sandboxDraft = sandboxDrafts[selected.id]
 const effectiveAttrs = { ...(selected.attrs||{id:'r-0d8f21a3',status:'available',tags:'environment=production'}), ...(sandboxDraft||{}) }
 const fullRepresentation=JSON.stringify({address:selected.id,mode:'managed',type:selected.type,provider:selected.provider,values:effectiveAttrs},null,2)

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
 // Custo por nó do grafo (derivado do tipo do recurso, "aws_vpc.main" -> "aws_vpc") e percentual do total.
 const graphCostTotal = useMemo(() => dependencyNodes.reduce((sum, n) => sum + (monthlyCostByType[n.split('.')[0]] ?? 0), 0), [])
 const nodeCostPct = (n: string) => graphCostTotal > 0 ? (monthlyCostByType[n.split('.')[0]] ?? 0) / graphCostTotal : 0

 // --- Histórico de applies com rollback simulado (persistido em localStorage) ---
 const [applies, setApplies] = useLocalStorage<ApplyEvent[]>('opsphere-terraform-applies', initialApplies)
 const rollback = (id: string) => {
  const target = applies.find(a => a.id === id)
  if (!target || target.status === 'rolled-back') return
  setApplies(list => list.map(a => a.id === id ? { ...a, status: 'rolled-back' as const } : a))
  if (target.summary === t('terraform.destroy.summary')) setDestroyed(false)
  addNotification(t('terraform.notify.rollbackTitle'), `Apply ${id} (${target.summary}) ${t('terraform.notify.rollbackReverted')}`, 'warning')
  logAction(t('terraform.audit.rollback'), `Reverteu o apply ${id}: ${target.summary}`)
 }

 // --- Estimativa de custo mockado por recurso ---
 const costRows = flatResources.map(r => ({ ...r, cost: monthlyCostByType[r.type] ?? 0 }))
 const totalCost = costRows.reduce((sum, r) => sum + r.cost, 0)

 // --- Simulação de state lock: outro usuário mock ("Ana Lima") supostamente aplicando mudanças ---
 const [lockModalOpen, setLockModalOpen] = useState(false)
 const [applyLocked, setApplyLocked] = useState(false)
 const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
 useEffect(() => () => { if (lockTimerRef.current) clearTimeout(lockTimerRef.current) }, [])
 const waitForLock = () => {
  setLockModalOpen(false)
  setApplyLocked(true)
  addNotification(t('terraform.lock.forceNotifyTitle'), t('terraform.lock.waiting'), 'warning')
  lockTimerRef.current = setTimeout(() => {
   setApplyLocked(false)
   addNotification(t('terraform.lock.title'), t('terraform.lock.waitDone'), 'healthy')
  }, 6000)
 }
 const forceApply = () => {
  setLockModalOpen(false)
  logAction(t('terraform.lock.simulateButton'), t('terraform.lock.forceLogged'))
  addNotification(t('terraform.lock.forceNotifyTitle'), t('terraform.lock.forceLogged'), 'critical')
 }

 // --- Simulação de destroy total ---
 const confirmDestroyStep2 = () => {
  if (destroyConfirmText.trim().toUpperCase() !== 'DESTROY') return
  setDestroyed(true)
  const id = `destroy-${Date.now()}`
  setApplies(list => [{ id, date: new Date().toLocaleString('pt-BR'), author: user.name, summary: t('terraform.destroy.summary'), status: 'success' as const }, ...list])
  addNotification(t('terraform.destroy.confirmTitle'), t('terraform.destroy.summary'), 'critical')
  logAction(t('terraform.destroy.button'), t('terraform.destroy.summary'))
  setDestroyStep(0); setDestroyConfirmText('')
 }

 // --- Tags customizadas ---
 const saveTags = () => {
  setResourceTags(map => ({ ...map, [selected.id]: tagForm }))
  logAction('terraform.tags.save', `Tags atualizadas para ${selected.id}: ${JSON.stringify(tagForm)}`)
 }

 // --- Sandbox: aplicar/descartar rascunho ---
 const applySandbox = () => {
  if (!sandboxKey.trim()) return
  setSandboxDrafts(map => ({ ...map, [selected.id]: { ...(map[selected.id]||{}), [sandboxKey.trim()]: sandboxValue } }))
  setSandboxKey(''); setSandboxValue('')
 }
 const discardSandbox = () => setSandboxDrafts(map => { const next = { ...map }; delete next[selected.id]; return next })

 const selectResource = (r: Resource) => {
  setSelected(r)
  setTagForm(resourceTags[r.id] || { environment: '', owner: '', criticality: '' })
  setSandboxOpen(false)
 }

 return <><PageHeader eyebrow={t('terraform.eyebrow')} title={t('terraform.title')} description={t('terraform.description')} actions={<>
  <button className="button" onClick={()=>download('terraform-state.json',JSON.stringify({modules:tree},null,2))}><Download size={16}/> {t('terraform.exportState')}</button>
  <button className="button" onClick={()=>download('terraform-state.tf',generateHcl(flatResources),'text/plain')}><FileJson size={16}/> {t('terraform.export.hcl')}</button>
  <button className="button button--primary"><FileJson size={16}/> {t('terraform.loadState')}</button>
  <button className="button" disabled={destroyed || !canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>setDestroyStep(1)}><Skull size={16}/> {t('terraform.destroy.button')}</button>
 </>}/>
 <div className="tab-strip">
  <button className={tab==='state'?'is-active':''} onClick={()=>setTab('state')}><Layers size={14}/> {t('terraform.tab.state')}</button>
  <button className={tab==='plan'?'is-active':''} onClick={()=>setTab('plan')}><GitCompare size={14}/> {t('terraform.tab.plan')} ({plan.length})</button>
  <button className={tab==='diff'?'is-active':''} onClick={()=>setTab('diff')}><GitCompare size={14}/> {t('terraform.tab.diff')}</button>
  <button className={tab==='graph'?'is-active':''} onClick={()=>setTab('graph')}><Network size={14}/> {t('terraform.tab.graph')}</button>
  <button className={tab==='history'?'is-active':''} onClick={()=>setTab('history')}><History size={14}/> {t('terraform.tab.history')}</button>
  <button className={tab==='cost'?'is-active':''} onClick={()=>setTab('cost')}><Wallet size={14}/> {t('terraform.tab.cost')}</button>
  <button className={tab==='providers'?'is-active':''} onClick={()=>setTab('providers')}><Package size={14}/> {t('terraform.tab.providers')}</button>
  <button className={tab==='rightsizing'?'is-active':''} onClick={()=>setTab('rightsizing')}><PiggyBank size={14}/> {t('terraform.tab.rightsizing')}</button>
 </div>
 {tab==='state'&&
 <section className="terraform-layout"><aside className="panel resource-tree"><label className="search-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('terraform.filterPlaceholder')}/></label>
 <div className="tf-tree-tags-filter"><Tags size={14}/><select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}><option value="all">{t('terraform.tags.filterAll')}</option>{allTagValues.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
 <div className="tree-summary"><span>{t('terraform.stateLabel')}: <strong>production</strong>{destroyed && <span className="tf-destroyed-badge"><Skull size={10}/> {t('terraform.destroyed.badge')}</span>}</span><span>{t('terraform.updatedAgo')}</span></div>
 {filteredTree.length===0&&<p className="empty-hint">{t('terraform.noResourcesFound')} "{query}".</p>}
 {filteredTree.map(module=><div className="tree-module" key={module.id}><button onClick={()=>setOpen(o=>o.includes(module.id)?o.filter(x=>x!==module.id):[...o,module.id])}>{autoOpen.includes(module.id)?<ChevronDown/>:<ChevronRight/>}<Cloud/><strong>{module.id}</strong>{annotations[module.id]?.trim() && <StickyNote size={12} className="tf-module-annotation-icon"/>}<span>{module.children?.length}</span></button>
 {autoOpen.includes(module.id)&&<><div className="tf-module-annotation"><input value={annotations[module.id]||''} onChange={e=>setAnnotations(a=>({...a,[module.id]:e.target.value}))} placeholder={t('terraform.annotation.placeholder')}/></div>
 <div>{module.children?.map(child=><button key={child.id} className={selected.id===child.id?'is-selected':''} onClick={()=>selectResource(child)}><i/>{child.id}{driftAddresses.has(child.id) && !destroyed && <span className="tf-drift-badge"><AlertOctagon size={9}/> {t('terraform.drift.badge')}</span>}</button>)}</div></>}</div>)}</aside>
 <article className="panel resource-detail"><div className="panel__header"><div><span className="eyebrow">{t('terraform.resourceEyebrow')}</span><h2>{selected.id}{driftAddresses.has(selected.id) && !destroyed && <span className="tf-drift-badge"><AlertOctagon size={9}/> {t('terraform.drift.badge')}</span>}{destroyed && <span className="tf-destroyed-badge"><Skull size={9}/> {t('terraform.destroyed.badge')}</span>}</h2><p>{selected.provider} · {t('terraform.managed')}</p></div><div style={{display:'flex',gap:8}}><button className={`icon-button${sandboxOpen?' is-active':''}`} title={t('terraform.sandbox.toggle')} onClick={()=>setSandboxOpen(o=>!o)}><FlaskConical size={17}/></button><button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: selected.id, module: 'terraform', label: selected.id })}><Star fill={isFavorite('terraform', selected.id) ? 'currentColor' : 'none'} size={17}/></button><button className="icon-button" onClick={()=>navigator.clipboard?.writeText(selected.id)}><Copy size={17}/></button></div></div><div className="resource-visual"><Cloud size={34}/><div><strong>{selected.type}</strong><span>{selected.provider}</span></div></div><h3>{t('terraform.attributes')}</h3><div className="attribute-table">{Object.entries(effectiveAttrs).map(([key,value])=><div key={key}><code>{key}</code><span>{value}{sandboxDraft?.[key]!==undefined && <em style={{marginLeft:6,color:'var(--warning)',fontStyle:'normal',fontSize:'7px'}}>({t('terraform.sandbox.badge')})</em>}</span></div>)}</div>

 <h3>{t('terraform.tags.environment')} / {t('terraform.tags.owner')} / {t('terraform.tags.criticality')}</h3>
 <div className="tf-tags-form">
  <label>{t('terraform.tags.environment')}<input value={tagForm.environment} onChange={e=>setTagForm(f=>({...f,environment:e.target.value}))}/></label>
  <label>{t('terraform.tags.owner')}<input value={tagForm.owner} onChange={e=>setTagForm(f=>({...f,owner:e.target.value}))}/></label>
  <label>{t('terraform.tags.criticality')}<input value={tagForm.criticality} onChange={e=>setTagForm(f=>({...f,criticality:e.target.value}))}/></label>
  <button className="button button--tiny" disabled={!canEdit} onClick={saveTags}>{t('terraform.tags.save')}</button>
 </div>
 {resourceTags[selected.id] && <div className="tf-resource-tags">{Object.values(resourceTags[selected.id]).filter(Boolean).map(v=><span key={v}>{v}</span>)}</div>}

 {sandboxOpen && <div className="tf-sandbox-panel">
  <h4><FlaskConical size={12}/> {t('terraform.sandbox.toggle')}</h4>
  <div className="tf-sandbox-row">
   <input value={sandboxKey} onChange={e=>setSandboxKey(e.target.value)} placeholder={t('terraform.sandbox.attrKey')}/>
   <input value={sandboxValue} onChange={e=>setSandboxValue(e.target.value)} placeholder={t('terraform.sandbox.attrValue')}/>
   <button className="button button--tiny" onClick={applySandbox}>{t('terraform.sandbox.apply')}</button>
  </div>
  {sandboxDraft && <div className="tf-sandbox-draft-list">{Object.entries(sandboxDraft).map(([k,v])=><div key={k}><span>{k}</span><span>{v}</span></div>)}</div>}
  <button className="button button--tiny" onClick={discardSandbox} disabled={!sandboxDraft}>{t('terraform.sandbox.discard')}</button>
 </div>}

 <div className="panel__header"><h3>{t('terraform.representation')}</h3><button className="icon-button" title={t('terraform.copyJson')} onClick={()=>navigator.clipboard?.writeText(fullRepresentation)}><Copy size={15}/></button></div><pre className="state-code">{fullRepresentation}</pre></article></section>}
 {tab==='plan'&&
 <section className="panel plan-panel">
  <div className="plan-summary"><span className="badge badge--healthy">{planSummary.create} {t('terraform.plan.toCreate')}</span><span className="badge badge--warning">{planSummary.update} {t('terraform.plan.toChange')}</span><span className="badge badge--critical">{planSummary.destroy} {t('terraform.plan.toDestroy')}</span></div>
  {favoritedDestroyWarnings.length > 0 && <div className="tf-fav-warning"><AlertOctagon size={14}/> {t('terraform.favorite.destroyWarning')} {favoritedDestroyWarnings.map(w=>w.address).join(', ')}</div>}
  <div className="plan-list">{plan.map(change=><div className={`plan-row plan-row--${change.action}`} key={change.address}><b className={`plan-marker badge--${planTone[change.action]}`}>{planIcon[change.action]}</b><div><strong>{change.address}</strong>{change.action==='destroy' && isFavorite('terraform',change.address) && <Star size={12} fill="currentColor" style={{color:'var(--danger)',marginLeft:6}}/>}<span>{change.detail}</span></div></div>)}</div>
  {applyLocked && <div className="tf-lock-waiting"><Lock size={12}/> {t('terraform.lock.waiting')}</div>}
  <div className="plan-actions">
   <button className="button" onClick={()=>download('terraform-plan.json',JSON.stringify(plan,null,2))}><Download size={16}/> {t('terraform.exportPlan')}</button>
   <button className="button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>setLockModalOpen(true)}><Lock size={16}/> {t('terraform.lock.simulateButton')}</button>
   <button className="button button--primary" disabled={!canEdit || applyLocked} title={!canEdit ? 'Ação bloqueada no modo visualizador' : applyLocked ? t('terraform.lock.waiting') : undefined}>{t('terraform.applyPlan')}</button>
  </div>
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
     <div className="tf-graph-mode-toggle">
      <button className={graphMode==='default'?'is-active':''} onClick={()=>setGraphMode('default')}>{t('terraform.graph.mode.default')}</button>
      <button className={graphMode==='cost'?'is-active':''} onClick={()=>setGraphMode('cost')}><Wallet size={12}/> {t('terraform.graph.mode.cost')}</button>
     </div>
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
         const pct = nodeCostPct(n)
         const w = graphMode === 'cost' ? 70 + pct * 200 : 120
         const fill = graphMode === 'cost' ? `rgba(242,163,63,${0.15 + pct * 0.7})` : undefined
         return <g key={n} className={`tf-graph-node${isSelected ? ' is-selected' : ''}${isRelated ? ' is-related' : ''}${isDimmed ? ' is-dimmed' : ''}`} onClick={() => setSelectedNode(n)} transform={`translate(${pos.x},${pos.y})`}>
           <rect width={w} height={26} rx={6} style={fill ? { fill } : undefined} />
           <text x={w/2} y={17} textAnchor="middle">{n.replace('aws_', '').slice(0, 20)}{graphMode==='cost' ? ` · ${Math.round(pct*100)}%` : ''}</text>
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
         {graphMode === 'cost' && <div><span>{t('terraform.cost.monthly')}</span><b>R$ {(monthlyCostByType[selectedNode.split('.')[0]] ?? 0).toLocaleString('pt-BR')}</b></div>}
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
   <div className="tf-cost-history">
     <h4>{t('terraform.cost.history')}</h4>
     <BarChart data={costHistory.map(c=>({label:c.month,value:c.total}))} suffix=" R$"/>
   </div>
 </section>}

 {tab === 'providers' && <section className="panel table-panel">
   <div className="tf-provider-table data-table">
     <div className="data-table__head" style={{gridTemplateColumns:'1.2fr 1fr 1fr 1fr'}}><span>{t('terraform.providers.name')}</span><span>{t('terraform.providers.constraint')}</span><span>{t('terraform.providers.current')}</span><span>{t('terraform.providers.latest')}</span></div>
     {providerVersions.map(p => {
       const outdated = isProviderOutdated(p.current, p.latest)
       return <div className="data-table__row" key={p.name} style={{gridTemplateColumns:'1.2fr 1fr 1fr 1fr'}}>
         <span>{p.name}</span>
         <span><code>{p.constraint}</code></span>
         <span>{p.current}</span>
         <span>
           <span className={outdated ? 'tf-provider-outdated' : 'tf-provider-uptodate'}>{p.latest}{outdated ? ` · ${t('terraform.providers.outdated')}` : ` · ${t('terraform.providers.upToDate')}`}</span>
           {outdated && <span className="tf-provider-upgrade-hint">{t('terraform.providers.upgradeHint')} {p.name} {p.constraint.replace(/[~><=\s]/g, '').split('.')[0]}.x = "{p.latest}"</span>}
         </span>
       </div>
     })}
   </div>
 </section>}

 {tab === 'rightsizing' && <section className="panel">
   <div style={{padding:'16px'}}>
     <h3 style={{margin:'0 0 4px',fontSize:'11px'}}>{t('terraform.rightsizing.title')}</h3>
     <div className="tf-rightsizing-list">
       {rightsizingSuggestions.map(s => <div className="tf-rightsizing-item" key={s.resourceId}>
         <strong>{s.resourceId}</strong>
         <p>{s.message}</p>
         <span className="tf-rightsizing-savings">{t('terraform.rightsizing.savings')}: R$ {s.estimatedMonthlySavings.toLocaleString('pt-BR')}{t('terraform.rightsizing.perMonth')}</span>
       </div>)}
     </div>
   </div>
 </section>}

 {destroyStep === 1 && <Modal title={t('terraform.destroy.confirmTitle')} onClose={()=>setDestroyStep(0)}>
  <div className="tf-destroy-confirm">
   <p>{t('terraform.destroy.confirmStep1')}</p>
   <div className="modal-actions"><button className="button" onClick={()=>setDestroyStep(0)}>{t('terraform.destroy.cancel')}</button><button className="button button--primary" onClick={()=>setDestroyStep(2)}>{t('terraform.destroy.confirmButton')}</button></div>
  </div>
 </Modal>}
 {destroyStep === 2 && <Modal title={t('terraform.destroy.confirmTitle')} onClose={()=>{setDestroyStep(0);setDestroyConfirmText('')}}>
  <div className="tf-destroy-confirm">
   <p>{t('terraform.destroy.confirmStep2')}</p>
   <input value={destroyConfirmText} onChange={e=>setDestroyConfirmText(e.target.value)} placeholder={t('terraform.destroy.confirmInputPlaceholder')}/>
   <div className="modal-actions"><button className="button" onClick={()=>{setDestroyStep(0);setDestroyConfirmText('')}}>{t('terraform.destroy.cancel')}</button><button className="button button--primary" disabled={destroyConfirmText.trim().toUpperCase()!=='DESTROY'} onClick={confirmDestroyStep2}>{t('terraform.destroy.confirmButton')}</button></div>
  </div>
 </Modal>}
 {lockModalOpen && <Modal title={t('terraform.lock.title')} onClose={()=>setLockModalOpen(false)}>
  <div className="tf-lock-modal">
   <p><Lock size={13}/> {t('terraform.lock.message')}</p>
   <div className="modal-actions">
    <button className="button" onClick={waitForLock}>{t('terraform.lock.wait')}</button>
    <button className="button button--primary" onClick={forceApply}>{t('terraform.lock.force')}</button>
   </div>
  </div>
 </Modal>}
 </>
}
