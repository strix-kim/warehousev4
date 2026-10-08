import { Check, Copy, Share2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCafeText, buildFullText, summarizeMeal, type MealTextContext } from './mealSummary'
import type { MealOrder } from './types'
import { DrawerFrame } from '../../components/DrawerFrame'
import { copyText } from '../../lib/clipboard'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'

type SummaryMode = 'cafe' | 'full'

// Web Share API есть не везде (десктопный Firefox, http-адрес в локальной сети —
// только защищённый контекст). Нет — кнопку не рисуем вовсе: остаётся
// «Скопировать». Проверка один раз: поддержка за жизнь вкладки не меняется.
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

// Сводка приёма текстом (план meals-s56, шаг 4): «Для кафе» — блюда и порции,
// «Полная» — плюс «кто что». Ничего не сохраняет, поэтому защиты несохранённого
// нет: закрытие — сразу onRequestClose.
export function MealSummarySheet({ orders, ctx, onRequestClose }: {
  orders: MealOrder[]
  ctx: MealTextContext
  onRequestClose: () => void
}) {
  const { tr } = useLanguage()
  useModalLayer(onRequestClose)
  const [mode, setMode] = useState<SummaryMode>('cafe')
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [isSharing, setIsSharing] = useState(false)
  // Таймер подтверждения сбрасываем при размонтировании и перед новым нажатием —
  // как у CopyPlanButton в halls/HallPlanPage.tsx.
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const summary = useMemo(() => summarizeMeal(orders, tr), [orders, tr])
  const text = useMemo(
    () => mode === 'cafe' ? buildCafeText(summary, ctx, tr) : buildFullText(orders, summary, ctx, tr),
    [mode, summary, orders, ctx, tr],
  )

  async function copy() {
    const ok = await copyText(text)
    window.clearTimeout(timer.current)
    setCopyState(ok ? 'done' : 'failed')
    timer.current = window.setTimeout(() => setCopyState('idle'), 2000)
  }

  // share() требует живого жеста — зовём прямо из обработчика клика, без await
  // до вызова. Повторный вызов, пока лист открыт, отклоняется InvalidStateError —
  // поэтому кнопка заперта на время шеринга.
  async function share() {
    if (isSharing) return
    setIsSharing(true)
    try {
      await navigator.share({ text })
    } catch (error) {
      // AbortError — человек закрыл системный лист (или целей нет): не ошибка.
      // Остальное (NotAllowedError политики, DataError цели) — в канал и в
      // буфер: текст должен уехать хоть так.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        reportAppError(error, { scope: 'react', detail: { source: 'meal-summary-share' } })
        await copy()
      }
    } finally {
      setIsSharing(false)
    }
  }

  const title = tr('Сводка заказа', 'Buyurtma xulosasi')
  const modes: { value: SummaryMode; label: string }[] = [
    { value: 'cafe', label: tr('Для кафе', 'Kafe uchun') },
    { value: 'full', label: tr('Полная', 'To‘liq') },
  ]

  return (
    <DrawerFrame
      className="meal-summary"
      ariaLabel={title}
      instant={false}
      onRequestClose={onRequestClose}
      head={<>
        <div className="drawer__titles">
          <p className="eyebrow">{tr('Обеды', 'Ovqatlanish')}</p>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={onRequestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </>}
      foot={<>
        <button type="button" className="button button--secondary" onClick={() => { void copy() }}>
          {copyState === 'done' ? <Check size={16} /> : <Copy size={16} />}
          {copyState === 'done' && tr('Скопировано', 'Nusxalandi')}
          {copyState === 'failed' && tr('Не вышло', 'Bo‘lmadi')}
          {copyState === 'idle' && tr('Скопировать', 'Nusxalash')}
        </button>
        {canShare && (
          <button type="button" className="button button--primary" disabled={isSharing} onClick={() => { void share() }}>
            <Share2 size={16} /> {tr('Поделиться', 'Ulashish')}
          </button>
        )}
      </>}
    >
      <div className="segmented" role="group" aria-label={tr('Вид сводки', 'Xulosa turi')}>
        {modes.map((item) => (
          <button key={item.value} type="button" aria-pressed={mode === item.value} onClick={() => setMode(item.value)}>
            {mode === item.value && <span className="segmented__thumb" />}
            {item.label}
          </button>
        ))}
      </div>
      <pre className="meal-summary__text">{text}</pre>
    </DrawerFrame>
  )
}
