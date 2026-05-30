/**
 * Water-drop shaped dark-mode icon.
 *  Light mode  → dark drop  + white sun  inside
 *  Dark  mode  → dark drop  + grey moon crescent inside
 */
export default function ThemeIcon({ dark, size = 28 }) {
  /* drop fill: near-black in light, dark-charcoal in dark */
  const drop = dark ? '#1E1E1E' : '#1A1A1A'

  /* 6 sun-ray endpoints (60° apart) */
  const rays = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * i) / 3
    return {
      x1: 12 + Math.cos(a) * 4.0,
      y1: 17 + Math.sin(a) * 4.0,
      x2: 12 + Math.cos(a) * 5.5,
      y2: 17 + Math.sin(a) * 5.5,
    }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Water drop shape ── */}
      <path
        d="M12 2
           C12 2 4 10 4 16
           C4 20.4 7.6 24 12 24
           C16.4 24 20 20.4 20 16
           C20 10 12 2 12 2Z"
        fill={drop}
      />

      {dark ? (
        /* ── Crescent moon (grey) ── */
        <>
          {/* full circle */}
          <circle cx="12" cy="17" r="4.2" fill="#9CA3AF" />
          {/* overlay circle to carve out crescent */}
          <circle cx="14.2" cy="15.8" r="3.4" fill={drop} />
        </>
      ) : (
        /* ── Sun (white) ── */
        <>
          {/* core */}
          <circle cx="12" cy="17" r="2.8" fill="white" />
          {/* rays */}
          {rays.map((r, i) => (
            <line
              key={i}
              x1={r.x1} y1={r.y1}
              x2={r.x2} y2={r.y2}
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          ))}
        </>
      )}
    </svg>
  )
}
