import { useEffect, useRef, useState } from 'react'

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('opsphere-sync') : null

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) as T : initial
    } catch { return initial }
  })
  const skipBroadcast = useRef(false)

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
    if (channel && !skipBroadcast.current) channel.postMessage({ key, value })
    skipBroadcast.current = false
  }, [key, value])

  useEffect(() => {
    if (!channel) return
    const handler = (event: MessageEvent<{ key: string; value: unknown }>) => {
      if (event.data?.key !== key) return
      skipBroadcast.current = true
      setValue(event.data.value as T)
    }
    channel.addEventListener('message', handler)
    return () => channel.removeEventListener('message', handler)
  }, [key])

  return [value, setValue] as const
}
