import { useEffect, useRef, useState } from 'react'

/** Keeps a temporary side panel keyboard-friendly and prevents background scrolling. */
export function useModalLayer(onClose: () => void) {
  const onCloseRef = useRef(onClose)
  // Кто держал фокус до открытия слоя (строка реестра, вкладка «Ещё»): после
  // закрытия клавиатура продолжает с того же места, а не с начала страницы.
  // Снимаем В РЕНДЕРЕ, а не в эффекте: autoFocus крестика срабатывает при
  // коммите, раньше любого эффекта слоя, и эффект увидел бы уже крестик.
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }

    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      window.removeEventListener('keydown', handleKeyDown)
      // Возвращаем, ТОЛЬКО если фокус потерян (ушёл в body вместе с DOM слоя).
      // Смена слоя на слой (модель → единица) не должна уводить фокус назад:
      // autoFocus нового дровера срабатывает раньше этой очистки старого, и
      // фокус уже стоит на его крестике. Открывший элемент мог и исчезнуть
      // (перерисованный список) — тогда возвращать некуда.
      const active = document.activeElement
      if (opener && opener.isConnected && (active === null || active === document.body)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])
}
