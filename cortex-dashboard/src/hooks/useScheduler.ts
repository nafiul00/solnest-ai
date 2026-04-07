import { useState, useEffect } from 'react'

export function useCountdown(targetTime: string) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function calc() {
      const now = new Date()
      // Email triage runs every 5 min — compute seconds to next 5-min mark
      if (targetTime === 'email-triage') {
        const secs = (5 * 60) - (now.getMinutes() % 5) * 60 - now.getSeconds()
        const m = Math.floor(secs / 60)
        const s = secs % 60
        setRemaining(`${m}:${String(s).padStart(2, '0')}`)
        return
      }
      const target = new Date(targetTime)
      const diff = target.getTime() - now.getTime()
      if (diff <= 0) { setRemaining('Now'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      if (h > 24) {
        setRemaining(`${Math.floor(h / 24)}d ${h % 24}h`)
      } else if (h > 0) {
        setRemaining(`${h}h ${m}m`)
      } else {
        const s = Math.floor((diff % 60000) / 1000)
        setRemaining(`${m}m ${s}s`)
      }
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetTime])

  return remaining
}
