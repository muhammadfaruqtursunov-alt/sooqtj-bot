import { useEffect, useState } from 'react'
import { UserCheck } from 'lucide-react'

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  x:     5  + (i * 43 + i * i * 7) % 90,
  y:     8  + (i * 37 + i * 3)     % 75,
  r:     3  + (i % 4) * 2.5,
  color: ['#F5C518','#FF9C00','#FFE566','#FF6B35','#FFDB4D','#FFC300','#FFA500'][i % 7],
  delay: (i * 55) % 650,
  rotate: (i * 37) % 360,
}))

export default function RegistrationModal({ onClose }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 40)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setShow(false)
    setTimeout(onClose, 380)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{
        background: show ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        transition: 'background 0.3s ease',
      }}
      onClick={dismiss}
    >
      <div
        className="w-full relative overflow-hidden"
        style={{
          background: '#1A1A1A',
          borderRadius: '24px 24px 0 0',
          padding: '12px 24px 48px',
          transform: show ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.42s cubic-bezier(0.34,1.08,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti dots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {CONFETTI.map((c, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${c.x}%`,
              top: `${c.y}%`,
              width:  c.r * 2,
              height: c.r * 2,
              borderRadius: i % 3 === 0 ? '3px' : '50%',
              background: c.color,
              transform: show
                ? `scale(1) rotate(${c.rotate}deg) translateY(0)`
                : `scale(0) rotate(0deg) translateY(-24px)`,
              opacity: show ? 0.55 : 0,
              transition: `all 0.65s ease ${c.delay}ms`,
            }} />
          ))}
        </div>

        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-7" />

        {/* Icon */}
        <div className="flex justify-center mb-5" style={{
          opacity:    show ? 1 : 0,
          transform:  show ? 'scale(1)' : 'scale(0.35)',
          transition: 'all 0.52s cubic-bezier(0.34,1.56,0.64,1) 0.06s',
        }}>
          <div className="w-[80px] h-[80px] gold rounded-[26px] flex items-center justify-center
            shadow-[0_8px_36px_rgba(245,197,24,0.5)]">
            <UserCheck size={42} color="#111" strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <p className="text-white font-black text-[21px] text-center leading-tight mb-2.5" style={{
          opacity:    show ? 1 : 0,
          transform:  show ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.35s ease 0.17s',
        }}>
          Вы зарегистрированы! 🎉
        </p>

        {/* Subtitle */}
        <p className="text-gray-400 text-[14px] text-center leading-relaxed mb-5 px-2" style={{
          opacity:    show ? 1 : 0,
          transform:  show ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.35s ease 0.26s',
        }}>
          Теперь вы в нашей клиентской базе. Будем держать вас в курсе акций и обновлений.
        </p>

        {/* Yellow pill badge */}
        <div className="flex justify-center mb-7" style={{
          opacity:    show ? 1 : 0,
          transition: 'opacity 0.3s ease 0.35s',
        }}>
          <span className="gold text-[#111] text-[12px] font-black px-5 py-1.5 rounded-full
            shadow-[0_2px_14px_rgba(245,197,24,0.38)]">
            Профиль создан автоматически
          </span>
        </div>

        {/* Button */}
        <button onClick={dismiss}
          className="w-full gold text-[#111] font-black text-[16px] py-[15px] rounded-2xl
            active:scale-[0.97] transition-transform shadow-[0_4px_22px_rgba(245,197,24,0.38)]"
          style={{
            opacity:    show ? 1 : 0,
            transform:  show ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.3s ease 0.44s',
          }}>
          Отлично! 🙌
        </button>
      </div>
    </div>
  )
}
