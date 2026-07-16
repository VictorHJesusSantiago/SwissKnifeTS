let ctx: AudioContext | null = null

function getContext() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  return ctx
}

export function playBeep(tone: 'critical' | 'warning' | 'info' | 'healthy' = 'info') {
  try {
    const audioCtx = getContext()
    const freq = { critical: 880, warning: 660, info: 520, healthy: 740 }[tone]
    const oscillator = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25)
    oscillator.connect(gain)
    gain.connect(audioCtx.destination)
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.26)
  } catch { /* ignore: audio not available */ }
}
