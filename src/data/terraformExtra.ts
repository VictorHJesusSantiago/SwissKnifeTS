// Dados mock exclusivos para as funcionalidades extras da TerraformPage.
// Não editar src/data/mockData.ts — este arquivo é auto-contido.

export type PlanAction = 'add' | 'change' | 'destroy'

export interface PlanResourceChange {
  address: string
  type: string
  action: PlanAction
  before: Record<string, string> | null
  after: Record<string, string> | null
}

export interface TerraformPlan {
  id: string
  label: string
  createdAt: string
  changes: PlanResourceChange[]
}

export const plans: TerraformPlan[] = [
  {
    id: 'plan-a',
    label: 'plan-2026-07-01-baseline',
    createdAt: '01/07/2026 09:12',
    changes: [
      { address: 'aws_vpc.main', type: 'aws_vpc', action: 'change', before: { cidr_block: '10.0.0.0/16', enable_dns_support: 'false' }, after: { cidr_block: '10.0.0.0/16', enable_dns_support: 'true' } },
      { address: 'aws_subnet.private_a', type: 'aws_subnet', action: 'add', before: null, after: { cidr_block: '10.0.1.0/24', az: 'sa-east-1a' } },
      { address: 'aws_eks_cluster.main', type: 'aws_eks_cluster', action: 'change', before: { version: '1.30' }, after: { version: '1.31' } },
      { address: 'aws_iam_role.legacy', type: 'aws_iam_role', action: 'destroy', before: { name: 'legacy-role', policy: 'AdministratorAccess' }, after: null },
    ],
  },
  {
    id: 'plan-b',
    label: 'plan-2026-07-05-scale-up',
    createdAt: '05/07/2026 16:47',
    changes: [
      { address: 'aws_vpc.main', type: 'aws_vpc', action: 'change', before: { cidr_block: '10.0.0.0/16', enable_dns_support: 'true' }, after: { cidr_block: '10.0.0.0/16', enable_dns_support: 'true' } },
      { address: 'aws_subnet.private_a', type: 'aws_subnet', action: 'change', before: { cidr_block: '10.0.1.0/24', az: 'sa-east-1a' }, after: { cidr_block: '10.0.1.0/23', az: 'sa-east-1a' } },
      { address: 'aws_rds_cluster.postgres', type: 'aws_rds_cluster', action: 'change', before: { instances: '3' }, after: { instances: '5' } },
      { address: 'aws_lambda_function.notifier', type: 'aws_lambda_function', action: 'add', before: null, after: { runtime: 'nodejs20.x', memory: '256' } },
      { address: 'aws_nat_gateway.primary', type: 'aws_nat_gateway', action: 'destroy', before: { allocation_id: 'eipalloc-0912a' }, after: null },
    ],
  },
  {
    id: 'plan-c',
    label: 'plan-2026-07-06-security-hardening',
    createdAt: '06/07/2026 11:03',
    changes: [
      { address: 'aws_security_group.default', type: 'aws_security_group', action: 'change', before: { ingress_0_0_0_0: 'true' }, after: { ingress_0_0_0_0: 'false' } },
      { address: 'aws_iam_role.cluster', type: 'aws_iam_role', action: 'change', before: { policy: 'broad' }, after: { policy: 'least-privilege' } },
      { address: 'aws_s3_bucket.audit_logs', type: 'aws_s3_bucket', action: 'add', before: null, after: { versioning: 'true', encryption: 'AES256' } },
    ],
  },
]

// Grafo de dependências: aresta A -> B significa "A depende de B"
export interface DependencyEdge { from: string; to: string }

export const dependencyNodes: string[] = [
  'aws_vpc.main',
  'aws_subnet.private_a',
  'aws_nat_gateway.primary',
  'aws_security_group.default',
  'aws_iam_role.cluster',
  'aws_eks_cluster.main',
  'aws_rds_cluster.postgres',
  'aws_lambda_function.notifier',
  'aws_s3_bucket.audit_logs',
]

export const dependencyEdges: DependencyEdge[] = [
  { from: 'aws_subnet.private_a', to: 'aws_vpc.main' },
  { from: 'aws_nat_gateway.primary', to: 'aws_subnet.private_a' },
  { from: 'aws_security_group.default', to: 'aws_vpc.main' },
  { from: 'aws_eks_cluster.main', to: 'aws_subnet.private_a' },
  { from: 'aws_eks_cluster.main', to: 'aws_security_group.default' },
  { from: 'aws_eks_cluster.main', to: 'aws_iam_role.cluster' },
  { from: 'aws_rds_cluster.postgres', to: 'aws_subnet.private_a' },
  { from: 'aws_rds_cluster.postgres', to: 'aws_security_group.default' },
  { from: 'aws_lambda_function.notifier', to: 'aws_vpc.main' },
  { from: 'aws_s3_bucket.audit_logs', to: 'aws_iam_role.cluster' },
]

export type ApplyStatus = 'success' | 'failed' | 'rolled-back'

export interface ApplyEvent {
  id: string
  date: string
  author: string
  summary: string
  status: ApplyStatus
}

export const initialApplies: ApplyEvent[] = [
  { id: 'apply-1041', date: '06/07/2026 18:22', author: 'Ana Lima', summary: 'Endurecimento das regras do security group padrão', status: 'success' },
  { id: 'apply-1040', date: '05/07/2026 16:52', author: 'Caio Nunes', summary: 'Escalonamento do cluster RDS para 5 instâncias', status: 'success' },
  { id: 'apply-1039', date: '05/07/2026 09:15', author: 'Davi Souza', summary: 'Provisionamento da função Lambda notifier', status: 'failed' },
  { id: 'apply-1038', date: '01/07/2026 09:14', author: 'Bia Reis', summary: 'Atualização do EKS para versão 1.31 e remoção da IAM role legada', status: 'success' },
  { id: 'apply-1037', date: '28/06/2026 14:03', author: 'Ana Lima', summary: 'Criação da subnet privada sa-east-1a', status: 'success' },
]

// Custo mensal aproximado em Reais (R$) por tipo de recurso Terraform.
export const monthlyCostByType: Record<string, number> = {
  aws_vpc: 0,
  aws_subnet: 0,
  aws_nat_gateway: 260,
  aws_security_group: 0,
  aws_iam_role: 0,
  aws_eks_cluster: 950,
  aws_rds_cluster: 680,
  aws_lambda_function: 45,
  aws_s3_bucket: 15,
  aws_instance: 420,
  module: 0,
}
