import { GitCompareArrows, TriangleAlert, Zap } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { pipelines, initialTickets, vulnerabilities } from '../data/mockData'
import { useI18n } from '../i18n/I18nContext'
import '../styles/comparator.css'

function hoursAgoFromText(text: string): number {
  const t = text.toLowerCase()
  if (t.includes('agora')) return 0
  const num = parseFloat(t) || 1
  if (t.includes('min')) return num / 60
  if (t.includes('h')) return num
  if (t.includes('dia') || t.includes('d')) return num * 24
  if (t.includes('semana')) return num * 24 * 7
  if (t === 'hoje') return 2
  if (t === '2 dias') return 48
  if (t === '4 dias') return 96
  if (t === '14 dias') return 336
  return 24
}

const DAYS = 7

function bucketOf(hoursAgo: number) {
  return Math.min(DAYS - 1, Math.floor(hoursAgo / 24))
}

export default function ComparatorPage() {
  const { t } = useI18n()
  const deployBuckets = Array(DAYS).fill(0)
  const ticketBuckets = Array(DAYS).fill(0)
  const vulnBuckets = Array(DAYS).fill(0)

  pipelines.forEach(p => { deployBuckets[bucketOf(hoursAgoFromText(p.updated))]++ })
  initialTickets.forEach(tk => { ticketBuckets[bucketOf(hoursAgoFromText(tk.age))]++ })
  vulnerabilities.filter(v => v.severity === 'Crítica' || v.severity === 'Alta').forEach(v => { vulnBuckets[bucketOf(hoursAgoFromText(v.due))]++ })

  const maxValue = Math.max(1, ...deployBuckets, ...ticketBuckets, ...vulnBuckets)
  const labels = Array.from({ length: DAYS }, (_, i) => i === 0 ? t('comparator.timeline.today') : `-${i}d`)

  const correlatedDays = labels
    .map((label, i) => ({ label, score: deployBuckets[i] + ticketBuckets[i] + vulnBuckets[i], i }))
    .filter(d => d.score >= 2 && ticketBuckets[d.i] > 0 && (deployBuckets[d.i] > 0 || vulnBuckets[d.i] > 0))
    .sort((a, b) => b.score - a.score)

  return <>
    <PageHeader eyebrow={t('comparator.eyebrow')} title={t('comparator.title')} description={t('comparator.description')}/>
    <section className="dashboard-grid">
      <article className="panel panel--wide">
        <div className="panel__header"><div><span className="eyebrow">{t('comparator.timeline.eyebrow')}</span><h2>{t('comparator.timeline.title')}</h2></div><GitCompareArrows size={18}/></div>
        <div className="comparator-chart">
          {labels.map((label, i) => <div className="comparator-chart__col" key={label}>
            <div className="comparator-chart__bars">
              <i title={`${deployBuckets[i]} deploys`} className="bar-deploy" style={{ height: `${(deployBuckets[i] / maxValue) * 100}%` }}/>
              <i title={`${ticketBuckets[i]} tickets`} className="bar-ticket" style={{ height: `${(ticketBuckets[i] / maxValue) * 100}%` }}/>
              <i title={`${vulnBuckets[i]} vulnerabilidades`} className="bar-vuln" style={{ height: `${(vulnBuckets[i] / maxValue) * 100}%` }}/>
            </div>
            <span>{label}</span>
          </div>)}
        </div>
        <div className="comparator-legend">
          <span><i className="dot bar-deploy"/> {t('comparator.legend.deploys')}</span>
          <span><i className="dot bar-ticket"/> {t('comparator.legend.tickets')}</span>
          <span><i className="dot bar-vuln"/> {t('comparator.legend.vulns')}</span>
        </div>
      </article>
      <article className="panel">
        <div className="panel__header"><div><span className="eyebrow">{t('comparator.insights.eyebrow')}</span><h2>{t('comparator.insights.title')}</h2></div><Zap size={18}/></div>
        <div className="comparator-insights">
          {correlatedDays.length === 0 && <div className="empty-compact"><TriangleAlert size={18}/><span>{t('comparator.insights.empty')}</span></div>}
          {correlatedDays.map(d => <div className="insight" key={d.label}>
            <TriangleAlert size={16}/>
            <span><strong>{d.label}:</strong> {deployBuckets[d.i]} {t('comparator.insights.deploysSuffix')} {ticketBuckets[d.i]} {t('comparator.insights.ticketsSuffix')} {vulnBuckets[d.i]} {t('comparator.insights.vulnsSuffix')}</span>
          </div>)}
        </div>
      </article>
    </section>
  </>
}
