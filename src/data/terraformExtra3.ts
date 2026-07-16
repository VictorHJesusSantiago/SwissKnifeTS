// Dados mock exclusivos para a terceira leva de funcionalidades extras da TerraformPage.
// Não editar src/data/mockData.ts, terraformExtra.ts nem terraformExtra2.ts — arquivo auto-contido.

export interface ProviderVersionInfo {
  name: string
  constraint: string
  current: string
  latest: string
}

// Versão de provider "instalada" (mock) vs. versão mais recente disponível (mock) para
// exibição de uma matriz de compatibilidade/atualização.
export const providerVersions: ProviderVersionInfo[] = [
  { name: 'aws', constraint: '~> 5.0', current: '5.42.0', latest: '5.58.0' },
  { name: 'kubernetes', constraint: '~> 2.20', current: '2.23.0', latest: '2.31.0' },
  { name: 'random', constraint: '~> 3.5', current: '3.6.0', latest: '3.6.2' },
  { name: 'null', constraint: '~> 3.2', current: '3.2.2', latest: '3.2.2' },
  { name: 'archive', constraint: '~> 2.4', current: '2.4.0', latest: '2.6.0' },
]

// Compara duas versões semver simplificadas (x.y.z). Retorna true se `current` < `latest`.
export function isProviderOutdated(current: string, latest: string): boolean {
  const a = current.split('.').map(Number)
  const b = latest.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0, bv = b[i] ?? 0
    if (av < bv) return true
    if (av > bv) return false
  }
  return false
}

export interface RightsizingSuggestion {
  resourceId: string
  resourceType: string
  message: string
  estimatedMonthlySavings: number
}

// Sugestões mock de rightsizing, derivadas da tabela de custo mensal por tipo (monthlyCostByType
// em terraformExtra.ts). Os valores de economia são aproximações fixas para fins de demonstração.
export const rightsizingSuggestions: RightsizingSuggestion[] = [
  {
    resourceId: 'aws_eks_cluster.main',
    resourceType: 'aws_eks_cluster',
    message: 'aws_eks_cluster.main está com node groups superdimensionados para a carga média observada nas últimas semanas — considere reduzir de 3 para 2 node groups.',
    estimatedMonthlySavings: 280,
  },
  {
    resourceId: 'aws_rds_cluster.postgres',
    resourceType: 'aws_rds_cluster',
    message: 'aws_rds_cluster.postgres está subutilizado (CPU média abaixo de 20%) — considere uma instância menor (db.r6g.large em vez de db.r6g.xlarge).',
    estimatedMonthlySavings: 190,
  },
  {
    resourceId: 'aws_nat_gateway.primary',
    resourceType: 'aws_nat_gateway',
    message: 'aws_nat_gateway.primary tem baixo throughput de saída — avalie consolidar tráfego em uma única NAT gateway compartilhada entre subnets.',
    estimatedMonthlySavings: 90,
  },
]
