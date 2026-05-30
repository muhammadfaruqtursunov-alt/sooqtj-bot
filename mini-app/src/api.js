const BASE = import.meta.env.VITE_API_URL || ''
let _initData = ''
let _userId = ''

export function setInitData(v) { _initData = v }
export function setUserId(v) { _userId = String(v) }

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': _initData,
      'x-user-id': _userId,
      ...opts.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
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
  getStats:        ()           => req('/api/stats'),
  getClients:      ()           => req('/api/clients'),
  broadcast:       (text)       => req('/api/broadcast', { method: 'POST', body: JSON.stringify({ text }) }),
  submitReview:    (text, rating) => req('/api/reviews', { method: 'POST', body: JSON.stringify({ text, rating }) }),
  getReviews:      ()           => req('/api/reviews'),
  getExpenses:     ()           => req('/api/expenses'),
  addExpense:      (name, amount) => req('/api/expenses', { method: 'POST', body: JSON.stringify({ name, amount }) }),
  deleteExpense:   (id)         => req(`/api/expenses/${id}`, { method: 'DELETE' }),
}
