import { Calendar, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'

const teams=[{name:'Platform Core',people:8,allocated:92,work:['Migração EKS','Observabilidade']},{name:'Commerce',people:11,allocated:84,work:['Checkout v3','PIX recorrente']},{name:'Data Platform',people:7,allocated:68,work:['Lakehouse','Data quality']},{name:'IAM & Security',people:6,allocated:106,work:['Passkeys','SOC 2']},{name:'Developer Experience',people:5,allocated:76,work:['CLI v2','Golden paths']}]
export default function CapacityPage(){
 const [week,setWeek]=useState(0)
 return <><PageHeader eyebrow="PLANEJAMENTO" title="Capacidade & alocação" description="Equilibre demanda, disponibilidade e foco das equipes." actions={<div className="week-picker"><button onClick={()=>setWeek(w=>w-1)}><ChevronLeft/></button><Calendar/><span>{week===0?'Esta semana':week>0?`+${week} semana${week>1?'s':''}`:`${week} semana${week<-1?'s':''}`}</span><button onClick={()=>setWeek(w=>w+1)}><ChevronRight/></button></div>}/>
 <section className="metric-grid"><MetricCard label="Pessoas" value="37" hint="5 equipes"/><MetricCard label="Capacidade total" value="1.480h" delta="+40h"/><MetricCard label="Alocação média" value="84%" tone="healthy"/><MetricCard label="Sobrealocados" value="4" tone="critical" hint="em 2 equipes"/></section>
 <section className="capacity-grid"><article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">ALOCação POR EQUIPE</span><h2>Carga planejada</h2></div><span className="legend-inline"><i className="dot dot--success"/> Ideal 70–90%</span></div>
 <div className="team-capacity">{teams.map(team=><div key={team.name}><div className="team-capacity__info"><span className="team-avatar"><Users/></span><div><strong>{team.name}</strong><small>{team.people} pessoas · {team.work.join(' / ')}</small></div><b className={team.allocated>100?'text-danger':''}>{team.allocated}%</b></div><div className="capacity-track"><i className={team.allocated>100?'is-over':''} style={{width:`${Math.min(team.allocated,100)}%`}}/><span style={{left:'90%'}}/></div></div>)}</div></article>
 <article className="panel"><div className="panel__header"><div><span className="eyebrow">DISTRIBUIÇÃO</span><h2>Por categoria</h2></div></div><BarChart suffix="%" data={[{label:'Roadmap',value:48},{label:'Operações',value:22,color:'#8097ff'},{label:'Dívida técnica',value:18,color:'#f8c56a'},{label:'Incidentes',value:8,color:'#ff7082'},{label:'Disponível',value:4,color:'#8693a5'}]}/><div className="insight"><Users size={16}/><span>IAM & Security precisa de <strong>+1 pessoa</strong> para normalizar a carga.</span></div></article></section></>
}
