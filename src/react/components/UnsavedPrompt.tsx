import { m } from 'motion/react'
import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { PHONE_MEDIA_QUERY } from '../lib/breakpoints'
import { useModalLayer } from '../lib/useModalLayer'
import { BottomSheet } from './BottomSheet'
import './unsaved-prompt.css'

type UnsavedPromptProps = {
  message: string
  stayLabel: string
  leaveLabel: string
  onStay: () => void
  onLeave: () => void
}

function subscribePhone(onChange: () => void) {
  const media = window.matchMedia(PHONE_MEDIA_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function isPhoneNow() {
  return window.matchMedia(PHONE_MEDIA_QUERY).matches
}

// Вопрос «уйти без сохранения?» — встроенной плашкой, а не window.confirm:
// у системного диалога кнопки браузерные, не на языке интерфейса, и на телефоне
// он читается как сбой, а не как вопрос приложения. Обе кнопки type="button": плашка
// стоит внутри <form>, и кнопка без типа отправила бы форму.
// Плашка тёмная, а не красная (макет с31, .guard): это вопрос, а не ошибка.
// На телефоне тот же вопрос — нижним листом со скримом.
export function UnsavedPrompt(props: UnsavedPromptProps) {
  const isPhone = useSyncExternalStore(subscribePhone, isPhoneNow)
  const onStayRef = useRef(props.onStay)

  useEffect(() => {
    onStayRef.current = props.onStay
  })

  // Esc = «Остаться». Перехват и stopPropagation — как у usePopoverLayer: слой
  // дровера (useModalLayer) слушает keydown на window во всплытии, и без
  // перехвата тот же Esc ушёл бы ему в requestClose.
  useEffect(() => {
    const stayOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onStayRef.current()
    }
    window.addEventListener('keydown', stayOnEscape, true)
    return () => window.removeEventListener('keydown', stayOnEscape, true)
  }, [])

  return isPhone ? <UnsavedSheet {...props} /> : <UnsavedBar {...props} />
}

function UnsavedBar({ message, stayLabel, leaveLabel, onStay, onLeave }: UnsavedPromptProps) {
  const promptRef = useRef<HTMLDivElement>(null)
  const messageId = useId()

  // Переход могли начать из низа длинной формы или с таб-бара — плашка вверху
  // экрана была бы за кадром, и клик выглядел бы как «ничего не произошло».
  useEffect(() => {
    promptRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <m.div
      ref={promptRef}
      className="unsaved-prompt"
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby={messageId}
      // Макет: 180 мс сверху вниз. Ухода нет — плашку снимает вызывающий
      // условным рендером, без AnimatePresence.
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <p className="unsaved-prompt__text"><strong id={messageId}>{message}</strong></p>
      <div className="unsaved-prompt__actions">
        {/* Фокус — на безопасном выборе: Enter по привычке не должен выбрасывать ввод. */}
        <button type="button" className="button unsaved-prompt__stay" autoFocus onClick={onStay}>{stayLabel}</button>
        <button type="button" className="button unsaved-prompt__leave" onClick={onLeave}>{leaveLabel}</button>
      </div>
    </m.div>
  )
}

// Лист — в body через портал: плашка стоит внутри дровера и формы, а
// position: fixed под предком с transform (дровер въезжает анимацией) считался
// бы от него, а не от окна. React-события из портала всё равно всплывают по
// дереву компонентов: нажатие на скрим дойдёт до .drawer и остановится там же,
// где останавливалось нажатие по самой плашке.
function UnsavedSheet({ message, stayLabel, leaveLabel, onStay, onLeave }: UnsavedPromptProps) {
  const messageId = useId()
  // Только блокировка прокрутки под скримом: Esc до слушателя слоя не доходит —
  // его перехватывает UnsavedPrompt.
  useModalLayer(onStay)

  return createPortal(
    // Свайп вниз, хват и скрим значат «Остаться»: закрыть вопрос — не то же
    // самое, что согласиться потерять ввод.
    <BottomSheet role="alertdialog" ariaLabelledBy={messageId} onClose={onStay}>
      <div className="unsaved-sheet">
        <strong id={messageId} className="unsaved-sheet__title">{message}</strong>
        <button type="button" className="button unsaved-sheet__stay" autoFocus onClick={onStay}>{stayLabel}</button>
        <button type="button" className="button unsaved-sheet__leave" onClick={onLeave}>{leaveLabel}</button>
      </div>
    </BottomSheet>,
    document.body,
  )
}
