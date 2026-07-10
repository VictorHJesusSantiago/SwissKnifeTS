import { describe, expect, it } from 'vitest'
import { classNames, formatCurrency } from './format'

describe('classNames', () => {
  it('junta apenas valores truthy', () => {
    expect(classNames('a', false, undefined, 'b')).toBe('a b')
  })
  it('retorna string vazia sem argumentos válidos', () => {
    expect(classNames(false, undefined)).toBe('')
  })
})

describe('formatCurrency', () => {
  it('formata em BRL sem casas decimais', () => {
    expect(formatCurrency(1000)).toContain('1.000')
  })
})
