import { useEffect, useState, useRef, useMemo } from 'react'
import { api } from '../api'
import { useDarkMode } from '../useDarkMode'
import GlassToggle from '../components/GlassToggle'
import StatusBadge from '../components/StatusBadge'
import DoughnutChart from '../components/DoughnutChart'
import { computeCost, getArticle, getSalePrice, getInitialStock, getPhotoUrl, getPhotoFallback, fmt } from '../costCalculation'
import {
  ClipboardList, BarChart2, Users, ShoppingBag,
  RefreshCw, UserPlus, UserX, Star, MessageSquare, X, ChevronDown,
} from 'lucide-react'

const ALL_STATUSES = ['Все', 'Новый', 'Подтверждён', 'В пути', 'Доставлен', 'Отменён']
const TABS = [
  { label: 'Заказы',     Icon: ClipboardList },
  { label: 'Статистика', Icon: BarChart2     },
  { label: 'Клиенты',    Icon: Users         },
]
const SWIPE_TABS = 3

const CHIP_COLORS = {
  'Все':         'bg-[#F5F5F5] dark:bg-white/5 text-gray-500 dark:text-gray-400',
  'Новый':       'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  'Подтверждён': 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  'В пути':      'bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400',
  'Доставлен':   'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  'Отменён':     'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400',
}
const CHIP_ACTIVE = {
  'Все':         'gold text-[#111]',
  'Новый':       'bg-blue-500 text-white',
  'Подтверждён': 'bg-amber-400 text-[#111]',
  'В пути':      'bg-orange-500 text-white',
  'Доставлен':   'bg-green-500 text-white',
  'Отменён':     'bg-red-500 text-white',
}

const card = `bg-white dark:bg-[#2D2F37] rounded-[20px] p-4
  shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
  border border-black/[0.04] dark:border-white/[0.05]`

export default function PartnerPage({ realRole }) {
  const { dark } = useDarkMode()
  const [tab, setTab] = useState(0)
  const [orders,   setOrders]   = useState([])
  const [clients,  setClients]  = useState([])
  const [products, setProducts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expandedRows, setExpandedRows] = useState({})
  const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  const [statusFilter, setStatusFilter] = useState('Все')
  const [statPeriod,   setStatPeriod]   = useState('month')
  const [clientFilter, setClientFilter] = useState('all')
  const [showReviews,  setShowReviews]  = useState(false)
  const [reviews,      setReviews]      = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const [dragX,    setDragX]    = useState(0)
  const [dragging, setDragging] = useState(false)

  const loadOrders   = () => api.getAllOrders().then(setOrders).catch(console.warn)
  const loadClients  = () => api.getClients().then(setClients).catch(console.warn)
  const loadProducts = () => api.getProducts().then(setProducts).catch(console.warn)
  const loadExpenses = () => api.getExpenses().then(setExpenses).catch(console.warn)
  const loadAll = () => {
    setLoading(true)
    return Promise.all([loadOrders(), loadClients(), loadProducts(), loadExpenses()])
      .finally(() => setLoading(false))
  }

  const productByArticle = useMemo(() => {
    const m = {}
    products.forEach(p => {
      const a = getArticle(p)
      if (a) m[a] = p
    })
    return m
  }, [products])
  useEffect(() => { loadAll() }, [])

  const filteredOrders = useMemo(() => {
    let list = [...orders]
    if (statusFilter !== 'Все') list = list.filter(o => o.status === statusFilter)
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  }, [orders, statusFilter])

  const ordersByDay = useMemo(() => {
    const map = {}
    filteredOrders.forEach(o => {
      const day = (o.timestamp || '').split(' ')[0] || 'Неизвестно'
      if (!map[day]) map[day] = []
      map[day].push(o)
    })
    return map
  }, [filteredOrders])
  const sortedDays = useMemo(() =>
    Object.keys(ordersByDay).sort((a, b) => b.localeCompare(a)), [ordersByDay])

  // ── Stat period filter ─────────────────────────────────────
  const statOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    const month = today.slice(0, 7) + '-01'
    return orders.filter(o => {
      const d = (o.timestamp || '').split(' ')[0]
      if (statPeriod === 'today') return d === today
      if (statPeriod === 'week')  return d >= week && d <= today
      if (statPeriod === 'month') return d >= month && d <= today
      return true
    })
  }, [orders, statPeriod])

  const statSummary = useMemo(() => {
    const delivered = statOrders.filter(o => o.status === 'Доставлен')
    const cancelled = statOrders.filter(o => o.status === 'Отменён')
    return {
      total:     statOrders.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      revenue:   delivered.reduce((s, o) => s + parseFloat(o.price || 0), 0),
    }
  }, [statOrders])

  const chartData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const bars  = statPeriod === 'today' ? 7 : 7
    return Array.from({ length: bars }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (bars - 1 - i))
      const ds = d.toISOString().split('T')[0]
      const dayO = orders.filter(o => (o.timestamp || '').startsWith(ds))
      return {
        label:   d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        count:   dayO.length,
        sum:     dayO.reduce((s, o) => s + parseFloat(o.price || 0), 0),
        isToday: ds === today,
      }
    })
  }, [orders, statPeriod])
  const maxCount = Math.max(1, ...chartData.map(d => d.count))

  const todayNew = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return clients.filter(c => (c.first_order || '').startsWith(today)).length
  }, [clients])

  const loadReviews = async () => {
    setReviewsLoading(true)
    try { const r = await api.getReviews(); setReviews(r) } catch (e) { console.warn(e) }
    finally { setReviewsLoading(false) }
  }
  const openReviews = () => { setShowReviews(true); loadReviews() }

  const goTo = t => setTab(Math.max(0, Math.min(SWIPE_TABS - 1, t)))
  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setDragging(true)
  }
  const onTouchMove = e => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (Math.abs(dy) > Math.abs(dx)) { setDragX(0); return }
    let d = dx
    if ((tab === 0 && d > 0) || (tab === SWIPE_TABS - 1 && d < 0)) d *= 0.15
    setDragX(d)
  }
  const onTouchEnd = e => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    setDragging(false); setDragX(0)
    if (Math.abs(diff) > 55) goTo(diff > 0 ? tab + 1 : tab - 1)
    touchStartX.current = null; touchStartY.current = null
  }

  const slideStyle = {
    display: 'flex',
    width: `${SWIPE_TABS * 100}%`,
    height: '100%',
    transform: `translateX(calc(${-tab * 100 / SWIPE_TABS}% + ${dragX}px))`,
    transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)',
    willChange: 'transform',
  }
  const paneStyle = { width: `${100 / SWIPE_TABS}%`, flexShrink: 0, overflowY: 'auto', height: '100%' }

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5] dark:bg-[#202329]">

      {/* HEADER */}
      <div className="gold px-4 pt-4 pb-3 shadow-[0_4px_24px_rgba(245,197,24,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-black text-[#111] text-[17px] leading-none tracking-tight">SOOQ.TJ</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-black bg-black/10 text-[#111] px-2 py-0.5 rounded-full tracking-wide">
                👤 АЛИШЕР · ПАРТНЁР
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {realRole === 'admin' && (
              <button
                onClick={() => {
                  const u = new URL(window.location.href)
                  u.searchParams.delete('role')
                  window.location.href = u.toString()
                }}
                title="Вернуться в админ-панель"
                className="h-9 px-3 rounded-2xl bg-black/10 flex items-center gap-1 active:scale-90 transition-transform">
                <span className="text-[10px] font-black text-[#111] uppercase tracking-wider">← АДМИН</span>
              </button>
            )}
            <button onClick={loadAll}
              className="w-9 h-9 rounded-2xl bg-black/10 flex items-center justify-center active:scale-90 transition-transform">
              <RefreshCw size={15} color="#111" strokeWidth={2.5} />
            </button>
            <GlassToggle />
          </div>
        </div>
      </div>

      {/* TOP NAV TABS */}
      <div className="bg-white dark:bg-[#262931] border-b border-black/[0.05] dark:border-white/[0.05]
        flex shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex-shrink-0">
        {TABS.map(({ label, Icon }, i) => (
          <button key={i} onClick={() => goTo(i)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors relative ${
              tab === i
                ? 'text-[#0A0A0A] dark:text-white'
                : 'text-gray-400 dark:text-gray-600'
            }`}>
            {tab === i && (
              <span className="absolute bottom-0 inset-x-4 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg,#F5C518,#FF9C00)' }} />
            )}
            <Icon size={18} strokeWidth={tab === i ? 2.5 : 1.8} />
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </div>

      {/* SWIPEABLE CONTENT */}
      <div className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <div style={slideStyle}>

          {/* ── PANE 0: ЗАКАЗЫ ── */}
          <div style={paneStyle} className="flex flex-col">
            {/* Status filter chips */}
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
                onTouchStart={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}>
                {ALL_STATUSES.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`flex-shrink-0 text-[11px] font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-95 ${
                      statusFilter === s ? CHIP_ACTIVE[s] : CHIP_COLORS[s]
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <ClipboardList size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">Заказов нет</p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {sortedDays.map(day => (
                    <div key={day}>
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest px-1 mb-2">
                        {day}
                      </p>
                      <div className="space-y-2">
                        {ordersByDay[day].map((o, i) => (
                          <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-3.5
                            shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)]
                            border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-bold text-sm text-[#0A0A0A] dark:text-white">
                                  #{o.id} · {o.name}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{o.phone}</p>
                              </div>
                              <StatusBadge status={o.status} />
                            </div>
                            <div className="flex items-end justify-between">
                              <div className="flex-1 mr-2 min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {o.product_name}{o.quantity > 1 ? ` x${o.quantity}` : ''}
                                </p>
                                {o.article && (
                                  <p className="text-[10px] font-mono font-black text-yellow-600 dark:text-yellow-500 mt-1">
                                    🔖 {o.article}
                                  </p>
                                )}
                              </div>
                              {(() => {
                                const sale = parseFloat(o.price) || 0
                                const op = productByArticle[o.article]
                                const qtyN = Number(o.quantity) || 1
                                const cost = op ? computeCost(op).total * qtyN : 0
                                const profit = sale - cost
                                return (
                                  <div className="flex flex-col items-end leading-none flex-shrink-0 text-right">
                                    <p className="font-black text-base text-[#0A0A0A] dark:text-white">
                                      {fmt(sale)} <span className="text-[10px] font-bold opacity-70">сом</span>
                                    </p>
                                    {op && (
                                      <>
                                        <p className="text-[10px] font-bold text-yellow-500 mt-1">с/с: {fmt(cost)}</p>
                                        <p className={`text-[11px] font-black mt-0.5 ${profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                          {profit > 0 ? '+' : ''}{fmt(profit)}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                            {o.address && (
                              <p className="text-[10px] text-gray-400 mt-1.5 truncate">📍 {o.address}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── PANE 1: СТАТИСТИКА ── */}
          <div style={paneStyle} className="p-3">
            <div className="pb-8 space-y-3">

              {/* ══ Финансы (сверху) ══ */}
              {(() => {
                const delivered = statOrders.filter(o => o.status === 'Доставлен')
                const revenue = delivered.reduce((s, o) => s + (parseFloat(o.price) || 0), 0)
                const costOfGoods = delivered.reduce((s, o) => {
                  const op = productByArticle[o.article]
                  if (!op) return s
                  const qtyN = Number(o.quantity) || 1
                  return s + computeCost(op).total * qtyN
                }, 0)
                const explicitExp = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
                const totalExpense = costOfGoods + explicitExp
                const netProfit = Math.max(0, revenue - totalExpense)
                return (
                  <div className={card}>
                    <p className="font-black text-xs text-[#0A0A0A] dark:text-white mb-3">
                      💰 Финансы (Доставлено)
                    </p>
                    <div className="flex items-center gap-4 mb-3">
                      <DoughnutChart income={netProfit} expense={totalExpense} size={140} />
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">Выручка</p>
                          <p className="font-black text-base text-[#0A0A0A] dark:text-white">{fmt(revenue)} сом</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full" />
                            <span className="text-gray-400 dark:text-gray-500">Расход</span>
                          </p>
                          <p className="font-black text-sm text-red-500">{fmt(totalExpense)} сом</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-gray-400 dark:text-gray-500">Чистая прибыль</span>
                          </p>
                          <p className="font-black text-sm text-green-500">{fmt(netProfit)} сом</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#F5F5F5] dark:bg-white/5 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Себестоимость товаров</span>
                        <span className="font-bold text-yellow-600 dark:text-yellow-500">{fmt(costOfGoods)} сом</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-gray-400">Доп. расходы</span>
                        <span className="font-bold text-orange-500">{fmt(explicitExp)} сом</span>
                      </div>
                    </div>
                    {expenses.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Доп. расходы</p>
                        {expenses.slice(0, 5).map(e => (
                          <div key={e.id} className="flex justify-between text-[11px] py-1 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0">
                            <span className="text-gray-600 dark:text-gray-300">{e.name}</span>
                            <span className="font-bold text-orange-500">{fmt(e.amount)} сом</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Period selector */}
              <div className="flex gap-2">
                {[
                  { key: 'today', label: 'Сегодня' },
                  { key: 'week',  label: 'Неделя'  },
                  { key: 'month', label: 'Месяц'   },
                ].map(p => (
                  <button key={p.key} onClick={() => setStatPeriod(p.key)}
                    className={`flex-1 text-xs py-2.5 rounded-2xl font-bold transition-all active:scale-95 ${
                      statPeriod === p.key
                        ? 'gold text-[#111] shadow-[0_2px_10px_rgba(245,197,24,0.25)]'
                        : 'bg-white dark:bg-[#2D2F37] text-gray-500 dark:text-gray-400 border border-black/[0.05] dark:border-white/[0.05]'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Заказов',   value: statSummary.total,                color: 'text-blue-500'  },
                  { label: 'Доставлено',value: statSummary.delivered,            color: 'text-green-500' },
                  { label: 'Отменено',  value: statSummary.cancelled,            color: 'text-red-500'   },
                  { label: 'Выручка',   value: Math.round(statSummary.revenue) + ' с', color: 'gold-text' },
                ].map((s, i) => (
                  <div key={i} className={card}>
                    <p className={`font-black text-2xl leading-none mb-1 ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className={card}>
                <p className="font-black text-xs text-[#0A0A0A] dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 gold rounded-md flex items-center justify-center">
                    <BarChart2 size={11} color="#111" strokeWidth={2.5} />
                  </span>
                  Заказы по дням
                </p>
                <div className="flex items-end gap-1.5 h-24">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <p className={`text-[8px] font-bold transition-all ${
                        d.count > 0 ? 'gold-text' : 'text-transparent'
                      }`}>{d.count}</p>
                      <div className="w-full rounded-t-lg transition-all duration-500"
                        style={{
                          height: `${Math.max(4, (d.count / maxCount) * 56)}px`,
                          background: d.isToday
                            ? 'linear-gradient(180deg,#F5C518,#FF9C00)'
                            : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        }} />
                      <p className="text-[8px] text-gray-400 leading-none text-center">{d.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status breakdown */}
              <div className={card}>
                <p className="font-black text-xs text-[#0A0A0A] dark:text-white mb-3">Статусы заказов</p>
                <div className="space-y-2">
                  {['Новый','Подтверждён','В пути','Доставлен','Отменён'].map(st => {
                    const cnt = statOrders.filter(o => o.status === st).length
                    const pct = statSummary.total > 0 ? Math.round((cnt / statSummary.total) * 100) : 0
                    return (
                      <div key={st}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{st}</span>
                          <span className="text-[11px] font-black text-[#0A0A0A] dark:text-white">{cnt}</span>
                        </div>
                        <div className="h-1.5 bg-[#F5F5F5] dark:bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: st === 'Доставлен' ? '#22c55e'
                                : st === 'Отменён' ? '#ef4444'
                                : st === 'В пути' ? '#f97316'
                                : st === 'Подтверждён' ? '#f59e0b'
                                : '#3b82f6',
                            }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ══ СКЛАД (внутри Статистики) ══ */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-7 h-7 gold rounded-xl flex items-center justify-center shadow-sm">
                    <ShoppingBag size={15} color="#111" strokeWidth={2.5} />
                  </span>
                  Склад
                </p>

                {/* Stock summary */}
                <div className="flex bg-[#F5F5F5] dark:bg-white/5 rounded-2xl p-2.5 mb-3">
                  {(() => {
                    const cur = (p) => parseInt(p['В наличии (шт)'] || p['В наличии'] || 0) || 0
                    const totalInitial = products.reduce((s, p) => s + (getInitialStock(p) ?? cur(p)), 0)
                    const totalCurrent = products.reduce((s, p) => s + cur(p), 0)
                    const totalSold    = totalInitial - totalCurrent
                    const totalRevenue = products.reduce((s, p) => s + getSalePrice(p) * cur(p), 0)
                    return [
                      { label: 'Грузил',   value: totalInitial, color: 'text-blue-500' },
                      { label: 'Осталось', value: totalCurrent, color: 'text-green-500' },
                      { label: 'Продано',  value: totalSold,    color: 'gold-text' },
                      { label: 'Выручка',  value: fmt(totalRevenue), unit: 'сом' },
                    ].map((s, i, arr) => (
                      <div key={i} className={`flex-1 text-center ${i < arr.length - 1 ? 'border-r border-black/[0.06] dark:border-white/[0.06]' : ''}`}>
                        <p className={`font-black text-sm leading-tight ${s.color || 'text-[#0A0A0A] dark:text-white'}`}>{s.value}</p>
                        {s.unit && <p className="text-[7px] font-bold text-gray-400">{s.unit}</p>}
                        <p className="text-[9px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))
                  })()}
                </div>

                {/* Product rows */}
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-7 h-7 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : products.length === 0 ? (
                  <p className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">Склад пуст</p>
                ) : (
                  <div className="space-y-2">
                    {products.map((p, i) => {
                      const photo = getPhotoUrl(p)
                      const name  = p['Название (RU)'] || p['Название'] || 'Товар'
                      const q     = parseInt(p['В наличии (шт)'] || p['В наличии'] || 0) || 0
                      const article = getArticle(p)
                      const sale = getSalePrice(p)
                      const cost = computeCost(p).total
                      const profit = sale - cost
                      return (
                        <div key={i} className="bg-[#F9F9F9] dark:bg-white/5 rounded-[16px] overflow-hidden flex
                          border border-black/[0.04] dark:border-white/[0.05]">
                          <div className="flex-shrink-0">
                            {photo
                              ? <img src={photo} className="w-16 h-16 object-cover" loading="lazy" decoding="async"
                                  onError={e => { const fb = getPhotoFallback(p); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }} />
                              : <div className="w-16 h-16 flex items-center justify-center"
                                  style={{ background: 'linear-gradient(135deg,#2A2A2A,#3D3D3D)' }}>
                                  <ShoppingBag size={22} color="rgba(255,255,255,0.15)" strokeWidth={1.5} />
                                </div>}
                          </div>
                          <div className="flex-1 p-2.5 min-w-0 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-[12px] text-[#0A0A0A] dark:text-white line-clamp-1">{name}</p>
                              {article && (
                                <p className="text-[9px] font-black font-mono text-yellow-600 dark:text-yellow-500 mt-0.5">
                                  🔖 {article}
                                </p>
                              )}
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {(() => {
                                  const init = getInitialStock(p)
                                  return init != null && (
                                    <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                                      Грузил: {init}
                                    </span>
                                  )
                                })()}
                                <span className="text-[9px] font-black bg-green-100 dark:bg-green-900/30 text-green-500 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                                  Осталось: {q}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end leading-none flex-shrink-0 text-right">
                              <p className="font-black text-sm text-[#0A0A0A] dark:text-white">
                                {fmt(sale)} <span className="text-[9px] font-bold opacity-70">сом</span>
                              </p>
                              <p className="text-[9px] font-bold text-yellow-500 mt-0.5">с/с: {fmt(cost)}</p>
                              <p className={`text-[10px] font-black mt-0.5 ${profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {profit > 0 ? '+' : ''}{fmt(profit)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── PANE 2: КЛИЕНТЫ ── */}
          <div style={paneStyle} className="p-3">
            <div className="pb-20 space-y-3">

              {/* Summary row */}
              <div className={card}>
                <div className="flex">
                  {[
                    { label: 'Клиентов', value: clients.length },
                    { label: 'Заказов',  value: clients.reduce((s, c) => s + (c.total_orders || 0), 0) },
                    { label: 'Выручка',  value: Math.round(clients.reduce((s, c) => s + (c.total_spent || 0), 0)) + ' с' },
                  ].map((s, i, arr) => (
                    <div key={i} className={`flex-1 text-center ${i < arr.length - 1 ? 'border-r border-black/[0.06] dark:border-white/[0.06]' : ''}`}>
                      <p className="font-black text-xl gold-text leading-tight">{s.value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* New today */}
              <div className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-4 flex items-center gap-3
                shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                border border-black/[0.04] dark:border-white/[0.05]">
                <div className="w-11 h-11 gold rounded-[16px] flex items-center justify-center flex-shrink-0 shadow-[0_4px_16px_rgba(245,197,24,0.3)]">
                  <UserPlus size={20} color="#111" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-gray-400 leading-none mb-0.5">Новых сегодня</p>
                  <p className="font-black text-2xl gold-text leading-none">{todayNew}</p>
                </div>
                <div className="relative flex-shrink-0 mr-1">
                  <div className="w-3 h-3 bg-green-400 rounded-full" />
                  <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75" />
                </div>
              </div>

              {/* Filter toggle */}
              <div className="flex gap-2">
                {[
                  { key: 'all',   label: 'Все клиенты' },
                  { key: 'today', label: `Новые (${todayNew})` },
                ].map(f => (
                  <button key={f.key} onClick={() => setClientFilter(f.key)}
                    className={`flex-1 text-xs py-2.5 rounded-2xl font-bold transition-all active:scale-95 ${
                      clientFilter === f.key
                        ? 'gold text-[#111] shadow-[0_2px_10px_rgba(245,197,24,0.25)]'
                        : 'bg-white dark:bg-[#2D2F37] text-gray-500 dark:text-gray-400 border border-black/[0.05] dark:border-white/[0.05]'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Reviews button */}
              <button onClick={openReviews}
                className="w-full bg-white dark:bg-[#2D2F37] rounded-[20px] p-4 flex items-center gap-3
                  shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                  border border-yellow-400/20 active:scale-[0.98] transition-transform text-left">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  <Star size={18} color="#fff" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm text-[#0A0A0A] dark:text-white">Отзывы</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Читать отзывы клиентов</p>
                </div>
                <span className="text-[11px] font-black text-yellow-500">→</span>
              </button>

              {/* Reviews panel (slide-in) */}
              {showReviews && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowReviews(false)}>
                  <div className="w-full bg-white dark:bg-[#202329] rounded-t-[28px] max-h-[80vh] overflow-y-auto p-4"
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-black text-base text-[#0A0A0A] dark:text-white flex items-center gap-2">
                        <Star size={16} className="text-yellow-400" /> Отзывы клиентов
                      </p>
                      <button onClick={() => setShowReviews(false)}
                        className="w-8 h-8 rounded-full bg-[#F5F5F5] dark:bg-white/10 flex items-center justify-center">
                        <X size={15} color={dark ? '#fff' : '#333'} />
                      </button>
                    </div>
                    {reviewsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-7 h-7 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : reviews.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare size={40} color={dark ? '#2A2A2A' : '#DDD'} className="mx-auto mb-3" strokeWidth={1.5} />
                        <p className="text-sm font-semibold text-gray-400">Отзывов пока нет</p>
                      </div>
                    ) : (
                      <div className="space-y-3 pb-4">
                        {reviews.map((r, i) => (
                          <div key={i} className="bg-[#F9F9F9] dark:bg-[#2D2F37] rounded-[18px] p-3.5
                            border border-black/[0.04] dark:border-white/[0.05]">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="font-bold text-sm text-[#0A0A0A] dark:text-white">{r.name || 'Клиент'}</p>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, s) => (
                                  <Star key={s} size={11}
                                    className={s < r.rating ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}
                                    fill={s < r.rating ? '#fbbf24' : 'none'} />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{r.text}</p>
                            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1.5">{r.created_at}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Client list */}
              <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest px-1 pt-1">
                {clientFilter === 'today' ? 'Новые сегодня 👥' : 'Все клиенты'}
              </p>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : clients.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Users size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">База пуста</p>
                </div>
              ) : clientFilter === 'today' && todayNew === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <UserX size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">Нет новых сегодня</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clients
                    .filter(c => clientFilter === 'all' || (c.first_order || '').startsWith(new Date().toISOString().split('T')[0]))
                    .map((c, i) => {
                      const initials = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-3.5 flex items-center gap-3
                          shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                          border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">
                          <div className="w-10 h-10 gold rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                            <span className="text-sm font-black text-[#111]">{initials}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[#0A0A0A] dark:text-white line-clamp-1">{c.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="gold-text font-black text-sm">{Math.round(c.total_spent)} сом</p>
                            <p className="text-[11px] text-gray-400">{c.total_orders} заказ(а)</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* BOTTOM NAV */}
      <div className="glass bg-white/90 dark:bg-[#202329]/90 border-t border-black/[0.06] dark:border-white/[0.06]
        shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
        <div className="flex">
          {TABS.map(({ Icon, label }, i) => (
            <button key={i} onClick={() => goTo(i)}
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
