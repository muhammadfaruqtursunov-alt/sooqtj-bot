import { Navigation, PackageCheck, Clock3, XCircle, RotateCcw, CheckCircle2 } from 'lucide-react'

const MAP = {
  'Новый':       { cls: 'bg-blue-50   dark:bg-blue-900/20   text-blue-600  dark:text-blue-400',   Icon: Clock3       },
  'Подтверждён': { cls: 'bg-amber-50  dark:bg-amber-900/20  text-amber-600 dark:text-amber-400',  Icon: CheckCircle2 },
  'В пути':      { cls: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',Icon: Navigation   },
  'Доставлен':   { cls: 'bg-green-50  dark:bg-green-900/20  text-green-600 dark:text-green-400',  Icon: PackageCheck },
  'Отменён':     { cls: 'bg-red-50    dark:bg-red-900/20    text-red-500   dark:text-red-400',    Icon: XCircle      },
  'Возврат':     { cls: 'bg-gray-100  dark:bg-white/5       text-gray-500  dark:text-gray-400',   Icon: RotateCcw    },
}

export default function StatusBadge({ status }) {
  const s = MAP[status] || { cls: 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500', Icon: Clock3 }
  const { Icon } = s
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
      <Icon size={11} strokeWidth={2.5} />
      {status || '—'}
    </span>
  )
}
