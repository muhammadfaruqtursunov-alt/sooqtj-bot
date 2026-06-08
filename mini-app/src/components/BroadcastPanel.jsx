import { useState } from 'react'
import { Megaphone, Users, X, Send, CheckCircle2 } from 'lucide-react'

const MSG_TYPES = ['📣 Акция', '🆕 Обновление', '✍️ Свободный']
const PLACEHOLDER_PREVIEW = '🔥 Скидка 20% на все товары только сегодня!\n\nЗаходите в магазин и выбирайте!'

export default function BroadcastPanel({ onSend, onClose, clientCount = 0 }) {
  const [msgType,  setMsgType]  = useState(0)
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [done,     setDone]     = useState(null) // null | { sent, failed }

  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const result = await onSend?.(text)
      setDone(result || { sent: clientCount, failed: 0 })
    } catch (_) {
      setDone({ sent: 0, failed: clientCount })
    }
    setSending(false)
  }

  // ── SUCCESS STATE ─────────────────────────────────────────
  if (done) return (
    <div className="flex flex-col h-full bg-[#F5F5F5] dark:bg-[#202329]">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-white/80 dark:bg-[#2D2F37]/80 glass
        border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
        <button onClick={onClose}
          className="w-8 h-8 rounded-xl bg-[#F5F5F5] dark:bg-white/5 flex items-center justify-center">
          <X size={16} color="#888" strokeWidth={2} />
        </button>
        <p className="font-black text-sm text-[#0A0A0A] dark:text-white">Рассылка клиентам</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-20 h-20 bg-green-500 rounded-[28px] flex items-center justify-center
          animate-pop shadow-[0_8px_32px_rgba(34,197,94,0.4)]">
          <CheckCircle2 size={42} color="white" strokeWidth={2.5} />
        </div>
        <p className="font-black text-[#0A0A0A] dark:text-white text-[19px] text-center leading-tight">
          Рассылка отправлена
        </p>
        <p className="text-gray-400 text-sm text-center font-semibold">
          {done.sent} клиентам ✅{done.failed > 0 ? ` · ${done.failed} ошибок` : ''}
        </p>
        <button onClick={onClose}
          className="mt-4 px-8 py-3 rounded-2xl bg-white dark:bg-white/5 text-gray-500 dark:text-gray-400
            font-bold text-sm active:scale-95 transition-transform
            shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]
            border border-black/[0.05] dark:border-white/[0.05]">
          Закрыть
        </button>
      </div>
    </div>
  )

  // ── COMPOSE STATE ────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] dark:bg-[#202329]">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-white/80 dark:bg-[#2D2F37]/80 glass
        border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
        <button onClick={onClose}
          className="w-8 h-8 rounded-xl bg-[#F5F5F5] dark:bg-white/5 flex items-center justify-center active:scale-90 transition-transform">
          <X size={16} color="#888" strokeWidth={2} />
        </button>
        <div className="w-7 h-7 gold rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <Megaphone size={13} color="#111" strokeWidth={2.5} />
        </div>
        <p className="font-black text-sm text-[#0A0A0A] dark:text-white flex-1">Рассылка клиентам</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Audience info */}
        <div className="bg-white dark:bg-[#2D2F37] rounded-[20px] p-4
          shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]
          border border-black/[0.04] dark:border-white/[0.05] flex items-center gap-3">
          <div className="w-10 h-10 gold rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Users size={18} color="#111" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="font-black text-[#0A0A0A] dark:text-white text-sm">Все клиенты</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Получат сообщение в Telegram</p>
          </div>
          <p className="font-black text-2xl gold-text">{clientCount}</p>
        </div>

        {/* Message type tabs */}
        <div>
          <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2.5">
            Тип сообщения
          </p>
          <div className="flex bg-white dark:bg-[#2D2F37] rounded-2xl p-1 gap-1
            shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]
            border border-black/[0.04] dark:border-white/[0.05]">
            {MSG_TYPES.map((t, i) => (
              <button key={i} onClick={() => setMsgType(i)}
                className={`flex-1 text-[10px] font-bold py-2 rounded-xl transition-all active:scale-95 ${
                  msgType === i
                    ? 'gold text-[#111] shadow-sm'
                    : 'text-gray-400 dark:text-gray-500'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div>
          <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2.5">
            Сообщение
          </p>
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              placeholder="Напишите всё что хотите — скидки, новости, обновления..."
              rows={6}
              style={{ minHeight: 160 }}
              className="w-full bg-white dark:bg-[#2D2F37] text-[#0A0A0A] dark:text-white
                placeholder-gray-400 dark:placeholder-gray-600 rounded-2xl px-4 py-3.5 text-sm
                border-2 border-transparent focus:border-[#F5C518] transition-colors resize-none
                shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            />
            <span className={`absolute bottom-3 right-3 text-[11px] font-mono transition-colors ${
              text.length > 450 ? 'text-orange-400' : 'text-gray-400'
            }`}>
              {text.length}/500
            </span>
          </div>
        </div>

        {/* Telegram message preview */}
        <div>
          <p className="text-[11px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2.5">
            Предпросмотр
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#17212B' }}>
            {/* Chat header */}
            <div className="px-4 py-3 flex items-center gap-2.5 border-b border-white/[0.06]">
              <div className="w-8 h-8 gold rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <Megaphone size={14} color="#111" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white text-[13px] font-bold leading-none">SOOQ.TJ</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#6B7BFF' }}>бот</p>
              </div>
            </div>
            {/* Message bubble */}
            <div className="p-4">
              <div className="inline-block max-w-[88%] px-3.5 py-2.5 rounded-[4px_16px_16px_16px]"
                style={{ background: '#2A2A2A' }}>
                <p className="text-white text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                  {text || PLACEHOLDER_PREVIEW}
                </p>
                <p className="text-right mt-1.5 text-[10px]" style={{ color: '#6B7BFF' }}>
                  12:34 ✓✓
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer so content isn't hidden behind bottom bar */}
        <div className="h-2" />
      </div>

      {/* Pinned bottom bar */}
      <div className="flex-shrink-0 px-4 pt-3 pb-5 glass
        bg-white/90 dark:bg-[#202329]/90
        border-t border-black/[0.06] dark:border-white/[0.06]
        shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} color="#888" strokeWidth={2} />
          <p className="text-sm text-gray-400">
            Получателей:&nbsp;
            <span className="font-black text-[#0A0A0A] dark:text-white">{clientCount}</span>
          </p>
        </div>
        <button onClick={handleSend}
          disabled={sending || !text.trim()}
          className="w-full gold text-[#111] font-black text-sm py-4 rounded-2xl
            active:scale-[0.97] transition-all disabled:opacity-50
            shadow-[0_4px_20px_rgba(245,197,24,0.32)] flex items-center justify-center gap-2">
          {sending
            ? <div className="w-4 h-4 border-2 border-[#111]/30 border-t-[#111] rounded-full animate-spin" />
            : <Send size={16} strokeWidth={2.5} />
          }
          Отправить рассылку
        </button>
      </div>
    </div>
  )
}
