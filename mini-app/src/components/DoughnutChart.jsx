// Simple SVG doughnut for two-slice income vs expense visualization.
// Props: income (green slice), expense (red slice).

export default function DoughnutChart({ income = 0, expense = 0, size = 180 }) {
  const total = income + expense
  const incomePct = total > 0 ? income / total : 0.5
  const expensePct = total > 0 ? expense / total : 0.5
  const r = size / 2
  const stroke = size * 0.18
  const innerR = r - stroke / 2
  const c = 2 * Math.PI * innerR

  const incomeDash = incomePct * c
  const expenseDash = expensePct * c

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={r} cy={r} r={innerR}
          fill="none" stroke="#1F2937" strokeOpacity="0.15"
          strokeWidth={stroke} />
        {/* expense slice (red) */}
        {expense > 0 && (
          <circle
            cx={r} cy={r} r={innerR}
            fill="none" stroke="#EF4444"
            strokeWidth={stroke}
            strokeDasharray={`${expenseDash} ${c}`}
            strokeLinecap="butt" />
        )}
        {/* income slice (green) — starts after expense */}
        {income > 0 && (
          <circle
            cx={r} cy={r} r={innerR}
            fill="none" stroke="#22C55E"
            strokeWidth={stroke}
            strokeDasharray={`${incomeDash} ${c}`}
            strokeDashoffset={-expenseDash}
            strokeLinecap="butt" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[9px] uppercase font-black tracking-widest text-gray-400 dark:text-gray-500">Итого</p>
        <p className="font-black text-lg leading-none mt-0.5 text-[#0A0A0A] dark:text-white">
          {Math.round(total)}
        </p>
        <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-0.5">сом</p>
      </div>
    </div>
  )
}
