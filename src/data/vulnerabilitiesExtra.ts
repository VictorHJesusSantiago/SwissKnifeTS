// Dados mock exclusivos para as funcionalidades extras da VulnerabilitiesPage.
// Não editar src/data/mockData.ts — este arquivo é auto-contido.

// O tipo Vulnerability (em src/types/index.ts) não possui um campo de data de detecção,
// apenas `due` (texto livre, ex: "Hoje", "2 dias"). Para poder calcular uma linha do tempo
// de remediação real (decorrido vs. prazo do SLA) precisamos de uma data de referência de
// quando a vulnerabilidade foi detectada. Mantemos esse dado aqui, indexado por id,
// como complemento local — sem tocar no mock original.
export const detectedAtById: Record<string, string> = {
  v1: '2026-07-06T09:00:00', // Crítica, detectada ontem — SLA de 2 dias, portanto já perto do limite
  v2: '2026-07-02T11:30:00', // Alta, detectada há 5 dias — SLA de 7 dias
  v3: '2026-06-20T08:15:00', // Alta, detectada há 17 dias — SLA de 7 dias já estourado
  v4: '2026-06-25T14:00:00', // Média, detectada há 12 dias — SLA de 30 dias
  v5: '2026-05-10T10:00:00', // Baixa, resolvida — SLA de 90 dias, fora de risco
}

// SLA (em dias) por severidade de vulnerabilidade.
export const slaDaysBySeverity: Record<string, number> = {
  'Crítica': 2,
  'Alta': 7,
  'Média': 30,
  'Baixa': 90,
}

// Heurística de "exploitability" (probabilidade de exploração, 1-5) por severidade,
// usada como eixo de probabilidade na matriz de risco quando não há um campo de
// exploitability explícito no CVSS mockado. Vulnerabilidades mais severas tendem a ter
// vetores de ataque mais simples/expostos, por isso mapeamos severidade -> probabilidade base,
// e refinamos com o próprio valor de CVSS (score mais alto = leve acréscimo de probabilidade).
export const baseProbabilityBySeverity: Record<string, number> = {
  'Crítica': 5,
  'Alta': 4,
  'Média': 2,
  'Baixa': 1,
}
