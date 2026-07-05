import { Download, Pause, Play, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { logs } from '../data/mockData'

export default function LogsPage() {
  const [query,setQuery]=useState(''), [level,setLevel]=useState('TODOS'), [live,setLive]=useState(true)
  const filtered=useMemo(()=>logs.filter(log=>(level==='TODOS'||log.level===level)&&(`${log.message} ${log.service} ${log.trace}`.toLowerCase().includes(query.toLowerCase()))),[query,level])
  const exportLogs=()=>{const blob=new Blob([filtered.map(l=>`${l.timestamp} ${l.level} [${l.service}] ${l.message}`).join('\n')],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='opsphere-logs.txt';a.click();URL.revokeObjectURL(a.href)}
  return <>
    <PageHeader eyebrow="OBSERVABILIDADE" title="Explorador de logs" description="Pesquise e correlacione eventos de todos os serviços em tempo real." actions={<button className="button" onClick={exportLogs}><Download size={16}/> Exportar</button>}/>
    <section className="logs-toolbar panel"><label className="search-input"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar mensagem, serviço ou trace ID..."/>{query&&<button onClick={()=>setQuery('')}><Trash2 size={15}/></button>}</label>
      <select value={level} onChange={e=>setLevel(e.target.value)}><option>TODOS</option><option>ERROR</option><option>WARN</option><option>INFO</option><option>DEBUG</option></select>
      <select><option>Todos os serviços</option><option>gateway</option><option>checkout-api</option></select>
      <button className={`button button--compact ${live?'button--live':''}`} onClick={()=>setLive(!live)}>{live?<Pause size={14}/>:<Play size={14}/>} {live?'Pausar stream':'Retomar stream'}</button>
    </section>
    <div className="log-summary"><span><strong>{filtered.length}</strong> eventos encontrados</span><span className={live?'text-success':''}><i className="pulse-dot"/> {live?'Recebendo eventos':'Stream pausado'}</span><span>Janela: últimos 60 min</span></div>
    <section className="log-console">{filtered.length?filtered.map(log=><div className="log-row" key={log.id}><time>{log.timestamp}</time><Badge tone={log.level}>{log.level}</Badge><strong>[{log.service}]</strong><span>{log.message}</span><button onClick={()=>setQuery(log.trace)}>{log.trace}</button></div>):<EmptyState message="Nenhum log corresponde à busca"/>}</section>
  </>
}
