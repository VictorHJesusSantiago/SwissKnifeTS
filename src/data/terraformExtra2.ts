// Dados mock exclusivos para a segunda leva de funcionalidades extras da TerraformPage.
// Não editar src/data/mockData.ts nem src/data/terraformExtra.ts — arquivo auto-contido.

export interface CostHistoryPoint { month: string; total: number }

// Histórico mockado de custo total mensal ao longo dos últimos 6 meses.
export const costHistory: CostHistoryPoint[] = [
  { month: 'fev/26', total: 1690 },
  { month: 'mar/26', total: 1740 },
  { month: 'abr/26', total: 1810 },
  { month: 'mai/26', total: 1955 },
  { month: 'jun/26', total: 2040 },
  { month: 'jul/26', total: 2370 },
]
