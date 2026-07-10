import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useUndoable } from './useUndoable'

describe('useUndoable', () => {
  it('atualiza o estado e permite desfazer/refazer', () => {
    const { result } = renderHook(() => useUndoable(0))

    act(() => result.current.set(1))
    act(() => result.current.set(2))
    expect(result.current.state).toBe(2)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.state).toBe(1)

    act(() => result.current.undo())
    expect(result.current.state).toBe(0)
    expect(result.current.canUndo).toBe(false)

    act(() => result.current.redo())
    expect(result.current.state).toBe(1)
  })

  it('limpa o futuro ao definir um novo valor após um undo', () => {
    const { result } = renderHook(() => useUndoable('a'))
    act(() => result.current.set('b'))
    act(() => result.current.undo())
    act(() => result.current.set('c'))
    expect(result.current.state).toBe('c')
    expect(result.current.canRedo).toBe(false)
  })
})
