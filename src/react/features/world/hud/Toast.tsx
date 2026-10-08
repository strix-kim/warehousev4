import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../lib/i18n'

// Тост мира — короткий ответ на действие («Мероприятие создано»): один за раз, новый
// сменяет прежний. Тексты приходят готовыми (tr — у того, кто зовёт show).
export type WorldToast = {
  // Номер показа: новый тост с тем же текстом — снова появление и новый отсчёт
  id: number
  text: string
  link: { to: string; label: string } | null
}

// Сам гаснет через 4 с; пока под указателем или в фокусе — ждёт
const HIDE_MS = 4000

// Состояние тоста для хозяина сцены: toast — в <Toast>, show — тем, кто отвечает на действие
export function useWorldToast() {
  const [toast, setToast] = useState<WorldToast | null>(null)
  const count = useRef(0)
  const show = useCallback((text: string, opts?: { link?: { to: string; label: string } }) => {
    setToast({ id: ++count.current, text, link: opts?.link ?? null })
  }, [])
  const hide = useCallback(() => setToast(null), [])
  return { toast, show, hide }
}

// Плашка одного показа. Монтируется заново на каждый тост (key = id): пауза и отсчёт —
// её собственные и с прошлого показа не переезжают.
function ToastCard({ toast, onClose }: { toast: WorldToast; onClose: () => void }) {
  const { tr } = useLanguage()
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held) return
    const timer = window.setTimeout(onClose, HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [held, onClose])

  return (
    <div
      className="w-plaque w-toast__card"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="w-toast__text">{toast.text}</span>
      {toast.link && <Link className="w-toast__link" to={toast.link.to} onClick={onClose}>{toast.link.label}</Link>}
      <button type="button" className="w-toast__close" aria-label={tr('Закрыть', 'Yopish')} onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

// Место тоста в сцене (.w-stage) стоит всегда: живая область обязана быть в дереве до
// того, как в неё придёт текст. data-w-chrome — обвязка, вывески её обходят (контракт HUD
// в worldStore.ts); пустое место нулевого размера раскладка не считает.
export function Toast({ toast, onClose }: { toast: WorldToast | null; onClose: () => void }) {
  return (
    <div className="w-toast" role="status" aria-live="polite" data-w-chrome>
      {toast && <ToastCard key={toast.id} toast={toast} onClose={onClose} />}
    </div>
  )
}
