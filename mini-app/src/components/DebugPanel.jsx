import { useEffect, useState, useRef } from 'react'
import { getLogs, clearLogs, subscribe, dumpText } from '../debug'

// Hidden debug console. Toggle with the floating 🐞 button.
// Shows API calls, errors, console output. "Copy" puts everything on the
// clipboard so the owner can paste it back to get a bug fixed fast.
export default function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState(getLogs())
  const [copied, setCopied] = useState(false)
  const endRef = useRef(null)

  useEffect(() => subscribe(() => setLogs(getLogs())), [])
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs, open])

  const errCount = logs.filter(l => l.level === 'err').length

  const copy = async () => {
    const text = dumpText() || '(пусто)'
    try { await navigator.clipboard.writeText(text) }
    catch {
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch (_) {}
      document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const color = lvl => lvl === 'err' ? '#ff5c5c' : lvl === 'api' ? '#5cc8ff' : '#9be38f'

  return (
    <>
      {/* Floating trigger — bottom-left, subtle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'fixed', left: 10, bottom: 10, zIndex: 9998 }}
        className="w-9 h-9 rounded-full bg-black/55 backdrop-blur flex items-center justify-center
          text-[15px] active:scale-90 transition-transform shadow-lg">
        🐞
        {errCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500
            text-white text-[9px] font-black flex items-center justify-center">{errCount}</span>
        )}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
          className="bg-black/70 flex flex-col" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            className="mt-auto bg-[#111] rounded-t-2xl max-h-[75vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
              <span className="text-white font-black text-sm flex-1">🐞 Debug · {logs.length} строк · {errCount} ошибок</span>
              <button onClick={copy}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold active:scale-95">
                {copied ? '✓ Скопировано' : '📋 Копировать'}
              </button>
              <button onClick={() => { clearLogs(); setLogs([]) }}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold active:scale-95">Очистить</button>
              <button onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold active:scale-95">✕</button>
            </div>
            {/* Log list */}
            <div className="overflow-y-auto p-2 font-mono text-[10px] leading-relaxed">
              {logs.length === 0
                ? <p className="text-gray-500 text-center py-6">Логи пусты — поделай действия в аппе</p>
                : logs.map((l, i) => (
                    <div key={i} className="border-b border-white/5 py-0.5 break-all">
                      <span className="text-gray-500">{l.t}</span>{' '}
                      <span style={{ color: color(l.level) }}>[{l.tag}]</span>{' '}
                      <span className="text-gray-200">{l.msg}</span>
                    </div>
                  ))}
              <div ref={endRef} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
