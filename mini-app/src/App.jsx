import { useEffect, useState, Component } from 'react'
import { useTelegram } from './useTelegram'
import { setInitData, setUserId, api } from './api'
import { LOGO, LOGO_FB } from './config'
import ClientPage from './pages/ClientPage'
import AdminPage from './pages/AdminPage'
import DriverPage from './pages/DriverPage'
import PartnerPage from './pages/PartnerPage'

const BASE = import.meta.env.VITE_API_URL || ''

// Fire product fetch immediately on module load — no auth required.
// By the time the user sees ClientPage, products are already in flight.
const _preloadedProducts = api.getProducts().catch(() => null)

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F5] p-6">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-bold text-[#1A1A1A] mb-2">Ошибка рендера</p>
        <p className="text-xs text-gray-400 text-center mb-4">{String(this.state.error)}</p>
        <button onClick={() => window.location.reload()}
          className="bg-[#FFBE00] text-[#1A1A1A] font-bold px-6 py-2.5 rounded-full text-sm">
          Перезагрузить
        </button>
      </div>
    )
    return this.props.children
  }
}

function collectDebug(user) {
  const search = window.location.search
  const params = new URLSearchParams(search)
  const urlUid = parseInt(params.get('uid') || '0')

  // initDataUnsafe
  const tgUid = user?.id || 0

  // Parse initData manually
  let initUid = 0
  try {
    const raw = window.Telegram?.WebApp?.initData || ''
    if (raw) {
      const p = new URLSearchParams(raw)
      const u = JSON.parse(p.get('user') || '{}')
      initUid = u?.id || 0
    }
  } catch (_) {}

  // localStorage
  let storedUid = 0
  try { storedUid = parseInt(localStorage.getItem('sooq_uid') || '0') } catch (_) {}

  const uid = urlUid || tgUid || initUid || storedUid

  // Save best uid
  if (uid > 0) {
    try { localStorage.setItem('sooq_uid', String(uid)) } catch (_) {}
  }

  return { uid, urlUid, tgUid, initUid, storedUid, search }
}

function AppInner() {
  const { ready, expand, initData, user } = useTelegram()
  const [role, setRole] = useState(null)
  const [realRole, setRealRole] = useState(null)
  const [debug, setDebug] = useState(null)
  const [apiError, setApiError] = useState('')

  const checkRole = async (uid) => {
    setApiError('')
    // ?role=partner|driver|client — admin override for testing other panels
    const override = new URLSearchParams(window.location.search).get('role')
    const allowedOverrides = ['partner', 'driver', 'client', 'admin']

    // Show cached role instantly — no waiting on cold Railway start
    let cached = null
    try { cached = localStorage.getItem(`sooq_role_${uid}`) } catch (_) {}
    if (cached) {
      if (override && allowedOverrides.includes(override) && cached === 'admin') {
        setRole(override)
      } else {
        setRole(cached)
      }
    }

    try {
      const r = await fetch(`${BASE}/api/role?user_id=${uid}`)
      const d = await r.json()
      const apiRole = d.role || 'client'
      setRealRole(apiRole)
      // Admin may force any role via ?role= for testing other panels
      const newRole = (apiRole === 'admin' && override && allowedOverrides.includes(override))
        ? override
        : apiRole
      setRole(newRole)
      // Cache the REAL role, not the override
      try { localStorage.setItem(`sooq_role_${uid}`, apiRole) } catch (_) {}
    } catch (e) {
      setApiError(String(e))
      if (!cached) setRole('client')   // only fallback if no cache
    }
  }

  useEffect(() => {
    ready()
    expand()
    setInitData(initData)

    const d = collectDebug(user)
    setDebug(d)
    setUserId(d.uid)

    if (!d.uid) {
      setRole('noid')
      return
    }
    checkRole(d.uid)
  }, [])

  // No ID at all — show clear instructions
  if (role === 'noid') return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F5] p-6">
      <p className="text-4xl mb-3">🔑</p>
      <p className="font-bold text-[#1A1A1A] text-lg mb-2">Нет доступа</p>
      <p className="text-sm text-gray-500 text-center mb-4">
        Не удалось определить ваш Telegram ID.<br />
        Закройте это окно и нажмите <b>/start</b> боту.
      </p>
      {debug && (
        <div className="bg-white rounded-xl p-3 w-full text-[10px] text-gray-400 space-y-0.5 font-mono">
          <p>url uid: {debug.urlUid}</p>
          <p>tg uid: {debug.tgUid}</p>
          <p>init uid: {debug.initUid}</p>
          <p>stored uid: {debug.storedUid}</p>
          <p>search: {debug.search || '(empty)'}</p>
          {apiError && <p className="text-red-400">err: {apiError}</p>}
        </div>
      )}
      <button onClick={() => window.location.reload()}
        className="mt-4 bg-[#FFBE00] text-[#1A1A1A] font-bold px-6 py-2.5 rounded-full text-sm">
        Попробовать ещё раз
      </button>
    </div>
  )

  // Loading
  if (!role) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F5]">
      <img src={LOGO} alt="SOOQ"
        className="w-24 h-24 animate-pulse mb-3 rounded-2xl object-cover"
        onError={e => { e.target.src = LOGO_FB }} />
      <p className="font-bold text-xl text-[#1A1A1A]">SOOQ.TJ</p>
      <p className="text-sm text-gray-400 mt-1">Загрузка...</p>
      {debug && debug.uid > 0 && (
        <p className="text-[10px] text-gray-300 mt-1">uid: {debug.uid}</p>
      )}
    </div>
  )

  if (role === 'admin')   return <AdminPage />
  if (role === 'driver')  return <DriverPage onLogout={() => setRole('client')} realRole={realRole} />
  if (role === 'partner') return <PartnerPage realRole={realRole} />
  return <ClientPage preloadedProducts={_preloadedProducts} />
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>
}
