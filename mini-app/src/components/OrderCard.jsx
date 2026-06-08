import { Package } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function OrderCard({ order: o }) {
  return (
    <div className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-4 mb-3
      shadow-[0_2px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]
      border border-black/[0.04] dark:border-white/[0.05] animate-fadeIn">

      {/* top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gold rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Package size={15} color="#111" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">Заказ</p>
            <p className="font-black text-sm text-[#0A0A0A] dark:text-white leading-tight">#{o.id}</p>
          </div>
        </div>
        <StatusBadge status={o.status} />
      </div>

      {/* divider */}
      <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mb-3" />

      {/* details */}
      <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-gray-200 mb-1 truncate">
        {o.product_name}
      </p>
      {o.article && (
        <p className="text-[10px] font-mono font-black text-yellow-600 dark:text-yellow-500 mb-1">
          🔖 {o.article}
        </p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{o.timestamp}</p>
        <p className="font-black text-[13px] gold-text">{o.price} сом</p>
      </div>
    </div>
  )
}
