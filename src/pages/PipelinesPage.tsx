import { Check, ChevronDown, Circle, Clock3, GitBranch, Play, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { pipelines as source } from '../data/mockData'
import type { Pipeline } from '../types'

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState(source)
  const [selected, setSelected] = useState<Pipeline | null>(source[1])
  const [running, setRunning] = useState(false)
  const runPipeline = () => {
    setRunning(true)
    const newRun: Pipeline = { ...source[0], id: Date.now(), name:'manual-deploy', owner:'Você', status:'running', updated:'agora', stages: source[1].stages }
    setPipelines(p => [newRun, ...p])
    setSelected(newRun)
    window.setTimeout(() => {
      setPipelines(p => p.map(item => item.id===newRun.id ? {...item,status:'success',duration:'3m 41s',stages:item.stages.map(s=>({...s,status:'success'}))}:item))
      setSelected(prev => prev?.id===newRun.id ? {...newRun,status:'success',duration:'3m 41s',stages:newRun.stages.map(s=>({...s,status:'success'}))}:prev)
      setRunning(false)
    }, 2400)
  }
  return <>
    <PageHeader eyebrow="ENTREGA CONTÍNUA" title="Pipelines CI/CD" description="Acompanhe a velocidade, confiabilidade e execução das suas entregas." actions={<button disabled={running} className="button button--primary" onClick={runPipeline}>{running?<RefreshCw className="spin" size={16}/>:<Play size={16}/>} {running?'Iniciando...':'Executar pipeline'}</button>}/>
    <section className="metric-grid"><MetricCard label="Taxa de sucesso" value="94,2%" delta="+1,8%"/><MetricCard label="Lead time médio" value="8m 42s" delta="-12%"/><MetricCard label="Execuções / 24h" value="128" delta="+18%"/><MetricCard label="Falhas" value="7" delta="-3" tone="warning"/></section>
    <section className="split-layout">
      <article className="panel list-panel"><div className="panel__header"><div><span className="eyebrow">EXECUÇÕES</span><h2>Atividade recente</h2></div><button className="filter-button">Todos <ChevronDown size={14}/></button></div>
        {pipelines.map(p=><button className={`pipeline-row ${selected?.id===p.id?'is-selected':''}`} key={p.id} onClick={()=>setSelected(p)}>
          <span className={`pipeline-status pipeline-status--${p.status}`}>{p.status==='success'?<Check/>:p.status==='failed'?<X/>:p.status==='running'?<RefreshCw className="spin"/>:<Circle/>}</span>
          <span className="grow"><strong>{p.name}</strong><small><GitBranch size={12}/>{p.branch} · {p.owner}</small></span><span><strong>{p.duration}</strong><small>{p.updated}</small></span>
        </button>)}
      </article>
      <article className="panel detail-panel">{selected && <>
        <div className="panel__header"><div><Badge tone={selected.status}>{selected.status}</Badge><h2>{selected.name}</h2><p>#{selected.id} · {selected.branch}</p></div><button className="icon-button" onClick={runPipeline}><RotateCcw size={17}/></button></div>
        <div className="pipeline-timeline">{selected.stages.map((stage,i)=><div className={`timeline-step timeline-step--${stage.status}`} key={stage.name}>
          <div className="timeline-step__rail"><span>{stage.status==='success'?<Check/>:stage.status==='failed'?<X/>:stage.status==='running'?<RefreshCw className="spin"/>:<Clock3/>}</span>{i<selected.stages.length-1&&<i/>}</div>
          <div><strong>{stage.name}</strong><small>{stage.duration}</small><p>{stage.status==='success'?'Etapa concluída sem erros.':stage.status==='failed'?'Testes unitários falharam no shard 4.':stage.status==='running'?'Executando análise de dependências...':'Aguardando etapa anterior.'}</p></div>
        </div>)}</div>
        <div className="code-log"><span>$ pipeline run --branch {selected.branch}</span><span>✓ checkout concluído</span><span>✓ dependências restauradas</span><span className={selected.status==='failed'?'log-error':''}>{selected.status==='failed'?'✕ 3 testes falharam':'✓ validações concluídas'}</span></div>
      </>}</article>
    </section>
  </>
}
