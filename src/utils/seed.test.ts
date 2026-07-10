import { beforeEach, describe, expect, it } from 'vitest'
import { getSeed, setSeed, mulberry32 } from './seed'

describe('seed utils', () => {
  beforeEach(() => localStorage.clear())

  it('retorna 42 por padrão quando não há seed salvo', () => {
    expect(getSeed()).toBe(42)
  })

  it('persiste e recupera o seed definido', () => {
    setSeed(123)
    expect(getSeed()).toBe(123)
  })

  it('mulberry32 é determinístico para o mesmo seed', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    expect(a()).toBe(b())
    expect(a()).toBe(b())
  })

  it('mulberry32 produz sequências diferentes para seeds diferentes', () => {
    const a = mulberry32(1)()
    const b = mulberry32(2)()
    expect(a).not.toBe(b)
  })
})
