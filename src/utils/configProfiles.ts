const PREFIX = 'opsphere-'
const PROFILES_KEY = 'opsphere-config-profiles'

export interface ConfigProfile {
  name: string
  savedAt: string
  data: Record<string, unknown>
}

const PREF_KEYS = ['opsphere-theme', 'opsphere-density', 'opsphere-lang', 'opsphere-high-contrast', 'opsphere-presentation-mode', 'opsphere-reading-mode', 'opsphere-ui-scale', 'opsphere-accent-color', 'opsphere-keyboard-only', 'opsphere-shortcut-bindings', 'opsphere-sidebar']

export function listProfiles(): ConfigProfile[] {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]') } catch { return [] }
}

export function saveProfile(name: string) {
  const data: Record<string, unknown> = {}
  PREF_KEYS.forEach(key => {
    const value = localStorage.getItem(key)
    if (value !== null) data[key] = JSON.parse(value)
  })
  const profiles = listProfiles().filter(p => p.name !== name)
  profiles.push({ name, savedAt: new Date().toLocaleString('pt-BR'), data })
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function applyProfile(name: string) {
  const profile = listProfiles().find(p => p.name === name)
  if (!profile) return
  Object.entries(profile.data).forEach(([key, value]) => {
    if (key.startsWith(PREFIX)) localStorage.setItem(key, JSON.stringify(value))
  })
}

export function deleteProfile(name: string) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(listProfiles().filter(p => p.name !== name)))
}
