const KEY = 'opsphere-seed'

export function getSeed(): number {
  const stored = localStorage.getItem(KEY)
  return stored ? Number(stored) || 42 : 42
}

export function setSeed(value: number) {
  localStorage.setItem(KEY, String(value))
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000)
}

export function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
