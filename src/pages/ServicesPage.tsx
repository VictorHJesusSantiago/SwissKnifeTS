import { Activity, ArrowUpRight, Box, Radio } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ForceGraph } from '../components/graph/ForceGraph'
import { PageHeader } from '../components/ui/PageHeader'
import { serviceLinks, serviceNodes } from '../data/mockData'
import type { GraphNode } from '../types'

export default function ServicesPage(){
 const [selected,setSelected]=useState<GraphNode>(serviceNodes[2]),[environment,setEnvironment]=useState('Produção')
 const select=useCallback((node:GraphNode)=>setSelected(node),[])
 const incoming=serviceLinks.filter(l=>l.target===selected.id).length,outgoing=serviceLinks.filter(l=>l.source===selected.id).length
 return <><PageHeader eyebrow="ARQUITETURA" title="Mapa de microsserviços" description="Entenda dependências, fluxo de tráfego e impacto entre serviços." actions={<select value={environment} onChange={e=>setEnvironment(e.target.value)}><option>Produção</option><option>Staging</option></select>}/>
 <section className="graph-layout"><article className="panel graph-panel"><div className="graph-toolbar"><span><i className="dot dot--success"/>Saudável</span><span><i className="dot dot--warning"/>Degradado</span><span><i className="dot dot--danger"/>Crítico</span><span className="push-right"><Radio size={14}/> Tráfego ao vivo</span></div><ForceGraph nodes={serviceNodes} links={serviceLinks} onSelect={select}/></article>
 <aside className="panel service-detail"><div className="resource-icon"><Box/></div><span className="eyebrow">SERVIÇO</span><h2>{selected.id}</h2><span className={`health-label health-label--${selected.health}`}><i/>{selected.health==='healthy'?'Saudável':selected.health==='warning'?'Degradado':'Crítico'}</span><div className="service-kpis"><div><span>Requests/min</span><strong>{selected.id==='checkout'?'18.420':'8.210'}</strong></div><div><span>Erro</span><strong className={selected.health==='critical'?'text-danger':''}>{selected.health==='critical'?'8,4%':'0,12%'}</strong></div><div><span>P95</span><strong>{selected.health==='critical'?'842ms':'118ms'}</strong></div><div><span>Versão</span><strong>v2.14.3</strong></div></div><div className="dependency-counts"><span><ArrowUpRight/> {outgoing} dependências</span><span><Activity/> {incoming} consumidores</span></div><button className="button button--full">Abrir observabilidade</button></aside></section></>
}
