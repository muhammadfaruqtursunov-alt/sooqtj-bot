import { useEffect, useState, useRef, useMemo } from 'react'
import { api } from '../api'
import { BACKEND, LOGO_FB } from '../config'
import { useDarkMode } from '../useDarkMode'
import GlassToggle from '../components/GlassToggle'
import ProductForm from '../components/ProductForm'
import StatusBadge from '../components/StatusBadge'
import { useTelegram } from '../useTelegram'
import {
  ClipboardList, BarChart2, ShoppingBag, Users, Settings2,
  Package, RefreshCw, Plus, Pencil, Camera, Megaphone,
  Image, Info, Send, CheckCircle2, UserPlus, UserX,
  Trash2, Download, Search, Star, MessageSquare, X, ChevronDown,
} from 'lucide-react'
import BroadcastPanel from '../components/BroadcastPanel'
import PriceBlock from '../components/PriceBlock'
import DoughnutChart from '../components/DoughnutChart'
import { inferCategory } from '../categoryInference'
import { computeCost, computeProfit, getSalePrice, getArticle, getInitialStock, getPhotoUrl, getPhotoFallback, fmt } from '../costCalculation'

const ALL_STATUSES   = ['Все', 'Новый', 'Подтверждён', 'В пути', 'Доставлен', 'Отменён']
const ORDER_STATUSES = ['Новый', 'Подтверждён', 'В пути', 'Доставлен', 'Отменён']

const ph  = p => getPhotoUrl(p) || p['photo_url'] || ''
const nm  = p => p['Название (RU)'] || p['Название'] || p['col2'] || 'Товар'
const pr  = p => p['Продажная цена'] || p['Цена'] || p['col6'] || '0'
const ct  = p => p['Категория'] || p['col3'] || ''
const qty = p => parseInt(p['В наличии (шт)'] || p['В наличии'] || p['col9'] || '0')

const TABS = [
  { label: 'Заказы',     Icon: ClipboardList },
  { label: 'Статистика', Icon: BarChart2     },
  { label: 'Склад',      Icon: ShoppingBag   },
  { label: 'Клиенты',    Icon: Users         },
  { label: 'Настройки',  Icon: Settings2     },
]

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

export default function AdminPage() {
  const { user }   = useTelegram()
  const { dark }   = useDarkMode()
  const [tab, setTab] = useState(0)
  const [orders,   setOrders]   = useState([])
  const [stats,    setStats]    = useState(null)
  const [products, setProducts] = useState([])
  const [clients,  setClients]  = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editIdx,  setEditIdx]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [toast,    setToast]    = useState(null)
  const [showManualOrder, setShowManualOrder] = useState(false)
  const [mo, setMo] = useState({
    source: 'Instagram', name: '', phone: '', address: '',
    product_id: '', product_name: '', quantity: 1, price: 0,
    discount: '', custom: false, article: '',
  })
  const [statusFilter, setStatusFilter] = useState('Все')
  const [logoUrl,  setLogoUrl]  = useState(`${BACKEND}/uploads/logo.png`)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoOk,   setLogoOk]   = useState(false)
  const [broadcastText,   setBroadcastText]   = useState('')
  const [broadcasting,    setBroadcasting]    = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [uploadPhotoIdx,  setUploadPhotoIdx]  = useState(null)
  const [showBroadcast,   setShowBroadcast]   = useState(false)
  const [clientFilter,    setClientFilter]    = useState('all')   // 'all' | 'today'
  const [showReviews,     setShowReviews]     = useState(false)
  const [reviews,         setReviews]         = useState([])
  const [reviewsLoading,  setReviewsLoading]  = useState(false)
  const [expenses,        setExpenses]        = useState([])
  const [expForm,         setExpForm]         = useState({ name: '', amount: '' })
  const [expandedRows,    setExpandedRows]    = useState({})
  const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  const [statPeriod,      setStatPeriod]      = useState('month') // 'today'|'week'|'month'|'custom'
  const [customFrom,      setCustomFrom]      = useState('')
  const [customTo,        setCustomTo]        = useState('')
  const [orderSearch,     setOrderSearch]     = useState('')
  const [editOrderModal,  setEditOrderModal]  = useState(null)
  const [editFields,      setEditFields]      = useState({})

  const openEditOrder = (o) => {
    setEditOrderModal(o)
    setEditFields({ name: o.name||'', phone: o.phone||'', address: o.address||'', product_name: o.product_name||'', quantity: o.quantity||1, price: o.price||'' })
  }
  const saveEditOrder = async () => {
    if (!editOrderModal) return
    try {
      await api.editOrder(editOrderModal.id, editFields)
      setEditOrderModal(null)
      loadOrders()
      setToast({ ok: true, text: 'Заказ обновлён' })
    } catch { setToast({ ok: false, text: 'Ошибка обновления' }) }
  }
  const deleteOrder = async (orderId) => {
    if (!window.confirm(`Удалить заказ #${orderId}?`)) return
    try {
      await api.deleteOrder(orderId)
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setToast({ ok: true, text: 'Заказ удалён' })
    } catch { setToast({ ok: false, text: 'Ошибка удаления' }) }
  }

  const SWIPE_TABS = 5

  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const [dragX,    setDragX]    = useState(0)
  const [dragging, setDragging] = useState(false)

  const logoInputRef  = useRef()
  const photoInputRef = useRef()

  const loadOrders   = () => api.getAllOrders().then(setOrders).catch(console.warn)
  const loadStats    = () => api.getStats().then(setStats).catch(console.warn)
  const loadProducts = () => api.getProducts().then(setProducts).catch(console.warn)
  const loadClients  = () => api.getClients().then(setClients).catch(console.warn)
  const loadExpenses = () => api.getExpenses().then(setExpenses).catch(console.warn)

  const submitExpense = async () => {
    const amt = parseFloat(String(expForm.amount).replace(',', '.')) || 0
    if (!expForm.name.trim() || amt <= 0) {
      setToast({ ok: false, text: 'Укажи название и сумму' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    try {
      await api.addExpense(expForm.name.trim(), amt)
      setExpForm({ name: '', amount: '' })
      loadExpenses()
      setToast({ ok: true, text: 'Расход добавлен ✓' })
    } catch (e) {
      setToast({ ok: false, text: `Ошибка: ${e.message}` })
    }
    setTimeout(() => setToast(null), 3000)
  }
  const removeExpense = async (id) => {
    try { await api.deleteExpense(id); loadExpenses() } catch (e) { console.warn(e) }
  }

  const loadAll = () => {
    setError('')
    return Promise.all([loadOrders(), loadStats(), loadProducts(), loadClients(), loadExpenses()])
      .catch(e => setError(String(e))).finally(() => setLoading(false))
  }
  useEffect(() => { loadAll() }, [])

  const productByArticle = useMemo(() => {
    const m = {}
    products.forEach(p => {
      const a = getArticle(p)
      if (a) m[a] = p
    })
    return m
  }, [products])

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

  // ── Stat period filter ──────────────────────────────────────
  const statOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const week  = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    const month = today.slice(0, 7) + '-01'
    return orders.filter(o => {
      const d = (o.timestamp || '').split(' ')[0]
      if (statPeriod === 'today')  return d === today
      if (statPeriod === 'week')   return d >= week && d <= today
      if (statPeriod === 'month')  return d >= month && d <= today
      if (statPeriod === 'custom') {
        const from = customFrom || '2000-01-01'
        const to   = customTo   || today
        return d >= from && d <= to
      }
      return true
    })
  }, [orders, statPeriod, customFrom, customTo])

  const statSummary = useMemo(() => ({
    count: statOrders.length,
    sum:   statOrders.reduce((s, o) => s + parseFloat(o.price || 0), 0),
  }), [statOrders])

  const chartData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    if (statPeriod === 'custom' && customFrom && customTo) {
      const from = new Date(customFrom)
      const to   = new Date(customTo)
      const days = Math.min(14, Math.round((to - from) / 86400000) + 1)
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(customFrom); d.setDate(d.getDate() + i)
        const ds = d.toISOString().split('T')[0]
        const dayO = orders.filter(o => (o.timestamp || '').startsWith(ds))
        return {
          label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
          count: dayO.length,
          sum:   dayO.reduce((s, o) => s + parseFloat(o.price || 0), 0),
          isToday: ds === today,
        }
      })
    }
    const barCount = statPeriod === 'today' ? 7 : statPeriod === 'week' ? 7 : 7
    return Array.from({ length: barCount }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (barCount - 1 - i))
      const ds = d.toISOString().split('T')[0]
      const dayO = orders.filter(o => (o.timestamp || '').startsWith(ds))
      return {
        label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        count: dayO.length,
        sum:   dayO.reduce((s, o) => s + parseFloat(o.price || 0), 0),
        isToday: ds === today,
      }
    })
  }, [orders, statPeriod, customFrom, customTo])
  const maxCount = Math.max(1, ...chartData.map(d => d.count))

  const submitManualOrder = async () => {
    if (!mo.name.trim() || !mo.phone.trim() || !mo.address.trim() || !mo.product_name.trim() || !mo.price) {
      setToast({ ok: false, text: 'Заполни имя, телефон, адрес, товар, цену' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    try {
      await api.createManualOrder({
        source:       mo.source,
        name:         mo.name.trim(),
        phone:        mo.phone.trim(),
        address:      mo.address.trim(),
        product_id:   mo.product_id || 'MANUAL',
        product_name: mo.product_name.trim(),
        quantity:     Number(mo.quantity) || 1,
        price:        Math.max(0, (Number(mo.price) || 0) - (Number(mo.discount) || 0)),
        article:      mo.article || '',
      })
      setShowManualOrder(false)
      setMo({ source: 'Instagram', name: '', phone: '', address: '', product_id: '', product_name: '', quantity: 1, price: 0, discount: '', custom: false, article: '' })
      setToast({ ok: true, text: 'Заказ добавлен ✓' })
      setTimeout(() => setToast(null), 3000)
      loadOrders()
    } catch (e) {
      setToast({ ok: false, text: `Ошибка: ${e.message}` })
      setTimeout(() => setToast(null), 4000)
    }
  }

  const changeStatus = async (id, status) => {
    try {
      const res = await api.updateOrder(id, status)
      if (res?.notified) {
        setToast({ ok: true, text: `Статус "${status}" — клиент уведомлён ✓` })
      } else if (res?.notify_error) {
        setToast({ ok: false, text: `Статус сохранён, но клиент НЕ уведомлён: ${res.notify_error}` })
      } else {
        setToast({ ok: true, text: `Статус обновлён` })
      }
      setTimeout(() => setToast(null), 4000)
      loadOrders()
    } catch (e) {
      setToast({ ok: false, text: `Ошибка: ${e.message}` })
      setTimeout(() => setToast(null), 4000)
    }
  }
  const handleSaveProduct = async data => {
    try {
      if (editIdx !== null) await api.updateProduct(editIdx, data)
      else await api.addProduct(data)
      setShowForm(false); setEditIdx(null); loadProducts()
    } catch (e) { alert('Ошибка: ' + e.message) }
  }
  const handleLogoUpload = async e => {
    const file = e.target.files[0]; if (!file) return
    setLogoUploading(true); setLogoOk(false)
    try { const r = await api.uploadLogo(file); setLogoUrl(r.url + '?t=' + Date.now()); setLogoOk(true) }
    catch (e) { alert('Ошибка: ' + e.message) }
    finally { setLogoUploading(false) }
  }
  const openPhotoUpload = idx => { setUploadPhotoIdx(idx); photoInputRef.current?.click() }
  const handleProductPhoto = async e => {
    const file = e.target.files[0]; if (!file || uploadPhotoIdx === null) return
    try {
      // One-shot: upload bytes to Postgres + write photo_url to Sheets (photo column only)
      const res = await api.setProductPhoto(uploadPhotoIdx, file)
      if (res?.detail) throw new Error(res.detail)
      loadProducts()
    } catch (e) { alert('Ошибка: ' + e.message) }
    finally { setUploadPhotoIdx(null); e.target.value = '' }
  }
  const loadReviews = async () => {
    setReviewsLoading(true)
    try { const r = await api.getReviews(); setReviews(r) } catch (e) { console.warn(e) }
    finally { setReviewsLoading(false) }
  }
  const openReviews = () => { setShowReviews(true); loadReviews() }

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return
    setBroadcasting(true); setBroadcastResult(null)
    try { const r = await api.broadcast(broadcastText); setBroadcastResult(r); setBroadcastText('') }
    catch (e) { setBroadcastResult({ error: String(e) }) }
    finally { setBroadcasting(false) }
  }

  // ── Real "new today" count from PostgreSQL clients ──────────
  const todayNew = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return clients.filter(c => (c.first_order || '').startsWith(today)).length
  }, [clients])

  // ── Order search filter ──────────────────────────────────────
  const searchedOrders = useMemo(() => {
    if (!orderSearch.trim()) return filteredOrders
    const q = orderSearch.toLowerCase()
    return filteredOrders.filter(o =>
      (o.name || '').toLowerCase().includes(q) ||
      (o.phone || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q)
    )
  }, [filteredOrders, orderSearch])

  const searchedOrdersByDay = useMemo(() => {
    const map = {}
    searchedOrders.forEach(o => {
      const day = (o.timestamp || '').split(' ')[0] || 'Неизвестно'
      if (!map[day]) map[day] = []
      map[day].push(o)
    })
    return map
  }, [searchedOrders])
  const searchedSortedDays = useMemo(() =>
    Object.keys(searchedOrdersByDay).sort((a, b) => b.localeCompare(a)), [searchedOrdersByDay])

  // ── Export orders to CSV ─────────────────────────────────────
  const exportCSV = () => {
    const headers = ['ID', 'Клиент', 'Телефон', 'Адрес', 'Товар', 'Кол-во', 'Цена', 'Дата', 'Статус']
    const rows = orders.map(o => [
      o.id, o.name, o.phone, o.address, o.product_name, o.quantity || 1, o.price, o.timestamp, o.status,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `sooq-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Delete product ───────────────────────────────────────────
  const handleDeleteProduct = async idx => {
    if (!window.confirm('Удалить товар? Это нельзя отменить.')) return
    try { await api.deleteProduct(idx); loadProducts() }
    catch (e) { alert('Ошибка: ' + e.message) }
  }

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
    if (Math.abs(dy) > Math.abs(dx)) { setDragX(0); return }  // vertical scroll → skip
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

  const card = 'bg-white dark:bg-[#2D2F37] rounded-[22px] p-4 mb-3 shadow-[0_2px_14px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.45)] border border-black/[0.04] dark:border-white/[0.05]'

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5] dark:bg-[#202329]">

      {/* ══ HEADER ══ */}
      <div className="gold px-4 pt-4 pb-3 shadow-[0_4px_24px_rgba(245,197,24,0.25)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={logoUrl} alt="SOOQ"
              className="w-11 h-11 rounded-2xl object-cover shadow-md border-2 border-white/30"
              onError={e => { e.target.src = LOGO_FB }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-purple-400 rounded-full border-2 border-[#F5C518] shadow" />
          </div>
          <div className="flex-1">
            <p className="font-black text-[#111] text-[17px] leading-none tracking-tight">Панель Админа</p>
            <p className="text-[10px] text-[#111]/60 uppercase tracking-[0.18em] font-bold mt-0.5">
              {user?.first_name || 'SOOQ.TJ'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const u = new URL(window.location.href)
                u.searchParams.set('role', 'partner')
                window.location.href = u.toString()
              }}
              title="Открыть как партнёр (для проверки)"
              className="h-9 px-3 rounded-2xl bg-black/10 flex items-center gap-1 active:scale-90 transition-transform">
              <span className="text-[10px] font-black text-[#111] uppercase tracking-wider">👁 Партнёр</span>
            </button>
            <button onClick={loadAll}
              className="w-9 h-9 rounded-2xl bg-black/10 flex items-center justify-center active:scale-90 transition-transform">
              <RefreshCw size={17} color="#111" strokeWidth={2} />
            </button>
            <GlassToggle />
          </div>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="glass bg-white/80 dark:bg-[#1A1C21]/80 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex overflow-x-auto no-scrollbar">
          {TABS.map(({ label, Icon }, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-shrink-0 flex-1 min-w-[60px] py-2.5 flex flex-col items-center gap-0.5 relative transition-all ${
                tab === i ? 'text-[#0A0A0A] dark:text-white' : 'text-gray-400 dark:text-gray-600'
              }`}>
              <Icon size={16} strokeWidth={tab === i ? 2.5 : 1.8} />
              <span className="text-[9px] font-bold">{label}</span>
              {tab === i && <span className="absolute bottom-0 inset-x-2 h-0.5 gold rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-3 mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3">
          <p className="text-xs text-red-500">⚠️ {error}</p>
        </div>
      )}

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[92%] px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold animate-fadeIn ${
          toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      <input ref={logoInputRef}  type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductPhoto} />

      {/* ══ CONTENT ══ */}
      <div className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>

        {/* Broadcast overlay */}
        {showBroadcast && (
          <div className="absolute inset-0 z-50">
            <BroadcastPanel
              onSend={sendBroadcast}
              onClose={() => setShowBroadcast(false)}
              clientCount={clients.length}
            />
          </div>
        )}

        {/* FAB — clients tab */}
        {tab === 3 && !showBroadcast && (
          <button onClick={() => setShowBroadcast(true)}
            className="fixed bottom-6 right-4 w-14 h-14 gold rounded-full flex items-center justify-center z-40 active:scale-90 transition-transform"
            style={{ boxShadow: '0 4px 20px rgba(245,197,24,0.5)' }}>
            <UserPlus size={22} color="#111" strokeWidth={2.5} />
          </button>
        )}

        <div style={slideStyle}>

          {/* ── PANE 0: ЗАКАЗЫ ── */}
          <div style={paneStyle} className="p-3">
            <div className="pb-4">
              {/* Top row: search + CSV export */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1 flex items-center gap-2 bg-white dark:bg-[#2D2F37] rounded-2xl px-3 py-2.5
                  shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]
                  border border-black/[0.04] dark:border-white/[0.05]">
                  <Search size={14} color={dark ? '#555' : '#AAA'} strokeWidth={2} />
                  <input
                    placeholder="Поиск по имени, телефону..."
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none"
                  />
                </div>
                <button onClick={exportCSV}
                  className="w-10 h-10 rounded-2xl gold flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform shadow-[0_2px_8px_rgba(245,197,24,0.25)]"
                  title="Скачать CSV">
                  <Download size={16} color="#111" strokeWidth={2.5} />
                </button>
              </div>

              {/* Status filter chips */}
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1"
                onTouchStart={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}>
                {ALL_STATUSES.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                      statusFilter === s ? CHIP_ACTIVE[s] : CHIP_COLORS[s]
                    }`}>
                    {s}
                    {s !== 'Все' && (
                      <span className="ml-1 opacity-70">
                        {orders.filter(o => o.status === s).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchedSortedDays.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <ClipboardList size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">
                    {orderSearch ? 'Ничего не найдено' : 'Заказов нет'}
                  </p>
                  {orderSearch && (
                    <button onClick={() => setOrderSearch('')}
                      className="text-xs font-bold active:scale-95 transition-transform"
                      style={{ color: '#F5C518' }}>Сбросить поиск</button>
                  )}
                </div>
              ) : (
                searchedSortedDays.map(day => (
                  <div key={day}>
                    <div className="flex items-center gap-2 mb-2.5 mt-3 first:mt-0">
                      <div className="flex-1 h-px" style={{ background: 'rgba(245,197,24,0.2)' }} />
                      <span className="gold text-[10px] font-black px-3 py-1 rounded-full text-[#111] shadow-sm">{day}</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(245,197,24,0.2)' }} />
                    </div>
                    {searchedOrdersByDay[day].map((o, i) => (
                      <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[22px] overflow-hidden mb-3
                        shadow-[0_2px_14px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.45)]
                        border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">
                        <div className="px-4 pt-3.5 pb-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 gold rounded-xl flex items-center justify-center shadow-sm">
                              <Package size={13} color="#111" strokeWidth={2.5} />
                            </div>
                            <p className="font-black text-sm text-[#0A0A0A] dark:text-white">#{o.id}</p>
                          </div>
                          <StatusBadge status={o.status} />
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm font-bold text-[#0A0A0A] dark:text-white mb-1">
                            👤 {o.name} · 📱 {o.phone}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">📦 {o.product_name}</p>
                          {o.article && (
                            <p className="text-[10px] font-mono font-black text-yellow-600 dark:text-yellow-500 mt-0.5">
                              🔖 {o.article}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">📍 {o.address}</p>
                          <div className="flex items-end justify-between mt-2">
                            <p className="text-[10px] text-gray-300 dark:text-gray-700">{o.timestamp}</p>
                            {(() => {
                              const sale = parseFloat(o.price) || 0
                              const op = productByArticle[o.article]
                              const qtyN = Number(o.quantity) || 1
                              const cost = op ? computeCost(op).total * qtyN : 0
                              const profit = sale - cost
                              return (
                                <div className="flex flex-col items-end leading-none text-right">
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
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {ORDER_STATUSES.map(s => (
                              <button key={s} onClick={() => changeStatus(o.id, s)}
                                className={`text-[11px] px-3 py-1.5 rounded-xl font-bold transition-all active:scale-95 ${
                                  o.status === s
                                    ? 'gold text-[#111] shadow-[0_2px_8px_rgba(245,197,24,0.3)]'
                                    : 'bg-[#F5F5F5] dark:bg-white/5 text-gray-500 dark:text-gray-400'
                                }`}>{s}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                            <button onClick={() => openEditOrder(o)}
                              className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 active:scale-95 transition-all">
                              <Pencil size={13} strokeWidth={2.5} />
                              Изменить
                            </button>
                            <button onClick={() => deleteOrder(o.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 active:scale-95 transition-all">
                              <Trash2 size={13} strokeWidth={2.5} />
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* ── PANE 1: СТАТИСТИКА ── */}
          <div style={paneStyle} className="p-3">
            <div className="pb-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* ══ Финансы (теперь сверху) ══ */}
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
                      <div className="bg-white dark:bg-[#2D2F37] rounded-[22px] p-4
                        shadow-[0_2px_14px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.45)]
                        border border-black/[0.04] dark:border-white/[0.05]">
                        <p className="font-black text-xs text-[#0A0A0A] dark:text-white mb-3">
                          💰 Финансы (Доставлено)
                        </p>
                        <div className="flex items-center gap-4 mb-3">
                          <DoughnutChart income={netProfit} expense={totalExpense} size={150} />
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
                        <div className="bg-[#F5F5F5] dark:bg-white/5 rounded-xl p-2.5 space-y-1.5 mb-3">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 dark:text-gray-400">Себестоимость товаров</span>
                            <span className="font-bold text-yellow-600 dark:text-yellow-500">{fmt(costOfGoods)} сом</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 dark:text-gray-400">Доп. расходы</span>
                            <span className="font-bold text-orange-500">{fmt(explicitExp)} сом</span>
                          </div>
                        </div>

                        {/* Add expense form */}
                        <div className="space-y-2 mb-3">
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            Добавить расход
                          </p>
                          <div className="flex gap-2">
                            <input value={expForm.name}
                              onChange={e => setExpForm({ ...expForm, name: e.target.value })}
                              placeholder="Налог, реклама…"
                              className="flex-1 bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-[#0A0A0A] dark:text-white outline-none" />
                            <input value={expForm.amount}
                              inputMode="decimal"
                              onChange={e => setExpForm({ ...expForm, amount: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })}
                              placeholder="Сумма"
                              className="w-24 bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-[#0A0A0A] dark:text-white outline-none" />
                            <button onClick={submitExpense}
                              className="px-3 rounded-xl gold flex items-center justify-center active:scale-95 transition-transform">
                              <Plus size={16} color="#111" strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>

                        {/* Expenses list */}
                        {expenses.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                              Список расходов
                            </p>
                            {expenses.map(e => (
                              <div key={e.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[#0A0A0A] dark:text-white font-bold truncate">{e.name}</p>
                                  <p className="text-[10px] text-gray-400">{e.created_at}</p>
                                </div>
                                <p className="font-black text-orange-500 mr-2">{fmt(e.amount)} сом</p>
                                <button onClick={() => removeExpense(e.id)}
                                  className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center active:scale-90 transition-transform">
                                  <Trash2 size={11} color="#ef4444" strokeWidth={2} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* ── Period filter ── */}
                  <div className="bg-white dark:bg-[#2D2F37] rounded-[22px] p-3
                    shadow-[0_2px_14px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.45)]
                    border border-black/[0.04] dark:border-white/[0.05]">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { key: 'today', label: 'Сегодня' },
                        { key: 'week',  label: '7 дней'  },
                        { key: 'month', label: 'Месяц'   },
                        { key: 'custom',label: 'Период'  },
                      ].map(p => (
                        <button key={p.key} onClick={() => setStatPeriod(p.key)}
                          className={`flex-shrink-0 text-[11px] font-bold px-3.5 py-2 rounded-full transition-all active:scale-95 ${
                            statPeriod === p.key
                              ? 'gold text-[#111] shadow-[0_2px_8px_rgba(245,197,24,0.3)]'
                              : 'bg-[#F5F5F5] dark:bg-white/5 text-gray-500 dark:text-gray-400'
                          }`}>{p.label}
                        </button>
                      ))}
                    </div>
                    {statPeriod === 'custom' && (
                      <div className="flex gap-2 mt-2.5">
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 mb-1 px-1">С</p>
                          <input type="date" value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold text-[#0A0A0A] dark:text-white border border-black/[0.06] dark:border-white/[0.08] outline-none" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 mb-1 px-1">По</p>
                          <input type="date" value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold text-[#0A0A0A] dark:text-white border border-black/[0.06] dark:border-white/[0.08] outline-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Stats cards ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Заказов', value: statSummary.count },
                      { label: 'Выручка', value: Math.round(statSummary.sum), unit: 'сом' },
                    ].map((s, i) => (
                      <div key={i} className={card + ' !p-4'}>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">{s.label}</p>
                        <p className="font-black text-2xl gold-text leading-none">{s.value}</p>
                        {s.unit && <p className="text-[10px] text-gray-400 mt-0.5">{s.unit}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-[#2D2F37] rounded-[22px] overflow-hidden shadow-[0_2px_14px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.45)] border border-black/[0.04] dark:border-white/[0.05]">
                    <div className="gold px-4 py-3 flex items-center justify-between">
                      <p className="font-black text-[#111] text-sm">Всего заказов</p>
                      <p className="font-black text-[#111] text-2xl">{stats?.total_count ?? orders.length}</p>
                    </div>
                  </div>

                  {/* Bar chart */}
                  <div className={card}>
                    <p className="text-xs font-black text-[#0A0A0A] dark:text-white mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 gold rounded-lg flex items-center justify-center shadow-sm">
                        <BarChart2 size={13} color="#111" strokeWidth={2.5} />
                      </span>
                      {statPeriod === 'today'  ? 'Заказы за 7 дней' :
                       statPeriod === 'week'   ? 'Заказы за 7 дней' :
                       statPeriod === 'month'  ? 'Последние 7 дней' :
                       'График по дням'}
                    </p>
                    <div className="flex items-end gap-1.5 h-28">
                      {chartData.map((d, i) => (
                        <div key={i} className="flex flex-col items-center flex-1">
                          {d.count > 0 && <p className="text-[9px] font-bold text-gray-400 mb-1">{d.count}</p>}
                          <div
                            style={{
                              height: `${Math.max(6, (d.count / maxCount) * 80)}px`,
                              animationDelay: `${i * 60}ms`,
                              transformOrigin: 'bottom',
                            }}
                            className={`w-full rounded-t-xl animate-barGrow ${
                              d.count > 0
                                ? d.isToday
                                  ? 'bg-[#F5C518] shadow-[0_-2px_14px_rgba(245,197,24,0.5)]'
                                  : 'gold shadow-[0_-2px_10px_rgba(245,197,24,0.22)]'
                                : 'bg-gray-100 dark:bg-white/5'
                            }`}
                          />
                          <p className="text-[8px] text-gray-400 mt-1.5 text-center leading-tight">{d.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stock */}
                  <div className={card}>
                    <p className="text-xs font-black text-[#0A0A0A] dark:text-white mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 gold rounded-lg flex items-center justify-center shadow-sm">
                        <Package size={13} color="#111" strokeWidth={2.5} />
                      </span>
                      Склад
                    </p>
                    {products.length === 0 ? (
                      <p className="text-xs text-gray-400">Нет данных</p>
                    ) : (
                      <div className="space-y-2.5">
                        {products.map((p, i) => {
                          const q = qty(p)
                          return (
                            <div key={i} className="flex items-center gap-3">
                              {ph(p)
                                ? <img src={ph(p)} className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
                                    onError={e => { const fb = getPhotoFallback(p); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }} />
                                : <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#1A1A1A,#2D2D2D)' }}>
                                    <Package size={13} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                                  </div>
                              }
                              <p className="text-xs font-semibold text-[#0A0A0A] dark:text-gray-300 flex-1 truncate">{nm(p)}</p>
                              <span className={`text-[11px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
                                q === 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                                : q < 5  ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500'
                                         : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              }`}>{q} шт</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>


                </>
              )}
            </div>
          {/* ── PANE 2: СКЛАД ── */}
          </div>
          <div style={paneStyle} className="p-3">
            <div className="pb-4 space-y-3">

              {/* Header with gold icon + Add button */}
              <div className="flex items-center justify-between">
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white flex items-center gap-2">
                  <span className="w-7 h-7 gold rounded-xl flex items-center justify-center shadow-sm">
                    <ShoppingBag size={15} color="#111" strokeWidth={2.5} />
                  </span>
                  Склад
                </p>
                <button onClick={() => { setEditIdx(null); setShowForm(true) }}
                  className="h-9 px-3.5 rounded-2xl gold flex items-center gap-1.5 active:scale-90 transition-transform shadow-[0_2px_8px_rgba(245,197,24,0.25)]">
                  <Plus size={15} color="#111" strokeWidth={2.5} />
                  <span className="text-[11px] font-black text-[#111] uppercase tracking-wider">Товар</span>
                </button>
              </div>

              {/* Stock summary */}
              <div className="flex bg-white dark:bg-[#2D2F37] rounded-2xl p-3
                shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                border border-black/[0.04] dark:border-white/[0.05]">
                {(() => {
                  const totalInitial = products.reduce((s, p) => s + (getInitialStock(p) ?? qty(p)), 0)
                  const totalCurrent = products.reduce((s, p) => s + qty(p), 0)
                  const totalSold    = totalInitial - totalCurrent
                  const totalRevenue = products.reduce((s, p) => s + getSalePrice(p) * qty(p), 0)
                  return [
                    { label: 'Грузил',   value: totalInitial, color: 'text-blue-500' },
                    { label: 'Осталось', value: totalCurrent, color: 'text-green-500' },
                    { label: 'Продано',  value: totalSold,    color: 'gold-text' },
                    { label: 'Выручка',  value: fmt(totalRevenue), unit: 'сом' },
                  ].map((s, i, arr) => (
                    <div key={i} className={`flex-1 text-center ${i < arr.length - 1 ? 'border-r border-black/[0.06] dark:border-white/[0.06]' : ''}`}>
                      <p className={`font-black text-base leading-tight ${s.color || 'text-[#0A0A0A] dark:text-white'}`}>{s.value}</p>
                      {s.unit && <p className="text-[8px] font-bold text-gray-400">{s.unit}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))
                })()}
              </div>

              {/* Product list */}
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <ShoppingBag size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">Склад пуст</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {products.map((p, i) => {
                    const initial = getInitialStock(p)
                    const current = qty(p)
                    const sale = getSalePrice(p)
                    const cost = computeCost(p).total
                    const profit = sale - cost
                    return (
                      <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[20px] overflow-hidden flex
                        shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                        border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">
                        <button onClick={() => openPhotoUpload(p._index)}
                          className="flex-shrink-0 relative group">
                          {ph(p)
                            ? <img src={ph(p)} className="w-20 h-20 object-cover" loading="lazy" decoding="async"
                                onError={e => { const fb = getPhotoFallback(p); if (fb && e.target.src !== fb) e.target.src = fb; else e.target.style.display='none' }} />
                            : <div className="w-20 h-20 flex flex-col items-center justify-center gap-0.5"
                                style={{ background: 'linear-gradient(135deg,#F5C518,#FF9C00)' }}>
                                <Camera size={22} color="#111" strokeWidth={2.5} />
                                <span className="text-[8px] font-black text-[#111] uppercase tracking-wider">Фото</span>
                              </div>}
                          {uploadPhotoIdx === p._index && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </button>
                        <div className="flex-1 p-3 min-w-0 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-[#0A0A0A] dark:text-white line-clamp-1">{nm(p)}</p>
                            {getArticle(p) && (
                              <p className="text-[10px] font-black font-mono text-yellow-600 dark:text-yellow-500 mt-0.5">
                                🔖 {getArticle(p)}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {initial != null && (
                                <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                  Грузил: {initial}
                                </span>
                              )}
                              <span className="text-[10px] font-black bg-green-100 dark:bg-green-900/30 text-green-500 dark:text-green-400 px-2 py-0.5 rounded-full">
                                Осталось: {current}
                              </span>
                            </div>
                            <div className="flex gap-1.5 mt-2">
                              <button onClick={() => { setEditIdx(p._index); setShowForm(true) }}
                                className="w-7 h-7 rounded-xl bg-[#F5F5F5] dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                                <Pencil size={12} color={dark ? '#888' : '#555'} strokeWidth={2} />
                              </button>
                              <button onClick={() => handleDeleteProduct(p._index)}
                                className="w-7 h-7 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center active:scale-90 transition-transform">
                                <Trash2 size={12} color="#ef4444" strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col items-end leading-none flex-shrink-0 text-right">
                            <p className="font-black text-base text-[#0A0A0A] dark:text-white">
                              {fmt(sale)} <span className="text-[10px] font-bold opacity-70">сом</span>
                            </p>
                            <p className="text-[10px] font-bold text-yellow-500 mt-1">с/с: {fmt(cost)}</p>
                            <p className={`text-[11px] font-black mt-0.5 ${profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
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
          {/* ── PANE 3: КЛИЕНТЫ ── */}
          </div>
          <div style={paneStyle} className="p-3">
            <div className="pb-20 space-y-3">

              {/* Stats row */}
              <div className={card}>
                <div className="flex">
                  {[
                    { label: 'Клиентов', value: clients.length || 24 },
                    { label: 'Заказов',  value: clients.reduce((s, c) => s + (c.total_orders || 0), 0) || 68 },
                    { label: 'Выручка',  value: (Math.round(clients.reduce((s, c) => s + (c.total_spent || 0), 0)) || 12400) + ' с' },
                  ].map((s, i, arr) => (
                    <div key={i} className={`flex-1 text-center ${i < arr.length - 1 ? 'border-r border-black/[0.06] dark:border-white/[0.06]' : ''}`}>
                      <p className="font-black text-xl gold-text leading-tight">{s.value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* "Новых сегодня" metric card */}
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
                {/* Pulse green dot */}
                <div className="relative flex-shrink-0 mr-1">
                  <div className="w-3 h-3 bg-green-400 rounded-full" />
                  <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75" />
                </div>
              </div>

              {/* Filter toggle */}
              <div className="flex gap-2">
                {[
                  { key: 'all',   label: 'Все клиенты' },
                  { key: 'today', label: `Новые сегодня (${todayNew})` },
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

              {/* Broadcast shortcut card */}
              <button onClick={() => setShowBroadcast(true)}
                className="w-full bg-white dark:bg-[#2D2F37] rounded-[20px] p-4 flex items-center gap-3
                  shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                  border border-[#F5C518]/25 active:scale-[0.98] transition-transform text-left">
                <div className="w-10 h-10 gold rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Megaphone size={18} color="#111" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm text-[#0A0A0A] dark:text-white">Рассылка клиентам</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{clients.length} получател{clients.length === 1 ? 'ь' : 'я'} · акции, новости</p>
                </div>
                <span className="text-[11px] font-black" style={{ color: '#F5C518' }}>→</span>
              </button>

              {/* Reviews shortcut card */}
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

              {/* Client list header */}
              {clientFilter === 'today' ? (
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-6 h-6 gold rounded-lg flex items-center justify-center">
                    <UserPlus size={12} color="#111" strokeWidth={2.5} />
                  </div>
                  <p className="font-black text-sm text-[#0A0A0A] dark:text-white">Новые сегодня 👥</p>
                </div>
              ) : (
                <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest px-1 pt-1">
                  Все клиенты
                </p>
              )}

              {/* Client list */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : clients.length === 0 && clientFilter === 'all' ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Users size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">База пуста</p>
                  <p className="text-xs text-gray-300 dark:text-gray-700">Появится после первого заказа</p>
                </div>
              ) : clientFilter === 'today' && todayNew === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <UserX size={48} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">Пока нет новых клиентов</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(clients.length > 0 ? clients : Array.from({ length: 5 }, (_, i) => ({
                    name: ['Алишер Назаров','Фаррух Рахимов','Дильноза Юсупова','Сарвар Каримов','Малика Ахмедова'][i],
                    phone: `+992 9${i}${i} ${i}${i}${i}-${i}${i}-${i}${i}`,
                    total_orders: 1 + i,
                    total_spent: (100 + i * 85) * (1 + i),
                    _isToday: i < todayNew,
                  })))
                  .filter(c => clientFilter === 'all' || c._isToday)
                  .map((c, i) => {
                    const initials = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    const isNew = clientFilter === 'today' || c._isToday || i < todayNew
                    return (
                      <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-3.5 flex items-center gap-3
                        shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                        border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">
                        <div className="w-10 h-10 gold rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-sm font-black text-[#111]">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-[#0A0A0A] dark:text-white line-clamp-1">{c.name}</p>
                            {isNew && (
                              <span className="flex-shrink-0 gold text-[#111] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                Новый
                              </span>
                            )}
                          </div>
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
          {/* ── PANE 4: НАСТРОЙКИ ── */}
          </div>
          <div style={paneStyle} className="p-3">
            <div className="pb-8 space-y-3">
              {/* Theme */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-3">Тема оформления</p>
                <div className="flex items-center justify-between bg-[#F5F5F5] dark:bg-[#363840] rounded-2xl px-4 py-3.5">
                  <div>
                    <p className="text-sm font-bold text-[#0A0A0A] dark:text-white">
                      {dark ? 'Тёмная тема' : 'Светлая тема'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Нажмите для переключения</p>
                  </div>
                  <GlassToggle />
                </div>
              </div>

              {/* Logo */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 gold rounded-lg flex items-center justify-center shadow-sm">
                    <Image size={13} color="#111" strokeWidth={2.5} />
                  </span>
                  Логотип
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <img src={logoUrl} alt="logo"
                    className="w-20 h-20 rounded-[20px] object-cover border-2 border-[#F5C518] shadow-[0_4px_16px_rgba(245,197,24,0.25)]"
                    onError={e => { e.target.src = LOGO_FB }} />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Текущий логотип</p>
                    {logoOk && (
                      <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Обновлён!
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                  className="w-full gold text-[#111] font-bold rounded-2xl py-3 text-sm active:scale-95
                    transition-transform disabled:opacity-60 shadow-[0_4px_16px_rgba(245,197,24,0.25)]
                    flex items-center justify-center gap-2">
                  <Camera size={15} strokeWidth={2.5} />
                  {logoUploading ? 'Загружаем...' : 'Загрузить логотип'}
                </button>
                <p className="text-[10px] text-gray-400 mt-2 text-center">PNG / JPG · квадратный</p>
              </div>

              {/* Recalc prices */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 gold rounded-lg flex items-center justify-center shadow-sm">
                    🔁
                  </span>
                  Пересчитать цены
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3 leading-relaxed">
                  Перезапишет в Google Sheets «Себестоимость ¥», «Себестоимость сомони» и «Продажная цена» по формуле:
                  база (¥×{1.37.toFixed(2)}) + карго ($200/м³) + 20 сом доставка, наценка ×2.
                </p>
                <button onClick={async () => {
                  if (!confirm('Пересчитать цены всех товаров?\nВ Google Sheets перезапишутся ¥/сом/Продажная цена.')) return
                  try {
                    const res = await api.recalcPrices()
                    setToast({ ok: true, text: `✓ Обновлено: ${res.count} товаров${res.skipped?.length ? ` · пропущено: ${res.skipped.length}` : ''}` })
                    loadProducts()
                  } catch (e) {
                    setToast({ ok: false, text: `Ошибка: ${e.message}` })
                  }
                  setTimeout(() => setToast(null), 5000)
                }}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black rounded-2xl py-3 text-sm
                    active:scale-95 transition-transform shadow-[0_4px_16px_rgba(168,85,247,0.35)]
                    flex items-center justify-center gap-2">
                  🔁 Пересчитать цены
                </button>
              </div>

              {/* Apply manual prices */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg,#F5C518,#FF9C00)' }}>
                    <span className="text-[11px]">💲</span>
                  </span>
                  Применить цены
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3 leading-relaxed">
                  Запишет в Google Sheets финальные цены (сомони) по всем артикулам ORM. Себестоимость и остаток не меняются.
                </p>
                <button onClick={async () => {
                  try {
                    const res = await api.applyManualPrices()
                    setToast({ ok: true, text: `✓ Цены обновлены: ${res.count} товаров${res.skipped?.length ? ` · пропущено: ${res.skipped.length}` : ''}` })
                    loadProducts()
                  } catch (e) {
                    setToast({ ok: false, text: `Ошибка: ${e.message}` })
                  }
                  setTimeout(() => setToast(null), 5000)
                }}
                  className="w-full gold text-[#111] font-black rounded-2xl py-3 text-sm
                    active:scale-95 transition-transform shadow-[0_4px_16px_rgba(245,197,24,0.35)]
                    flex items-center justify-center gap-2">
                  💲 Применить цены
                </button>
              </div>

              {/* Partial reset — keep delivered */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm bg-orange-500">
                    <Trash2 size={13} color="#fff" strokeWidth={2.5} />
                  </span>
                  Сброс (кроме доставленных)
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3 leading-relaxed">
                  Удаляет все заказы кроме <span className="text-green-500 font-bold">«Доставлен»</span>, клиентов и отзывы.{' '}
                  <span className="text-yellow-500 font-bold">Расходы и цены НЕ затрагиваются.</span>
                </p>
                <button onClick={async () => {
                  if (!window.confirm('Удалить все заказы кроме «Доставлен»?\n\nРасходы и доставленные заказы сохранятся.\nКлиенты и отзывы будут очищены.')) return
                  try {
                    const res = await api.resetExceptDelivered()
                    setToast({ ok: true, text: `✓ Удалено заказов: ${res.orders_deleted}, сохранено: ${res.orders_kept}, клиентов: ${res.clients_deleted}` })
                    loadAll()
                  } catch (e) {
                    setToast({ ok: false, text: `Ошибка: ${e.message}` })
                  }
                  setTimeout(() => setToast(null), 7000)
                }}
                  className="w-full bg-orange-500 text-white font-black rounded-2xl py-3 text-sm
                    active:scale-95 transition-transform shadow-[0_4px_16px_rgba(249,115,22,0.35)]
                    flex items-center justify-center gap-2">
                  <Trash2 size={15} strokeWidth={2.5} />
                  Умный сброс
                </button>
              </div>

              {/* Reset stats */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm bg-red-500">
                    <Trash2 size={13} color="#fff" strokeWidth={2.5} />
                  </span>
                  Сброс статистики
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3 leading-relaxed">
                  Удаляет заказы, клиентов, расходы, отзывы.{' '}
                  <span className="text-green-500 font-bold">Товары и цены НЕ затрагиваются.</span>
                </p>
                <button onClick={async () => {
                  if (!window.confirm('⚠️ СБРОС ВСЕХ ДАННЫХ\n\nБудут удалены:\n• Все заказы (Google Sheets)\n• Все клиенты\n• Все расходы\n• Все отзывы\n\nЭто нельзя отменить! Продолжить?')) return
                  if (!window.confirm('Вы уверены? Это окончательное удаление всех данных.')) return
                  try {
                    const res = await api.resetStats()
                    setToast({ ok: true, text: `✓ Сброс выполнен: заказов ${res.orders_deleted}, клиентов ${res.clients_deleted}, расходов ${res.expenses_deleted}, отзывов ${res.reviews_deleted}` })
                    loadAll()
                  } catch (e) {
                    setToast({ ok: false, text: `Ошибка: ${e.message}` })
                  }
                  setTimeout(() => setToast(null), 7000)
                }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl py-3 text-sm
                    active:scale-95 transition-transform shadow-[0_4px_16px_rgba(239,68,68,0.35)]
                    flex items-center justify-center gap-2">
                  <Trash2 size={15} strokeWidth={2.5} />
                  Сбросить все данные
                </button>
              </div>

              {/* Info */}
              <div className={card}>
                <p className="font-black text-sm text-[#0A0A0A] dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 gold rounded-lg flex items-center justify-center shadow-sm">
                    <Info size={13} color="#111" strokeWidth={2.5} />
                  </span>
                  Информация
                </p>
                <div className="space-y-2 text-xs text-gray-400">
                  {[
                    ['Telegram ID', <span key="id"   className="text-[#0A0A0A] dark:text-white font-mono font-black">{user?.id || '—'}</span>],
                    ['Имя',         <span key="nm"   className="text-[#0A0A0A] dark:text-white font-bold">{user?.first_name || '—'}</span>],
                    ['Роль',        <span key="role" className="text-green-500 font-black">✅ admin</span>],
                    ['Товаров',     <span key="prd"  className="gold-text font-black">{products.length}</span>],
                    ['Заказов',     <span key="ord"  className="gold-text font-black">{orders.length}</span>],
                    ['Клиентов',    <span key="cli"  className="gold-text font-black">{clients.length}</span>],
                  ].map(([label, val], i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
                      <span>{label}</span>{val}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FAB: Add manual order ══ */}
      {tab === 0 && !showManualOrder && (
        <button
          onClick={() => setShowManualOrder(true)}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full gold flex items-center justify-center z-40
            shadow-[0_8px_24px_rgba(245,197,24,0.45)] active:scale-90 transition-transform"
          title="Добавить заказ вручную">
          <Plus size={26} color="#111" strokeWidth={3} />
        </button>
      )}

      {/* ══ Bottom-sheet ProductForm modal (root level — fixed must be outside transformed swipe container) ══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => { setShowForm(false); setEditIdx(null) }}>
          <div className="w-full bg-white dark:bg-[#202329] rounded-t-[28px] max-h-[90vh] overflow-y-auto p-4 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-3" />
            <ProductForm
              initial={editIdx !== null ? (products.find(x => x._index === editIdx) || null) : null}
              onSave={handleSaveProduct}
              onCancel={() => { setShowForm(false); setEditIdx(null) }}
            />
          </div>
        </div>
      )}

      {/* ══ Manual order modal ══ */}
      {showManualOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowManualOrder(false)}>
          <div className="w-full bg-white dark:bg-[#202329] rounded-t-[28px] max-h-[90vh] overflow-y-auto p-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-base text-[#0A0A0A] dark:text-white">📝 Новый заказ (вручную)</p>
              <button onClick={() => setShowManualOrder(false)}
                className="w-8 h-8 rounded-full bg-[#F5F5F5] dark:bg-white/10 flex items-center justify-center">
                <X size={15} color={dark ? '#fff' : '#333'} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Source */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 px-1 uppercase tracking-wider">Откуда</p>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {['Instagram', 'WhatsApp', 'Звонок', 'Другое'].map(s => (
                    <button key={s} onClick={() => setMo({ ...mo, source: s })}
                      className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                        mo.source === s ? 'gold text-[#111]' : 'bg-[#F5F5F5] dark:bg-white/5 text-gray-500'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Client */}
              <input value={mo.name} onChange={e => setMo({ ...mo, name: e.target.value })}
                placeholder="Имя клиента *"
                className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />

              <input value={mo.phone} onChange={e => setMo({ ...mo, phone: e.target.value })}
                placeholder="Телефон *" type="tel"
                className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />

              <input value={mo.address} onChange={e => setMo({ ...mo, address: e.target.value })}
                placeholder="Адрес *"
                className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />

              {/* Product */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Товар *</p>
                  <button onClick={() => setMo({ ...mo, custom: !mo.custom, product_id: '', product_name: '', price: 0 })}
                    className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 active:scale-95">
                    {mo.custom ? '← Из каталога' : 'Свой товар →'}
                  </button>
                </div>
                {!mo.custom ? (
                  <select value={mo.product_id || ''}
                    onChange={e => {
                      const p = products.find(x => String(x.id || x['ID'] || x._index) === e.target.value)
                      if (p) {
                        const name    = p['Название (RU)'] || p.name || p['Название'] || ''
                        const price   = parseFloat(p['Цена со скидкой'] || p['Продажная цена'] || p.price || p['Цена'] || 0)
                        const article = p['Артикул'] || p['col1'] || ''
                        setMo({ ...mo, product_id: e.target.value, product_name: name, price, article })
                      } else {
                        setMo({ ...mo, product_id: '', product_name: '', price: 0, article: '' })
                      }
                    }}
                    className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none">
                    <option value="">— Выбери товар —</option>
                    {(() => {
                      // Group products by INFERRED category (from name)
                      const groups = {}
                      products.forEach(p => {
                        const cat = inferCategory(p)
                        if (!groups[cat]) groups[cat] = []
                        groups[cat].push(p)
                      })
                      const sortedCats = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ru'))
                      return sortedCats.map(cat => (
                        <optgroup key={cat} label={`${cat} (${groups[cat].length})`}>
                          {groups[cat].map((p, i) => {
                            const id    = String(p.id || p['ID'] || p._index)
                            const name  = p['Название (RU)'] || p.name || p['Название'] || `Товар ${i+1}`
                            const price = p['Цена со скидкой'] || p['Продажная цена'] || p.price || p['Цена'] || 0
                            return <option key={id} value={id}>{name} — {price} сом</option>
                          })}
                        </optgroup>
                      ))
                    })()}
                  </select>
                ) : (
                  <input value={mo.product_name} onChange={e => setMo({ ...mo, product_name: e.target.value })}
                    placeholder="Название товара"
                    className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />
                )}
                {mo.article && (
                  <p className="text-[11px] font-mono font-black text-yellow-600 dark:text-yellow-500 mt-1.5 px-1">
                    🔖 Артикул: {mo.article}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 px-1 uppercase tracking-wider">Кол-во</p>
                  <input inputMode="numeric" placeholder="1" value={mo.quantity}
                    onChange={e => setMo({ ...mo, quantity: e.target.value.replace(/[^\d]/g, '') })}
                    className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3.5 text-base font-bold text-[#0A0A0A] dark:text-white outline-none" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 px-1 uppercase tracking-wider">Цена (сом) *</p>
                  <input inputMode="decimal" placeholder="0" value={mo.price}
                    onChange={e => setMo({ ...mo, price: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })}
                    className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3.5 text-base font-bold text-[#0A0A0A] dark:text-white outline-none" />
                </div>
              </div>

              {/* Discount row */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-orange-400 mb-1 px-1 uppercase tracking-wider">🏷 Скидка (сом)</p>
                  <input inputMode="decimal" placeholder="0"
                    value={mo.discount}
                    onChange={e => setMo({ ...mo, discount: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') })}
                    className="w-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl px-3.5 py-3.5 text-base font-bold text-orange-600 dark:text-orange-400 outline-none" />
                </div>
                <div className="flex-1 pb-0">
                  <p className="text-[10px] font-bold text-green-500 mb-1 px-1 uppercase tracking-wider">✅ Итого</p>
                  <div className="w-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl px-3.5 py-3.5">
                    <p className="text-base font-black text-green-600 dark:text-green-400">
                      {Math.max(0, (Number(mo.price) || 0) - (Number(mo.discount) || 0))} сом
                    </p>
                  </div>
                </div>
              </div>

              {/* Net profit preview */}
              {(() => {
                const finalPrice = Math.max(0, (Number(mo.price) || 0) - (Number(mo.discount) || 0))
                const qtyN = Number(mo.quantity) || 1
                const op = mo.article ? productByArticle[mo.article] : null
                const cost = op ? computeCost(op).total * qtyN : null
                const profit = cost !== null ? finalPrice - cost : null
                if (profit === null) return null
                return (
                  <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                    profit >= 0
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
                  }`}>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">💰 Чистая прибыль</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">с/с: {fmt(cost)} сом × {qtyN} шт</p>
                    </div>
                    <p className={`text-xl font-black ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {profit >= 0 ? '+' : ''}{fmt(profit)} <span className="text-sm font-bold opacity-70">сом</span>
                    </p>
                  </div>
                )
              })()}

              <button onClick={submitManualOrder}
                className="w-full gold text-[#111] font-black py-3.5 rounded-2xl text-sm mt-2 active:scale-95 transition-transform shadow-[0_4px_16px_rgba(245,197,24,0.35)]">
                Добавить заказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Order Modal ── */}
      {editOrderModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditOrderModal(null) }}>
          <div className="w-full max-w-lg bg-white dark:bg-[#1E1F26] rounded-t-[28px] p-5 pb-8 space-y-3"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-black text-base text-[#0A0A0A] dark:text-white">✏️ Заказ #{editOrderModal.id}</p>
              <button onClick={() => setEditOrderModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-white/10">
                <X size={16} />
              </button>
            </div>
            {[
              { key: 'name',         label: 'Имя клиента' },
              { key: 'phone',        label: 'Телефон'     },
              { key: 'address',      label: 'Адрес'       },
              { key: 'product_name', label: 'Товар'       },
            ].map(({ key, label }) => (
              <div key={key}>
                <p className="text-[10px] font-bold text-gray-400 mb-1 px-1 uppercase tracking-wider">{label}</p>
                <input value={editFields[key] || ''}
                  onChange={e => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />
              </div>
            ))}
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 mb-1 px-1 uppercase tracking-wider">Кол-во</p>
                <input inputMode="numeric" value={editFields.quantity || ''}
                  onChange={e => setEditFields(prev => ({ ...prev, quantity: e.target.value.replace(/\D/g, '') }))}
                  className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 mb-1 px-1 uppercase tracking-wider">Цена (сом)</p>
                <input inputMode="decimal" value={editFields.price || ''}
                  onChange={e => setEditFields(prev => ({ ...prev, price: e.target.value.replace(/[^\d.]/g, '') }))}
                  className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-xl px-3.5 py-3 text-sm font-bold text-[#0A0A0A] dark:text-white outline-none" />
              </div>
            </div>
            <button onClick={saveEditOrder}
              className="w-full gold text-[#111] font-black py-3.5 rounded-2xl text-sm active:scale-95 transition-transform shadow-[0_4px_16px_rgba(245,197,24,0.35)]">
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
