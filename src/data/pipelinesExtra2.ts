import type { Pipeline } from '../types'
import { getHistoryFor, type PipelineRun } from './pipelinesExtra'

export const BUILD_PLATFORMS = ['linux-x64', 'linux-arm64', 'windows'] as const
export type BuildPlatform = typeof BUILD_PLATFORMS[number]

export const BREAKER_AUTHORS = ['Ana Lima', 'Caio Nunes', 'Bia Reis', 'Davi Souza', 'Felipe Rocha']

/** Retorna true se as últimas execuções alternaram sucesso/falha >= threshold vezes (pipeline "instável"). */
export function isFlaky(history: PipelineRun[], sampleSize = 5, threshold = 2): boolean {
  const sample = history.slice(0, sampleSize)
  if (sample.length < 3) return false
  let alternations = 0
  for (let i = 1; i < sample.length; i++) {
    if (sample[i].status !== sample[i - 1].status) alternations++
  }
  return alternations >= threshold
}

/** Autor mock "responsável" por uma execução com falha, via rotação determinística pelo id da run. */
export function breakerFor(run: PipelineRun): string {
  let hash = 0
  for (let i = 0; i < run.id.length; i++) hash = (hash * 31 + run.id.charCodeAt(i)) >>> 0
  return BREAKER_AUTHORS[hash % BREAKER_AUTHORS.length]
}

/** Simula o resultado de uma combinação pipeline x plataforma, de forma determinística por seed. */
export function simulateMatrixResult(pipelineId: number, platform: BuildPlatform, seedOffset: number): 'success' | 'failed' {
  let hash = pipelineId * 131 + seedOffset * 17
  for (let i = 0; i < platform.length; i++) hash = (hash * 31 + platform.charCodeAt(i)) >>> 0
  return (hash % 10) < 8 ? 'success' : 'failed'
}

export interface DoraMetrics {
  leadTimeMinutes: number
  deployFrequencyPerDay: number
  mttrMinutes: number
  changeFailureRatePct: number
}

/** Métricas DORA aproximadas calculadas localmente a partir do histórico mock de execuções. */
export function computeDora(pipelines: Pipeline[]): DoraMetrics {
  let totalDuration = 0
  let totalRuns = 0
  let totalFailed = 0
  let totalFailedDuration = 0

  pipelines.forEach(p => {
    const history = getHistoryFor(p.id)
    history.forEach(run => {
      totalDuration += run.durationSeconds
      totalRuns++
      if (run.status === 'failed') {
        totalFailed++
        totalFailedDuration += run.durationSeconds * 4 // aproxima tempo de recuperação como múltiplo da duração da execução
      }
    })
  })

  const leadTimeMinutes = totalRuns ? Math.round((totalDuration / totalRuns) / 60 * 10) / 10 : 0
  const deployFrequencyPerDay = pipelines.length ? Math.round((totalRuns / pipelines.length / 12) * 10) / 10 : 0
  const mttrMinutes = totalFailed ? Math.round((totalFailedDuration / totalFailed) / 60 * 10) / 10 : 0
  const changeFailureRatePct = totalRuns ? Math.round((totalFailed / totalRuns) * 1000) / 10 : 0

  return { leadTimeMinutes, deployFrequencyPerDay, mttrMinutes, changeFailureRatePct }
}

export interface WebhookLogEntry {
  id: string
  time: string
  text: string
}

export function makeWebhookEntry(text: string): WebhookLogEntry {
  return { id: `wh${Date.now()}${Math.random().toString(36).slice(2, 6)}`, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text }
}
