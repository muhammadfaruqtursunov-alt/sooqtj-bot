import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sooq_dark') === '1' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('sooq_dark', dark ? '1' : '0') } catch {}
  }, [dark])

  const toggleDark = () => setDark(d => !d)
  return { dark, toggleDark }
}
