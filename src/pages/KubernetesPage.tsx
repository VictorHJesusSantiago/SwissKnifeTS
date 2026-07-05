import { Box, CheckCircle2, Cpu, MoreHorizontal, RotateCw, Server } from 'lucide-react'
import { useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { DonutChart } from '../components/charts/DonutChart'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'

const pods=[['checkout-api-7fd8c','commerce','Running','230m','412Mi','2'],['payments-5db77','finance','Running','410m','688Mi','0'],['catalog-6c8b9','commerce','Running','180m','356Mi','1'],['identity-8fd42','platform','Pending','—','—','0'],['worker-queue-4ab22','jobs','CrashLoop','120m','228Mi','12']]
export default function KubernetesPage(){
 const [refreshing,setRefreshing]=useState(false),[cluster,setCluster]=useState('prod-sa-east-1')
 const refresh=()=>{setRefreshing(true);setTimeout(()=>setRefreshing(false),900)}
 return <><PageHeader eyebrow="ORQUESTRAÇÃO" title="Saúde do Kubernetes" description="Visibilidade operacional dos clusters, nodes e workloads." actions={<><select value={cluster} onChange={e=>setCluster(e.target.value)}><option>prod-sa-east-1</option><option>staging-us-east-1</option></select><button className="button" onClick={refresh}><RotateCw className={refreshing?'spin':''} size={16}/> Atualizar</button></>}/>
 <section className="metric-grid"><MetricCard label="Saúde do cluster" value="98,6%" tone="healthy"/><MetricCard label="Nodes" value="18 / 18" hint="prontos"/><MetricCard label="Pods" value="284 / 288" hint="4 com atenção" tone="warning"/><MetricCard label="Reinícios (24h)" value="18" delta="-32%"/></section>
 <section className="k8s-grid"><article className="panel"><div className="panel__header"><div><span className="eyebrow">RECURSOS DO CLUSTER</span><h2>Utilização</h2></div><Cpu size={18}/></div><div className="donut-pair"><DonutChart value={68} label="CPU"/><DonutChart value={74} label="Memória" color="#8097ff"/></div><BarChart data={[{label:'CPU requests',value:62},{label:'CPU limits',value:84,color:'#8097ff'},{label:'Memory requests',value:71,color:'#f8c56a'}]} suffix="%"/></article>
 <article className="panel"><div className="panel__header"><div><span className="eyebrow">NODES</span><h2>Distribuição</h2></div><Server size={18}/></div><div className="node-grid">{Array.from({length:18},(_,i)=><div className={i===14?'has-warning':''} key={i}><Server size={17}/><strong>node-{String(i+1).padStart(2,'0')}</strong><span>{i===14?'82% CPU':`${35+i%6*7}% CPU`}</span></div>)}</div></article></section>
 <article className="panel table-panel"><div className="panel__header"><div><span className="eyebrow">WORKLOADS</span><h2>Pods que exigem atenção</h2></div><span className="text-success"><CheckCircle2 size={15}/> Monitoramento ativo</span></div><div className="data-table"><div className="data-table__head"><span>Pod</span><span>Namespace</span><span>Status</span><span>CPU</span><span>Memória</span><span>Restarts</span><span/></div>{pods.map(p=><div className="data-table__row" key={p[0]}><span><Box size={15}/><strong>{p[0]}</strong></span><span>{p[1]}</span><span><i className={`dot dot--${p[2]==='Running'?'success':p[2]==='Pending'?'warning':'danger'}`}/>{p[2]}</span><span>{p[3]}</span><span>{p[4]}</span><span>{p[5]}</span><button className="icon-button"><MoreHorizontal size={16}/></button></div>)}</div></article></>
}
