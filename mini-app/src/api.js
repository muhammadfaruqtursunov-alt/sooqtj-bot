import { dapi, derr } from './debug'

const BASE = import.meta.env.VITE_API_URL || ''
let _initData = ''
let _userId = ''

export function setInitData(v) { _initData = v }
export function setUserId(v) { _userId = String(v) }

async function req(path, opts = {}) {
  const method = opts.method || 'GET'
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'x-init-data': _initData,
        'x-user-id': _userId,
        ...opts.headers,
      },
    })
    const ms = Date.now() - t0
    if (!res.ok) {
      const body = await res.text()
      derr('API', `${res.status} ${method} ${path} (${ms}ms) → ${body.slice(0, 200)}`)
      throw new Error(body)
    }
    dapi('API', `${res.status} ${method} ${path} (${ms}ms)`)
    return res.json()
  } catch (e) {
    if (!String(e.message).match(/^\{|^\[|<!DOCTYPE/)) {
      derr('API', `FAIL ${method} ${path} (${Date.now() - t0}ms) → ${e.message}`)
    }
    throw e
  }
}

export const api = {
  getMe:           ()           => req('/api/me'),
  getProducts:     ()           => req('/api/products'),
  addProduct:      (d)          => req('/api/products', { method: 'POST', body: JSON.stringify(d) }),
  updateProduct:   (id, d)      => req(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  uploadPhoto:     (file)       => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE}/api/upload-photo`, {
      method: 'POST',
      headers: { 'x-init-data': _initData, 'x-user-id': _userId },
      body: form,
    }).then(r => r.json())
  },
  uploadLogo:      (file)       => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE}/api/upload-logo`, {
      method: 'POST',
      headers: { 'x-init-data': _initData, 'x-user-id': _userId },
      body: form,
    }).then(r => r.json())
  },
  deleteProduct:   (id)         => req(`/api/products/${id}`, { method: 'DELETE' }),
  setProductPhoto: (rowIndex, file) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE}/api/products/${rowIndex}/photo`, {
      method: 'POST',
      headers: { 'x-init-data': _initData, 'x-user-id': _userId },
      body: form,
    }).then(r => r.json())
  },
  createOrder:     (d)          => req('/api/orders', { method: 'POST', body: JSON.stringify(d) }),
  createOrderBatch:(d)          => req('/api/orders/batch', { method: 'POST', body: JSON.stringify(d) }),
  createManualOrder:(d)         => req('/api/orders/manual', { method: 'POST', body: JSON.stringify(d) }),
  getMyOrders:     ()           => req('/api/orders/my'),
  getAllOrders:     ()           => req('/api/orders'),
  getDeliveries:   ()           => req('/api/deliveries'),
  updateOrder:     (id, status) => req(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  editOrder:       (id, fields) => req(`/api/orders/${id}/edit`, { method: 'PATCH', body: JSON.stringify(fields) }),
  deleteOrder:     (id)         => req(`/api/orders/${id}`, { method: 'DELETE' }),
  getStats:        ()           => req('/api/stats'),
  getClients:      ()           => req('/api/clients'),
  broadcast:       (text)       => req('/api/broadcast', { method: 'POST', body: JSON.stringify({ text }) }),
  submitReview:    (text, rating) => req('/api/reviews', { method: 'POST', body: JSON.stringify({ text, rating }) }),
  getReviews:      ()           => req('/api/reviews'),
  getExpenses:     ()           => req('/api/expenses'),
  addExpense:      (name, amount) => req('/api/expenses', { method: 'POST', body: JSON.stringify({ name, amount }) }),
  deleteExpense:   (id)         => req(`/api/expenses/${id}`, { method: 'DELETE' }),
  recalcPrices:    ()           => req('/api/_admin/recalc-prices', { method: 'POST' }),
  resetStats:             ()    => req('/api/_admin/reset-stats',             { method: 'POST' }),
  resetExceptDelivered:   ()    => req('/api/_admin/reset-except-delivered',  { method: 'POST' }),
  applyManualPrices:  ()        => req('/api/_admin/apply-manual-prices', { method: 'POST' }),
}
