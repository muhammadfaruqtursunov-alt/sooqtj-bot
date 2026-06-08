// Lightweight in-app debug logger — ring buffer + global error capture.
// View it via the 🐞 button (DebugPanel). Lets the owner see the real cause
// of a bug (API calls, errors, server responses) and copy it to share.

const MAX = 300
const _buf = []
const _subs = new Set()

function push(level, tag, msg) {
  const entry = {
    t: new Date().toISOString().slice(11, 23), // HH:MM:SS.mmm
    level,                                       // 'log' | 'err' | 'api'
    tag,
    msg: typeof msg === 'string' ? msg : safeStringify(msg),
  }
  _buf.push(entry)
  if (_buf.length > MAX) _buf.shift()
  _subs.forEach(fn => { try { fn(entry) } catch (_) {} })
}

function safeStringify(v) {
  try { return JSON.stringify(v) } catch { return String(v) }
}

export const dlog = (tag, ...args) =>
  push('log', tag, args.map(a => typeof a === 'string' ? a : safeStringify(a)).join(' '))
export const derr = (tag, ...args) =>
  push('err', tag, args.map(a => typeof a === 'string' ? a : safeStringify(a)).join(' '))
export const dapi = (tag, ...args) =>
  push('api', tag, args.map(a => typeof a === 'string' ? a : safeStringify(a)).join(' '))

export const getLogs = () => _buf.slice()
export const clearLogs = () => { _buf.length = 0; _subs.forEach(fn => { try { fn(null) } catch (_) {} }) }
export const subscribe = (fn) => { _subs.add(fn); return () => _subs.delete(fn) }

export const dumpText = () =>
  _buf.map(e => `${e.t} [${e.level}] ${e.tag}: ${e.msg}`).join('\n')

// ── Global capture: uncaught errors + promise rejections ──
let _installed = false
export function installGlobalCapture() {
  if (_installed) return
  _installed = true
  try {
    window.addEventListener('error', (e) => {
      derr('window.error', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`)
    })
    window.addEventListener('unhandledrejection', (e) => {
      derr('unhandledrejection', String(e.reason?.stack || e.reason || e))
    })
    // Mirror console.error/warn into the buffer
    const origErr = console.error.bind(console)
    console.error = (...a) => { derr('console', ...a); origErr(...a) }
    const origWarn = console.warn.bind(console)
    console.warn = (...a) => { push('log', 'console.warn', a.map(x => typeof x === 'string' ? x : safeStringify(x)).join(' ')); origWarn(...a) }
  } catch (_) {}
}
