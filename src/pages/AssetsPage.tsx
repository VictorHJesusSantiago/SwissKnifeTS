import { Boxes, Laptop, Plus, Search, Smartphone, Wifi } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { assets as initial } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { Asset } from '../types'
import { formatCurrency } from '../utils/format'

export default function AssetsPage(){
 const [assets,setAssets]=useLocalStorage<Asset[]>('opsphere-assets',initial),[query,setQuery]=useState(''),[modal,setModal]=useState(false)
 const [form,setForm]=useState({name:'',type:'Notebook',owner:'',location:''})
 const visible=useMemo(()=>assets.filter(a=>`${a.name} ${a.id} ${a.owner}`.toLowerCase().includes(query.toLowerCase())),[assets,query])
 const create=()=>{if(!form.name)return;setAssets(v=>[{id:`AT-${1030+v.length}`,name:form.name,type:form.type,owner:form.owner||'—',status:'Ativo',location:form.location||'São Paulo',value:0,warranty:'—'},...v]);setModal(false)}
 const icon=(type:string)=>type==='Notebook'?<Laptop/>:type==='Mobile'?<Smartphone/>:type==='Rede'?<Wifi/>:<Boxes/>
 return <><PageHeader eyebrow="IT ASSET MANAGEMENT" title="Ativos de TI" description="Controle o ciclo de vida, propriedade e custos dos ativos." actions={<button className="button button--primary" onClick={()=>setModal(true)}><Plus size={16}/> Cadastrar ativo</button>}/>
 <section className="asset-summary"><div><span>Valor total dos ativos</span><strong>{formatCurrency(assets.reduce((s,a)=>s+a.value,0))}</strong></div><div><span>Ativos em uso</span><strong>{assets.filter(a=>a.status==='Ativo').length}</strong></div><div><span>Em manutenção</span><strong>{assets.filter(a=>a.status==='Manutenção').length}</strong></div><div><span>Garantias vencendo</span><strong>7</strong></div></section>
 <section className="panel table-panel"><div className="table-toolbar"><label className="search-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ativo, etiqueta ou responsável..."/></label><select><option>Todos os tipos</option><option>Notebook</option><option>Rede</option><option>Mobile</option></select></div><div className="asset-table data-table"><div className="data-table__head"><span>Ativo</span><span>Responsável</span><span>Status</span><span>Local</span><span>Valor</span><span>Garantia</span></div>{visible.map(a=><div className="data-table__row" key={a.id}><span><i className="asset-icon">{icon(a.type)}</i><span><strong>{a.name}</strong><small>{a.id} · {a.type}</small></span></span><span>{a.owner}</span><span><Badge tone={a.status}>{a.status}</Badge></span><span>{a.location}</span><span>{formatCurrency(a.value)}</span><span>{a.warranty}</span></div>)}</div></section>
 {modal&&<Modal title="Cadastrar ativo" onClose={()=>setModal(false)}><div className="form-grid"><label className="span-2">Nome do ativo<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Fabricante e modelo"/></label><label>Tipo<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Notebook</option><option>Mobile</option><option>Rede</option><option>Segurança</option></select></label><label>Responsável<input value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}/></label><label className="span-2">Localização<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><div className="form-actions span-2"><button className="button" onClick={()=>setModal(false)}>Cancelar</button><button className="button button--primary" onClick={create}>Cadastrar</button></div></div></Modal>}</>
}
