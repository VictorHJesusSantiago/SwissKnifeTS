import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { faqEntries } from '../data/faq'
import '../styles/help.css'

export default function HelpPage() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return faqEntries
    return faqEntries.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.module.toLowerCase().includes(q))
  }, [query])

  const grouped = results.reduce<Record<string, typeof faqEntries>>((acc, entry) => {
    acc[entry.module] = acc[entry.module] || []
    acc[entry.module].push(entry)
    return acc
  }, {})

  return <>
    <PageHeader eyebrow="SUPORTE" title="Central de ajuda" description="Perguntas frequentes por módulo — pesquisa 100% local, sem chat externo."/>
    <label className="search-input" style={{ marginBottom: 16, width: 420 }}>
      <Search size={16}/><input placeholder="Buscar dúvida..." value={query} onChange={e => setQuery(e.target.value)}/>
    </label>
    {Object.entries(grouped).map(([module, entries]) => <section className="panel faq-group" key={module}>
      <div className="panel__header"><div><span className="eyebrow">{module.toUpperCase()}</span><h2>{module}</h2></div></div>
      <div className="faq-list">
        {entries.map(entry => <details className="faq-item" key={entry.question}>
          <summary>{entry.question}</summary>
          <p>{entry.answer}</p>
        </details>)}
      </div>
    </section>)}
    {results.length === 0 && <div className="empty-state"><strong>Nenhuma dúvida encontrada</strong><span>Tente outro termo de busca.</span></div>}
  </>
}
