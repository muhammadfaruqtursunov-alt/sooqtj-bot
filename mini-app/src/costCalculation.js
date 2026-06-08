// Cost calculation: base cost + cargo ($200/m³) + 20 TJS delivery per item.
// Volume per unit (m³) extracted from the source xlsx.
// Article code (ORM-XXX) lives in the "Категория" column in current sheet
// because the user's data entry swapped Артикул and Категория.

export const CARGO_USD_PER_CBM   = 200
export const USD_TO_TJS          = 10.5
export const YUAN_TO_TJS         = 1.37
export const DELIVERY_PER_ITEM   = 20    // TJS

// volume per unit in m³ (J/F from xlsx) + yuan price (H) + name + initial stock (G = E×F)
export const PRICING_MAP = {
  'ORM-513':       { vol_m3: 0.0510,  yuan: 285, initial_stock: 14, name_ru: 'Моющий пылесос' },
  'ORM-8028':      { vol_m3: 0.01275, yuan: 60,  initial_stock: 12, name_ru: 'Электрочайник' },
  'ORM-8823':      { vol_m3: 0.0360,  yuan: 135, initial_stock: 4,  name_ru: 'Аэрофритюрница' },
  'ORM-8860':      { vol_m3: 0.0445,  yuan: 148, initial_stock: 4,  name_ru: 'Фритюрница' },
  'ORM-8821':      { vol_m3: 0.02875, yuan: 108, initial_stock: 8,  name_ru: 'Фритюрница' },
  'ORM-3579':      { vol_m3: 0.03167, yuan: 155, initial_stock: 6,  name_ru: 'Мясорубка' },
  'ORM-3595':      { vol_m3: 0.0200,  yuan: 110, initial_stock: 6,  name_ru: 'Мясорубка' },
  'ORM-925':       { vol_m3: 0.0034,  yuan: 43,  initial_stock: 20, name_ru: 'Миксер' },
  'ORM-8031':      { vol_m3: 0.01017, yuan: 49,  initial_stock: 12, name_ru: 'Электрочайник' },
  'ORM-8011':      { vol_m3: 0.0105,  yuan: 55,  initial_stock: 12, name_ru: 'Электрочайник' },
  'ORM-3311':      { vol_m3: 0.0340,  yuan: 195, initial_stock: 4,  name_ru: 'Термос' },
  'ORM-3313':      { vol_m3: 0.0340,  yuan: 108, initial_stock: 4,  name_ru: 'Термос' },
  'ORM-213':       { vol_m3: 0.0464,  yuan: 298, initial_stock: 6,  name_ru: 'Тестомес' },
  'ORM-211':       { vol_m3: 0.0380,  yuan: 235, initial_stock: 4,  name_ru: 'Тестомес' },
  'ORM-6807':      { vol_m3: 0.04235, yuan: 450, initial_stock: 6,  name_ru: 'Кофемашина' },
  'ORM-3536':      { vol_m3: 0.0098,  yuan: 88,  initial_stock: 10, name_ru: 'Утюг' },
  'ORM-8060':      { vol_m3: 0.00792, yuan: 48,  initial_stock: 12, name_ru: 'Электрочайник' },
}

/** Returns the initial stock (как было первоначально загружено) for a product. */
export function getInitialStock(p) {
  const code = getArticle(p)
  if (!code) return null
  if (PRICING_MAP[code]?.initial_stock != null) return PRICING_MAP[code].initial_stock
  // fuzzy match for color variants
  for (const key of Object.keys(PRICING_MAP)) {
    if (code.startsWith(key) && PRICING_MAP[key].initial_stock != null) return PRICING_MAP[key].initial_stock
  }
  return null
}

// Back-compat: VOLUME_MAP kept as a thin projection so existing code still works
export const VOLUME_MAP = Object.fromEntries(
  Object.entries(PRICING_MAP).map(([k, v]) => [k, v.vol_m3])
)

/** Extract ORM-XXX from any field that contains it. Handles the swapped schema. */
export function getArticle(p) {
  if (!p) return ''
  const candidates = [
    p['Категория'], p['Артикул'], p.article, p['col1'], p['col3'],
  ]
  for (const c of candidates) {
    const s = String(c ?? '').trim()
    const m = s.match(/ORM-\d+/i)
    if (m) return m[0].toUpperCase()
  }
  return ''
}

// Base path for static assets (GitHub Pages serves under /sooqtj-bot/ in prod).
const ASSET_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

/**
 * Resolve the best photo URL for a product.
 * For ANY product with an ORM article, prefer the GitHub Pages CDN copy
 * (`/products/ORM-XXX.webp`) — fast, edge-cached, works on slow internet.
 * Newly uploaded photos land there automatically (backend commits on upload).
 * If the CDN copy isn't there yet (Pages still rebuilding), the <img onError>
 * handler swaps to getPhotoFallback() (the Postgres copy from the sheet URL).
 */
export function getPhotoUrl(p) {
  if (!p) return ''
  const code = getArticle(p)
  if (code) {
    return `${ASSET_BASE}/products/${code}.webp`
  }
  return getPhotoFallback(p)
}

/** Raw sheet-stored URL (Postgres /api/image or external) — used as onError fallback. */
export function getPhotoFallback(p) {
  if (!p) return ''
  return p['Фото (URL)'] || p['Фото 1'] || p['Фото'] || ''
}

/** Category name (NOT the ORM code, even though it lives in "Категория"). */
export function getCategoryName(p) {
  if (!p) return ''
  const candidates = [p['Категория'], p['Артикул'], p['col3']]
  for (const c of candidates) {
    const s = String(c ?? '').trim()
    if (s && !/^ORM-/i.test(s)) return s
  }
  return ''
}

export function getBaseCost(p) {
  return parseFloat(
    p?.['Себестоимость сомони'] ||
    p?.['Себестоимость'] ||
    p?.cost ||
    0
  ) || 0
}

export function getSalePrice(p) {
  return parseFloat(
    p?.['Цена со скидкой'] ||
    p?.['Продажная цена'] ||
    p?.['Цена'] ||
    p?.price ||
    p?.['col6'] ||
    0
  ) || 0
}

export function getVolume(p) {
  const article = getArticle(p).toUpperCase()
  // exact match first
  if (VOLUME_MAP[article] != null) return VOLUME_MAP[article]
  // fuzzy: strip suffixes like white/black variants
  const stripped = article.replace(/[^A-Z0-9-]/g, '')
  for (const key of Object.keys(VOLUME_MAP)) {
    if (stripped.startsWith(key)) return VOLUME_MAP[key]
  }
  // explicit volume column in the sheet (future-proof)
  const v = parseFloat(p?.['Объём (м³)'] || p?.['Объём'] || 0)
  return v > 0 ? v : 0
}

/** Cost (себестоимость) per unit — single source of truth: the
 * "Себестоимость сомони" column, entered manually by the admin.
 * No cargo/delivery re-computation (that caused double-counting). */
export function computeCost(p) {
  const total = getBaseCost(p)   // reads "Себестоимость сомони"
  return { base: total, cargo: 0, delivery: 0, total }
}

/** Profit per unit. */
export function computeProfit(p) {
  return Math.max(0, getSalePrice(p) - computeCost(p).total)
}

/** Format a money number compactly (rounds to 0 or 1 decimals). */
export function fmt(n) {
  const v = Number(n) || 0
  return v >= 100 ? Math.round(v).toString() : v.toFixed(1)
}
