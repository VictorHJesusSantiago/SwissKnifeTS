import { useCallback, useRef, useState } from 'react'

export function useUndoable<T>(initial: T) {
  const [state, setState] = useState(initial)
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      past.current.push(prev)
      future.current = []
      return next
    })
  }, [])

  const undo = useCallback(() => {
    setState(prev => {
      const previous = past.current.pop()
      if (previous === undefined) return prev
      future.current.push(prev)
      return previous
    })
  }, [])

  const redo = useCallback(() => {
    setState(prev => {
      const next = future.current.pop()
      if (next === undefined) return prev
      past.current.push(prev)
      return next
    })
  }, [])

  return { state, set, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}
