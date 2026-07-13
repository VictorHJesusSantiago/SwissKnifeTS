import { AlertTriangle, Box, CheckCircle2, ChevronDown, ChevronUp, Clock3, Download, FileCode2, GitCompareArrows, Plus, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useI18n } from '../i18n/I18nContext'
import { manifestTemplates, namespaceManifestSamples, seedNamespaceEvents, type NamespaceEvent } from '../data/kubernetesExtra2'
import '../styles/namespaces-extra.css'
import { classNames } from '../utils/format'

type Namespace={name:string;team:string;environment:string;cpu:string;memory:string;status:string;created:string;quota:{cpuUsedPct:number;memUsedPct:number;storageUsedPct:number};budget?:number}
const initial:Namespace[]=[
 {name:'commerce-prod',team:'Commerce',environment:'Produção',cpu:'8 vCPU',memory:'16 GiB',status:'Ativo',created:'12/04/2026',quota:{cpuUsedPct:74,memUsedPct:82,storageUsedPct:55},budget:1200},
 {name:'data-sandbox',team:'Data Platform',environment:'Sandbox',cpu:'4 vCPU',memory:'8 GiB',status:'Ativo',created:'21/05/2026',quota:{cpuUsedPct:38,memUsedPct:44,storageUsedPct:91},budget:500},
 {name:'growth-preview',team:'Growth',environment:'Preview',cpu:'2 vCPU',memory:'4 GiB',status:'Provisionando',created:'Agora',quota:{cpuUsedPct:12,memUsedPct:18,storageUsedPct:9},budget:200},
]

const manifestFor = (ns: Namespace) => namespaceManifestSamples[ns.name] || `apiVersion: v1
kind: Namespace
metadata:
  name: ${ns.name}
  labels:
    team: ${ns.team.toLowerCase().replace(/\s+/g,'-')}
    environment: ${ns.environment.toLowerCase()}
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ${ns.name}-quota
  namespace: ${ns.name}
spec:
  hard:
    requests.cpu: "${ns.cpu.replace(' vCPU','')}"
    requests.memory: ${ns.memory.replace(' GiB','Gi')}
    persistentvolumeclaims: "10"
`

function validateYaml(text: string): { ok: boolean; message: string } {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/#.*/, '')
    if (!line.trim()) continue
    if (line.includes('\t')) return { ok: false, message: `Linha ${i + 1}: indentação com tabs não é permitida, use espaços.` }
    const indent = line.match(/^ */)?.[0].length ?? 0
    if (indent % 2 !== 0) return { ok: false, message: `Linha ${i + 1}: indentação inconsistente (use múltiplos de 2 espaços).` }
    const trimmed = line.trim()
    if (trimmed === '---') continue
    if (trimmed.startsWith('- ')) continue
    if (!/^[A-Za-z0-9_.\-]+:(\s.*)?$/.test(trimmed)) {
      return { ok: false, message: `Linha ${i + 1}: chave mal formada, esperado "chave: valor" → "${trimmed}"` }
    }
  }
  return { ok: true, message: 'YAML válido (verificação simulada de sintaxe).' }
}

/** Naive line-by-line diff: aligns by index and marks lines that differ between the two texts. */
function diffLines(a: string, b: string) {
  const aLines = a.split('\n'), bLines = b.split('\n')
  const max = Math.max(aLines.length, bLines.length)
  const left: { text: string; changed: boolean }[] = []
  const right: { text: string; changed: boolean }[] = []
  for (let i = 0; i < max; i++) {
    const al = aLines[i] ?? ''
    const bl = bLines[i] ?? ''
    const changed = al !== bl
    left.push({ text: al, changed })
    right.push({ text: bl, changed })
  }
  return { left, right }
}

/** Rough estimated monthly cost (mock) based on requested CPU/memory quota usage. */
const estimateCost = (ns: Namespace) => Math.round(ns.quota.cpuUsedPct * 6 + ns.quota.memUsedPct * 3.4)

const quotaTone = (pct: number) => pct >= 90 ? 'is-danger' : pct >= 75 ? 'is-warning' : ''

export default function NamespacesPage(){
 const { t } = useI18n()
 const { logAction } = useAudit()
 const { addNotification } = useNotifications()
 const { isFavorite, toggleFavorite } = useFavorites()
 const { canEdit } = useRole()
 const [items,setItems]=useLocalStorage<Namespace[]>('opsphere-namespaces',initial),[modal,setModal]=useState(false)
 const [form,setForm]=useState({name:'',team:'',environment:'Desenvolvimento',size:'Pequeno'})
 const [yamlTarget,setYamlTarget]=useState<Namespace|null>(null)
 const [yamlText,setYamlText]=useState('')
 const [templateId,setTemplateId]=useState('')
 const [events,setEvents]=useLocalStorage<Record<string,NamespaceEvent[]>>('opsphere-namespace-events',seedNamespaceEvents)
 const [expandedEvents,setExpandedEvents]=useState<Set<string>>(new Set())

 // --- item 12: manifest comparison ---
 const [compareA,setCompareA]=useState(initial[0].name)
 const [compareB,setCompareB]=useState(initial[1].name)
 const [showCompare,setShowCompare]=useState(false)

 const create=()=>{
  if(!form.name||!form.team)return
  const sizes:Record<string,[string,string]>={Pequeno:['2 vCPU','4 GiB'],Médio:['4 vCPU','8 GiB'],Grande:['8 vCPU','16 GiB']}
  setItems(v=>[...v,{name:form.name,team:form.team,environment:form.environment,cpu:sizes[form.size][0],memory:sizes[form.size][1],status:'Provisionando',created:'Agora',quota:{cpuUsedPct:5,memUsedPct:8,storageUsedPct:2},budget:400}])
  setEvents(prev=>({...prev,[form.name]:[{id:`e${Date.now()}`,type:'created',message:'Namespace criado',time:'Agora'}]}))
  setModal(false)
  setTimeout(()=>setItems(v=>v.map(i=>i.name===form.name?{...i,status:'Ativo'}:i)),2200)
 }

 const addEvent=(name:string, event: Omit<NamespaceEvent,'id'|'time'>)=>{
  setEvents(prev=>({...prev,[name]:[{...event,id:`e${Date.now()}${Math.random().toString(36).slice(2,5)}`,time:'Agora'},...(prev[name]||[])]}))
 }

 const toggleEvents=(name:string)=>setExpandedEvents(prev=>{const next=new Set(prev);next.has(name)?next.delete(name):next.add(name);return next})

 const openYaml = (ns: Namespace) => { setYamlTarget(ns); setYamlText(manifestFor(ns)); setTemplateId(''); logAction(t('namespaces.audit.manifestOpened'), ns.name) }
 const validation = useMemo(()=> yamlTarget ? validateYaml(yamlText) : null, [yamlTarget, yamlText])
 const saveYaml = () => {
  if (!yamlTarget) return
  const result = validateYaml(yamlText)
  if (result.ok) { addNotification(t('namespaces.notify.manifestValidTitle'), `${yamlTarget.name}: ${t('namespaces.notify.manifestValidBody')}`, 'healthy'); logAction(t('namespaces.audit.manifestValidated'), yamlTarget.name) }
  else { addNotification(t('namespaces.notify.manifestInvalidTitle'), `${yamlTarget.name}: ${result.message}`, 'critical') }
 }

 const applyTemplate=(id:string)=>{
  setTemplateId(id)
  const tpl = manifestTemplates.find(m=>m.id===id)
  if (tpl) { setYamlText(tpl.content); logAction('Namespaces: template de manifesto aplicado', `${yamlTarget?.name} → ${tpl.label}`) }
 }

 const downloadYaml=()=>{
  if (!yamlTarget) return
  const blob = new Blob([yamlText], { type: 'text/yaml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${yamlTarget.name}.yaml`
  a.click()
  URL.revokeObjectURL(a.href)
  logAction('Namespaces: manifesto exportado', `${yamlTarget.name}.yaml`)
 }

 const setBudget=(name:string, value:number)=>{
  setItems(v=>v.map(i=>i.name===name?{...i,budget:value}:i))
 }

 const diff = useMemo(()=> showCompare ? diffLines(manifestFor(items.find(i=>i.name===compareA) || initial[0]), manifestFor(items.find(i=>i.name===compareB) || initial[1])) : null, [showCompare, compareA, compareB, items])

 return <><PageHeader eyebrow={t('namespaces.eyebrow')} title={t('namespaces.title')} description={t('namespaces.description')} actions={<><button className={showCompare?'button button--primary':'button'} onClick={()=>setShowCompare(v=>!v)}><GitCompareArrows size={16}/> Comparar manifests</button><button className="button button--primary" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>setModal(true)}><Plus size={16}/> {t('namespaces.request')}</button></>}/>
 <div className="notice-banner"><CheckCircle2/><div><strong>{t('namespaces.notice.title')}</strong><span>{t('namespaces.notice.body')}</span></div></div>

 {showCompare && <article className="panel">
  <div className="diff-controls">
   <span>Namespace A</span>
   <select value={compareA} onChange={e=>setCompareA(e.target.value)}>{items.map(i=><option key={i.name} value={i.name}>{i.name}</option>)}</select>
   <span>Namespace B</span>
   <select value={compareB} onChange={e=>setCompareB(e.target.value)}>{items.map(i=><option key={i.name} value={i.name}>{i.name}</option>)}</select>
  </div>
  {diff && <div className="diff-panel">
   <pre>{diff.left.map((l,i)=><span key={i} className={l.changed?'diff-remove':''}>{l.text||' '}</span>)}</pre>
   <pre>{diff.right.map((l,i)=><span key={i} className={l.changed?'diff-add':''}>{l.text||' '}</span>)}</pre>
  </div>}
 </article>}

 <section className="namespace-grid">{items.map(item=>{
  const cost = estimateCost(item)
  const overBudget = item.budget !== undefined && cost > item.budget
  const nsEvents = events[item.name] || []
  const expanded = expandedEvents.has(item.name)
  return <article className="panel namespace-card" key={item.name}><header><div className="resource-icon"><Box/></div><div><h2>{item.name}</h2><span>{item.team}</span></div><button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: item.name, module: 'namespaces', label: item.name })}><Star fill={isFavorite('namespaces', item.name) ? 'currentColor' : 'none'} size={16}/></button><button className="icon-button" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>setItems(v=>v.filter(i=>i.name!==item.name))}><Trash2 size={16}/></button></header><div className={`provision-status ${item.status==='Ativo'?'is-active':''}`}>{item.status==='Ativo'?<CheckCircle2/>:<Clock3 className="spin"/>}{item.status}</div><dl><div><dt>{t('namespaces.environment')}</dt><dd>{item.environment}</dd></div><div><dt>{t('namespaces.cpu')}</dt><dd>{item.cpu}</dd></div><div><dt>{t('namespaces.memory')}</dt><dd>{item.memory}</dd></div><div><dt>{t('namespaces.created')}</dt><dd>{item.created}</dd></div></dl>
  <div className="quota-list">
   <div className="quota-row"><span className="quota-row__label"><span>{t('namespaces.quota.cpu')}</span><span>{item.quota.cpuUsedPct}%</span></span><div className={classNames('quota-track',quotaTone(item.quota.cpuUsedPct))}><i style={{width:`${item.quota.cpuUsedPct}%`}}/></div></div>
   <div className="quota-row"><span className="quota-row__label"><span>{t('namespaces.quota.memory')}</span><span>{item.quota.memUsedPct}%</span></span><div className={classNames('quota-track',quotaTone(item.quota.memUsedPct))}><i style={{width:`${item.quota.memUsedPct}%`}}/></div></div>
   <div className="quota-row"><span className="quota-row__label"><span>{t('namespaces.quota.storage')}</span><span>{item.quota.storageUsedPct}%</span></span><div className={classNames('quota-track',quotaTone(item.quota.storageUsedPct))}><i style={{width:`${item.quota.storageUsedPct}%`}}/></div></div>
  </div>
  <div className="budget-row">
   <span className="budget-row__label"><span>Orçamento mensal (R$)</span><span>Custo estimado: R$ {cost}</span></span>
   <input type="number" min={0} value={item.budget ?? 0} disabled={!canEdit} onChange={e=>setBudget(item.name, Number(e.target.value))}/>
   {overBudget && <span className="budget-alert"><AlertTriangle size={13}/> Custo estimado ultrapassa o orçamento definido.</span>}
  </div>
  <div className="ns-events">
   <button className="ns-events__toggle" onClick={()=>toggleEvents(item.name)}>{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>} Histórico de eventos ({nsEvents.length})</button>
   {expanded && <ul className="ns-events__list">{nsEvents.map(ev=><li key={ev.id}><span>{ev.message}</span><span>{ev.time}</span></li>)}</ul>}
  </div>
  <button className="button button--full" onClick={()=>{openYaml(item);}}><FileCode2 size={15}/> {t('namespaces.editManifest')}</button>
 </article>
 })}</section>
 {modal&&<Modal title={t('namespaces.modal.title')} onClose={()=>setModal(false)}><div className="form-grid"><label>{t('namespaces.form.name')}<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} placeholder={t('namespaces.form.namePlaceholder')}/></label><label>{t('namespaces.form.team')}<input value={form.team} onChange={e=>setForm({...form,team:e.target.value})} placeholder={t('namespaces.form.teamPlaceholder')}/></label><label>{t('namespaces.form.environment')}<select value={form.environment} onChange={e=>setForm({...form,environment:e.target.value})}><option>Desenvolvimento</option><option>Sandbox</option><option>Produção</option></select></label><label>{t('namespaces.form.size')}<select value={form.size} onChange={e=>setForm({...form,size:e.target.value})}><option>Pequeno</option><option>Médio</option><option>Grande</option></select></label><div className="cost-preview span-2"><span>{t('namespaces.costEstimate')}</span><strong>{form.size==='Grande'?'R$ 1.840':form.size==='Médio'?'R$ 920':'R$ 460'}</strong></div><div className="form-actions span-2"><button className="button" onClick={()=>setModal(false)}>{t('namespaces.cancel')}</button><button className="button button--primary" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={create}>{t('namespaces.provision')}</button></div></div></Modal>}
 {yamlTarget && <Modal title={`${t('namespaces.manifestTitle')}: ${yamlTarget.name}`} onClose={()=>setYamlTarget(null)}>
  <div className="yaml-editor">
   <div className="yaml-editor__toolbar">
    <span>Template pronto:</span>
    <select value={templateId} onChange={e=>applyTemplate(e.target.value)}>
     <option value="">Selecione um template…</option>
     {manifestTemplates.map(tpl=><option key={tpl.id} value={tpl.id}>{tpl.label}</option>)}
    </select>
    <button className="button" onClick={downloadYaml}><Download size={14}/> Exportar .yaml</button>
   </div>
   <textarea value={yamlText} onChange={e=>setYamlText(e.target.value)} spellCheck={false}/>
   {validation && <div className={classNames('yaml-editor__status', validation.ok ? 'is-ok' : 'is-error')}>{validation.ok ? <CheckCircle2 size={15}/> : null}{validation.message}</div>}
   <div className="form-actions" style={{marginTop:12}}>
    <button className="button" onClick={()=>setYamlTarget(null)}>{t('namespaces.close')}</button>
    <button className="button button--primary" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>{saveYaml();addEvent(yamlTarget.name,{type:'quota',message:'Manifesto validado/editado'})}}>{t('namespaces.validateSyntax')}</button>
   </div>
  </div>
 </Modal>}
 </>
}
