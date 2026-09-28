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

// Якорь и окно в CSS-px попапа (с33). На широком экране корень увеличен
// CSS-свойством zoom (06-responsive): getBoundingClientRect и innerWidth/
// innerHeight отдают экранные px, а top/left попапа внутри увеличенного корня
// браузер умножает на zoom ещё раз — без деления попап уезжал от кнопки вправо
// вниз на 12,5 % её координат (замер на 2560: до 200 px). Масштаб читается с
// корня, где он задан: цель портала (body или полноэкранный элемент) — его
// потомок и своего zoom не имеет. Без zoom делитель 1 и расчёт прежний.
export function measureAnchor(anchor: Element) {
  const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1
  const rect = anchor.getBoundingClientRect()
  return {
    rect: { top: rect.top / zoom, bottom: rect.bottom / zoom, left: rect.left / zoom, width: rect.width / zoom },
    viewportWidth: window.innerWidth / zoom,
    viewportHeight: window.innerHeight / zoom,
  }
}

export function computePopoverPosition(anchor: Element, itemCount: number, minWidth = 220) {
  const { rect, viewportWidth, viewportHeight } = measureAnchor(anchor)
  const width = Math.max(rect.width, minWidth)
  const left = Math.min(rect.left, viewportWidth - width - VIEWPORT_MARGIN)
  const estimatedHeight = Math.min(itemCount * ITEM_HEIGHT + POPOVER_PADDING, MAX_HEIGHT)
  const below = rect.bottom + GAP
  // Ниже кнопки, если внизу хватает места; иначе над ней. Прижимать к краю
  // экрана нельзя: попап накрыл бы саму кнопку.
  const top = below + estimatedHeight <= viewportHeight ? below : Math.max(VIEWPORT_MARGIN, rect.top - estimatedHeight - GAP)
  return { top, left: Math.max(VIEWPORT_MARGIN, left), width }
}
