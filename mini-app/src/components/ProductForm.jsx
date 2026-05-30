import { useState } from 'react'
import { X, Check } from 'lucide-react'
import PhotoUpload from './PhotoUpload'

export default function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:      initial?.['Название (RU)'] || initial?.['col2'] || '',
    category:  initial?.['Категория']      || initial?.['col3'] || '',
    photo_url: initial?.['Фото (URL)'] || initial?.['Фото 1'] || initial?.['Фото'] || '',
    price:     initial?.['Продажная цена'] || initial?.['col6'] || '',
    qty:       initial?.['В наличии (шт)'] || initial?.['col9'] || '',
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = () => {
    if (!form.name || !form.price) return alert('Заполните название и цену')
    onSave({ ...form, price: parseFloat(form.price), qty: parseInt(form.qty) || 0 })
  }

  const inp = "w-full bg-[#F5F5F5] dark:bg-[#363840] text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 rounded-2xl px-4 py-3 text-sm border border-transparent focus:border-[#F5C518] transition-colors"

  return (
    <div className="bg-white dark:bg-[#2D2F37] rounded-[24px] p-5 mb-4
      shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]
      border border-[#F5C518]/20 animate-fadeIn">

      <p className="font-black text-[#0A0A0A] dark:text-white text-base mb-4">
        {initial ? '✏️ Редактировать товар' : '✨ Новый товар'}
      </p>

      <PhotoUpload value={form.photo_url} onChange={v => setForm(f => ({ ...f, photo_url: v }))} />

      <div className="space-y-2.5 mt-3">
        <input placeholder="Название товара *" value={form.name} onChange={set('name')} className={inp} />
        <input placeholder="Категория" value={form.category} onChange={set('category')} className={inp} />
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 px-1 uppercase tracking-wider">Цена (сом) *</label>
            <input
              inputMode="decimal"
              placeholder="0"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') }))}
              className={`${inp} text-base font-bold`} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 px-1 uppercase tracking-wider">Кол-во</label>
            <input
              inputMode="numeric"
              placeholder="0"
              value={form.qty}
              onChange={e => setForm(f => ({ ...f, qty: e.target.value.replace(/[^\d]/g, '') }))}
              className={`${inp} text-base font-bold`} />
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 mt-4">
        <button onClick={onCancel}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5
            bg-[#F5F5F5] dark:bg-white/5 text-gray-500 dark:text-gray-400
            active:scale-95 transition-transform">
          <X size={15} strokeWidth={2.5} /> Отмена
        </button>
        <button onClick={submit}
          className="flex-1 py-3 rounded-2xl text-sm font-black gold text-[#111]
            shadow-[0_4px_16px_rgba(245,197,24,0.3)] active:scale-95 transition-transform
            flex items-center justify-center gap-1.5">
          <Check size={15} strokeWidth={2.5} /> Сохранить
        </button>
      </div>
    </div>
  )
}
