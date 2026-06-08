import { useEffect, useState } from 'react'
import { api } from '../api'
import { LOGO_FB } from '../config'
import { useDarkMode } from '../useDarkMode'
import GlassToggle from '../components/GlassToggle'
import StatusBadge from '../components/StatusBadge'
import { Truck, CheckCircle2, RefreshCw, LogOut, Package, Phone, MapPin } from 'lucide-react'

const DRIVER_STATUSES = ['В пути', 'Доставлен', 'Возврат']

export default function DriverPage({ onLogout, realRole }) {
  const { dark } = useDarkMode()
  const [tab, setTab] = useState(0)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    api.getDeliveries().then(setDeliveries).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const changeStatus = async (id, status) => {
    try {
      const res = await api.updateOrder(id, status)
      if (res?.notified) {
        setToast({ ok: true, text: `"${status}" — клиент уведомлён ✓` })
      } else if (res?.notify_error) {
        setToast({ ok: false, text: `Сохранено, но клиент НЕ уведомлён: ${res.notify_error}` })
      } else {
        setToast({ ok: true, text: `Статус "${status}" сохранён` })
      }
      setTimeout(() => setToast(null), 4000)
    } catch (e) {
      setToast({ ok: false, text: `Ошибка: ${e.message}` })
      setTimeout(() => setToast(null), 4000)
    }
    load()
  }

  const active    = deliveries.filter(d => d.status !== 'Доставлен' && d.status !== 'Возврат')
  const completed = deliveries.filter(d => d.status === 'Доставлен' || d.status === 'Возврат')
  const current   = tab === 0 ? active : completed

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5] dark:bg-[#202329]">

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[92%] px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold ${
          toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      {/* HEADER */}
      <div className="gold px-4 pt-4 pb-3 shadow-[0_4px_24px_rgba(245,197,24,0.25)]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#111]/15 rounded-2xl flex items-center justify-center shadow-sm">
            <Truck size={22} color="#111" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="font-black text-[#111] text-[17px] leading-none tracking-tight">Мои Доставки</p>
            <p className="text-[10px] text-[#111]/60 uppercase tracking-[0.18em] font-bold mt-0.5">SOOQ.TJ Driver</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="w-9 h-9 rounded-2xl bg-black/10 flex items-center justify-center active:scale-90 transition-transform">
              <RefreshCw size={17} color="#111" strokeWidth={2} className={loading ? 'animate-spin' : ''} />
            </button>
            <GlassToggle />
            <button onClick={onLogout}
              className="h-9 px-3 rounded-2xl bg-[#111]/15 text-[#111] text-xs font-black active:scale-90 transition-transform flex items-center gap-1.5">
              <LogOut size={13} color="#111" strokeWidth={2.5} />
              Выйти
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 font-semibold">Загружаем доставки...</p>
          </div>
        ) : current.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <CheckCircle2 size={56} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
            <p className="font-bold text-sm text-gray-400 dark:text-gray-600">
              {tab === 0 ? 'Нет активных доставок' : 'Нет завершённых доставок'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {current.map((d, i) => (
              <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[24px] overflow-hidden
                shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]
                border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">

                {/* Card header */}
                <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 gold rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                      <Truck size={15} color="#111" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 leading-none">Заказ</p>
                      <p className="font-black text-sm text-[#0A0A0A] dark:text-white">#{d.id}</p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                {/* Details */}
                <div className="px-4 py-3 space-y-1.5">
                  <p className="text-sm font-bold text-[#0A0A0A] dark:text-white">👤 {d.name}</p>

                  {/* Phone — tap to call */}
                  <a href={`tel:${d.phone}`}
                    className="flex items-center gap-2 active:opacity-70 transition-opacity">
                    <div className="w-6 h-6 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone size={12} color="#22c55e" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 underline underline-offset-2">
                      {d.phone}
                    </span>
                  </a>

                  {/* Address — tap to open Google Maps */}
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(d.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 active:opacity-70 transition-opacity">
                    <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin size={12} color="#3b82f6" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 underline underline-offset-2 leading-tight">
                      {d.address}
                    </span>
                  </a>

                  <p className="text-xs text-gray-500 dark:text-gray-400">📦 {d.product_name}</p>
                  {d.article && (
                    <p className="text-[11px] font-mono font-black text-yellow-600 dark:text-yellow-500">
                      🔖 {d.article}
                    </p>
                  )}
                  <p className="font-black text-sm gold-text">💰 {d.price} сомони</p>
                </div>

                {/* Status buttons — only for active tab */}
                {tab === 0 && (
                  <div className="px-4 pb-4 flex gap-2">
                    {DRIVER_STATUSES.map(s => (
                      <button key={s} onClick={() => changeStatus(d.id, s)}
                        className={`flex-1 text-xs py-2.5 rounded-2xl font-bold transition-all active:scale-95 ${
                          d.status === s
                            ? 'gold text-[#111] shadow-[0_2px_10px_rgba(245,197,24,0.3)]'
                            : 'bg-[#F5F5F5] dark:bg-white/5 text-gray-500 dark:text-gray-400'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className="glass bg-white/90 dark:bg-[#202329]/90 border-t border-black/[0.06] dark:border-white/[0.06]
        shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex">
          {[
            { Icon: Truck, label: `Активные${active.length > 0 ? ' (' + active.length + ')' : ''}` },
            { Icon: CheckCircle2, label: 'Завершённые' },
          ].map(({ Icon, label }, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 relative transition-colors ${
                tab === i ? 'text-[#0A0A0A] dark:text-white' : 'text-gray-400 dark:text-gray-600'
              }`}>
              {tab === i && (
                <span className="absolute top-0 inset-x-5 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg,#F5C518,#FF9C00)' }} />
              )}
              <Icon size={22} strokeWidth={tab === i ? 2.5 : 1.8} className="mt-1" />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
