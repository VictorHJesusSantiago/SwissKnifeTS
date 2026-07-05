import { Play, RotateCcw, Router, Wifi, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ForceGraph } from '../components/graph/ForceGraph'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import type { GraphNode } from '../types'

const nodes:GraphNode[]=[{id:'Internet',group:'edge',health:'healthy'},{id:'WAF',group:'edge',health:'healthy'},{id:'LB-Prod',group:'edge',health:'healthy'},{id:'VPC-App',group:'core',health:'healthy'},{id:'VPC-Data',group:'core',health:'warning'},{id:'NAT-01',group:'edge',health:'healthy'},{id:'DB-Primary',group:'data',health:'warning'},{id:'Redis',group:'data',health:'healthy'},{id:'VPN',group:'edge',health:'healthy'}]
const links=[{source:'Internet',target:'WAF',value:90},{source:'WAF',target:'LB-Prod',value:85},{source:'LB-Prod',target:'VPC-App',value:75},{source:'VPC-App',target:'VPC-Data',value:60},{source:'VPC-Data',target:'DB-Primary',value:70},{source:'VPC-Data',target:'Redis',value:45},{source:'VPC-App',target:'NAT-01',value:35},{source:'VPN',target:'VPC-App',value:25}]
export default function NetworkPage(){
 const [selected,setSelected]=useState<GraphNode>(nodes[4]),[packet,setPacket]=useState<string[]>([])
 const select=useCallback((n:GraphNode)=>setSelected(n),[])
 const simulate=()=>{setPacket(['Internet']);['WAF','LB-Prod','VPC-App','VPC-Data'].forEach((n,i)=>setTimeout(()=>setPacket(p=>[...p,n]),(i+1)*400))}
 return <><PageHeader eyebrow="CONECTIVIDADE" title="Topologia de rede" description="Explore os componentes, conexões e rotas da infraestrutura." actions={<><button className="button" onClick={()=>setPacket([])}><RotateCcw size={16}/> Limpar</button><button className="button button--primary" onClick={simulate}><Play size={16}/> Simular pacote</button></>}/>
 <section className="metric-grid"><MetricCard label="Dispositivos" value="42" hint="39 online"/><MetricCard label="Tráfego atual" value="8,4 Gbps" delta="+6,2%"/><MetricCard label="Perda de pacotes" value="0,03%" tone="healthy"/><MetricCard label="Latência média" value="14ms" tone="healthy"/></section>
 <section className="graph-layout"><article className="panel graph-panel"><div className="graph-toolbar"><span><i className="dot dot--success"/>Operacional</span><span><i className="dot dot--warning"/>Degradado</span><span>Scroll para zoom · arraste para mover</span></div><ForceGraph nodes={nodes} links={links} onSelect={select}/>{packet.length>0&&<div className="packet-path"><Zap size={15}/>{packet.map((p,i)=><span key={p}>{i>0&&'→'} {p}</span>)}</div>}</article>
 <aside className="panel node-detail"><div className="node-detail__icon"><Router/></div><span className="eyebrow">COMPONENTE SELECIONADO</span><h2>{selected.id}</h2><span className={`health-label health-label--${selected.health}`}><i/>{selected.health==='healthy'?'Operacional':'Degradado'}</span><dl><div><dt>Tipo</dt><dd>{selected.group}</dd></div><div><dt>IP privado</dt><dd>10.28.4.12</dd></div><div><dt>Região</dt><dd>sa-east-1</dd></div><div><dt>Throughput</dt><dd>1,8 Gbps</dd></div></dl><div className="mini-stat"><Wifi size={17}/><span><strong>14ms</strong> latência atual</span></div></aside></section></>
}
