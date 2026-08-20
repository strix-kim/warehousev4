import { useEffect, useRef, type RefObject } from 'react'

/**
 * Общий слой поповера: закрытие по клику мимо, по Escape и по изменению вьюпорта.
 * `insideRefs` — узлы, клик по которым считается «внутри» (кнопка и сам попап).
 *
 * Прокрутка слушается в фазе перехвата (`capture: true`). Попап позиционируется
 * абсолютными координатами в body, поэтому прокрутка ЛЮБОГО контейнера отрывает
 * его от кнопки; события scroll не всплывают, и без capture прокрутка внутри
 * drawer'а до window не доходила — попап оставался висеть на старом месте.
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
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    const closeOnViewportChange = () => onCloseRef.current()
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [open])
}
