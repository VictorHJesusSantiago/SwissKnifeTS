import { AlertTriangle, CheckCircle2, Filter, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { vulnerabilities as initial } from '../data/mockData'
import type { Vulnerability } from '../types'

export default function VulnerabilitiesPage(){
 const [items,setItems]=useState(initial),[query,setQuery]=useState(''),[severity,setSeverity]=useState('Todas')
 const visible=useMemo(()=>items.filter(v=>(severity==='Todas'||v.severity===severity)&&(`${v.cve} ${v.package} ${v.asset}`).toLowerCase().includes(query.toLowerCase())),[items,query,severity])
 const resolve=(id:string)=>setItems(v=>v.map(i=>i.id===id?{...i,status:'Resolvida' as Vulnerability['status']}:i))
 return <><PageHeader eyebrow="SEGURANÇA" title="Gestão de vulnerabilidades" description="Priorize riscos com contexto de negócio e acompanhe a remediação." actions={<button className="button button--primary"><ShieldCheck size={16}/> Iniciar varredura</button>}/>
 <section className="metric-grid"><MetricCard label="Críticas abertas" value="12" delta="-4" tone="critical"/><MetricCard label="Risco total" value="72 / 100" delta="-6" tone="warning"/><MetricCard label="MTTR" value="3,8 dias" delta="-18%"/><MetricCard label="Cobertura de scan" value="97,4%" delta="+1,2%" tone="healthy"/></section>
 <section className="panel table-panel"><div className="table-toolbar"><label className="search-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar CVE, pacote ou ativo..."/></label><Filter size={16}/><select value={severity} onChange={e=>setSeverity(e.target.value)}><option>Todas</option><option>Crítica</option><option>Alta</option><option>Média</option><option>Baixa</option></select></div>
 <div className="vuln-table data-table"><div className="data-table__head"><span>Vulnerabilidade</span><span>Ativo</span><span>Severidade</span><span>CVSS</span><span>Status</span><span>SLA</span><span/></div>{visible.map(v=><div className="data-table__row" key={v.id}><span><strong>{v.cve}</strong><small>{v.package}</small></span><span>{v.asset}</span><span><Badge tone={v.severity}>{v.severity}</Badge></span><span><b className={`cvss cvss--${v.severity.toLowerCase().replace('í','i')}`}>{v.cvss}</b></span><span>{v.status}</span><span className={v.due==='Hoje'?'text-danger':''}>{v.due}</span><button disabled={v.status==='Resolvida'} className="button button--tiny" onClick={()=>resolve(v.id)}>{v.status==='Resolvida'?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>} {v.status==='Resolvida'?'Resolvida':'Resolver'}</button></div>)}</div></section></>
}
