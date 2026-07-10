import '../styles/pipelines-extra.css'
import { ArrowRight, Check, CheckCircle2, ChevronDown, Circle, Clock3, GitBranch, Play, RefreshCw, RotateCcw, Star, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { pipelines as source } from '../data/mockData'
import { getHistoryFor, type PipelineRun } from '../data/pipelinesExtra'
import { useI18n } from '../i18n/I18nContext'
import type { Pipeline, Status } from '../types'

type Stage = { name: string; status: Status; duration: string }

function stageIcon(status: Status, size = 18) {
  return status === 'success' ? <Check size={size}/> : status === 'failed' ? <X size={size}/> : status === 'running' ? <RefreshCw className="spin" size={size}/> : <Clock3 size={size}/>
}

function DagNode({ stage, x, y }: { stage: Stage; x: number; y: number }) {
  return <div className="dag-graph__node" style={{ left: x, top: y }}>
    <div className={`dag__node-circle dag__node-circle--${stage.status}`}>{stageIcon(stage.status)}</div>
    <span>{stage.name}</span>
    <small>{stage.duration}</small>
  </div>
}

// DAG real: Build -> (Testes ‖ Segurança em paralelo) -> Deploy, com arestas de dependência desenhadas via SVG.
function PipelineDag({ stages }: { stages: Stage[] }) {
  const build = stages.find(s => s.name === 'Build')
  const tests = stages.find(s => s.name === 'Testes')
  const security = stages.find(s => s.name === 'Segurança')
  const deploy = stages.find(s => s.name === 'Deploy')

  if (!build || !tests || !security || !deploy) {
    return <div className="dag">
      {stages.flatMap((stage, i) => [
        <div className="dag__node" key={stage.name}>
          <div className={`dag__node-circle dag__node-circle--${stage.status}`}>{stageIcon(stage.status)}</div>
          <span>{stage.name}</span><small>{stage.duration}</small>
        </div>,
        i < stages.length - 1 ? <div className="dag__arrow" key={`arrow-${stage.name}`}><ArrowRight size={18}/></div> : null,
      ])}
    </div>
  }

  const COL = [70, 260, 450]
  const ROW_TOP = 30
  const ROW_MID = 90
  const ROW_BOTTOM = 150

  return <div className="dag-graph">
    <svg className="dag-graph__svg" viewBox="0 0 520 180" preserveAspectRatio="none">
      <line x1={COL[0] + 46} y1={ROW_MID + 23} x2={COL[1]} y2={ROW_TOP + 23} className={`dag-edge dag-edge--${tests.status === 'pending' ? 'pending' : 'active'}`}/>
      <line x1={COL[0] + 46} y1={ROW_MID + 23} x2={COL[1]} y2={ROW_BOTTOM + 23} className={`dag-edge dag-edge--${security.status === 'pending' ? 'pending' : 'active'}`}/>
      <line x1={COL[1] + 92} y1={ROW_TOP + 23} x2={COL[2]} y2={ROW_MID + 23} className={`dag-edge dag-edge--${deploy.status === 'pending' ? 'pending' : 'active'}`}/>
      <line x1={COL[1] + 92} y1={ROW_BOTTOM + 23} x2={COL[2]} y2={ROW_MID + 23} className={`dag-edge dag-edge--${deploy.status === 'pending' ? 'pending' : 'active'}`}/>
    </svg>
    <DagNode stage={build} x={COL[0]} y={ROW_MID}/>
    <DagNode stage={tests} x={COL[1]} y={ROW_TOP}/>
    <DagNode stage={security} x={COL[1]} y={ROW_BOTTOM}/>
    <DagNode stage={deploy} x={COL[2]} y={ROW_MID}/>
  </div>
}

export default function PipelinesPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { addNotification } = useNotifications()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()
  const [pipelines, setPipelines] = useState(source)
  const [selected, setSelected] = useState<Pipeline | null>(source[1])
  const [running, setRunning] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [runA, setRunA] = useState<PipelineRun | null>(null)
  const [runB, setRunB] = useState<PipelineRun | null>(null)

  const history = selected ? getHistoryFor(selected.id) : []

  const updatePipeline = (id: number, patch: Partial<Pipeline> | ((p: Pipeline) => Pipeline)) => {
    setPipelines(list => list.map(item => item.id === id
      ? (typeof patch === 'function' ? patch(item) : { ...item, ...patch })
      : item))
    setSelected(prev => prev && prev.id === id
      ? (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch })
      : prev)
  }

  const runPipeline = () => {
    setRunning(true)
    const newRun: Pipeline = { ...source[0], id: Date.now(), name:'manual-deploy', owner:'Você', status:'running', updated:'agora', stages: source[1].stages.map(s => ({ ...s, status: 'pending' as const })) }
    newRun.stages[0] = { ...newRun.stages[0], status: 'running' }
    setPipelines(p => [newRun, ...p])
    setSelected(newRun)
    logAction('Pipeline iniciado', `Execução manual "${newRun.name}" disparada`)
    window.setTimeout(() => {
      updatePipeline(newRun.id, item => ({ ...item, status:'success', duration:'3m 41s', stages:item.stages.map(s=>({...s,status:'success'})) }))
      addNotification('Pipeline concluído', `${newRun.name} finalizou com sucesso.`, 'healthy')
      logAction('Pipeline concluído', `Execução manual "${newRun.name}" finalizou com sucesso`)
      setRunning(false)
    }, 2400)
  }

  const rerunPipeline = (p: Pipeline) => {
    updatePipeline(p.id, item => ({ ...item, status:'running', updated:'agora', stages: item.stages.map(s => ({ ...s, status: 'pending' as const })) }))
    logAction('Re-run disparado', `Pipeline "${p.name}" reiniciado manualmente`)
    window.setTimeout(() => {
      updatePipeline(p.id, item => ({ ...item, status:'success', duration: item.duration, stages: item.stages.map(s => ({ ...s, status: 'success' as const })) }))
      addNotification('Re-run concluído', `${p.name} foi reexecutado com sucesso.`, 'healthy')
      logAction('Re-run concluído', `Pipeline "${p.name}" finalizado com sucesso`)
    }, 1800)
  }

  const cancelPipeline = (p: Pipeline) => {
    updatePipeline(p.id, item => ({ ...item, status:'failed', stages: item.stages.map(s => s.status === 'success' ? s : { ...s, status: 'failed' as const }) }))
    addNotification('Pipeline cancelado', `${p.name} foi cancelado pelo usuário.`, 'warning')
    logAction('Pipeline cancelado', `Pipeline "${p.name}" cancelado manualmente`)
  }

  const approveGate = (p: Pipeline) => {
    updatePipeline(p.id, item => {
      const idx = item.stages.findIndex(s => s.status === 'pending')
      if (idx === -1) return item
      const stages = item.stages.map((s, i) => i === idx ? { ...s, status: 'running' as const } : s)
      return { ...item, stages, status: 'running' }
    })
    logAction('Gate aprovado', `Aprovação manual concedida para "${p.name}"`)
    window.setTimeout(() => {
      updatePipeline(p.id, item => {
        const idx = item.stages.findIndex(s => s.status === 'running')
        if (idx === -1) return item
        const stages = item.stages.map((s, i) => i === idx ? { ...s, status: 'success' as const } : s)
        const allDone = stages.every(s => s.status === 'success')
        return { ...item, stages, status: allDone ? 'success' : item.status }
      })
      addNotification('Estágio liberado', `Etapa aprovada de "${p.name}" concluída.`, 'healthy')
    }, 1600)
  }

  const openCompare = () => {
    if (history.length >= 2) { setRunA(history[0]); setRunB(history[1]); setCompareOpen(true) }
  }

  const gateStageIndex = selected?.stages.findIndex(s => s.name === 'Deploy' && s.status === 'pending') ?? -1
  const hasPendingGate = gateStageIndex !== undefined && gateStageIndex >= 0
    && selected?.stages.slice(0, gateStageIndex).every(s => s.status === 'success')

  return <>
    <PageHeader eyebrow={t('pipelines.eyebrow')} title={t('pipelines.title')} description={t('pipelines.subtitle')} actions={<button disabled={running || !canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} className="button button--primary" onClick={runPipeline}>{running?<RefreshCw className="spin" size={16}/>:<Play size={16}/>} {running?t('pipelines.starting'):t('pipelines.run')}</button>}/>
    <section className="metric-grid"><MetricCard label={t('pipelines.metricSuccessRate')} value="94,2%" delta="+1,8%"/><MetricCard label={t('pipelines.metricLeadTime')} value="8m 42s" delta="-12%"/><MetricCard label={t('pipelines.metricRuns')} value="128" delta="+18%"/><MetricCard label={t('pipelines.metricFailures')} value="7" delta="-3" tone="warning"/></section>
    <section className="split-layout">
      <article className="panel list-panel"><div className="panel__header"><div><span className="eyebrow">{t('pipelines.executionsEyebrow')}</span><h2>{t('pipelines.recentActivity')}</h2></div><button className="filter-button">{t('pipelines.filterAll')} <ChevronDown size={14}/></button></div>
        {pipelines.map(p=><button className={`pipeline-row ${selected?.id===p.id?'is-selected':''}`} key={p.id} onClick={()=>setSelected(p)}>
          <span className={`pipeline-status pipeline-status--${p.status}`}>{p.status==='success'?<Check/>:p.status==='failed'?<X/>:p.status==='running'?<RefreshCw className="spin"/>:<Circle/>}</span>
          <span className="grow"><strong>{p.name}</strong><small><GitBranch size={12}/>{p.branch} · {p.owner}</small></span><span><strong>{p.duration}</strong><small>{p.updated}</small></span>
        </button>)}
      </article>
      <article className="panel detail-panel">{selected && <>
        <div className="panel__header">
          <div><Badge tone={selected.status}>{selected.status}</Badge><h2>{selected.name}</h2><p>#{selected.id} · {selected.branch}</p></div>
          <div className="row" style={{display:'flex',gap:8}}>
            <button className="icon-button" title={t('pipelines.favorite')} onClick={()=>toggleFavorite({ id: String(selected.id), module: 'pipelines', label: selected.name })}><Star fill={isFavorite('pipelines', String(selected.id)) ? 'currentColor' : 'none'} size={17}/></button>
            <button className="icon-button" title={canEdit ? t('pipelines.rerun') : t('pipelines.viewerBlocked')} disabled={!canEdit} onClick={()=>rerunPipeline(selected)}><RotateCcw size={17}/></button>
            <button className="icon-button" title={canEdit ? t('pipelines.cancel') : t('pipelines.viewerBlocked')} disabled={!canEdit} onClick={()=>cancelPipeline(selected)}><X size={17}/></button>
            <button className="button button--tiny" disabled={history.length < 2} onClick={openCompare}>{t('pipelines.compareRuns')}</button>
          </div>
        </div>

        <PipelineDag stages={selected.stages}/>

        {hasPendingGate && <div className="gate-banner">
          <Clock3 size={16}/>
          <span>{t('pipelines.gateBannerText')}</span>
          <button className="button button--tiny button--primary" disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={()=>approveGate(selected)}>{t('pipelines.approve')}</button>
        </div>}

        <div className="pipeline-timeline">{selected.stages.map((stage,i)=><div className={`timeline-step timeline-step--${stage.status}`} key={stage.name}>
          <div className="timeline-step__rail"><span>{stage.status==='success'?<Check/>:stage.status==='failed'?<X/>:stage.status==='running'?<RefreshCw className="spin"/>:<Clock3/>}</span>{i<selected.stages.length-1&&<i/>}</div>
          <div><strong>{stage.name}</strong><small>{stage.duration}</small><p>{stage.status==='success'?t('pipelines.stageDoneOk'):stage.status==='failed'?t('pipelines.stageFailed'):stage.status==='running'?t('pipelines.stageRunning'):t('pipelines.stageWaiting')}</p></div>
        </div>)}</div>

        <div className="code-log"><span>$ pipeline run --branch {selected.branch}</span><span>{t('pipelines.checkoutOk')}</span><span>{t('pipelines.depsOk')}</span><span className={selected.status==='failed'?'log-error':''}>{selected.status==='failed'?t('pipelines.testsFailed'):t('pipelines.validationsOk')}</span></div>

        <div className="panel__header"><div><span className="eyebrow">{t('pipelines.historyEyebrow')}</span><h2>{t('pipelines.historyTitle')}</h2></div></div>
        <div className="history-chart-wrap">
          <BarChart suffix="s" data={history.slice(0,8).map(r => ({ label: `#${r.runNumber}`, value: r.durationSeconds, color: r.status==='failed' ? '#e05d5d' : undefined }))}/>
        </div>
      </>}</article>
    </section>

    {compareOpen && runA && runB && <Modal title={t('pipelines.compareTitle')} onClose={()=>setCompareOpen(false)}>
      <div className="run-picker">
        {history.slice(0,10).map(r => <button key={`a-${r.id}`} className={runA.id===r.id?'is-active':''} onClick={()=>setRunA(r)}>A: #{r.runNumber}</button>)}
      </div>
      <div className="run-picker">
        {history.slice(0,10).map(r => <button key={`b-${r.id}`} className={runB.id===r.id?'is-active':''} onClick={()=>setRunB(r)}>B: #{r.runNumber}</button>)}
      </div>
      <div className="compare-grid">
        <div className="compare-col">
          <h3>{t('pipelines.run.label')} #{runA.runNumber} · {runA.status==='success'?<CheckCircle2 size={13}/>:<XCircle size={13}/>} {runA.durationSeconds}s {t('pipelines.total')}</h3>
          {runA.stages.map(s => <div className="compare-row" key={s.name}><span>{s.name}</span><strong>{s.durationSeconds}s</strong></div>)}
        </div>
        <div className="compare-col">
          <h3>{t('pipelines.run.label')} #{runB.runNumber} · {runB.status==='success'?<CheckCircle2 size={13}/>:<XCircle size={13}/>} {runB.durationSeconds}s {t('pipelines.total')}</h3>
          {runB.stages.map((s, i) => {
            const other = runA.stages[i]
            const delta = other ? s.durationSeconds - other.durationSeconds : 0
            return <div className="compare-row" key={s.name}>
              <span>{s.name}</span>
              <strong className={delta > 0 ? 'compare-row__delta--up' : delta < 0 ? 'compare-row__delta--down' : ''}>{s.durationSeconds}s ({delta > 0 ? '+' : ''}{delta}s)</strong>
            </div>
          })}
        </div>
      </div>
    </Modal>}
  </>
}
