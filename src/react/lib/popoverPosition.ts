// Координаты попапа, который рисуется порталом в body и потому позиционируется
// абсолютно. Вынесено из AppSelect: меню действий на карточке считает то же
// самое, и разъехаться эти два расчёта не должны.

// Высота попапа НЕ измеряется, а оценивается: координаты нужны до того, как
// попап появится в DOM, иначе первый кадр он рисует в левом верхнем углу и
// прыгает на место.
const ITEM_HEIGHT = 42
const POPOVER_PADDING = 12
const MAX_HEIGHT = 330
const GAP = 7
const VIEWPORT_MARGIN = 12

export function computePopoverPosition(rect: DOMRect, itemCount: number, minWidth = 220) {
  const width = Math.max(rect.width, minWidth)
  const left = Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)
  const estimatedHeight = Math.min(itemCount * ITEM_HEIGHT + POPOVER_PADDING, MAX_HEIGHT)
  const below = rect.bottom + GAP
  // Ниже кнопки, если внизу хватает места; иначе над ней. Прижимать к краю
  // экрана нельзя: попап накрыл бы саму кнопку.
  const top = below + estimatedHeight <= window.innerHeight ? below : Math.max(VIEWPORT_MARGIN, rect.top - estimatedHeight - GAP)
  return { top, left: Math.max(VIEWPORT_MARGIN, left), width }
}
