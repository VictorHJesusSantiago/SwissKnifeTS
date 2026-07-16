import '../styles/pipelines-extra.css'
import '../styles/pipelines-extra2.css'
import '../styles/pipelines-extra3.css'
import {
  AlertOctagon, ArrowRight, Check, CheckCircle2, ChevronDown, Circle, Clock3, DollarSign, Download, Edit3,
  FastForward, GitBranch, Grid3x3, GripVertical, History, Package, Pause, Play, Radio, RefreshCw, RotateCcw,
  Square, Star, Trash2, Users, X, XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/ui/MetricCard'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAudit } from '../context/AuditContext'
import { useFavorites } from '../context/FavoritesContext'
import { useGlobalUndo } from '../context/GlobalUndoContext'
import { useNotifications } from '../context/NotificationContext'
import { useRole } from '../context/RoleContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { pipelines as source } from '../data/mockData'
import { getHistoryFor, type PipelineRun } from '../data/pipelinesExtra'
import {
  BREAKER_AUTHORS, BUILD_PLATFORMS, breakerFor, computeDora, isFlaky, makeWebhookEntry,
  simulateMatrixResult, type BuildPlatform, type WebhookLogEntry,
} from '../data/pipelinesExtra2'
import {
  artifactFor, downloadArtifact, estimateMonthlyCost, estimateRunCost, PIPELINE_TRIGGER_CHAIN,
  COST_PER_MINUTE_BRL,
} from '../data/pipelinesExtra3'
import { useI18n } from '../i18n/I18nContext'
import type { Pipeline, Status } from '../types'
import { classNames, formatCurrency } from '../utils/format'

type Stage = { name: string; status: Status; duration: string }
type ReplaySpeed = 1 | 2 | 4

function stageIcon(status: Status, size = 18) {
  return status === 'success' ? <Check size={size}/> : status === 'failed' ? <X size={size}/> : status === 'running' ? <RefreshCw className="spin" size={size}/> : <Clock3 size={size}/>
}

function DagNode({ stage, x, y, pipelineId, isFavorite, toggleFavorite, favLabel }: {
  stage: Stage; x: number; y: number; pipelineId: number
  isFavorite: (id: string) => boolean; toggleFavorite: (id: string, label: string) => void; favLabel: string
}) {
  const favId = `${pipelineId}-${stage.name}`
  return <div className="dag-graph__node" style={{ left: x, top: y }}>
    <div className={`dag__node-circle dag__node-circle--${stage.status}`}>{stageIcon(stage.status)}</div>
    <button className="dag-stage-fav" onClick={() => toggleFavorite(favId, favLabel)}><Star size={11} fill={isFavorite(favId) ? 'currentColor' : 'none'}/></button>
    <span>{stage.name}</span>
    <small>{stage.duration}</small>
  </div>
}

// DAG real: Build -> (Testes ‖ Segurança em paralelo) -> Deploy, com arestas de dependência desenhadas via SVG.
function PipelineDag({ stages, pipelineId, isFavorite, toggleFavorite }: {
  stages: Stage[]; pipelineId: number
  isFavorite: (module: 'pipelines', id: string) => boolean
  toggleFavorite: (item: { id: string; module: 'pipelines'; label: string }) => void
}) {
  const build = stages.find(s => s.name === 'Build')
  const tests = stages.find(s => s.name === 'Testes')
  const security = stages.find(s => s.name === 'Segurança')
  const deploy = stages.find(s => s.name === 'Deploy')

  const favIs = (id: string) => isFavorite('pipelines', id)
  const favToggle = (id: string, label: string) => toggleFavorite({ id, module: 'pipelines', label })

  if (!build || !tests || !security || !deploy) {
    return <div className="dag">
      {stages.flatMap((stage, i) => [
        <div className="dag__node" key={stage.name} style={{ position: 'relative' }}>
          <div className={`dag__node-circle dag__node-circle--${stage.status}`}>{stageIcon(stage.status)}</div>
          <button className="dag-stage-fav" onClick={() => favToggle(`${pipelineId}-${stage.name}`, `${stage.name} (#${pipelineId})`)}><Star size={11} fill={favIs(`${pipelineId}-${stage.name}`) ? 'currentColor' : 'none'}/></button>
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
    <DagNode stage={build} x={COL[0]} y={ROW_MID} pipelineId={pipelineId} isFavorite={favIs} toggleFavorite={favToggle} favLabel={`Build (#${pipelineId})`}/>
    <DagNode stage={tests} x={COL[1]} y={ROW_TOP} pipelineId={pipelineId} isFavorite={favIs} toggleFavorite={favToggle} favLabel={`Testes (#${pipelineId})`}/>
    <DagNode stage={security} x={COL[1]} y={ROW_BOTTOM} pipelineId={pipelineId} isFavorite={favIs} toggleFavorite={favToggle} favLabel={`Segurança (#${pipelineId})`}/>
    <DagNode stage={deploy} x={COL[2]} y={ROW_MID} pipelineId={pipelineId} isFavorite={favIs} toggleFavorite={favToggle} favLabel={`Deploy (#${pipelineId})`}/>
  </div>
}

// Item 5: meta-DAG mock entre pipelines — cadeia fixa de disparo definida em PIPELINE_TRIGGER_CHAIN.
function MetaDag({ pipelines, selectedId, onSelect }: { pipelines: Pipeline[]; selectedId: number; onSelect: (id: number) => void }) {
  const positions: Record<number, { x: number; y: number }> = {}
  pipelines.forEach((p, i) => { positions[p.id] = { x: 70 + i * 150, y: 40 } })
  const edges: { from: number; to: number }[] = []
  pipelines.forEach(p => (PIPELINE_TRIGGER_CHAIN[p.id] ?? []).forEach(to => { if (positions[to]) edges.push({ from: p.id, to }) }))

  return <div className="meta-dag-wrap">
    <svg className="meta-dag-svg" viewBox={`0 0 ${70 + pipelines.length * 150} 90`}>
      <defs>
        <marker id="meta-dag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--muted)"/>
        </marker>
      </defs>
      {edges.map(e => {
        const a = positions[e.from], b = positions[e.to]
        return <line key={`${e.from}-${e.to}`} className="meta-dag-edge" x1={a.x + 60} y1={a.y + 20} x2={b.x} y2={b.y + 20}/>
      })}
      {pipelines.map(p => {
        const pos = positions[p.id]
        return <g key={p.id} className={classNames('meta-dag-node', p.id === selectedId && 'is-selected')} onClick={() => onSelect(p.id)}>
          <rect x={pos.x} y={pos.y} width={120} height={40} rx={9}/>
          <text x={pos.x + 60} y={pos.y + 18} textAnchor="middle">{p.name}</text>
          <text className="meta-dag-node__sub" x={pos.x + 60} y={pos.y + 31} textAnchor="middle">#{p.id} · {p.status}</text>
        </g>
      })}
    </svg>
  </div>
}

export default function PipelinesPage() {
  const { t } = useI18n()
  const { logAction } = useAudit()
  const { addNotification } = useNotifications()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { canEdit } = useRole()
  const { registerUndo } = useGlobalUndo()
  const [pipelines, setPipelines] = useState(source)
  const [selected, setSelected] = useState<Pipeline | null>(source[1])
  const [running, setRunning] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [runA, setRunA] = useState<PipelineRun | null>(null)
  const [runB, setRunB] = useState<PipelineRun | null>(null)

  // --- Item 11: editor visual de pipeline (reorder + estágio custom, apenas local) ---
  const [customStages, setCustomStages] = useLocalStorage<Record<number, string[]>>('opsphere-pipelines-custom-stages', {})
  const [editorOpen, setEditorOpen] = useState(false)
  const [draftStages, setDraftStages] = useState<string[]>([])
  const [newStageName, setNewStageName] = useState('')
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  // --- Item 13: agendamento simulado tipo cron (só grava intenção) ---
  const [cronMap, setCronMap] = useLocalStorage<Record<number, string>>('opsphere-pipelines-cron', {})
  const [cronDraft, setCronDraft] = useState('')

  // --- Item 14: matriz de builds ---
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [matrixPlatforms, setMatrixPlatforms] = useState<BuildPlatform[]>(['linux-x64', 'windows'])
  const [matrixResults, setMatrixResults] = useState<Record<BuildPlatform, 'success' | 'failed'> | null>(null)
  const [matrixRunSeed, setMatrixRunSeed] = useState(0)

  // --- Item 15: anotações em execuções ---
  const [annotations, setAnnotations] = useLocalStorage<Record<string, string>>('opsphere-pipelines-run-annotations', {})

  // --- Item 17: webhooks simulados (somente sessão) ---
  const [webhookLog, setWebhookLog] = useState<WebhookLogEntry[]>([])
  const [webhookOpen, setWebhookOpen] = useState(false)
  const pushWebhook = (text: string) => setWebhookLog(list => [makeWebhookEntry(text), ...list].slice(0, 40))

  // --- Item 20: replay da execução ---
  const [replayIndex, setReplayIndex] = useState(0)
  const [replaying, setReplaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1)
  const replayTimer = useRef<number | null>(null)

  // --- Item 8: rollback de deploy ---
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [rollbackPick, setRollbackPick] = useState<PipelineRun | null>(null)

  // --- Item 9: simulação de deploy canário / blue-green ---
  const [canaryActive, setCanaryActive] = useState(false)
  const [canaryPaused, setCanaryPaused] = useState(false)
  const [canaryProgress, setCanaryProgress] = useState(0)
  const canaryTimer = useRef<number | null>(null)

  const history = selected ? getHistoryFor(selected.id) : []
  const dora = computeDora(pipelines)

  // --- Item 6: custo estimado por execução ---
  const monthlyRunCost = estimateMonthlyCost(history)

  // --- Item 8: candidatos de rollback (últimas execuções bem-sucedidas do histórico) ---
  const successfulRuns = history.filter(r => r.status === 'success').slice(0, 5)

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
    pushWebhook(`POST /hooks/slack disparado (simulado) — ${newRun.name} passou a running`)
    window.setTimeout(() => {
      updatePipeline(newRun.id, item => ({ ...item, status:'success', duration:'3m 41s', stages:item.stages.map(s=>({...s,status:'success'})) }))
      addNotification('Pipeline concluído', `${newRun.name} finalizou com sucesso.`, 'healthy')
      logAction('Pipeline concluído', `Execução manual "${newRun.name}" finalizou com sucesso`)
      pushWebhook(`POST /hooks/slack disparado (simulado) — ${newRun.name} passou a success`)
      setRunning(false)
    }, 2400)
  }

  const rerunPipeline = (p: Pipeline) => {
    updatePipeline(p.id, item => ({ ...item, status:'running', updated:'agora', stages: item.stages.map(s => ({ ...s, status: 'pending' as const })) }))
    logAction('Re-run disparado', `Pipeline "${p.name}" reiniciado manualmente`)
    pushWebhook(`POST /hooks/slack disparado (simulado) — ${p.name} passou a running`)
    window.setTimeout(() => {
      updatePipeline(p.id, item => ({ ...item, status:'success', duration: item.duration, stages: item.stages.map(s => ({ ...s, status: 'success' as const })) }))
      addNotification('Re-run concluído', `${p.name} foi reexecutado com sucesso.`, 'healthy')
      logAction('Re-run concluído', `Pipeline "${p.name}" finalizado com sucesso`)
      pushWebhook(`POST /hooks/slack disparado (simulado) — ${p.name} passou a success`)
    }, 1800)
  }

  const cancelPipeline = (p: Pipeline) => {
    updatePipeline(p.id, item => ({ ...item, status:'failed', stages: item.stages.map(s => s.status === 'success' ? s : { ...s, status: 'failed' as const }) }))
    addNotification('Pipeline cancelado', `${p.name} foi cancelado pelo usuário.`, 'warning')
    logAction('Pipeline cancelado', `Pipeline "${p.name}" cancelado manualmente`)
    pushWebhook(`POST /hooks/slack disparado (simulado) — ${p.name} passou a failed`)
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
      pushWebhook(`POST /hooks/slack disparado (simulado) — ${p.name} etapa liberada`)
    }, 1600)
  }

  const openCompare = () => {
    if (history.length >= 2) { setRunA(history[0]); setRunB(history[1]); setCompareOpen(true) }
  }

  // --- Editor visual (item 11) ---
  const openEditor = () => {
    if (!selected) return
    const saved = customStages[selected.id]
    setDraftStages(saved ?? selected.stages.map(s => s.name))
    setNewStageName('')
    setEditorOpen(true)
  }
  const moveDraftStage = (target: number) => {
    if (draggedIdx === null || draggedIdx === target) return
    setDraftStages(prev => {
      const next = [...prev]
      const [item] = next.splice(draggedIdx, 1)
      next.splice(target, 0, item)
      return next
    })
    setDraggedIdx(target)
  }
  const addDraftStage = () => {
    if (!newStageName.trim()) return
    setDraftStages(prev => [...prev, newStageName.trim()])
    setNewStageName('')
  }
  const removeDraftStage = (idx: number) => setDraftStages(prev => prev.filter((_, i) => i !== idx))
  const saveEditor = () => {
    if (!selected) return
    setCustomStages(prev => ({ ...prev, [selected.id]: draftStages }))
    logAction('Editor de pipeline salvo', `Ordem de estágios de "${selected.name}" atualizada (${draftStages.length} estágios)`)
    setEditorOpen(false)
  }

  // --- Cron (item 13) ---
  useEffect(() => { setCronDraft(selected ? (cronMap[selected.id] ?? '') : '') }, [selected?.id])
  const saveCron = () => {
    if (!selected) return
    setCronMap(prev => ({ ...prev, [selected.id]: cronDraft }))
    logAction('Agendamento definido', `Pipeline "${selected.name}" agendado: "${cronDraft}"`)
  }

  // --- Matriz de builds (item 14) ---
  const togglePlatform = (platform: BuildPlatform) => setMatrixPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform])
  const runMatrix = () => {
    if (!selected) return
    const seed = matrixRunSeed + 1
    setMatrixRunSeed(seed)
    const results = {} as Record<BuildPlatform, 'success' | 'failed'>
    matrixPlatforms.forEach(pl => { results[pl] = simulateMatrixResult(selected.id, pl, seed) })
    setMatrixResults(results)
    logAction('Matriz de builds executada', `Pipeline "${selected.name}" simulado em ${matrixPlatforms.join(', ')}`)
  }

  // --- Replay (item 20) ---
  const latestRun = history[0]
  const replayStages = latestRun?.stages ?? []
  const stopReplay = () => { setReplaying(false); if (replayTimer.current) { window.clearInterval(replayTimer.current); replayTimer.current = null } }
  const playReplay = () => {
    if (!replayStages.length) return
    if (replayIndex >= replayStages.length - 1) setReplayIndex(0)
    setReplaying(true)
  }
  useEffect(() => {
    if (!replaying) return
    replayTimer.current = window.setInterval(() => {
      setReplayIndex(i => {
        if (i >= replayStages.length - 1) { stopReplay(); return i }
        return i + 1
      })
    }, 1200 / replaySpeed)
    return () => { if (replayTimer.current) window.clearInterval(replayTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaying, replaySpeed, replayStages.length])
  useEffect(() => { stopReplay(); setReplayIndex(0) }, [selected?.id])

  // --- Item 5: navegação pela meta-DAG ---
  const selectPipelineById = (id: number) => {
    const target = pipelines.find(p => p.id === id)
    if (target) setSelected(target)
  }

  // --- Item 8: rollback de deploy ---
  const openRollback = () => {
    setRollbackPick(successfulRuns[0] ?? null)
    setRollbackOpen(true)
  }
  const confirmRollback = () => {
    if (!selected || !rollbackPick) return
    const previous = { ...selected }
    const restoredStages = selected.stages.map((s, i) => {
      const runStage = rollbackPick.stages[i]
      return runStage ? { ...s, status: 'success' as const, duration: `${runStage.durationSeconds}s` } : s
    })
    updatePipeline(selected.id, item => ({
      ...item,
      status: 'success',
      duration: `${rollbackPick.durationSeconds}s`,
      updated: `restaurado da execução #${rollbackPick.runNumber}`,
      stages: restoredStages,
    }))
    addNotification('Rollback aplicado', `"${selected.name}" restaurado para a execução #${rollbackPick.runNumber}.`, 'warning')
    logAction('Rollback de deploy', `Pipeline "${selected.name}" revertido para a execução #${rollbackPick.runNumber}`)
    registerUndo(`Rollback de "${selected.name}" desfeito`, () => {
      updatePipeline(previous.id, () => previous)
    })
    setRollbackOpen(false)
  }

  // --- Item 9: simulação de deploy canário / blue-green ---
  const stopCanaryTimer = () => { if (canaryTimer.current) { window.clearInterval(canaryTimer.current); canaryTimer.current = null } }
  const startCanary = () => {
    if (!selected) return
    setCanaryActive(true)
    setCanaryPaused(false)
    setCanaryProgress(0)
    logAction('Rollout canário iniciado', `Migração progressiva de tráfego iniciada para "${selected.name}"`)
    stopCanaryTimer()
    canaryTimer.current = window.setInterval(() => {
      setCanaryProgress(p => {
        const next = Math.min(100, p + 10)
        if (next >= 100) {
          stopCanaryTimer()
          addNotification('Rollout concluído', `100% do tráfego de "${selected.name}" migrado.`, 'healthy')
          logAction('Rollout canário concluído', `Migração de tráfego de "${selected.name}" finalizada em 100%`)
        }
        return next
      })
    }, 700)
  }
  const togglePauseCanary = () => {
    setCanaryPaused(paused => {
      const next = !paused
      if (next) stopCanaryTimer()
      else {
        canaryTimer.current = window.setInterval(() => {
          setCanaryProgress(p => {
            const nextP = Math.min(100, p + 10)
            if (nextP >= 100) stopCanaryTimer()
            return nextP
          })
        }, 700)
      }
      return next
    })
  }
  const abortCanary = () => {
    stopCanaryTimer()
    setCanaryActive(false)
    setCanaryPaused(false)
    setCanaryProgress(0)
    if (selected) {
      addNotification('Rollout abortado', `Migração de tráfego de "${selected.name}" abortada.`, 'critical')
      logAction('Rollout canário abortado', `Migração de tráfego de "${selected.name}" abortada em ${canaryProgress}%`)
    }
  }
  useEffect(() => () => stopCanaryTimer(), [])
  useEffect(() => { stopCanaryTimer(); setCanaryActive(false); setCanaryPaused(false); setCanaryProgress(0) }, [selected?.id])

  const gateStageIndex = selected?.stages.findIndex(s => s.name === 'Deploy' && s.status === 'pending') ?? -1
  const hasPendingGate = gateStageIndex !== undefined && gateStageIndex >= 0
    && selected?.stages.slice(0, gateStageIndex).every(s => s.status === 'success')

  return <>
    <PageHeader eyebrow={t('pipelines.eyebrow')} title={t('pipelines.title')} description={t('pipelines.subtitle')} actions={<button disabled={running || !canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} className="button button--primary" onClick={runPipeline}>{running?<RefreshCw className="spin" size={16}/>:<Play size={16}/>} {running?t('pipelines.starting'):t('pipelines.run')}</button>}/>
    <section className="metric-grid"><MetricCard label={t('pipelines.metricSuccessRate')} value="94,2%" delta="+1,8%"/><MetricCard label={t('pipelines.metricLeadTime')} value="8m 42s" delta="-12%"/><MetricCard label={t('pipelines.metricRuns')} value="128" delta="+18%"/><MetricCard label={t('pipelines.metricFailures')} value="7" delta="-3" tone="warning"/></section>

    <section className="panel" style={{ marginBottom: 14 }}>
      <div className="panel__header"><div><span className="eyebrow">{t('pipelines.doraEyebrow')}</span><h2>{t('pipelines.doraTitle')}</h2></div></div>
      <div className="dora-grid" style={{ padding: '0 18px 18px' }}>
        <MetricCard label={t('pipelines.doraLeadTime')} value={`${dora.leadTimeMinutes}min`}/>
        <MetricCard label={t('pipelines.doraDeployFreq')} value={`${dora.deployFrequencyPerDay}${t('pipelines.doraDeployFreqUnit')}`}/>
        <MetricCard label={t('pipelines.doraMttr')} value={`${dora.mttrMinutes}min`} tone="warning"/>
        <MetricCard label={t('pipelines.doraChangeFailure')} value={`${dora.changeFailureRatePct}%`} tone={dora.changeFailureRatePct > 15 ? 'critical' : 'info'}/>
      </div>
    </section>

    <section className="split-layout">
      <article className="panel list-panel"><div className="panel__header"><div><span className="eyebrow">{t('pipelines.executionsEyebrow')}</span><h2>{t('pipelines.recentActivity')}</h2></div><button className="filter-button">{t('pipelines.filterAll')} <ChevronDown size={14}/></button></div>
        {pipelines.map(p=>{
          const flaky = isFlaky(getHistoryFor(p.id))
          return <button className={`pipeline-row ${selected?.id===p.id?'is-selected':''}`} key={p.id} onClick={()=>setSelected(p)}>
            <span className={`pipeline-status pipeline-status--${p.status}`}>{p.status==='success'?<Check/>:p.status==='failed'?<X/>:p.status==='running'?<RefreshCw className="spin"/>:<Circle/>}</span>
            <span className="grow"><strong>{p.name}</strong><small><GitBranch size={12}/>{p.branch} · {p.owner}</small></span>
            <span className="pipeline-row__badges">{flaky && <Badge tone="warning"><AlertOctagon size={10}/> {t('pipelines.flaky')}</Badge>}</span>
            <span><strong>{p.duration}</strong><small>{p.updated}</small></span>
          </button>
        })}
      </article>
      <article className="panel detail-panel">{selected && <>
        <div className="panel__header">
          <div><Badge tone={selected.status}>{selected.status}</Badge><h2>{selected.name}</h2><p>#{selected.id} · {selected.branch}</p></div>
          <div className="row" style={{display:'flex',gap:8, flexWrap:'wrap'}}>
            <button className="icon-button" title={t('pipelines.favorite')} onClick={()=>toggleFavorite({ id: String(selected.id), module: 'pipelines', label: selected.name })}><Star fill={isFavorite('pipelines', String(selected.id)) ? 'currentColor' : 'none'} size={17}/></button>
            <button className="icon-button" title={canEdit ? t('pipelines.rerun') : t('pipelines.viewerBlocked')} disabled={!canEdit} onClick={()=>rerunPipeline(selected)}><RotateCcw size={17}/></button>
            <button className="icon-button" title={canEdit ? t('pipelines.cancel') : t('pipelines.viewerBlocked')} disabled={!canEdit} onClick={()=>cancelPipeline(selected)}><X size={17}/></button>
            <button className="button button--tiny" disabled={history.length < 2} onClick={openCompare}>{t('pipelines.compareRuns')}</button>
            <button className="button button--tiny" disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={openEditor}><Edit3 size={13}/> {t('pipelines.editStages')}</button>
            <button className="button button--tiny" onClick={()=>setMatrixOpen(v=>!v)}><Grid3x3 size={13}/> {t('pipelines.matrixTitle')}</button>
            <button className="button button--tiny" disabled={!canEdit || successfulRuns.length === 0} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={openRollback}><History size={13}/> {t('pipelines.rollbackButton')}</button>
          </div>
        </div>

        {/* Item 5: meta-DAG entre pipelines */}
        <div className="panel__header"><div><span className="eyebrow">{t('pipelines.dagChainEyebrow')}</span><h2>{t('pipelines.dagChainTitle')}</h2></div></div>
        <p style={{padding:'0 18px', fontSize:11, color:'var(--muted)'}}>{t('pipelines.dagChainHint')}</p>
        <MetaDag pipelines={pipelines} selectedId={selected.id} onSelect={selectPipelineById}/>

        <PipelineDag stages={selected.stages} pipelineId={selected.id} isFavorite={isFavorite} toggleFavorite={toggleFavorite}/>

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

        {/* Item 13: agendamento simulado */}
        <div className="cron-row">
          <span className="cron-row__text">{t('pipelines.cronLabel')}:</span>
          <input placeholder={t('pipelines.cronPlaceholder')} value={cronDraft} disabled={!canEdit} onChange={e=>setCronDraft(e.target.value)}/>
          <button className="button button--tiny" disabled={!canEdit} onClick={saveCron}>{t('pipelines.cronSave')}</button>
          <span className="cron-row__text">{cronMap[selected.id] ? `${t('pipelines.cronDefined')} "${cronMap[selected.id]}"` : t('pipelines.cronNone')}</span>
        </div>

        {/* Item 14: matriz de builds */}
        {matrixOpen && <div className="panel" style={{margin:'10px 18px', border:'1px solid var(--border)'}}>
          <div className="panel__header"><div><span className="eyebrow">{t('pipelines.matrixTitle')}</span></div></div>
          <p style={{padding:'0 18px', fontSize:11, color:'var(--muted)'}}>{t('pipelines.matrixHint')}</p>
          <div className="matrix-platform-picker">
            {BUILD_PLATFORMS.map(pl => <label key={pl}><input type="checkbox" checked={matrixPlatforms.includes(pl)} onChange={()=>togglePlatform(pl)}/> {pl}</label>)}
          </div>
          <div style={{padding:'10px 18px 0'}}><button className="button button--tiny button--primary" disabled={!matrixPlatforms.length} onClick={runMatrix}>{t('pipelines.matrixRun')}</button></div>
          {matrixResults && <div className="matrix-grid">
            {matrixPlatforms.map(pl => <div className="matrix-cell" key={pl}>
              <strong>{pl}</strong>
              {matrixResults[pl]==='success' ? <Badge tone="healthy"><CheckCircle2 size={11}/> success</Badge> : <Badge tone="critical"><XCircle size={11}/> failed</Badge>}
            </div>)}
          </div>}
        </div>}

        {/* Item 20: replay da execução */}
        <div className="replay-controls">
          <span className="eyebrow">{t('pipelines.replayTitle')}</span>
          <button className="icon-button" disabled={!replayStages.length} onClick={replaying ? stopReplay : playReplay}>{replaying ? <Pause size={15}/> : <Play size={15}/>}</button>
          <button className="icon-button" disabled={!replayStages.length} onClick={()=>{ stopReplay(); setReplayIndex(0) }}><RotateCcw size={15}/></button>
          <span className="cron-row__text">{t('pipelines.replaySpeed')}:</span>
          <select value={replaySpeed} onChange={e=>setReplaySpeed(Number(e.target.value) as ReplaySpeed)}>
            <option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option>
          </select>
          <span className="cron-row__text">{replayStages.map((s,i)=>`${s.name}${i===replayIndex && replaying ? ' ▶' : i<replayIndex ? ' ✓' : ''}`).join('  →  ')}</span>
        </div>

        <div className="panel__header"><div><span className="eyebrow">{t('pipelines.historyEyebrow')}</span><h2>{t('pipelines.historyTitle')}</h2></div></div>
        <div className="history-chart-wrap">
          <BarChart suffix="s" data={history.slice(0,8).map(r => ({ label: `#${r.runNumber}`, value: r.durationSeconds, color: r.status==='failed' ? '#e05d5d' : undefined }))}/>
        </div>

        {/* Item 6: custo estimado por execução */}
        <div className="panel__header"><div><span className="eyebrow">{t('pipelines.costEyebrow')}</span><h2>{t('pipelines.costTitle')}</h2></div><DollarSign size={18}/></div>
        <div className="cost-panel">
          <div className="cost-summary">
            <div className="cost-summary__item"><span>{t('pipelines.costPerMinute')}</span><strong>{formatCurrency(COST_PER_MINUTE_BRL)}</strong></div>
            <div className="cost-summary__item"><span>{t('pipelines.costTotalMonth')}</span><strong>{formatCurrency(monthlyRunCost)}</strong></div>
          </div>
          <div className="cost-table">
            {history.slice(0,8).map(r => <div className="cost-table__row" key={r.id}>
              <span>#{r.runNumber}</span>
              <span className="grow">{t('pipelines.costDuration')}: {r.durationSeconds}s</span>
              <strong>{formatCurrency(estimateRunCost(r))}</strong>
            </div>)}
          </div>
        </div>

        {/* Item 7: registro de artefatos simulado */}
        <div className="panel__header"><div><span className="eyebrow">{t('pipelines.artifactsEyebrow')}</span><h2>{t('pipelines.artifactsTitle')}</h2></div><Package size={18}/></div>
        <div className="artifacts-list">
          {history.slice(0,8).map(r => {
            const artifact = artifactFor(r)
            return <div className="artifacts-row" key={r.id}>
              <span className="artifacts-row__name">{artifact.name}</span>
              <span className="artifacts-row__size">{artifact.sizeMb} MB</span>
              <button className="button button--tiny" onClick={() => downloadArtifact(selected.name, r, artifact)}><Download size={12}/> {t('pipelines.artifactDownload')}</button>
            </div>
          })}
        </div>

        {/* Item 9: simulação de deploy canário / blue-green */}
        <div className="panel__header"><div><span className="eyebrow">{t('pipelines.canaryEyebrow')}</span><h2>{t('pipelines.canaryTitle')}</h2></div></div>
        <div className="canary-panel">
          {!canaryActive
            ? <button className="button button--tiny button--primary" disabled={!canEdit} title={!canEdit ? t('pipelines.viewerBlocked') : undefined} onClick={startCanary}><Play size={13}/> {t('pipelines.canaryStart')}</button>
            : <>
              <div className="canary-progress-track"><div className="canary-progress-bar" style={{ width: `${canaryProgress}%` }}/></div>
              <div className="canary-controls">
                <span className="canary-status">{t('pipelines.canaryProgress')}: {canaryProgress}%</span>
                <button className="button button--tiny" onClick={togglePauseCanary}>{canaryPaused ? <Play size={13}/> : <Pause size={13}/>} {canaryPaused ? t('pipelines.canaryResume') : t('pipelines.canaryPause')}</button>
                <button className="button button--tiny" onClick={abortCanary}><Square size={13}/> {t('pipelines.canaryAbort')}</button>
              </div>
              {canaryProgress >= 100 && <span className="canary-status">{t('pipelines.canaryDone')}</span>}
            </>}
        </div>

        {/* Itens 15 & 16: anotações e "quem quebrou o build" */}
        {history.slice(0,5).map(run => <div className="run-annotation" key={run.id}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, marginBottom:4}}>
            <span>#{run.runNumber} · {run.status} · {run.durationSeconds}s</span>
            {run.status === 'failed' && <span className="breaker-tag"><Users size={11}/> {t('pipelines.brokenBy')}: {breakerFor(run)}</span>}
          </div>
          <textarea placeholder={t('pipelines.annotationPlaceholder')} value={annotations[run.id] ?? ''} disabled={!canEdit} onChange={e=>setAnnotations(a=>({...a,[run.id]:e.target.value}))}/>
        </div>)}

        {/* Item 17: webhooks simulados */}
        <div className="webhook-panel">
          <button className="webhook-panel__toggle" onClick={()=>setWebhookOpen(v=>!v)}><span><Radio size={13}/> {t('pipelines.webhooksTitle')} ({webhookLog.length})</span><ChevronDown size={14} style={{transform: webhookOpen ? 'rotate(180deg)' : undefined}}/></button>
          {webhookOpen && (webhookLog.length ? <div className="webhook-log">{webhookLog.map(w => <div className="webhook-log__row" key={w.id}>[{w.time}] {w.text}</div>)}</div> : <p className="webhook-log__empty">{t('pipelines.webhooksEmpty')}</p>)}
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

    {editorOpen && <Modal title={t('pipelines.editStagesTitle')} onClose={()=>setEditorOpen(false)}>
      <p style={{fontSize:11, color:'var(--muted)', marginBottom:12}}>{t('pipelines.editStagesHint')}</p>
      <div className="editor-stage-list">
        {draftStages.map((name, idx) => <div key={`${name}-${idx}`}
          className={classNames('editor-stage-row', draggedIdx===idx && 'is-dragging')}
          draggable
          onDragStart={()=>setDraggedIdx(idx)}
          onDragOver={e=>{e.preventDefault(); moveDraftStage(idx)}}
          onDragEnd={()=>setDraggedIdx(null)}>
          <GripVertical size={14}/>
          <strong>{name}</strong>
          <button className="icon-button" onClick={()=>removeDraftStage(idx)}><Trash2 size={14}/></button>
        </div>)}
      </div>
      <div className="editor-add-row">
        <input placeholder={t('pipelines.addStagePlaceholder')} value={newStageName} onChange={e=>setNewStageName(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') addDraftStage() }}/>
        <button className="button button--tiny" onClick={addDraftStage}>{t('pipelines.addStage')}</button>
      </div>
      <div style={{marginTop:14, display:'flex', justifyContent:'flex-end'}}>
        <button className="button button--primary" onClick={saveEditor}>{t('pipelines.saveStages')}</button>
      </div>
    </Modal>}

    {rollbackOpen && selected && <Modal title={t('pipelines.rollbackTitle')} onClose={()=>setRollbackOpen(false)}>
      {successfulRuns.length === 0
        ? <p style={{fontSize:11, color:'var(--muted)'}}>{t('pipelines.rollbackNone')}</p>
        : <div className="rollback-panel">
          <p style={{fontSize:11, color:'var(--muted)', margin:0}}>{t('pipelines.rollbackPick')}</p>
          <div className="rollback-list">
            {successfulRuns.map(r => <button key={r.id} type="button"
              className={classNames('rollback-option', rollbackPick?.id === r.id && 'is-selected')}
              onClick={()=>setRollbackPick(r)}>
              <CheckCircle2 size={14}/>
              <span className="grow">#{r.runNumber} · {r.date}</span>
              <strong>{r.durationSeconds}s</strong>
            </button>)}
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
            <button className="button button--tiny" onClick={()=>setRollbackOpen(false)}>{t('overview.widgetBuilderCancel')}</button>
            <button className="button button--tiny button--primary" disabled={!rollbackPick} onClick={confirmRollback}>{t('pipelines.rollbackConfirm')}</button>
          </div>
        </div>}
    </Modal>}
  </>
}
