import type { PipelineRun } from './pipelinesExtra'

// --- Item 5: meta-DAG entre pipelines (cadeia mock fixa de disparo) ---
// checkout-api (1) dispara identity-service (2), que dispara web-storefront (3), que dispara ledger-worker (4).
export const PIPELINE_TRIGGER_CHAIN: Record<number, number[]> = {
  1: [2],
  2: [3],
  3: [4],
  4: [],
}

// --- Item 6: custo estimado por execução ---
export const COST_PER_MINUTE_BRL = 0.8

export function estimateRunCost(run: PipelineRun): number {
  return Math.round((run.durationSeconds / 60) * COST_PER_MINUTE_BRL * 100) / 100
}

export function estimateMonthlyCost(runs: PipelineRun[]): number {
  return Math.round(runs.reduce((sum, r) => sum + estimateRunCost(r), 0) * 100) / 100
}

// --- Item 7: registro de artefatos simulado ---
export interface RunArtifact {
  name: string
  sizeMb: number
}

export function artifactFor(run: PipelineRun): RunArtifact {
  let hash = 0
  for (let i = 0; i < run.id.length; i++) hash = (hash * 31 + run.id.charCodeAt(i)) >>> 0
  const sizeMb = Math.round(((hash % 4000) / 100 + 4) * 10) / 10
  return { name: `build-${run.runNumber}.tar.gz`, sizeMb }
}

export function downloadArtifact(pipelineName: string, run: PipelineRun, artifact: RunArtifact): void {
  const payload = {
    artifact: artifact.name,
    pipeline: pipelineName,
    runNumber: run.runNumber,
    status: run.status,
    durationSeconds: run.durationSeconds,
    sizeMb: artifact.sizeMb,
    generatedAt: new Date().toISOString(),
    note: 'Arquivo simulado gerado pelo OpsPhere para representar o artefato de build desta execução.',
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = artifact.name.replace('.tar.gz', '.json')
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
