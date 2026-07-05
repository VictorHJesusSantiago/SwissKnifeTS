import { ChevronDown, ChevronRight, Cloud, Copy, FileJson, Search } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'

type Resource={id:string;type:string;provider:string;children?:Resource[];attrs?:Record<string,string>}
const tree:Resource[]=[
 {id:'module.network',type:'module',provider:'terraform',children:[{id:'aws_vpc.main',type:'aws_vpc',provider:'AWS',attrs:{cidr_block:'10.0.0.0/16',region:'sa-east-1',environment:'production'}},{id:'aws_subnet.private_a',type:'aws_subnet',provider:'AWS'},{id:'aws_nat_gateway.primary',type:'aws_nat_gateway',provider:'AWS'}]},
 {id:'module.eks',type:'module',provider:'terraform',children:[{id:'aws_eks_cluster.main',type:'aws_eks_cluster',provider:'AWS',attrs:{version:'1.31',endpoint_private_access:'true',node_groups:'3'}},{id:'aws_iam_role.cluster',type:'aws_iam_role',provider:'AWS'}]},
 {id:'module.database',type:'module',provider:'terraform',children:[{id:'aws_rds_cluster.postgres',type:'aws_rds_cluster',provider:'AWS',attrs:{engine:'aurora-postgresql',instances:'3',encrypted:'true'}}]},
]
export default function TerraformPage(){
 const [open,setOpen]=useState<string[]>(tree.map(t=>t.id)),[selected,setSelected]=useState<Resource>(tree[1].children![0]),[query,setQuery]=useState('')
 return <><PageHeader eyebrow="INFRAESTRUTURA COMO CÓDIGO" title="Terraform State" description="Inspecione recursos provisionados, relações e atributos do estado." actions={<button className="button"><FileJson size={16}/> Carregar state</button>}/>
 <section className="terraform-layout"><aside className="panel resource-tree"><label className="search-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filtrar recursos..."/></label><div className="tree-summary"><span>State: <strong>production</strong></span><span>Atualizado há 12 min</span></div>
 {tree.filter(m=>m.id.includes(query)||m.children?.some(c=>c.id.includes(query))).map(module=><div className="tree-module" key={module.id}><button onClick={()=>setOpen(o=>o.includes(module.id)?o.filter(x=>x!==module.id):[...o,module.id])}>{open.includes(module.id)?<ChevronDown/>:<ChevronRight/>}<Cloud/><strong>{module.id}</strong><span>{module.children?.length}</span></button>{open.includes(module.id)&&<div>{module.children?.map(child=><button key={child.id} className={selected.id===child.id?'is-selected':''} onClick={()=>setSelected(child)}><i/>{child.id}</button>)}</div>}</div>)}</aside>
 <article className="panel resource-detail"><div className="panel__header"><div><span className="eyebrow">RECURSO</span><h2>{selected.id}</h2><p>{selected.provider} · gerenciado</p></div><button className="icon-button" onClick={()=>navigator.clipboard?.writeText(selected.id)}><Copy size={17}/></button></div><div className="resource-visual"><Cloud size={34}/><div><strong>{selected.type}</strong><span>{selected.provider}</span></div></div><h3>Atributos</h3><div className="attribute-table">{Object.entries(selected.attrs||{id:'r-0d8f21a3',status:'available',tags:'environment=production'}).map(([key,value])=><div key={key}><code>{key}</code><span>{value}</span></div>)}</div><h3>Representação</h3><pre className="state-code">{JSON.stringify({address:selected.id,mode:'managed',type:selected.type,provider:selected.provider,values:selected.attrs||{}},null,2)}</pre></article></section></>
}
