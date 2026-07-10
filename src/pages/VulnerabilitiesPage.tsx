import { AlertTriangle, CheckCircle2, Download, FileText, Filter, Gauge, Link2, Search, ShieldCheck, ShieldOff, Star, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useFavorites } from '../context/FavoritesContext'
import { useRole } from '../context/RoleContext'
import { assets, serviceNodes, vulnerabilities as initial } from '../data/mockData'
import { baseProbabilityBySeverity, detectedAtById, slaDaysBySeverity } from '../data/vulnerabilitiesExtra'
import { useI18n } from '../i18n/I18nContext'
import type { Vulnerability } from '../types'
import '../styles/vulnerabilities-extra.css'

type SortKey='cvss'|'severity'|'due'
const severityRank:Record<Vulnerability['severity'],number>={'Crítica':4,'Alta':3,'Média':2,'Baixa':1}

function download(filename:string,content:string,type='text/csv'){
 const blob=new Blob([content],{type})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=filename;a.click()
 URL.revokeObjectURL(url)
}

type ExtraTab = 'table' | 'matrix' | 'timeline' | 'compliance'

// Normaliza um nome para comparação aproximada (minúsculas, sem acentos/hífens/espaços extras).
function normalize(s: string): string {
 return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

// Correspondência aproximada por substring nos dois sentidos entre o `asset` da vulnerabilidade
// e o nome do ativo/serviço.
function fuzzyMatch(a: string, b: string): boolean {
 const na = normalize(a), nb = normalize(b)
 if (!na || !nb) return false
 return na.includes(nb) || nb.includes(na)
}

// Impacto (eixo Y, 1-5): derivado diretamente do score CVSS (0-10), que já reflete a
// severidade técnica do impacto de exploração.
function impactFromCvss(cvss: number): number {
 return Math.min(5, Math.max(1, Math.ceil(cvss / 2)))
}

// Probabilidade (eixo X, 1-5): não há campo de "exploitability" explícito no mock, então
// usamos a severidade como base (vulnerabilidades críticas/altas tendem a ter exploits públicos
// mais acessíveis) e damos um pequeno ajuste conforme o próprio CVSS dentro da faixa da severidade.
function probabilityFromVuln(v: Vulnerability): number {
 const base = baseProbabilityBySeverity[v.severity] ?? 2
 const adjust = v.cvss >= 9 ? 1 : 0
 return Math.min(5, Math.max(1, base + (adjust && base < 5 ? 1 : 0) - (base + 1 > 5 ? 1 : 0)))
}

function severityClass(sev: string): string {
 return sev.toLowerCase().replace('í', 'i').replace('é', 'e')
}

export default function VulnerabilitiesPage(){
 const { t } = useI18n()
 const { isFavorite, toggleFavorite } = useFavorites()
 const { canEdit } = useRole()
 const [items,setItems]=useState(initial),[query,setQuery]=useState(''),[severity,setSeverity]=useState('Todas')
 const [selected,setSelected]=useState<string[]>([])
 const [sort,setSort]=useState<{key:SortKey;dir:1|-1}|null>(null)
 const [detail,setDetail]=useState<Vulnerability|null>(null)
 const [tab,setTab]=useState<ExtraTab>('table')

 const visible=useMemo(()=>{
  const filtered=items.filter(v=>(severity==='Todas'||v.severity===severity)&&(`${v.cve} ${v.package} ${v.asset}`).toLowerCase().includes(query.toLowerCase()))
  if(!sort)return filtered
  const {key,dir}=sort
  return [...filtered].sort((a,b)=>{
   const av=key==='severity'?severityRank[a.severity]:key==='cvss'?a.cvss:a.due
   const bv=key==='severity'?severityRank[b.severity]:key==='cvss'?b.cvss:b.due
   if(av<bv)return -1*dir
   if(av>bv)return 1*dir
   return 0
  })
 },[items,query,severity,sort])

 const resolve=(id:string)=>setItems(v=>v.map(i=>i.id===id?{...i,status:'Resolvida' as Vulnerability['status']}:i))
 const accept=(id:string)=>setItems(v=>v.map(i=>i.id===id?{...i,status:'Aceita' as Vulnerability['status']}:i))
 const toggleSort=(key:SortKey)=>setSort(s=>s?.key===key?(s.dir===1?{key,dir:-1}:null):{key,dir:1})
 const toggleSelect=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])
 const toggleSelectAll=()=>setSelected(s=>s.length===visible.length?[]:visible.map(v=>v.id))
 const resolveSelected=()=>{setItems(v=>v.map(i=>selected.includes(i.id)?{...i,status:'Resolvida' as Vulnerability['status']}:i));setSelected([])}

 const exportCsv=()=>{
  const header='cve,package,asset,severity,cvss,status,due'
  const rows=visible.map(v=>[v.cve,v.package,v.asset,v.severity,v.cvss,v.status,v.due].join(','))
  download('vulnerabilidades.csv',[header,...rows].join('\n'))
 }

 // --- Vinculação de CVE a ativos/serviços afetados ---
 const linkedFor = (v: Vulnerability | null) => {
  if (!v) return { relatedAssets: [], relatedServices: [] }
  return {
   relatedAssets: assets.filter(a => fuzzyMatch(a.name, v.asset) || fuzzyMatch(a.type, v.asset)),
   relatedServices: serviceNodes.filter(s => fuzzyMatch(s.id, v.asset)),
  }
 }
 const { relatedAssets, relatedServices } = linkedFor(detail)

 // --- Matriz de risco (impacto x probabilidade) ---
 const matrixCells = useMemo(() => {
  const grid: Vulnerability[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [] as Vulnerability[]))
  items.forEach(v => {
   const impact = impactFromCvss(v.cvss)
   const prob = probabilityFromVuln(v)
   grid[impact - 1][prob - 1].push(v)
  })
  return grid
 }, [items])

 // --- Linha do tempo de remediação (SLA) ---
 const timelineRows = useMemo(() => items.map(v => {
  const slaDays = slaDaysBySeverity[v.severity] ?? 30
  const detectedAt = detectedAtById[v.id] ? new Date(detectedAtById[v.id]) : new Date()
  const now = new Date('2026-07-07T12:00:00')
  const elapsedMs = now.getTime() - detectedAt.getTime()
  const slaMs = slaDays * 24 * 60 * 60 * 1000
  const ratio = Math.max(0, elapsedMs / slaMs)
  const remainingRatio = 1 - ratio
  let tone: 'ok' | 'warn' | 'danger' = 'ok'
  if (v.status !== 'Resolvida') {
   if (ratio >= 1) tone = 'danger'
   else if (remainingRatio < 0.2) tone = 'warn'
  }
  return { v, slaDays, elapsedDays: Math.max(0, Math.round(elapsedMs / 86400000)), ratio: Math.min(1, ratio), tone }
 }), [items])

 // --- Geração de relatório de compliance ---
 const generateReport = () => {
  const counts: Record<string, number> = {}
  items.forEach(v => { counts[v.severity] = (counts[v.severity] ?? 0) + 1 })
  const rows = items.map(v => `<tr><td>${v.cve}</td><td>${v.severity}</td><td>${v.cvss}</td><td>${v.asset}</td><td>${v.status}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${t('vulnerabilities.report.title')}</title>
  <style>body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px 10px;font-size:12px;text-align:left}th{background:#f0f0f0}.summary{display:flex;gap:20px;margin:18px 0}.summary div{padding:12px 16px;border:1px solid #ccc;border-radius:8px}</style>
  </head><body>
  <h1>${t('vulnerabilities.report.heading')}</h1>
  <p>${t('vulnerabilities.report.generatedAt')} ${new Date().toLocaleString('pt-BR')} · OpsPhere</p>
  <h2>${t('vulnerabilities.report.execSummary')}</h2>
  <div class="summary">${Object.entries(counts).map(([sev, n]) => `<div><strong>${n}</strong><br/>${sev}</div>`).join('')}<div><strong>${items.length}</strong><br/>${t('vulnerabilities.report.total')}</div></div>
  <h2>${t('vulnerabilities.report.details')}</h2>
  <table><thead><tr><th>${t('vulnerabilities.report.cve')}</th><th>${t('vulnerabilities.report.severity')}</th><th>${t('vulnerabilities.report.cvss')}</th><th>${t('vulnerabilities.report.asset')}</th><th>${t('vulnerabilities.report.status')}</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
   const a = document.createElement('a')
   a.href = url; a.download = 'relatorio-compliance-vulnerabilidades.html'; a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000)
 }

 return <><PageHeader eyebrow={t('vulnerabilities.eyebrow')} title={t('vulnerabilities.title')} description={t('vulnerabilities.description')} actions={<>
  <button className="button" onClick={exportCsv}><Download size={16}/> {t('vulnerabilities.exportCsv')}</button>
  <button className="button button--primary"><ShieldCheck size={16}/> {t('vulnerabilities.startScan')}</button>
 </>}/>
 <section className="metric-grid"><MetricCard label={t('vulnerabilities.metric.criticalOpen')} value="12" delta="-4" tone="critical"/><MetricCard label={t('vulnerabilities.metric.totalRisk')} value="72 / 100" delta="-6" tone="warning"/><MetricCard label={t('vulnerabilities.metric.mttr')} value="3,8 dias" delta="-18%"/><MetricCard label={t('vulnerabilities.metric.scanCoverage')} value="97,4%" delta="+1,2%" tone="healthy"/></section>

 <div className="vuln-extra-tabs">
  <button className={tab==='table'?'is-active':''} onClick={()=>setTab('table')}><ShieldCheck size={13}/> {t('vulnerabilities.tab.table')}</button>
  <button className={tab==='matrix'?'is-active':''} onClick={()=>setTab('matrix')}><Gauge size={13}/> {t('vulnerabilities.tab.matrix')}</button>
  <button className={tab==='timeline'?'is-active':''} onClick={()=>setTab('timeline')}><Timer size={13}/> {t('vulnerabilities.tab.timeline')}</button>
  <button className={tab==='compliance'?'is-active':''} onClick={()=>setTab('compliance')}><FileText size={13}/> {t('vulnerabilities.tab.compliance')}</button>
 </div>

 {tab==='table' && <section className="panel table-panel"><div className="table-toolbar"><label className="search-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('vulnerabilities.searchPlaceholder')}/></label><Filter size={16}/><select value={severity} onChange={e=>setSeverity(e.target.value)}><option>Todas</option><option>Crítica</option><option>Alta</option><option>Média</option><option>Baixa</option></select></div>
 {selected.length>0&&<div className="bulk-bar"><span>{selected.length} {t('vulnerabilities.selectedCount')}</span><button className="button button--tiny" disabled={!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={resolveSelected}><CheckCircle2 size={13}/> {t('vulnerabilities.resolveSelected')}</button><button className="button button--tiny" onClick={()=>setSelected([])}>{t('vulnerabilities.clearSelection')}</button></div>}
 <div className="vuln-table data-table"><div className="data-table__head"><span><input type="checkbox" className="vuln-checkbox" checked={selected.length>0&&selected.length===visible.length} onChange={toggleSelectAll}/> {t('vulnerabilities.table.vulnerability')}</span><span>{t('vulnerabilities.table.asset')}</span><span className="sortable-head" onClick={()=>toggleSort('severity')}>{t('vulnerabilities.table.severity')} {sort?.key==='severity'?(sort.dir===1?'▲':'▼'):''}</span><span className="sortable-head" onClick={()=>toggleSort('cvss')}>{t('vulnerabilities.table.cvss')} {sort?.key==='cvss'?(sort.dir===1?'▲':'▼'):''}</span><span>{t('vulnerabilities.table.status')}</span><span className="sortable-head" onClick={()=>toggleSort('due')}>{t('vulnerabilities.table.sla')} {sort?.key==='due'?(sort.dir===1?'▲':'▼'):''}</span><span/></div>
 {visible.map(v=><div className="data-table__row" key={v.id}>
  <span><input type="checkbox" className="vuln-checkbox" checked={selected.includes(v.id)} onChange={()=>toggleSelect(v.id)} onClick={e=>e.stopPropagation()}/><span onClick={()=>setDetail(v)} style={{cursor:'pointer'}}><strong>{v.cve}</strong><small>{v.package}</small></span></span>
  <span>{v.asset}</span>
  <span><Badge tone={v.severity}>{v.severity}</Badge></span>
  <span><b className={`cvss cvss--${v.severity.toLowerCase().replace('í','i')}`}>{v.cvss}</b></span>
  <span>{v.status}</span>
  <span className={v.due==='Hoje'?'text-danger':''}>{v.due}</span>
  <span style={{display:'flex',gap:6,alignItems:'center'}}>
   <button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: v.id, module: 'vulnerabilities', label: `${v.cve} · ${v.asset}` })}><Star fill={isFavorite('vulnerabilities', v.id) ? 'currentColor' : 'none'} size={14}/></button>
   <button disabled={v.status==='Resolvida'||!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} className="button button--tiny" onClick={()=>resolve(v.id)}>{v.status==='Resolvida'?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>} {v.status==='Resolvida'?t('vulnerabilities.action.resolved'):t('vulnerabilities.action.resolve')}</button>
  </span>
 </div>)}</div></section>}

 {tab==='matrix' && <section className="panel risk-matrix-wrap">
  <div className="risk-matrix">
   {[5,4,3,2,1].flatMap(impact => [
    <div className="risk-matrix-row-label" key={`label-${impact}`}>{impact}</div>,
    ...[1,2,3,4,5].map(prob => (
     <div className="risk-matrix-cell" data-cell={`${impact}·${prob}`} key={`${impact}-${prob}`}>
      {matrixCells[impact-1][prob-1].map(v => <span key={v.id} className={`risk-dot risk-dot--${severityClass(v.severity)}${detail?.id===v.id?' is-selected':''}`} title={`${v.cve} · ${v.severity} · CVSS ${v.cvss}`} onClick={()=>setDetail(v)}>{v.cvss.toFixed(0)}</span>)}
     </div>
    )),
   ])}
  </div>
  <div className="risk-matrix-axis-x"><span/>{[1,2,3,4,5].map(p=><span key={p}>{p}</span>)}</div>
  <p className="risk-matrix-hint">{t('vulnerabilities.riskMatrix.hint')}</p>
  <div className="risk-matrix-legend">
   <span><i style={{background:'#ef5a76'}}/> {t('vulnerabilities.riskMatrix.critical')}</span>
   <span><i style={{background:'#f2a33f'}}/> {t('vulnerabilities.riskMatrix.high')}</span>
   <span><i style={{background:'#5b8bf2'}}/> {t('vulnerabilities.riskMatrix.medium')}</span>
   <span><i style={{background:'#6ce5c4'}}/> {t('vulnerabilities.riskMatrix.low')}</span>
  </div>
 </section>}

 {tab==='timeline' && <section className="panel table-panel">
  <div className="timeline-gantt">
   {timelineRows.map(row => <div className="timeline-gantt-row" key={row.v.id}>
    <div><strong>{row.v.cve}</strong><small>{row.v.package} · {row.v.asset}</small></div>
    <div><Badge tone={row.v.severity}>{row.v.severity}</Badge></div>
    <div>
     <div className="timeline-gantt-track"><div className={`timeline-gantt-fill timeline-gantt-fill--${row.tone}`} style={{width:`${Math.round(row.ratio*100)}%`}}/></div>
     <div className="timeline-gantt-label">{row.elapsedDays}{t('vulnerabilities.timeline.elapsed')} {row.slaDays}{t('vulnerabilities.timeline.slaSuffix')} {row.tone==='danger'?`· ${t('vulnerabilities.timeline.overdue')}`:row.tone==='warn'?`· ${t('vulnerabilities.timeline.dueSoon')}`:''}</div>
    </div>
   </div>)}
  </div>
 </section>}

 {tab==='compliance' && <section className="panel">
  <div className="compliance-toolbar"><button className="button button--primary" onClick={generateReport}><FileText size={16}/> {t('vulnerabilities.compliance.generateReport')}</button></div>
  <div className="attribute-table" style={{margin:'0 16px 16px'}}>
   {Object.entries(items.reduce<Record<string,number>>((acc,v)=>{acc[v.severity]=(acc[v.severity]??0)+1;return acc},{})).map(([sev,n])=><div key={sev}><code>{sev}</code><span>{n} {t('vulnerabilities.compliance.countSuffix')}</span></div>)}
  </div>
 </section>}

 {detail&&<Modal title={detail.cve} onClose={()=>setDetail(null)}>
  <div className="vuln-detail">
   <dl>
    <dt>{t('vulnerabilities.detail.package')}</dt><dd>{detail.package}</dd>
    <dt>{t('vulnerabilities.detail.asset')}</dt><dd>{detail.asset}</dd>
    <dt>{t('vulnerabilities.detail.severity')}</dt><dd><Badge tone={detail.severity}>{detail.severity}</Badge></dd>
    <dt>{t('vulnerabilities.detail.cvss')}</dt><dd>{detail.cvss}</dd>
    <dt>{t('vulnerabilities.detail.status')}</dt><dd>{detail.status}</dd>
    <dt>{t('vulnerabilities.detail.sla')}</dt><dd>{detail.due}</dd>
   </dl>
   <div className="link-panel">
    <div className="link-panel-group">
     <h5><Link2 size={12}/> {t('vulnerabilities.detail.relatedAssets')}</h5>
     {relatedAssets.length>0?relatedAssets.map(a=><div className="link-panel-item" key={a.id}><span>{a.name}</span><small>{a.type} · {a.owner}</small></div>):<div className="link-panel-empty">{t('vulnerabilities.detail.noAssetMatch')}</div>}
    </div>
    <div className="link-panel-group">
     <h5><Link2 size={12}/> {t('vulnerabilities.detail.relatedServices')}</h5>
     {relatedServices.length>0?relatedServices.map(s=><div className="link-panel-item" key={s.id}><span>{s.id}</span><small>{s.group}{s.health?` · ${s.health}`:''}</small></div>):<div className="link-panel-empty">{t('vulnerabilities.detail.noServiceMatch')}</div>}
    </div>
   </div>
   <div className="modal-actions">
    <button className="button" disabled={detail.status==='Aceita'||detail.status==='Resolvida'||!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>{accept(detail.id);setDetail(null)}}><ShieldOff size={14}/> {t('vulnerabilities.detail.acceptRisk')}</button>
    <button className="button button--primary" disabled={detail.status==='Resolvida'||!canEdit} title={!canEdit ? 'Ação bloqueada no modo visualizador' : undefined} onClick={()=>{resolve(detail.id);setDetail(null)}}><CheckCircle2 size={14}/> {t('vulnerabilities.detail.markResolved')}</button>
   </div>
  </div>
 </Modal>}
 </>
}
