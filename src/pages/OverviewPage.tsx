import { ArrowRight, CheckCircle2, Clock3, Server, ShieldAlert, Zap } from 'lucide-react'
import { BarChart } from '../components/charts/BarChart'
import { DonutChart } from '../components/charts/DonutChart'
import { Sparkline } from '../components/charts/Sparkline'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { pipelines } from '../data/mockData'
import type { ModuleId } from '../types'

export default function OverviewPage({ onNavigate = () => undefined }: { onNavigate?: (id: ModuleId) => void }) {
  return <>
    <PageHeader eyebrow="QUARTA-FEIRA, 1 DE JULHO" title="Bom dia, Victor." description="Aqui está o pulso da sua plataforma nas últimas 24 horas." actions={<button className="button button--primary" onClick={() => onNavigate('tickets')}>Abrir incidente <ArrowRight size={16}/></button>}/>
    <section className="metric-grid">
      <MetricCard label="Disponibilidade" value="99,97%" delta="+0,04%" hint="vs. semana anterior" tone="healthy"/>
      <MetricCard label="Deploys hoje" value="47" delta="+12,8%" hint="3 em andamento" tone="info"/>
      <MetricCard label="Incidentes ativos" value="3" delta="-25%" hint="1 crítico" tone="critical"/>
      <MetricCard label="Custo projetado" value="R$ 184k" delta="+2,1%" hint="78% do orçamento" tone="warning"/>
    </section>
    <section className="dashboard-grid">
      <article className="panel panel--wide">
        <div className="panel__header"><div><span className="eyebrow">TRÁFEGO DA PLATAFORMA</span><h2>Requisições & latência</h2></div><select><option>Últimas 24 horas</option><option>7 dias</option></select></div>
        <div className="traffic-kpis"><div><span>Requisições</span><strong>12,8M</strong><Sparkline values={[22,30,27,41,36,54,51,64,60,72,68,82,77,90]}/></div><div><span>Latência P95</span><strong>182ms</strong><Sparkline values={[44,40,52,49,61,47,43,50,39,42,35,38,31,34]} color="#f8c56a"/></div></div>
        <div className="activity-chart">{[44,58,42,68,52,75,64,82,61,91,78,88,68,76,94,84,70,89,74,96,81,87,72,80].map((v,i)=><i key={i} style={{height:`${v}%`}}/>)}</div>
        <div className="chart-axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>Agora</span></div>
      </article>
      <article className="panel"><div className="panel__header"><div><span className="eyebrow">SAÚDE GLOBAL</span><h2>Serviços</h2></div><button className="link-button" onClick={() => onNavigate('services')}>Ver mapa</button></div>
        <DonutChart value={94} label="saudáveis"/>
        <div className="legend-list"><span><i className="dot dot--success"/>31 saudáveis</span><span><i className="dot dot--warning"/>2 degradados</span><span><i className="dot dot--danger"/>1 indisponível</span></div>
      </article>
      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">ENTREGAS RECENTES</span><h2>Atividade de pipelines</h2></div><button className="link-button" onClick={() => onNavigate('pipelines')}>Ver todos <ArrowRight size={14}/></button></div>
        <div className="data-list">{pipelines.slice(0,3).map(p=><div className="data-list__row" key={p.id}><div className={`status-icon status-icon--${p.status}`}>{p.status==='success'?<CheckCircle2 size={17}/>:p.status==='running'?<Clock3 size={17}/>:<ShieldAlert size={17}/>}</div><div className="grow"><strong>{p.name}</strong><span>{p.branch} · {p.owner}</span></div><Badge tone={p.status}>{p.status==='success'?'Sucesso':p.status==='running'?'Executando':'Falhou'}</Badge><time>{p.updated}</time></div>)}</div>
      </article>
      <article className="panel"><div className="panel__header"><div><span className="eyebrow">CONSUMO</span><h2>Por ambiente</h2></div><Server size={19}/></div>
        <BarChart suffix="%" data={[{label:'Produção',value:84},{label:'Staging',value:56,color:'#8097ff'},{label:'Dev',value:38,color:'#f8c56a'},{label:'Sandbox',value:22,color:'#b98aff'}]}/>
        <div className="insight"><Zap size={16}/><span><strong>Oportunidade:</strong> 12 workloads ociosos podem economizar R$ 8,4k/mês.</span></div>
      </article>
    </section>
  </>
}
