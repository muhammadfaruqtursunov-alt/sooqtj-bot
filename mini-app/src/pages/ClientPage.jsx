import { useEffect, useState, useRef, useMemo } from 'react'
import { api } from '../api'
import { LOGO, LOGO_FB } from '../config'
import { inferCategory } from '../categoryInference'
import { getPhotoUrl, getPhotoFallback } from '../costCalculation'
import { useDarkMode } from '../useDarkMode'
import GlassToggle from '../components/GlassToggle'
import ProductCard from '../components/ProductCard'
import OrderCard from '../components/OrderCard'
import { ShoppingBag, ShoppingCart, Package, Search, Plus, Minus, Trash2, X, Star, MessageSquare } from 'lucide-react'
import RegistrationModal from '../components/RegistrationModal'

const TABS_COUNT = 3

export default function ClientPage({ preloadedProducts }) {
  const { dark } = useDarkMode()
  const [tab, setTab] = useState(0)
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sooq_cart') || '[]') } catch { return [] }
  })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Все')
  const [showRegModal,   setShowRegModal]   = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('review') === '1' } catch { return false }
  })
  const [reviewText,    setReviewText]    = useState('')
  const [reviewRating,  setReviewRating]  = useState(5)
  const [reviewSending, setReviewSending] = useState(false)
  const [reviewSent,    setReviewSent]    = useState(false)
  const [viewProduct,   setViewProduct]   = useState(null)

  // Swipe state
  const touchStartX = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const productFetch = preloadedProducts || api.getProducts()
    productFetch
      .then(data => { if (data) setProducts(data) })
      .catch(() => api.getProducts().then(setProducts).catch(() => {}))
      .finally(() => setLoading(false))
    api.getMyOrders().then(setOrders).catch(() => {})
  }, [])

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('sooq_cart', JSON.stringify(cart))
  }, [cart])

  // Build category list: "Все" + explicit categories from sheet + auto-inferred subcategories
  const categories = useMemo(() => {
    const explicit = [...new Set(products.map(p => (p['Категория'] || p['col3'] || '').trim()).filter(Boolean))]
    const inferred = [...new Set(products.map(p => inferCategory(p)))].filter(c => c !== 'Прочее' && !explicit.includes(c))
    inferred.sort((a, b) => a.localeCompare(b, 'ru'))
    return ['Все', ...explicit, ...inferred]
  }, [products])

  const filteredProducts = products.filter(p => {
    const matchSearch = !search.trim() || (() => {
      const q = search.toLowerCase()
      const n = (p['Название (RU)'] || p['Название'] || p['col2'] || '').toLowerCase()
      const c = (p['Категория'] || p['col3'] || '').toLowerCase()
      return n.includes(q) || c.includes(q)
    })()
    const explicitCat = (p['Категория'] || p['col3'] || '').trim()
    const matchCat = category === 'Все'
      || explicitCat === category
      || inferCategory(p) === category
    return matchSearch && matchCat
  })


  const addToCart = p => setCart(prev => {
    const ex = prev.find(i => i._index === p._index)
    if (ex) return prev.map(i => i._index === p._index ? { ...i, qty: i.qty + 1 } : i)
    return [...prev, { ...p, qty: 1 }]
  })
  const removeFromCart = idx => setCart(prev => prev.filter(i => i._index !== idx))
  const changeQty = (idx, delta) => setCart(prev =>
    prev.map(i => i._index === idx ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i['Продажная цена'] || i['Цена'] || 0) * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  const submitReview = async () => {
    if (!reviewText.trim()) return
    setReviewSending(true)
    try {
      await api.submitReview(reviewText.trim(), reviewRating)
      setReviewSent(true)
      setTimeout(() => { setShowReviewForm(false); setReviewSent(false); setReviewText(''); setReviewRating(5) }, 2000)
    } catch (e) {
      alert('Не удалось отправить отзыв. Попробуйте ещё раз.')
    } finally {
      setReviewSending(false)
    }
  }

  const placeOrder = async () => {
    if (!form.name || !form.phone || !form.address) return alert('Заполните все поля')
    setPlacing(true)
    try {
      await api.createOrderBatch({
        name: form.name,
        phone: form.phone,
        address: form.address,
        items: cart.map(item => ({
          product_id: item._index?.toString() || '',
          product_name: item['Название (RU)'] || item['Название'] || item['col2'] || 'Товар',
          quantity: item.qty,
          price: parseFloat(item['Продажная цена'] || item['Цена'] || item['col6'] || 0) * item.qty,
          article: item['Артикул'] || item['col1'] || '',
        })),
      })
      setCart([]); localStorage.removeItem('sooq_cart'); setSuccess(true)
      api.getMyOrders().then(setOrders).catch(() => {})
      // Show success briefly, then show registration modal
      setTimeout(() => { setSuccess(false); setShowRegModal(true) }, 1500)
    } catch (e) {
      alert('Ошибка оформления заказа. Попробуйте ещё раз.')
    } finally {
      setPlacing(false)
    }
  }

  // ── Swipe handlers ──────────────────────────────────────────
  const goTo = t => setTab(Math.max(0, Math.min(TABS_COUNT - 1, t)))

  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    setDragging(true)
  }
  const onTouchMove = e => {
    if (touchStartX.current === null) return
    let d = e.touches[0].clientX - touchStartX.current
    // rubber-band at edges
    if ((tab === 0 && d > 0) || (tab === TABS_COUNT - 1 && d < 0)) d *= 0.15
    setDragX(d)
  }
  const onTouchEnd = e => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    setDragging(false)
    setDragX(0)
    if (Math.abs(diff) > 55) goTo(diff > 0 ? tab + 1 : tab - 1)
    touchStartX.current = null
  }

  const slideStyle = {
    display: 'flex',
    width: `${TABS_COUNT * 100}%`,
    height: '100%',
    transform: `translateX(calc(${-tab * 100 / TABS_COUNT}% + ${dragX}px))`,
    transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)',
    willChange: 'transform',
  }
  const paneStyle = { width: `${100 / TABS_COUNT}%`, flexShrink: 0, overflowY: 'auto', height: '100%' }

  const inp = 'w-full bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3.5 text-sm text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 border border-white/30 dark:border-white/10 mb-2.5'

  const NAV = [
    { Icon: ShoppingBag, label: 'Каталог', badge: 0 },
    { Icon: ShoppingCart, label: 'Корзина', badge: cartCount },
    { Icon: Package,      label: 'Заказы',  badge: 0 },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5] dark:bg-[#202329]">

      {/* HEADER */}
      <div className="gold px-4 pt-4 pb-3 shadow-[0_4px_24px_rgba(245,197,24,0.25)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={LOGO} alt="SOOQ"
              className="w-11 h-11 rounded-2xl object-cover shadow-md border-2 border-white/30"
              onError={e => { e.target.src = LOGO_FB }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#F5C518] shadow" />
          </div>
          <div className="flex-1">
            <p className="font-black text-[#111] text-[17px] leading-none tracking-tight">SOOQ.TJ</p>
            <p className="text-[10px] text-[#111]/60 uppercase tracking-[0.18em] font-bold mt-0.5">Premium Store</p>
          </div>
          <div className="flex items-center gap-2">
            {cartCount > 0 && tab !== 1 && (
              <button onClick={() => goTo(1)}
                className="relative w-9 h-9 rounded-2xl bg-black/10 flex items-center justify-center active:scale-90 transition-transform">
                <ShoppingCart size={18} color="#111" strokeWidth={2} />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 animate-pop">
                  {cartCount}
                </span>
              </button>
            )}
            <GlassToggle />
          </div>
        </div>
      </div>

      {/* SWIPEABLE CONTENT */}
      <div className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <div style={slideStyle}>

          {/* PANE 0 — КАТАЛОГ */}
          <div style={paneStyle} className="flex flex-col">
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2.5 bg-white dark:bg-[#2D2F37] rounded-2xl px-3.5 py-2.5
                shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]
                border border-black/[0.04] dark:border-white/[0.05]">
                <Search size={16} color={dark ? '#555' : '#AAA'} strokeWidth={2} />
                <input
                  placeholder="Поиск товаров..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-gray-400 active:scale-90 transition-transform">
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
            {/* Category chips */}
            {categories.length > 1 && (
              <div className="px-3 pb-2 flex-shrink-0">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
                  onTouchStart={e => e.stopPropagation()}
                  onTouchMove={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      className={`flex-shrink-0 text-[11px] font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-95 ${
                        category === cat
                          ? 'gold text-[#111] shadow-[0_2px_8px_rgba(245,197,24,0.3)]'
                          : 'bg-white dark:bg-[#2D2F37] text-gray-500 dark:text-gray-400 border border-black/[0.05] dark:border-white/[0.05] shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400 font-semibold">Загружаем каталог...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <ShoppingBag size={52} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-600">
                    {search ? 'Ничего не найдено' : 'Каталог пуст'}
                  </p>
                  {search && (
                    <button onClick={() => setSearch('')}
                      className="text-xs font-bold active:scale-95 transition-transform"
                      style={{ color: '#F5C518' }}>
                      Очистить поиск
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-4">
                  {filteredProducts.map((p, i) => (
                    <ProductCard key={i} product={p}
                      onAdd={() => addToCart(p)}
                      onView={setViewProduct} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PANE 1 — КОРЗИНА */}
          <div style={paneStyle}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-3">
                <ShoppingCart size={56} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                <p className="font-bold text-sm text-gray-400 dark:text-gray-600">Корзина пуста</p>
                <button onClick={() => goTo(0)}
                  className="text-sm font-bold active:scale-95 transition-transform"
                  style={{ color: '#F5C518' }}>
                  Перейти в каталог
                </button>
              </div>
            ) : (
              <div className="p-3 pb-6">
                <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3 px-1">
                  Товары в корзине
                </p>
                {cart.map((item, i) => {
                  const ph = item['Фото (URL)'] || item['Фото 1'] || item['Фото']
                  const nm = item['Название (RU)'] || item['Название'] || item['col2'] || 'Товар'
                  const pr = parseFloat(item['Продажная цена'] || item['Цена'] || item['col6'] || '0')
                  return (
                    <div key={i} className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-3 mb-2.5 flex items-center gap-3
                      shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)]
                      border border-black/[0.04] dark:border-white/[0.05]">
                      {ph
                        ? <img src={ph} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
                        : <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#1A1A1A,#2D2D2D)' }}>
                            <Package size={24} color="rgba(255,255,255,0.18)" strokeWidth={1.5} />
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[#0A0A0A] dark:text-white line-clamp-1">{nm}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-semibold">{(pr * item.qty).toFixed(0)} сом</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button onClick={() => changeQty(item._index, -1)}
                            className="w-6 h-6 rounded-lg bg-[#F5F5F5] dark:bg-white/8 flex items-center justify-center active:scale-90 transition-transform border border-black/[0.06] dark:border-white/[0.06]">
                            <Minus size={11} color={dark ? '#888' : '#555'} strokeWidth={2.5} />
                          </button>
                          <span className="text-sm font-black text-[#0A0A0A] dark:text-white min-w-[20px] text-center">{item.qty}</span>
                          <button onClick={() => changeQty(item._index, 1)}
                            className="w-6 h-6 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                            style={{ background: 'rgba(245,197,24,0.18)' }}>
                            <Plus size={11} color="#F5C518" strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item._index)}
                        className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform">
                        <Trash2 size={15} color="#EF4444" strokeWidth={2} />
                      </button>
                    </div>
                  )
                })}

                <div className="mt-4 rounded-[24px] overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #F5C518 0%, #FF9C00 100%)' }}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-black text-[#111] text-[17px]">Итого</p>
                      <p className="font-black text-[#111] text-xl">{cartTotal.toFixed(0)} сом</p>
                    </div>
                    <input placeholder="Ваше имя" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
                    <input placeholder="Номер телефона" value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} />
                    <input placeholder="Адрес доставки" value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3.5 text-sm text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 border border-white/30 dark:border-white/10" />
                    <div className="mt-4">
                      {success ? (
                        <div className="bg-green-500 text-white text-center rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2">
                          ✅ Заказ оформлен!
                        </div>
                      ) : (
                        <button onClick={placeOrder} disabled={placing}
                          className="w-full bg-[#111] text-white font-black text-sm rounded-2xl py-4
                            active:scale-[0.97] transition-all disabled:opacity-60
                            shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2">
                          {placing
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Оформляем...</>
                            : <><Package size={16} strokeWidth={2.5} /> Оформить заказ</>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PANE 2 — МОИ ЗАКАЗЫ */}
          <div style={paneStyle}>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-3">
                <Package size={56} color={dark ? '#2A2A2A' : '#DDD'} strokeWidth={1.5} />
                <p className="font-bold text-sm text-gray-400 dark:text-gray-600">Заказов пока нет</p>
                <p className="text-xs text-gray-300 dark:text-gray-700">Сделайте первый заказ</p>
              </div>
            ) : (
              <div className="p-3 pb-4">
                <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3 px-1">
                  История заказов
                </p>
                {orders.map((o, i) => <OrderCard key={i} order={o} />)}
                {/* Leave review button */}
                <button onClick={() => setShowReviewForm(true)}
                  className="mt-4 w-full bg-white dark:bg-[#2D2F37] rounded-[20px] p-4 flex items-center gap-3
                    shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)]
                    border border-yellow-400/20 active:scale-[0.98] transition-transform text-left">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <Star size={18} color="#fff" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-sm text-[#0A0A0A] dark:text-white">Оставить отзыв</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Поделитесь впечатлением о покупке</p>
                  </div>
                  <span className="text-[11px] font-black text-yellow-500">→</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Registration modal (fixed overlay, appears after first order) */}
      {showRegModal && (
        <RegistrationModal onClose={() => { setShowRegModal(false); goTo(2) }} />
      )}

      {/* Review form modal */}
      {showReviewForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowReviewForm(false)}>
          <div className="w-full bg-white dark:bg-[#202329] rounded-t-[28px] p-5 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <p className="font-black text-base text-[#0A0A0A] dark:text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-yellow-500" />
                Оставить отзыв
              </p>
              <button onClick={() => setShowReviewForm(false)}
                className="w-8 h-8 rounded-full bg-[#F5F5F5] dark:bg-white/10 flex items-center justify-center">
                <X size={15} color={dark ? '#fff' : '#333'} />
              </button>
            </div>
            {reviewSent ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
                <p className="font-black text-base text-[#0A0A0A] dark:text-white">Спасибо за отзыв!</p>
                <p className="text-sm text-gray-400 text-center">Ваше мнение очень важно для нас 🙏</p>
              </div>
            ) : (
              <>
                {/* Star rating */}
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Оценка</p>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setReviewRating(n)}
                      className="active:scale-90 transition-transform">
                      <Star size={32}
                        className={n <= reviewRating ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700'}
                        fill={n <= reviewRating ? '#fbbf24' : 'none'}
                        strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
                {/* Text area */}
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Ваш отзыв</p>
                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Расскажите о вашем опыте покупки..."
                  rows={4}
                  className="w-full bg-[#F5F5F5] dark:bg-white/5 rounded-2xl px-4 py-3 text-sm
                    text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-gray-600
                    border border-black/[0.06] dark:border-white/[0.08] resize-none mb-4
                    focus:outline-none focus:border-yellow-400/60" />
                <button onClick={submitReview} disabled={reviewSending || !reviewText.trim()}
                  className="w-full gold text-[#111] font-black text-sm rounded-2xl py-4
                    shadow-[0_4px_20px_rgba(245,197,24,0.3)] active:scale-[0.97] transition-all
                    disabled:opacity-50 flex items-center justify-center gap-2">
                  {reviewSending
                    ? <><div className="w-4 h-4 border-2 border-[#111]/30 border-t-[#111] rounded-full animate-spin" /> Отправляем...</>
                    : <><Star size={16} strokeWidth={2.5} fill="#111" /> Отправить отзыв</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div className="glass bg-white/90 dark:bg-[#202329]/90 border-t border-black/[0.06] dark:border-white/[0.06]
        shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
        <div className="flex">
          {NAV.map(({ Icon, label, badge }, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 relative transition-colors ${
                tab === i ? 'text-[#0A0A0A] dark:text-white' : 'text-gray-400 dark:text-gray-600'
              }`}>
              {tab === i && (
                <span className="absolute top-0 inset-x-5 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg,#F5C518,#FF9C00)' }} />
              )}
              <div className="relative mt-1">
                <Icon size={22} strokeWidth={tab === i ? 2.5 : 1.8} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-1 animate-pop">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ FULLSCREEN PRODUCT VIEW ══ */}
      {viewProduct && (() => {
        const p = viewProduct
        const photo    = getPhotoUrl(p)
        const name     = p['Название (RU)'] || p['Название'] || p['col2'] || 'Товар'
        const price    = p['Продажная цена'] || p['Цена'] || p['col6'] || '0'
        const cat      = p['Категория'] || p['col3'] || ''
        const stock    = parseInt(p['В наличии (шт)'] || p['В наличии'] || p['col9'] || '99')
        const sold     = stock === 0
        const article  = p['Артикул'] || p['col1'] || ''
        const discount = parseFloat(p['Скидка %'] || 0)
        const priceDisc= p['Цена со скидкой']
        const promo    = p['Акция']
        const isPromo  = promo && promo !== '❌' && String(promo).trim() !== ''
        return (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col"
            onClick={() => setViewProduct(null)}>
            {/* Close button */}
            <button onClick={() => setViewProduct(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/15 backdrop-blur-md
                flex items-center justify-center active:scale-90 transition-transform">
              <X size={20} color="#fff" strokeWidth={2.5} />
            </button>

            {/* Photo area — tap photo also closes */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden"
              onClick={() => setViewProduct(null)}>
              {photo
                ? <img src={photo} alt={name} decoding="async"
                    className="max-w-full max-h-full object-contain rounded-2xl"
                    onClick={e => e.stopPropagation()}
                    onError={e => {
                      const fb = getPhotoFallback(p)
                      if (fb && e.target.src !== fb) e.target.src = fb
                    }} />
                : <div className="w-72 h-72 flex items-center justify-center rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #2A2A2A, #3D3D3D)' }}>
                    <ShoppingCart size={80} color="rgba(255,255,255,0.2)" strokeWidth={1.2} />
                  </div>}
            </div>

            {/* Bottom info sheet — stop click propagation */}
            <div onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#2D2F37] rounded-t-[28px] p-5 pb-7 max-h-[70vh] overflow-y-auto
                shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                {cat && (
                  <span className="gold text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-[#111]">
                    {cat}
                  </span>
                )}
                {isPromo && (
                  <span className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                    🔥 АКЦИЯ
                  </span>
                )}
              </div>
              <p className="font-black text-[#0A0A0A] dark:text-white text-xl leading-tight mb-2">
                {name}
              </p>
              <div className="flex items-end justify-between mb-4">
                <div>
                  {discount > 0 && priceDisc ? (
                    <>
                      <p className="text-gray-400 text-sm font-bold line-through leading-none mb-1">
                        {price} сом
                      </p>
                      <p className="gold-text font-black text-3xl leading-none">
                        {priceDisc} <span className="text-base font-bold opacity-80">сом</span>
                      </p>
                    </>
                  ) : (
                    <p className="gold-text font-black text-3xl leading-none">
                      {price} <span className="text-base font-bold opacity-80">сом</span>
                    </p>
                  )}
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  sold
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                }`}>
                  {sold ? '❌ Нет в наличии' : `✓ В наличии: ${stock}`}
                </span>
              </div>

              {/* Характеристики */}
              <div className="bg-[#F5F5F5] dark:bg-white/5 rounded-2xl p-3.5 mb-4 space-y-2">
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                  Характеристики
                </p>
                {article && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">🔖 Артикул</span>
                    <span className="text-[12px] font-black text-[#0A0A0A] dark:text-white font-mono">{article}</span>
                  </div>
                )}
                {cat && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">📂 Категория</span>
                    <span className="text-[12px] font-bold text-[#0A0A0A] dark:text-white">{cat}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">📦 Наличие</span>
                  <span className={`text-[12px] font-black ${sold ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {sold ? 'Нет' : `${stock} шт`}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">💸 Скидка</span>
                    <span className="text-[12px] font-black text-red-500">−{discount}%</span>
                  </div>
                )}
                {isPromo && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">🎁 Акция</span>
                    <span className="text-[12px] font-bold text-[#0A0A0A] dark:text-white">{promo}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => { if (!sold) { addToCart(p); setViewProduct(null) } }}
                disabled={sold}
                className={`w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-transform ${
                  sold
                    ? 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'gold text-[#111] shadow-[0_4px_16px_rgba(245,197,24,0.35)]'
                }`}>
                <Plus size={18} strokeWidth={2.5} />
                {sold ? 'Нет в наличии' : 'Добавить в корзину'}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
