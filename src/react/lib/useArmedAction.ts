import { useEffect, useRef, useState } from 'react'

// Двухшаговое подтверждение прямо в кнопке: первый клик взводит, второй в течение
// timeoutMs выполняет действие. Модального окна здесь нет намеренно — отменяет
// пользователь бездействием, а не второй кнопкой «нет».
export function useArmedAction(timeoutMs = 4000) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef(0)

  // Таймер живёт дольше рендера, поэтому снимается на размонтировании: иначе
  // setArmed выстрелит в уже отсоединённый компонент.
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  function disarm() {
    window.clearTimeout(timerRef.current)
    setArmed(false)
  }

  function fire(action: () => void) {
    if (armed) {
      disarm()
      action()
      return
    }
    window.clearTimeout(timerRef.current)
    setArmed(true)
    timerRef.current = window.setTimeout(() => setArmed(false), timeoutMs)
  }

  return { armed, fire, disarm }
}
