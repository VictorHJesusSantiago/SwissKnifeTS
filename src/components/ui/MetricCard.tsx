import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { Metric } from '../../types'

export function MetricCard({ label, value, delta, tone = 'info', hint }: Metric) {
  const positive = delta && !delta.startsWith('-')
  return (
    <article className="metric-card">
      <div className={`metric-card__indicator metric-card__indicator--${tone}`} />
      <span className="eyebrow">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {(delta || hint) && <div className="metric-card__meta">
        {delta && <span className={positive ? 'text-success' : 'text-danger'}>
          {positive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {delta}
        </span>}
        {hint && <span>{hint}</span>}
      </div>}
    </article>
  )
}
