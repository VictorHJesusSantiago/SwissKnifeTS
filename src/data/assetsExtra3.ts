// Dados/tipos auxiliares para solicitação de novos ativos e projeção de depreciação (AssetsPage).

export type AssetRequestStatus = 'pendente' | 'aprovado' | 'negado'

export interface AssetRequest {
  id: string
  name: string
  type: string
  justification: string
  requestedBy: string
  status: AssetRequestStatus
  createdAt: string // ISO
}

export const ASSET_REQUEST_TYPES = ['Notebook', 'Mobile', 'Rede', 'Segurança'] as const

export const initialAssetRequests: AssetRequest[] = []

/** Valor estimado do ativo ao longo dos próximos N anos, usando depreciação linear já existente no projeto. */
export function projectDepreciation(value: number, ratePerYear: number, years: number) {
  const points: { year: number; value: number }[] = []
  for (let y = 0; y <= years; y++) {
    const factor = Math.max(0, 1 - ratePerYear * y)
    points.push({ year: y, value: Math.round(value * factor) })
  }
  return points
}
