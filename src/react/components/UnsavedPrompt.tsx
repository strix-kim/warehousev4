import { CircleAlert } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

type UnsavedPromptProps = {
  message: string
  stayLabel: string
  leaveLabel: string
  onStay: () => void
  onLeave: () => void
}

// Вопрос «уйти без сохранения?» — встроенной плашкой, а не window.confirm:
// у системного диалога кнопки браузерные, не на языке интерфейса, и на телефоне
// он читается как сбой, а не как вопрос приложения. Обе кнопки type="button": плашка
// стоит внутри <form>, и кнопка без типа отправила бы форму.
export function UnsavedPrompt({ message, stayLabel, leaveLabel, onStay, onLeave }: UnsavedPromptProps) {
  const promptRef = useRef<HTMLDivElement>(null)
  const messageId = useId()

  // Переход могли начать из низа длинной формы или с таб-бара — плашка вверху
  // экрана была бы за кадром, и клик выглядел бы как «ничего не произошло».
  useEffect(() => {
    promptRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <div ref={promptRef} className="unsaved-prompt" role="alertdialog" aria-live="assertive" aria-labelledby={messageId}>
      <CircleAlert size={18} />
      <strong id={messageId}>{message}</strong>
      <div className="unsaved-prompt__actions">
        {/* Фокус — на безопасном выборе: Enter по привычке не должен выбрасывать ввод. */}
        <button type="button" className="button button--primary" autoFocus onClick={onStay}>{stayLabel}</button>
        <button type="button" className="button button--secondary" onClick={onLeave}>{leaveLabel}</button>
      </div>
    </div>
  )
}
