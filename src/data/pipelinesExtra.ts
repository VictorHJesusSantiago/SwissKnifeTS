import { getSeed } from '../utils/seed'

export interface PipelineRun {
  id: string
  pipelineId: number
  runNumber: number
  status: 'success' | 'failed' | 'running' | 'pending'
  durationSeconds: number
  date: string
  stages: { name: string; durationSeconds: number }[]
}

const STAGE_NAMES = ['Build', 'Testes', 'Segurança', 'Deploy']

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function buildHistory(pipelineId: number, baseDuration: number, count = 12): PipelineRun[] {
  const rand = seededRandom(pipelineId * 97 + 13 + getSeed() * 7)
  const runs: PipelineRun[] = []
  for (let i = count; i > 0; i--) {
    const variance = 0.7 + rand() * 0.7
    const total = Math.round(baseDuration * variance)
    const failed = rand() < 0.12
    const stageShares = [0.18, 0.42, 0.15, 0.25]
    const stages = STAGE_NAMES.map((name, idx) => ({
      name,
      durationSeconds: Math.max(5, Math.round(total * stageShares[idx] * (0.8 + rand() * 0.4))),
    }))
    runs.push({
      id: `${pipelineId}-run-${i}`,
      pipelineId,
      runNumber: count - i + 1,
      status: failed ? 'failed' : 'success',
      durationSeconds: total,
      date: `${i} execuções atrás`,
      stages,
    })
  }
  return runs
}

export const pipelineHistory: Record<number, PipelineRun[]> = {
  1: buildHistory(1, 252),
  2: buildHistory(2, 158),
  3: buildHistory(3, 187),
  4: buildHistory(4, 344),
}

export function getHistoryFor(pipelineId: number): PipelineRun[] {
  return pipelineHistory[pipelineId] ?? buildHistory(pipelineId, 200)
}
