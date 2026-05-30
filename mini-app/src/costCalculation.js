// Cost calculation: base cost + cargo ($200/m³) + 20 TJS delivery per item.
// Volume per unit (m³) extracted from the source xlsx.
// Article code (ORM-XXX) lives in the "Категория" column in current sheet
// because the user's data entry swapped Артикул and Категория.

export const CARGO_USD_PER_CBM   = 200
export const USD_TO_TJS          = 10.5
export const DELIVERY_PER_ITEM   = 20    // TJS

// volume per unit in m³ (J/F from xlsx: m³ per carton / pcs per carton)
export const VOLUME_MAP = {
  'ORM-513':   0.0510,
  'ORM-8028':  0.01275,
  'ORM-8823':  0.0360,
  'ORM-8860':  0.0445,
  'ORM-8821':  0.02875,
  'ORM-3579':  0.03167,
  'ORM-3595':  0.0200,
  'ORM-925':   0.0034,
  'ORM-8031':  0.01017,   // covers both 白色 (white) and 黑色 (black)
  'ORM-8011':  0.0105,    // covers both white/black
  'ORM-3311':  0.0340,
  'ORM-3313':  0.0340,
  'ORM-213':   0.0464,
  'ORM-211':   0.0380,
  'ORM-6807':  0.04235,
  'ORM-3536':  0.0098,
  'ORM-8060':  0.00792,
}

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

/** Returns {base, cargo, delivery, total} all in TJS per unit. */
export function computeCost(p) {
  const base     = getBaseCost(p)
  const volume   = getVolume(p)
  const cargo    = volume * CARGO_USD_PER_CBM * USD_TO_TJS
  const delivery = DELIVERY_PER_ITEM
  return { base, cargo, delivery, total: base + cargo + delivery }
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
