import { useLayoutEffect, useState, type RefObject } from 'react'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'

// Геометрия цепочки калькулятора ITC: ширины кабелей «в масштабе метров» и
// выбор ориентации — ряд слева направо, пока помещается, иначе столбец.

// Коробка узла (значок), px. Пара в 05-delay.css: .delay-node__box.
export const NODE_PX = 56
// Поля цепочки по бокам: подпись узла шире самого узла на 34 px с каждой стороны
// (124 против 56) и не должна вылезать за край цепочки. Пара в 05-delay.css.
export const CHAIN_PAD_X = 34
// Меньше кабель не бывает: под поле длины и под подписи соседних узлов.
// Инвариант: MIN_CABLE_PX + NODE_PX ≥ 124 + 8 — расстояние между центрами соседних
// узлов не меньше ширины подписи (124) плюс зазор 8, подписи не наезжают друг на друга.
// 76 — ровно по инварианту. Замер (с38): пилюля поля с «125,5» — 64,25 px, то есть
// в кабеле 76 остаётся по 5,9 px линии с каждой стороны; на 1280 при 6 излучателях
// меньшего минимума не нужно, а больший ряд не вместил бы.
export const MIN_CABLE_PX = 76
// Запас на округление, чтобы ряд не упирался в край ровно в пиксель.
const CHAIN_SLACK_PX = 2
// Гистерезис: из столбца обратно в ряд — только когда ряд влезает с запасом,
// иначе на границе раскладка качалась бы от каждого пикселя ресайза.
const HYSTERESIS_PX = 16

export type ChainOrientation = 'row' | 'column'

// Ширины кабелей, px: пропорциональны метрам, но не меньше minPx. Кабель, для
// которого пропорция дала бы меньше минимума, фиксируется на минимуме, а остаток
// делится между остальными — пока набор «закреплённых» не перестанет расти.
export function cableWidths(available: number, lengths: number[], minPx: number): number[] {
  const values = lengths.map((length) => Math.max(0, length || 0))
  const fixed = new Set<number>()
  let scale = 0
  // Не больше одного прохода на кабель: каждый проход либо закрепляет ещё один,
  // либо ничего не меняет. Три прохода (как в макете) оставляли бы хвост с
  // устаревшим масштабом и лишними пикселями за краем.
  for (let pass = 0; pass <= values.length; pass += 1) {
    let free = available
    let sum = 0
    values.forEach((value, index) => {
      if (fixed.has(index)) free -= minPx
      else sum += value
    })
    scale = sum ? free / sum : 0
    let grew = false
    values.forEach((value, index) => {
      if (!fixed.has(index) && value * scale < minPx) {
        fixed.add(index)
        grew = true
      }
    })
    if (!grew) break
  }
  return values.map((value, index) => (fixed.has(index) ? minPx : Math.max(minPx, value * scale)))
}

// Ширина цепочки, при которой ряд из count излучателей ещё влезает с минимальными кабелями.
function rowWidthNeeded(count: number) {
  return NODE_PX * (count + 1) + MIN_CABLE_PX * count + CHAIN_PAD_X * 2 + CHAIN_SLACK_PX
}

// Ориентация и ширины кабелей. Меряем родителя цепочки (карточку), а не саму
// цепочку: в столбце у неё max-width, и по её ширине нельзя понять, влез бы ряд.
// Ряд занимает всю карточку вместе с её боковым padding (22 px, «выпущен» в него
// отрицательным margin в 05-delay.css — без этих 44 px 6 излучателей не влезали
// в ряд на 1280), поэтому его ширина — clientWidth карточки. clientWidth, а не getBoundingClientRect: под zoom 2560
// прямоугольник отдаёт экранные px (gotchas §16).
export function useChainLayout(chainRef: RefObject<HTMLElement | null>, lengths: number[]) {
  const count = lengths.length
  const [state, setState] = useState<{ orientation: ChainOrientation; width: number }>(() => ({
    orientation: window.matchMedia(MOBILE_MEDIA_QUERY).matches ? 'column' : 'row',
    width: 0,
  }))

  // Layout-эффект: первый замер до отрисовки, иначе кадр с чужой ориентацией.
  useLayoutEffect(() => {
    const stage = chainRef.current?.parentElement
    if (!stage) return
    const mobile = window.matchMedia(MOBILE_MEDIA_QUERY)
    const needed = rowWidthNeeded(count)

    function measure() {
      if (!stage) return
      const width = stage.clientWidth
      setState((prev) => {
        let orientation: ChainOrientation
        if (mobile.matches) orientation = 'column'
        else if (prev.orientation === 'row') orientation = needed > width ? 'column' : 'row'
        else orientation = needed + HYSTERESIS_PX <= width ? 'row' : 'column'
        return orientation === prev.orientation && width === prev.width ? prev : { orientation, width }
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    mobile.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      mobile.removeEventListener('change', measure)
    }
  }, [chainRef, count])

  const available = state.width - CHAIN_PAD_X * 2 - NODE_PX * (count + 1) - CHAIN_SLACK_PX
  return { orientation: state.orientation, widths: cableWidths(available, lengths, MIN_CABLE_PX) }
}
