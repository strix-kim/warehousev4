import { useEffect, useRef, type RefObject } from 'react'

/**
 * Общий слой поповера: закрытие по клику мимо, по Escape и по изменению вьюпорта.
 * `insideRefs` — узлы, клик по которым считается «внутри» (кнопка и сам попап).
 *
 * Прокрутка слушается в фазе перехвата (`capture: true`). Попап позиционируется
 * абсолютными координатами в body, поэтому прокрутка ЛЮБОГО контейнера отрывает
 * его от кнопки; события scroll не всплывают, и без capture прокрутка внутри
 * drawer'а до window не доходила — попап оставался висеть на старом месте.
 *
 * Escape тоже ловится в фазе перехвата и гасит дальнейшее распространение:
 * открытый попап забирает клавишу себе. Слой drawer'а (`useModalLayer`) слушает
 * keydown на window в фазе всплытия, то есть последним, — без перехвата один
 * Escape закрывал и попап, и весь drawer вместе с несохранёнными правками.
 * Второй Escape уходит уже в drawer: попап к этому моменту размонтирован и
 * слушателя не ставит.
 */
export function usePopoverLayer(
  open: boolean,
  onClose: () => void,
  insideRefs: Array<RefObject<HTMLElement | null>>,
) {
  const onCloseRef = useRef(onClose)
  const insideRefsRef = useRef(insideRefs)

  useEffect(() => {
    onCloseRef.current = onClose
    insideRefsRef.current = insideRefs
  })

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!insideRefsRef.current.some((ref) => ref.current?.contains(target))) onCloseRef.current()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCloseRef.current()
    }
    const closeOnViewportChange = () => onCloseRef.current()
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape, true)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape, true)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [open])
}
