import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Plane, Plus, ShieldAlert, Star, UserMinus, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { ExportCsvButton } from '../components/ui/ExportCsvButton'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import {
  absences,
  HOURS_PER_PERSON_WEEK,
  onCallRoster,
  peopleAllocation,
  personSprintUtilization,
  projects,
  skillMatrix,
  skills,
  sprintBurndown,
  sprintHistory,
  sprintTotalPoints,
  type PersonAllocation,
} from '../data/capacityExtra'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import { classNames } from '../utils/format'
import { exportIcs } from '../utils/ics'
import '../styles/capacity-extra.css'
import '../styles/capacityExtraFeatures.css'

const teams = [
  { name: 'Platform Core', people: 8, allocated: 92, work: ['Migração EKS', 'Observabilidade'] },
  { name: 'Commerce', people: 11, allocated: 84, work: ['Checkout v3', 'PIX recorrente'] },
  { name: 'Data Platform', people: 7, allocated: 68, work: ['Lakehouse', 'Data quality'] },
  { name: 'IAM & Security', people: 6, allocated: 106, work: ['Passkeys', 'SOC 2'] },
  { name: 'Developer Experience', people: 5, allocated: 76, work: ['CLI v2', 'Golden paths'] },
]

const projectColors: Record<string, string> = { 'Checkout v3': '#8097ff', 'Migração EKS': '#6fd7a3', 'Lakehouse': '#f8c56a', 'Passkeys': '#ff7082', 'CLI v2': '#8693a5' }

const skillColor = (level: number) => {
  if (level >= 5) return '#6fd7a3'
  if (level >= 4) return '#a3e0b0'
  if (level >= 3) return '#f8c56a'
  if (level >= 2) return '#f2a35f'
  return '#ff7082'
}

type Tr = (key: TranslationKey) => string

function Burndown({ t }: { t: Tr }) {
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

function HistoryChart({ t }: { t: Tr }) {
  const width = 560, height = 170, pad = 28
  const max = 100
  const x = (i: number) => pad + (i / (sprintHistory.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2)
  const pts = sprintHistory.map((d, i) => `${x(i)},${y(d.utilization)}`).join(' ')
  const barWidth = (width - pad * 2) / sprintHistory.length - 14
  return <div className="history-chart">
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" />
      <line x1={pad} y1={y(100)} x2={width - pad} y2={y(100)} stroke="#ff7082" strokeDasharray="3 3" opacity={0.5} />
      {sprintHistory.map((d, i) => <rect key={d.sprint} x={x(i) - barWidth / 2} y={y(d.utilization)} width={barWidth} height={height - pad - y(d.utilization)} fill={d.utilization > 90 ? '#ff7082' : '#8097ff'} opacity={0.55} rx={3} />)}
      <polyline points={pts} fill="none" stroke="#6fd7a3" strokeWidth={2.5} />
      {sprintHistory.map((d, i) => <circle key={d.sprint} cx={x(i)} cy={y(d.utilization)} r={3.5} fill="#6fd7a3" />)}
      {sprintHistory.map((d, i) => <text key={d.sprint} x={x(i)} y={height - pad + 14} fontSize={9} fill="var(--muted)" textAnchor="middle">{d.sprint.replace('Sprint ', 'S')}</text>)}
    </svg>
    <div className="history-chart__legend">
      <span><i style={{ background: '#6fd7a3' }} />{t('capacity.history.legend')}</span>
      <span><i style={{ background: '#ff7082' }} />{'>'}90%</span>
    </div>
  </div>
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function CapacityPage() {
  const { t } = useI18n()
  const [week, setWeek] = useState(0)
  const { logAction } = useAudit()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addNotification } = useNotifications()
  const { canEdit } = useRole()
  const [removedPerson, setRemovedPerson] = useState('')
  const [fictitiousPerson, setFictitiousPerson] = useState<PersonAllocation | null>(null)
  const [vacationSimActive, setVacationSimActive] = useState(false)

  const baseAllocation = useMemo(() => fictitiousPerson ? [...peopleAllocation, fictitiousPerson] : peopleAllocation, [fictitiousPerson])
  const activeAllocation = useMemo(() => baseAllocation.filter(p => p.person !== removedPerson), [removedPerson, baseAllocation])
  const totalPeople = baseAllocation.length
  const activePeople = activeAllocation.length
  const totalCapacityHours = totalPeople * HOURS_PER_PERSON_WEEK
  const activeCapacityHours = activePeople * HOURS_PER_PERSON_WEEK
  const removedWork = removedPerson ? baseAllocation.find(p => p.person === removedPerson) : undefined
  const impactPct = removedWork ? Math.round((HOURS_PER_PERSON_WEEK / totalCapacityHours) * 100) : 0

  const onRemovePerson = (name: string) => {
    setRemovedPerson(name)
    if (name) logAction(t('capacity.audit.whatIf'), `${t('capacity.audit.removed')} ${name} ${t('capacity.audit.impactOf')} ${Math.round((HOURS_PER_PERSON_WEEK / totalCapacityHours) * 100)}${t('capacity.audit.onTotalCapacity')}`)
  }

  const onAddFictitious = () => {
    const name = t('capacity.hire.name')
    const person: PersonAllocation = { person: `${name} #${Math.floor(Math.random() * 900 + 100)}`, team: 'Platform Core', allocations: {} }
    setFictitiousPerson(person)
    logAction(t('capacity.hire.title'), `${person.person} — ${t('capacity.hire.added')}`)
    addNotification(t('capacity.hire.title'), `${person.person} ${t('capacity.hire.added')}`, 'info')
  }
  const onDiscardFictitious = () => {
    if (fictitiousPerson) logAction(t('capacity.hire.title'), `${fictitiousPerson.person} — ${t('capacity.hire.discarded')}`)
    setFictitiousPerson(null)
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

  // Item 9 — export ausências como .ics
  const onExportAbsencesIcs = () => {
    const events = absences.map(a => ({ title: `${t('capacity.absence.title')} — ${a.person}`, date: a.start, description: `${a.person}: ${a.start} a ${a.end}` }))
    exportIcs('ausencias-capacidade.ics', events)
    logAction(t('capacity.export.icsButton'), `${events.length} eventos exportados.`)
  }

  // Item 3 — export matriz de alocação
  const matrixRows = useMemo(() => activeAllocation.flatMap(p =>
    projects.map(proj => ({ pessoa: p.person, equipe: p.team, projeto: proj, alocacaoPct: p.allocations[proj] || 0 }))
  ), [activeAllocation])

  // Item 5 — rodízio de plantão para os próximos 14 dias
  const today = new Date(2026, 6, 10)
  const oncallSchedule = useMemo(() => Array.from({ length: 14 }).map((_, i) => {
    const date = addDays(today, i)
    const person = onCallRoster[i % onCallRoster.length]
    return { date, person, isToday: i === 0 }
  }), [])

  // Item 8 — burnout simulado: >90% por 2+ sprints seguidos
  const burnoutPeople = useMemo(() => {
    const result = new Set<string>()
    Object.entries(personSprintUtilization).forEach(([person, series]) => {
      let streak = 0
      for (const v of series) {
        if (v > 90) { streak++; if (streak >= 2) { result.add(person); break } } else streak = 0
      }
    })
    return result
  }, [])

  // Item 10 — simulação de férias coletivas
  const vacationStart = today
  const vacationEnd = addDays(today, 6)
  const onSimulateVacation = () => {
    setVacationSimActive(true)
    logAction(t('capacity.vacation.audit'), `${isoDate(vacationStart)} → ${isoDate(vacationEnd)} · ${totalPeople} pessoas`)
    addNotification(t('capacity.vacation.title'), `${t('capacity.vacation.warning')} ${isoDate(vacationStart)} ${t('capacity.vacation.to')} ${isoDate(vacationEnd)}.`, 'warning')
  }
  const onResetVacation = () => setVacationSimActive(false)

  return <>
    <PageHeader eyebrow={t('capacity.eyebrow')} title={t('capacity.title')} description={t('capacity.description')} actions={<div className="week-picker"><button onClick={() => setWeek(w => w - 1)}><ChevronLeft /></button><Calendar /><span>{week === 0 ? t('capacity.week.current') : week > 0 ? `+${week} ${t('capacity.week.suffix')}${week > 1 ? 's' : ''}` : `${week} ${t('capacity.week.suffix')}${week < -1 ? 's' : ''}`}</span><button onClick={() => setWeek(w => w + 1)}><ChevronRight /></button></div>} />
    <section className="metric-grid"><MetricCard label={t('capacity.metric.people')} value={String(totalPeople)} hint={t('capacity.metric.peopleHint')} /><MetricCard label={t('capacity.metric.totalCapacity')} value={`${totalCapacityHours}h`} delta="+40h" /><MetricCard label={t('capacity.metric.avgAllocation')} value="84%" tone="healthy" /><MetricCard label={t('capacity.metric.overallocated')} value={String(activeAllocation.filter(p => Object.values(p.allocations).reduce((s, v) => s + v, 0) > 100).length)} tone="critical" hint={t('capacity.metric.overallocatedHint')} /></section>
    <section className="capacity-grid">
      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.byTeam.eyebrow')}</span><h2>{t('capacity.byTeam.title')}</h2></div><span className="legend-inline"><i className="dot dot--success" /> {t('capacity.byTeam.ideal')}</span></div>
        <div className="team-capacity">{teams.map(team => <div key={team.name}><div className="team-capacity__info"><span className="team-avatar"><Users /></span><div><strong>{team.name}</strong><small>{team.people} pessoas · {team.work.join(' / ')}</small></div><button className="icon-button" title="Favoritar" onClick={()=>toggleFavorite({ id: team.name, module: 'capacity', label: team.name })}><Star fill={isFavorite('capacity', team.name) ? 'currentColor' : 'none'} size={14}/></button><b className={team.allocated > 100 ? 'text-danger' : ''}>{team.allocated}%</b></div><div className="capacity-track"><i className={team.allocated > 100 ? 'is-over' : ''} style={{ width: `${Math.min(team.allocated, 100)}%` }} /><span style={{ left: '90%' }} /></div></div>)}</div></article>
      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.distribution.eyebrow')}</span><h2>{t('capacity.distribution.title')}</h2></div></div><BarChart suffix="%" data={[{ label: t('capacity.distribution.roadmap'), value: 48 }, { label: t('capacity.distribution.operations'), value: 22, color: '#8097ff' }, { label: t('capacity.distribution.techDebt'), value: 18, color: '#f8c56a' }, { label: t('capacity.distribution.incidents'), value: 8, color: '#ff7082' }, { label: t('capacity.distribution.available'), value: 4, color: '#8693a5' }]} /><div className="insight"><Users size={16} /><span>IAM & Security {t('capacity.distribution.insightPrefix')} <strong>{t('capacity.distribution.onePerson')}</strong> {t('capacity.distribution.insightSuffix')}</span></div></article>

      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.sprint.eyebrow')}</span><h2>{t('capacity.sprint.title')}</h2></div></div><Burndown t={t} /></article>

      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.history.eyebrow')}</span><h2>{t('capacity.history.title')}</h2></div></div><HistoryChart t={t} /></article>

      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.whatIf.eyebrow')}</span><h2>{t('capacity.whatIf.title')}</h2></div><UserMinus size={18} /></div>
        <div className="whatif-panel">
          <label>{t('capacity.whatIf.removeLabel')}<select value={removedPerson} onChange={e => onRemovePerson(e.target.value)} disabled={!canEdit}><option value="">{t('capacity.whatIf.keepAll')}</option>{baseAllocation.map(p => <option key={p.person} value={p.person}>{p.person} ({p.team})</option>)}</select></label>
          <div className="whatif-impact">
            <div><span>{t('capacity.whatIf.activePeople')}</span><strong>{activePeople} / {totalPeople}</strong></div>
            <div><span>{t('capacity.whatIf.capacity')}</span><strong>{activeCapacityHours}h</strong></div>
            <div><span>{t('capacity.whatIf.impact')}</span><strong className={impactPct ? 'text-danger' : ''}>{impactPct ? `-${impactPct}%` : '0%'}</strong></div>
          </div>
          {removedWork && <div className="insight"><UserMinus size={16} /><span>{t('capacity.whatIf.workOf')} <strong>{removedWork.person}</strong> em {Object.keys(removedWork.allocations).join(', ') || '—'} {t('capacity.whatIf.redistribute')} {removedWork.team}.</span></div>}
        </div>
      </article>

      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.hire.eyebrow')}</span><h2>{t('capacity.hire.title')}</h2></div><Plus size={18} /></div>
        <div className="hire-sim">
          {!fictitiousPerson
            ? <button className="button button--tiny" disabled={!canEdit} onClick={onAddFictitious}><Plus size={12} /> {t('capacity.hire.add')}</button>
            : <div className="hire-sim__row">
                <div><strong>{fictitiousPerson.person}</strong><small>{fictitiousPerson.team}</small></div>
                <button className="icon-button" title={t('capacity.hire.discard')} onClick={onDiscardFictitious}><X size={14} /></button>
              </div>}
          <div className="insight"><Users size={16} /><span>{t('capacity.hire.impact')}: <strong>+{HOURS_PER_PERSON_WEEK}h</strong> {fictitiousPerson ? `(${totalCapacityHours}h ${t('capacity.whatIf.capacity').toLowerCase()})` : ''}</span></div>
        </div>
      </article>

      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.matrix.eyebrow')}</span><h2>{t('capacity.matrix.title')}</h2></div><div className="panel__actions"><ExportCsvButton filename={t('capacity.export.matrixFilename')} rows={matrixRows} label={t('capacity.matrix.export')} /></div></div>
        <div className="alloc-matrix">{activeAllocation.map(p => {
          const total = Object.values(p.allocations).reduce((s, v) => s + v, 0)
          const isBurnout = burnoutPeople.has(p.person)
          return <div className="alloc-matrix__row" key={p.person}>
            <header><span><strong>{p.person}</strong> <small>· {p.team}</small></span><span>{total > 100 && <span className="overalloc-badge"><ShieldAlert size={10} /> {t('capacity.matrix.overallocated')}</span>}{isBurnout && <span className="burnout-badge"><AlertTriangle size={10} /> {t('capacity.matrix.burnout')}</span>}<b className={classNames(total > 100 && 'text-danger')}> {total}%</b></span></header>
            <div className="alloc-matrix__bars">{projects.map(proj => <div className="alloc-matrix__bar" key={proj} title={`${proj}: ${p.allocations[proj] || 0}%`}>{p.allocations[proj] ? <i style={{ width: `${p.allocations[proj]}%`, background: projectColors[proj] }} /> : null}</div>)}</div>
          </div>
        })}</div>
        <div className="alloc-matrix__key">{projects.map(p => <span key={p}><i style={{ background: projectColors[p] }} />{p}</span>)}</div>
      </article>

      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.oncall.eyebrow')}</span><h2>{t('capacity.oncall.title')}</h2></div><Calendar size={18} /></div>
        <div className="oncall-list">{oncallSchedule.map((s, i) => <div className={classNames('oncall-list__row', s.isToday && 'is-today')} key={i}><span>{s.person}</span><span className="date">{isoDate(s.date).slice(5)}{s.isToday ? ` · ${t('capacity.oncall.today')}` : ''}</span></div>)}</div>
      </article>

      <article className="panel panel--wide"><div className="panel__header"><div><span className="eyebrow">{t('capacity.skills.eyebrow')}</span><h2>{t('capacity.skills.title')}</h2></div></div>
        <div className="skill-matrix-wrap">
          <table className="skill-matrix">
            <thead><tr><th>Pessoa</th>{skills.map(s => <th key={s}>{s}</th>)}</tr></thead>
            <tbody>{Object.entries(skillMatrix).map(([person, levels]) => <tr key={person}><td><strong>{person}</strong></td>{skills.map(s => <td key={s} className="skill-cell" style={{ background: skillColor(levels[s]) }}>{levels[s]}</td>)}</tr>)}</tbody>
          </table>
        </div>
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
          <div className="panel__actions" style={{ marginTop: 10 }}><ExportCsvButton filename="ausencias" rows={absences} label="Exportar CSV" /><button className="button button--tiny" onClick={onExportAbsencesIcs}><Calendar size={12} /> {t('capacity.export.icsButton')}</button></div>
        </div>
      </article>

      <article className="panel"><div className="panel__header"><div><span className="eyebrow">{t('capacity.vacation.eyebrow')}</span><h2>{t('capacity.vacation.title')}</h2></div><Plane size={18} /></div>
        <div className="vacation-sim">
          {!vacationSimActive
            ? <button className="button button--tiny" disabled={!canEdit} onClick={onSimulateVacation}><Plane size={12} /> {t('capacity.vacation.button')}</button>
            : <>
                <div className="vacation-sim__alert"><AlertTriangle size={14} /><span>{t('capacity.vacation.warning')} <strong>{isoDate(vacationStart)}</strong> {t('capacity.vacation.to')} <strong>{isoDate(vacationEnd)}</strong>. {t('capacity.vacation.capacityDrop')} <strong>0%</strong> ({totalPeople} {t('capacity.metric.people').toLowerCase()}).</span></div>
                <button className="button button--tiny" onClick={onResetVacation}><X size={12} /> {t('capacity.vacation.reset')}</button>
              </>}
        </div>
      </article>
    </section>
  </>
}
