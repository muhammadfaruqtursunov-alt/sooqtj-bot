import { Plus, ShoppingCart } from 'lucide-react'
import { getPhotoUrl, getPhotoFallback } from '../costCalculation'

export default function ProductCard({ product: p, onAdd, onView }) {
  const photo = getPhotoUrl(p)
  const fallback = getPhotoFallback(p)
  const name  = p['Название (RU)'] || p['Название'] || p['col2'] || 'Товар'
  const price = p['Продажная цена'] || p['Цена'] || p['col6'] || '0'
  const cat   = p['Категория'] || p['col3'] || ''
  const stock = parseInt(p['В наличии (шт)'] || p['В наличии'] || p['col9'] || '99')
  const sold  = stock === 0

  return (
    <div className="rounded-[20px] overflow-hidden bg-white dark:bg-[#2D2F37]
      shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.4)]
      border border-black/[0.04] dark:border-white/[0.05]
      transition-transform active:scale-[0.97] animate-fadeIn">

      {/* Image area (clickable — opens fullscreen view) */}
      <div className="relative overflow-hidden cursor-pointer"
        style={{ paddingBottom: '100%' }}
        onClick={() => onView?.(p)}>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)' }}>
          {photo
            ? <img src={photo} alt={name} loading="lazy" decoding="async"
                className="w-full h-full object-cover"
                onError={e => {
                  if (fallback && e.target.src !== fallback) { e.target.src = fallback }
                  else { e.target.style.display = 'none' }
                }} />
            : <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart size={40} color="rgba(255,255,255,0.12)" strokeWidth={1.5} />
              </div>
          }
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Category chip */}
          {cat && (
            <div className="absolute top-2.5 left-2.5">
              <span className="gold text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-[#111]">
                {cat}
              </span>
            </div>
          )}

          {/* Out-of-stock overlay */}
          {sold && (
            <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
              <span className="text-white text-[11px] font-black tracking-widest uppercase opacity-90">
                Нет в наличии
              </span>
            </div>
          )}

          {/* Price at bottom */}
          <div className="absolute bottom-2.5 left-3 right-3">
            <p className="text-white font-black text-[15px] leading-none">
              {price} <span className="text-[10px] font-semibold opacity-75">сом</span>
            </p>
          </div>
        </div>
      </div>

      {/* Name + Add button */}
      <div className="p-2.5 flex items-center gap-2">
        <p className="flex-1 text-[12px] font-bold text-[#0A0A0A] dark:text-white line-clamp-2 leading-tight cursor-pointer"
          onClick={() => onView?.(p)}>
          {name}
        </p>
        <button
          onClick={!sold ? onAdd : undefined}
          disabled={sold}
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
            sold
              ? 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'gold text-[#111] shadow-[0_2px_8px_rgba(245,197,24,0.35)]'
          }`}>
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
