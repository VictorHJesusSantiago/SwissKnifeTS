import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { initialTickets } from '../data/mockData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { Ticket } from '../types'

const columns: Ticket['status'][]=['Backlog','Em andamento','Revisão','Concluído']
export default function TicketsPage(){
  const [tickets,setTickets]=useLocalStorage<Ticket[]>('opsphere-tickets',initialTickets)
  const [modal,setModal]=useState(false),[query,setQuery]=useState('')
  const [form,setForm]=useState({title:'',priority:'P2' as Ticket['priority'],assignee:''})
  const visible=useMemo(()=>tickets.filter(t=>t.title.toLowerCase().includes(query.toLowerCase())||t.id.toLowerCase().includes(query.toLowerCase())),[tickets,query])
  const create=()=>{if(!form.title.trim())return;setTickets(t=>[{id:`OPS-${419+t.length}`,title:form.title,priority:form.priority,status:'Backlog',assignee:form.assignee||'Não atribuído',tags:['novo'],age:'agora'},...t]);setModal(false);setForm({title:'',priority:'P2',assignee:''})}
  const move=(ticket:Ticket,direction:number)=>{const index=columns.indexOf(ticket.status);const next=columns[Math.max(0,Math.min(3,index+direction))];setTickets(ts=>ts.map(t=>t.id===ticket.id?{...t,status:next}:t))}
  return <>
    <PageHeader eyebrow="CENTRAL DE TRABALHO" title="Tickets operacionais" description="Priorize, atribua e acompanhe o trabalho da sua equipe." actions={<button className="button button--primary" onClick={()=>setModal(true)}><Plus size={16}/> Novo ticket</button>}/>
    <div className="board-toolbar"><label className="search-input"><Search size={16}/><input placeholder="Buscar tickets..." value={query} onChange={e=>setQuery(e.target.value)}/></label><span>{tickets.filter(t=>t.status!=='Concluído').length} tickets abertos</span></div>
    <section className="kanban">{columns.map((column,columnIndex)=><div className="kanban-column" key={column}><header><h2>{column}</h2><span>{visible.filter(t=>t.status===column).length}</span></header>
      <div className="kanban-column__body">{visible.filter(t=>t.status===column).map(ticket=><article className="ticket-card" key={ticket.id}><div><Badge tone={ticket.priority}>{ticket.priority}</Badge><span>{ticket.id}</span></div><h3>{ticket.title}</h3><div className="tag-list">{ticket.tags.map(tag=><span key={tag}>{tag}</span>)}</div><footer><div className="mini-avatar">{ticket.assignee.split(' ').map(s=>s[0]).join('').slice(0,2)}</div><span>{ticket.assignee}</span><time>{ticket.age}</time></footer><div className="ticket-actions"><button disabled={columnIndex===0} onClick={()=>move(ticket,-1)}>←</button><button disabled={columnIndex===3} onClick={()=>move(ticket,1)}>Avançar →</button></div></article>)}</div>
    </div>)}</section>
    {modal&&<Modal title="Criar novo ticket" onClose={()=>setModal(false)}><div className="form-grid"><label className="span-2">Título<input autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Descreva o trabalho necessário"/></label><label>Prioridade<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Ticket['priority']})}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></label><label>Responsável<input value={form.assignee} onChange={e=>setForm({...form,assignee:e.target.value})} placeholder="Nome"/></label><div className="form-actions span-2"><button className="button" onClick={()=>setModal(false)}>Cancelar</button><button className="button button--primary" onClick={create}>Criar ticket</button></div></div></Modal>}
  </>
}
