import type { Asset, GraphLink, GraphNode, LogEntry, Pipeline, Ticket, Vulnerability } from '../types'

export const pipelines: Pipeline[] = [
  { id: 1, name: 'checkout-api', branch: 'main', owner: 'Commerce', status: 'success', duration: '4m 12s', updated: 'há 3 min', stages: [{name:'Build',status:'success',duration:'48s'},{name:'Testes',status:'success',duration:'2m 10s'},{name:'Segurança',status:'success',duration:'34s'},{name:'Deploy',status:'success',duration:'40s'}] },
  { id: 2, name: 'identity-service', branch: 'feat/passkeys', owner: 'IAM', status: 'running', duration: '2m 38s', updated: 'agora', stages: [{name:'Build',status:'success',duration:'51s'},{name:'Testes',status:'success',duration:'1m 22s'},{name:'Segurança',status:'running',duration:'25s'},{name:'Deploy',status:'pending',duration:'—'}] },
  { id: 3, name: 'web-storefront', branch: 'main', owner: 'Experience', status: 'failed', duration: '3m 07s', updated: 'há 18 min', stages: [{name:'Build',status:'success',duration:'42s'},{name:'Testes',status:'failed',duration:'2m 25s'},{name:'Segurança',status:'pending',duration:'—'},{name:'Deploy',status:'pending',duration:'—'}] },
  { id: 4, name: 'ledger-worker', branch: 'release/4.8', owner: 'FinOps', status: 'success', duration: '5m 44s', updated: 'há 32 min', stages: [{name:'Build',status:'success',duration:'1m 02s'},{name:'Testes',status:'success',duration:'3m 20s'},{name:'Segurança',status:'success',duration:'40s'},{name:'Deploy',status:'success',duration:'42s'}] },
]

export const logs: LogEntry[] = Array.from({ length: 48 }, (_, i) => {
  const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'DEBUG', 'ERROR'] as const
  const services = ['gateway', 'checkout-api', 'identity', 'catalog', 'payments']
  const messages = [
    'Request completed with status 200', 'Cache miss for product collection',
    'Connection pool nearing configured limit', 'Token refreshed successfully',
    'Payment provider returned an invalid response', 'Background job batch processed',
  ]
  return { id: i + 1, timestamp: `14:${String(58 - i).padStart(2,'0')}:${String((i * 7) % 60).padStart(2,'0')}.12${i % 9}`, level: levels[i % levels.length], service: services[i % services.length], message: messages[i % messages.length], trace: `tr_${(982341 + i * 117).toString(16)}` }
})

export const initialTickets: Ticket[] = [
  { id:'OPS-418', title:'Latência elevada no checkout da região sul', priority:'P0', status:'Em andamento', assignee:'Ana Lima', tags:['incidente','checkout'], age:'18 min' },
  { id:'OPS-417', title:'Rotacionar credenciais do registry', priority:'P1', status:'Revisão', assignee:'Caio N.', tags:['segurança'], age:'2 h' },
  { id:'OPS-416', title:'Aumentar retenção dos logs de auditoria', priority:'P2', status:'Backlog', assignee:'Bia Reis', tags:['logs','compliance'], age:'5 h' },
  { id:'OPS-415', title:'Atualizar ingress controller para v1.11', priority:'P2', status:'Em andamento', assignee:'Davi S.', tags:['k8s'], age:'1 d' },
  { id:'OPS-414', title:'Documentar failover do banco principal', priority:'P3', status:'Concluído', assignee:'Ana Lima', tags:['docs'], age:'2 d' },
]

export const serviceNodes: GraphNode[] = [
  {id:'gateway',group:'edge',health:'healthy'}, {id:'identity',group:'core',health:'healthy'},
  {id:'checkout',group:'commerce',health:'critical'}, {id:'catalog',group:'commerce',health:'healthy'},
  {id:'payments',group:'finance',health:'warning'}, {id:'ledger',group:'finance',health:'healthy'},
  {id:'notifications',group:'platform',health:'healthy'}, {id:'fraud',group:'finance',health:'healthy'},
]
export const serviceLinks: GraphLink[] = [
  {source:'gateway',target:'identity',value:90},{source:'gateway',target:'checkout',value:75},
  {source:'gateway',target:'catalog',value:55},{source:'checkout',target:'payments',value:80},
  {source:'checkout',target:'catalog',value:65},{source:'payments',target:'ledger',value:70},
  {source:'payments',target:'fraud',value:45},{source:'checkout',target:'notifications',value:30},
]

export const vulnerabilities: Vulnerability[] = [
  {id:'v1',cve:'CVE-2026-3182',package:'openssl 3.1.2',asset:'checkout-api',severity:'Crítica',cvss:9.8,status:'Aberta',due:'Hoje'},
  {id:'v2',cve:'CVE-2026-2901',package:'lodash 4.17.20',asset:'web-storefront',severity:'Alta',cvss:8.1,status:'Em correção',due:'2 dias'},
  {id:'v3',cve:'CVE-2025-8842',package:'golang 1.22.1',asset:'ledger-worker',severity:'Alta',cvss:7.6,status:'Aberta',due:'4 dias'},
  {id:'v4',cve:'CVE-2026-1120',package:'nginx 1.24',asset:'edge-proxy',severity:'Média',cvss:6.4,status:'Aceita',due:'14 dias'},
  {id:'v5',cve:'CVE-2025-9918',package:'axios 1.6.2',asset:'admin-portal',severity:'Baixa',cvss:3.2,status:'Resolvida',due:'—'},
]

export const assets: Asset[] = [
  {id:'AT-1029',name:'MacBook Pro 14”',type:'Notebook',owner:'Ana Lima',status:'Ativo',location:'São Paulo',value:14500,warranty:'12/2027'},
  {id:'AT-1028',name:'Dell Latitude 7440',type:'Notebook',owner:'Caio Nunes',status:'Ativo',location:'Remoto',value:9200,warranty:'08/2027'},
  {id:'AT-1027',name:'Cisco Catalyst 9300',type:'Rede',owner:'Infra Core',status:'Ativo',location:'DC SP-01',value:42800,warranty:'03/2028'},
  {id:'AT-1026',name:'iPhone 15',type:'Mobile',owner:'Bia Reis',status:'Manutenção',location:'São Paulo',value:6800,warranty:'01/2027'},
  {id:'AT-1025',name:'YubiKey 5 NFC',type:'Segurança',owner:'—',status:'Estoque',location:'Almoxarifado',value:420,warranty:'—'},
]
