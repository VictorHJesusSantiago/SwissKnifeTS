// Dados mock exclusivos para a terceira leva de funcionalidades extras da VulnerabilitiesPage.
// Não editar src/data/mockData.ts, vulnerabilitiesExtra.ts nem vulnerabilitiesExtra2.ts — arquivo auto-contido.
import type { Vulnerability } from '../types'

export interface CveCatalogEntry {
  id: string
  description: string
  typicalSeverity: Vulnerability['severity']
}

// Pequeno catálogo estático de CVEs conhecidas (não vinculado às vulnerabilidades do projeto),
// usado como base de consulta/pesquisa independente da lista de vulnerabilidades ativas.
export const cveCatalog: CveCatalogEntry[] = [
  { id: 'CVE-2021-44228', description: 'Log4Shell — execução remota de código via JNDI lookup no Log4j 2.x', typicalSeverity: 'Crítica' },
  { id: 'CVE-2022-22965', description: 'Spring4Shell — execução remota de código via data binding no Spring Framework', typicalSeverity: 'Crítica' },
  { id: 'CVE-2014-0160', description: 'Heartbleed — vazamento de memória no OpenSSL via extensão heartbeat do TLS', typicalSeverity: 'Crítica' },
  { id: 'CVE-2017-5638', description: 'Execução remota de código no Apache Struts via cabeçalho Content-Type malformado', typicalSeverity: 'Crítica' },
  { id: 'CVE-2019-0708', description: 'BlueKeep — execução remota de código no serviço RDP do Windows', typicalSeverity: 'Crítica' },
  { id: 'CVE-2020-1472', description: 'Zerologon — elevação de privilégio via protocolo Netlogon em controladores de domínio', typicalSeverity: 'Crítica' },
  { id: 'CVE-2023-4863', description: 'Estouro de buffer no processamento de imagens WebP (libwebp)', typicalSeverity: 'Alta' },
  { id: 'CVE-2022-1388', description: 'Bypass de autenticação na iControl REST API do F5 BIG-IP', typicalSeverity: 'Alta' },
  { id: 'CVE-2018-7600', description: 'Drupalgeddon2 — execução remota de código no core do Drupal', typicalSeverity: 'Alta' },
  { id: 'CVE-2015-1635', description: 'Execução remota de código no HTTP.sys do Windows via requisição HTTP malformada', typicalSeverity: 'Média' },
]

// Itens genéricos de checklist de remediação, aplicáveis a qualquer vulnerabilidade.
export const remediationChecklistItems: string[] = [
  'Identificar sistemas e ativos afetados',
  'Avaliar exposição e possibilidade de exploração ativa',
  'Aplicar patch ou mitigação recomendada',
  'Validar a correção em ambiente de staging',
  'Confirmar a aplicação em produção e encerrar o item',
]
