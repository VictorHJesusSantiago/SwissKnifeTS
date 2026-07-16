import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OnlineStatusBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null
  return <div className="offline-banner"><WifiOff size={13}/> Sem conexão com a internet — o app continua funcionando com os dados salvos localmente (PWA offline).</div>
}
