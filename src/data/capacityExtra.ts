export interface SprintDay { day: string; planned: number; completed: number }
export const sprintBurndown: SprintDay[] = [
  { day: 'D1', planned: 8, completed: 7 },
  { day: 'D2', planned: 16, completed: 15 },
  { day: 'D3', planned: 24, completed: 20 },
  { day: 'D4', planned: 32, completed: 29 },
  { day: 'D5', planned: 40, completed: 33 },
  { day: 'D6', planned: 48, completed: 41 },
  { day: 'D7', planned: 56, completed: 50 },
  { day: 'D8', planned: 64, completed: 58 },
  { day: 'D9', planned: 72, completed: 64 },
  { day: 'D10', planned: 80, completed: 76 },
]
export const sprintTotalPoints = 80

export interface PersonAllocation { person: string; team: string; allocations: Record<string, number> }
export const projects = ['Checkout v3', 'Migração EKS', 'Lakehouse', 'Passkeys', 'CLI v2']
export const peopleAllocation: PersonAllocation[] = [
  { person: 'Ana Lima', team: 'Platform Core', allocations: { 'Migração EKS': 70, 'Lakehouse': 10 } },
  { person: 'Caio Nunes', team: 'Commerce', allocations: { 'Checkout v3': 90 } },
  { person: 'Bia Reis', team: 'IAM & Security', allocations: { 'Passkeys': 60, 'Migração EKS': 20 } },
  { person: 'Davi Souza', team: 'Data Platform', allocations: { 'Lakehouse': 80 } },
  { person: 'Ellen Costa', team: 'Developer Experience', allocations: { 'CLI v2': 75 } },
  { person: 'Felipe Rocha', team: 'Commerce', allocations: { 'Checkout v3': 50, 'Migração EKS': 10 } },
  { person: 'Gabi Martins', team: 'Platform Core', allocations: { 'Migração EKS': 60, 'Lakehouse': 15 } },
]

export interface Absence { person: string; start: string; end: string }
export const absences: Absence[] = [
  { person: 'Ana Lima', start: '2026-07-06', end: '2026-07-10' },
  { person: 'Caio Nunes', start: '2026-07-14', end: '2026-07-21' },
  { person: 'Bia Reis', start: '2026-07-01', end: '2026-07-03' },
  { person: 'Davi Souza', start: '2026-07-22', end: '2026-07-24' },
  { person: 'Ellen Costa', start: '2026-07-27', end: '2026-07-31' },
]

export const HOURS_PER_PERSON_WEEK = 40

// --- Histórico de sprints (utilização de capacidade) ---
export interface SprintHistoryEntry { sprint: string; utilization: number }
export const sprintHistory: SprintHistoryEntry[] = [
  { sprint: 'Sprint 18', utilization: 78 },
  { sprint: 'Sprint 19', utilization: 85 },
  { sprint: 'Sprint 20', utilization: 91 },
  { sprint: 'Sprint 21', utilization: 88 },
  { sprint: 'Sprint 22', utilization: 94 },
]

// Utilização individual por sprint, usada para detectar burnout (>90% por 2+ sprints seguidos)
export const personSprintUtilization: Record<string, number[]> = {
  'Ana Lima': [72, 80, 88, 91, 95],
  'Caio Nunes': [90, 92, 94, 96, 97],
  'Bia Reis': [65, 70, 68, 72, 74],
  'Davi Souza': [80, 84, 90, 93, 92],
  'Ellen Costa': [70, 75, 78, 80, 82],
  'Felipe Rocha': [60, 62, 65, 66, 68],
  'Gabi Martins': [88, 91, 93, 95, 96],
}

// --- Rodízio de plantão ---
export const onCallRoster = ['Ana Lima', 'Caio Nunes', 'Bia Reis', 'Davi Souza', 'Ellen Costa', 'Felipe Rocha', 'Gabi Martins']

// --- Skill matrix ---
export const skills = ['Backend', 'Kubernetes', 'Segurança', 'Frontend'] as const
export type Skill = typeof skills[number]
export const skillMatrix: Record<string, Record<Skill, number>> = {
  'Ana Lima': { Backend: 4, Kubernetes: 5, 'Segurança': 3, Frontend: 2 },
  'Caio Nunes': { Backend: 5, Kubernetes: 2, 'Segurança': 2, Frontend: 4 },
  'Bia Reis': { Backend: 3, Kubernetes: 3, 'Segurança': 5, Frontend: 2 },
  'Davi Souza': { Backend: 4, Kubernetes: 4, 'Segurança': 3, Frontend: 1 },
  'Ellen Costa': { Backend: 2, Kubernetes: 2, 'Segurança': 2, Frontend: 5 },
  'Felipe Rocha': { Backend: 3, Kubernetes: 3, 'Segurança': 2, Frontend: 3 },
  'Gabi Martins': { Backend: 4, Kubernetes: 5, 'Segurança': 4, Frontend: 2 },
}
