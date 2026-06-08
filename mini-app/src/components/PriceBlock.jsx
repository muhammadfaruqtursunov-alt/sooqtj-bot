// Big white sale price, small yellow cost, small green profit.
// Used in admin and partner product/order rows.

import { computeCost, computeProfit, getSalePrice, fmt } from '../costCalculation'

export default function PriceBlock({ product, qty = 1, align = 'right' }) {
  const sale   = getSalePrice(product) * qty
  const cost   = computeCost(product).total * qty
  const profit = computeProfit(product) * qty
  const alignCls = align === 'right' ? 'text-right items-end' : 'text-left items-start'
  return (
    <div className={`flex flex-col ${alignCls} leading-none`}>
      <p className="font-black text-[#0A0A0A] dark:text-white text-base">
        {fmt(sale)} <span className="text-[10px] font-bold opacity-70">сом</span>
      </p>
      <p className="text-[10px] font-bold text-yellow-500 mt-0.5">
        с/с: {fmt(cost)}
      </p>
      <p className={`text-[11px] font-black mt-0.5 ${profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
        {profit > 0 ? '+' : ''}{fmt(profit)}
      </p>
    </div>
  )
}
