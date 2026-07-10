import { Calendar, ChevronLeft, ChevronRight, Star, UserMinus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { absences, HOURS_PER_PERSON_WEEK, peopleAllocation, projects, sprintBurndown, sprintTotalPoints } from '../data/capacityExtra'
import { useI18n } from '../i18n/I18nContext'
import '../styles/capacity-extra.css'

const teams = [
  { name: 'Platform Core', people: 8, allocated: 92, work: ['Migração EKS', 'Observabilidade'] },
  { name: 'Commerce', people: 11, allocated: 84, work: ['Checkout v3', 'PIX recorrente'] },
  { name: 'Data Platform', people: 7, allocated: 68, work: ['Lakehouse', 'Data quality'] },
  { name: 'IAM & Security', people: 6, allocated: 106, work: ['Passkeys', 'SOC 2'] },
  { name: 'Developer Experience', people: 5, allocated: 76, work: ['CLI v2', 'Golden paths'] },
]

const projectColors: Record<string, string> = { 'Checkout v3': '#8097ff', 'Migração EKS': '#6fd7a3', 'Lakehouse': '#f8c56a', 'Passkeys': '#ff7082', 'CLI v2': '#8693a5' }

function Burndown({ t }: { t: (key: import('../i18n/translations').TranslationKey) => string }) {
  const width = 560, height = 160, pad = 24
  const maxV = sprintTotalPoints
  const x = (i: number) => pad + (i / (sprintBurndown.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - (v / maxV) * (height - pad * 2)
  const plannedPts = sprintBurndown.map((d, i) => `${x(i)},${y(d.planned)}`).join(' ')
  const completedPts = sprintBurndown.map((d, i) => `${x(i)},${y(d.completed)}`).join(' ')
  return <div className="burndown-chart">
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" />
      <polyline points={plannedPts} fill="none" stroke="#8693a5" strokeDasharray="4 4" strokeWidth={2} />
      <polyline points={completedPts} fill="none" stroke="#6fd7a3" strokeWidth={2.5} />
      {sprintBurndown.map((d, i) => <circle key={d.day} cx={x(i)} cy={y(d.completed)} r={3} fill="#6fd7a3" />)}
    </svg>
    <div className="burndown-chart__legend">
      <span><i style={{ background: '#8693a5' }} />{t('capacity.burndown.planned')}</span>
      <span><i style={{ background: '#6fd7a3' }} />{t('capacity.burndown.completed')}</span>
    </div>
  </div>
}

export default function CapacityPage() {
  const { t } = useI18n()
  const [week, setWeek] = useState(0)
  const { logAction } = useAudit()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [removedPerson, setRemovedPerson] = useState('')

  const activeAllocation = useMemo(() => peopleAllocation.filter(p => p.person !== removedPerson), [removedPerson])
  const totalPeople = peopleAllocation.length
  const activePeople = activeAllocation.length
  const totalCapacityHours = totalPeople * HOURS_PER_PERSON_WEEK
  const activeCapacityHours = activePeople * HOURS_PER_PERSON_WEEK
  const removedWork = removedPerson ? peopleAllocation.find(p => p.person === removedPerson) : undefined
  const impactPct = removedWork ? Math.round((HOURS_PER_PERSON_WEEK / totalCapacityHours) * 100) : 0

  const onRemovePerson = (name: string) => {
    setRemovedPerson(name)
    if (name) logAction(t('capacity.audit.whatIf'), `${t('capacity.audit.removed')} ${name} ${t('capacity.audit.impactOf')} ${Math.round((HOURS_PER_PERSON_WEEK / totalCapacityHours) * 100)}${t('capacity.audit.onTotalCapacity')}`)
  }

  const year = 2026, month = 6 // julho (0-indexed)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const dayHasAbsence = (day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return absences.filter(a => iso >= a.start && iso <= a.end)
  }
  const totalAbsenceDays = absences.reduce((sum, a) => sum + (new Date(a.end).getTime() - new Date(a.start).getTime()) / 86400000 + 1, 0)
  const availableCapacityPct = Math.round(100 - (totalAbsenceDays / (totalPeople * 30)) * 100)

  return <>
    <PageHeader eyebrow={t('capacity.eyebrow')} title={t('capacity.title')} description={t('capacity.description')} actions={<div className="week-picker"><button onClick={() => setWeek(w => w - 1)}><ChevronLeft /></button><Calendar /><span>{week === 0 ? t('capacity.week.current') : week > 0 ? `+${week} ${t('capacity.week.suffix')}${week > 1 ? 's' : ''}` : `${week} ${t('capacity.week.suffix')}${week < -1 ? 's' : ''}`}</span><button onClick={() => setWeek(w => w + 1)}><ChevronRight /></button></div>} />
    <section className="metric-grid"><MetricCard label={t('capacity.metric.people')} value="37" hint={t('capacity.metric.peopleHint')} /><MetricCard label={t('capacity.metric.totalCapacity')} value="1.480h" delta="+40h" /><MetricCard label={t('capacity.metric.avgAllocation')} value="84%" tone="healthy" /><MetricCard label={t('capacity.metric.overallocated')} value="4" tone="critical" hint={t('capacity.metric.overallocatedHint')} /></section>
    <section className="capacity-grid">
      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.byTeam.eyebrow')}</span><h2>{t('capacity.byTeam.title')}</h2></div><span className="legend-inline"><i className="dot dot--success" /> {t('capacity.byTeam.ideal')}</span></div>
        <div className="team-capacity">{teams.map(team => <div key={team.name}><div className="team-capacity__info"><span className="team-avatar"><Users /></span><div><strong>{team.name}</strong><small>{team.people} pessoas · {team.work.join(' / ')}</small></div><button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: team.name, module: 'capacity', label: team.name })}><Star fill={isFavorite('capacity', team.name) ? 'currentColor' : 'none'} size={14}/></button><b className={team.allocated > 100 ? 'text-danger' : ''}>{team.allocated}%</b></div><div className="capacity-track"><i className={team.allocated > 100 ? 'is-over' : ''} style={{ width: `${Math.min(team.allocated, 100)}%` }} /><span style={{ left: '90%' }} /></div></div>)}</div></article>
      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.distribution.eyebrow')}</span><h2>{t('capacity.distribution.title')}</h2></div></div><BarChart suffix="%" data={[{ label: t('capacity.distribution.roadmap'), value: 48 }, { label: t('capacity.distribution.operations'), value: 22, color: '#8097ff' }, { label: t('capacity.distribution.techDebt'), value: 18, color: '#f8c56a' }, { label: t('capacity.distribution.incidents'), value: 8, color: '#ff7082' }, { label: t('capacity.distribution.available'), value: 4, color: '#8693a5' }]} /><div className="insight"><Users size={16} /><span>IAM & Security {t('capacity.distribution.insightPrefix')} <strong>{t('capacity.distribution.onePerson')}</strong> {t('capacity.distribution.insightSuffix')}</span></div></article>

      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.sprint.eyebrow')}</span><h2>{t('capacity.sprint.title')}</h2></div></div><Burndown t={t} /></article>

      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.whatIf.eyebrow')}</span><h2>{t('capacity.whatIf.title')}</h2></div><UserMinus size={18} /></div>
        <div className="whatif-panel">
          <label>{t('capacity.whatIf.removeLabel')}<select value={removedPerson} onChange={e => onRemovePerson(e.target.value)}><option value="">{t('capacity.whatIf.keepAll')}</option>{peopleAllocation.map(p => <option key={p.person} value={p.person}>{p.person} ({p.team})</option>)}</select></label>
          <div className="whatif-impact">
            <div><span>{t('capacity.whatIf.activePeople')}</span><strong>{activePeople} / {totalPeople}</strong></div>
            <div><span>{t('capacity.whatIf.capacity')}</span><strong>{activeCapacityHours}h</strong></div>
            <div><span>{t('capacity.whatIf.impact')}</span><strong className={impactPct ? 'text-danger' : ''}>{impactPct ? `-${impactPct}%` : '0%'}</strong></div>
          </div>
          {removedWork && <div className="insight"><UserMinus size={16} /><span>{t('capacity.whatIf.workOf')} <strong>{removedWork.person}</strong> em {Object.keys(removedWork.allocations).join(', ')} {t('capacity.whatIf.redistribute')} {removedWork.team}.</span></div>}
        </div>
      </article>

      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.matrix.eyebrow')}</span><h2>{t('capacity.matrix.title')}</h2></div></div>
        <div className="alloc-matrix">{activeAllocation.map(p => {
          const total = Object.values(p.allocations).reduce((s, v) => s + v, 0)
          return <div className="alloc-matrix__row" key={p.person}>
            <header><span><strong>{p.person}</strong> <small>· {p.team}</small></span><b className={total > 100 ? 'text-danger' : ''}>{total}%</b></header>
            <div className="alloc-matrix__bars">{projects.map(proj => <div className="alloc-matrix__bar" key={proj} title={`${proj}: ${p.allocations[proj] || 0}%`}>{p.allocations[proj] ? <i style={{ width: `${p.allocations[proj]}%`, background: projectColors[proj] }} /> : null}</div>)}</div>
          </div>
        })}</div>
        <div className="alloc-matrix__key">{projects.map(p => <span key={p}><i style={{ background: projectColors[p] }} />{p}</span>)}</div>
      </article>

      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.absence.eyebrow')}</span><h2>{t('capacity.absence.title')}</h2></div><Calendar size={18} /></div>
        <div className="absence-calendar">
          <div className="absence-calendar__grid">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span className="dow" key={i}>{d}</span>)}
            {Array.from({ length: firstDow }).map((_, i) => <span className="absence-calendar__day is-empty" key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const hits = dayHasAbsence(day)
              return <div className={hits.length ? 'absence-calendar__day has-absence' : 'absence-calendar__day'} key={day} title={hits.map(h => h.person).join(', ')}>
                {day}{hits.length > 0 && <b />}
              </div>
            })}
          </div>
          <div className="absence-calendar__list">
            {absences.map((a, i) => <div key={i}><span>{a.person}</span><span>{a.start.slice(8)}–{a.end.slice(8)}/07</span></div>)}
          </div>
          <div className="insight"><Calendar size={16} /><span>{t('capacity.absence.availableCapacity')} <strong>{availableCapacityPct}%</strong> {t('capacity.absence.consideringAbsences')}</span></div>
        </div>
      </article>
    </section>
  </>
}
