import { useEffect, useRef, useState } from 'react'

const COUNT_UP_MS = 180

// Докрутка счётчика (макет с31: 180 мс). Своим rAF, а не motion: число — это
// текст, а не стиль, и императивный animate() потянул бы в чанк гибридный
// аниматор ради пяти строк.
//
// live = false — число меняется сразу. Страница включает live только первым
// действием пользователя: гидратация открытого списка и подъём черновика
// приходят до него и не должны «накручиваться» с нуля. При
// prefers-reduced-motion докрутки нет вовсе.
export function useCountUp(value: number, live: boolean) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  const animated = live && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const from = shownRef.current
    if (!animated || from === value) {
      shownRef.current = value
      setShown(value)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS)
      const eased = 1 - (1 - progress) ** 3
      const next = Math.round(from + (value - from) * eased)
      shownRef.current = next
      setShown(next)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [animated, value])

  // Без докрутки отдаём само значение, а не стейт: иначе на кадр до эффекта
  // мелькнуло бы прежнее число.
  return animated ? shown : value
}
