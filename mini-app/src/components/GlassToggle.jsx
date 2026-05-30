import { Sun, Moon } from 'lucide-react'
import { useDarkMode } from '../useDarkMode'

export default function GlassToggle() {
  const { dark, toggleDark } = useDarkMode()
  return (
    <button
      onClick={toggleDark}
      aria-label="Toggle theme"
      style={{
        width: 54,
        height: 30,
        borderRadius: 99,
        position: 'relative',
        flexShrink: 0,
        background: dark ? 'rgba(245,197,24,0.12)' : 'rgba(0,0,0,0.07)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: dark ? '1px solid rgba(245,197,24,0.22)' : '1px solid rgba(0,0,0,0.1)',
        boxShadow: dark ? '0 0 16px rgba(245,197,24,0.1)' : 'none',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: dark ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: dark ? '#F5C518' : '#FFFFFF',
          boxShadow: dark
            ? '0 2px 10px rgba(245,197,24,0.45)'
            : '0 2px 6px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {dark
          ? <Moon size={13} color="#111111" strokeWidth={2.5} />
          : <Sun size={13} color="#888888" strokeWidth={2.5} />
        }
      </span>
    </button>
  )
}
