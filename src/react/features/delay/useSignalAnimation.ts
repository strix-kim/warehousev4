import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { lineArrivals } from './delay'

// Анимация сигнала по цепочке — объяснение формулы движением, а не текстом.
// Запускается ТОЛЬКО кнопкой (play): один проход ≈2,4 с (при двух линиях до ~4 с),
// без автозапуска и без цикла (макет с31, «Motion»). Из мозгов бежит точка — по
// одной на линию, обе стартуют вместе; в начале прохода кольца всех излучателей
// пусты, и каждое заполняется от прихода сигнала до вспышки. В момент, когда
// сигнал доберётся до самого дальнего излучателя системы, все излучатели ВСЕХ
// линий вспыхивают разом: ближние ждали дольше, дальний не ждал вовсе, а излучают
// вместе. Потом кольца за 350 мс возвращаются к доле покоя.
//
// Кольцо заполняется ровно за оставшийся путь точки, то есть за задержку
// излучателя в масштабе анимации. Это не steps × 25 нс, пересчитанные в
// миллисекунды: округление вверх и клампы отрезков ниже разнесли бы финиши
// колец, и одновременная вспышка — ради которой всё и затеяно — развалилась бы.
// Поэтому шкала времени ОБЩАЯ на обе линии (signalTimes): раздельные клампы по
// линиям ставили бы точку одной линии впереди точки другой при большем пути.
//
// Покой колец живёт инлайн-transform'ом из React (DelayChain): анимации кладутся
// поверх него и в конце снимаются cancel() — без скачка, потому что последний
// кадр возврата совпадает с инлайном. Повторный play() во время прохода
// игнорируется. Смена длин, ориентации, размера, скрытая вкладка и смена
// prefers-reduced-motion обрывают проход и возвращают покой.
//
// Всё на Web Animations API и только по transform/opacity. Глобальное правило
// prefers-reduced-motion в 06-responsive гасит CSS-анимации, но до WAAPI не
// дотягивается — поэтому media query проверяется здесь: точки не бегут, кольца
// не крутятся, вспышка — только opacity.
//
// Фоновая «живая» анимация цепочки (ореол мозгов, импульсы по кабелям, эхо у
// излучателей) — чистый CSS в 05-delay.css, хук её не ведёт. Он только отдаёт
// running: пока идёт проход, DelayChain гасит фон классом, чтобы два сигнала не
// читались разом.
//
// Путь второй линии: в столбце она стартует из маленьких мозгов своего блока
// (data-signal-start), в ряду обе линии идут от мозгов по отводу — два угла у
// шины — и только потом вдоль кабелей.
//
// Разметку хук находит по data-атрибутам внутри цепочки:
//   data-signal-dot     — бегущие точки, по одной на линию;
//   data-signal-brain   — коробка мозгов (сама вне линий);
//   data-signal-start   — коробка мозгов второй линии в столбце (в ряду скрыта);
//   data-signal-line    — обёртка линии; внутри неё:
//   data-signal-anchor  — коробки излучателей линии по порядку;
//   data-signal-icon / data-signal-glow — иконка и подсветка узла;
//   data-ring-sweep     — половины кольца ожидания (правая, потом левая);
//   data-signal-wave    — волны вспышки.

const LEAD_MS = 380
// Целевой проход по всей цепочке; клампы отрезков сдвигают его в пределах 2–3 с.
const TRAVEL_MS = 2400
const MIN_SEGMENT_MS = 140
const MAX_SEGMENT_MS = 1100
// Кольца возвращаются к покою через REST_DELAY_MS после вспышки и за REST_MS.
const REST_DELAY_MS = 180
const REST_MS = 350
// Хвост после возврата: волны и подсветка договаривают до конца, потом снимаем всё.
const TAIL_MS = 1300
// Вспышка без движения (reduced motion): одновременный fade подсветки.
const REDUCED_FLASH_MS = 600
const DOT_SIZE = 14
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// Центр узла в координатах цепочки. Считаем по offset*, а не по
// getBoundingClientRect: только что добавленный излучатель ещё въезжает
// transform-анимацией, и прямоугольник на её середине соврал бы на те же 8 px.
function centerWithin(element: HTMLElement, root: HTMLElement) {
  let x = element.offsetWidth / 2
  let y = element.offsetHeight / 2
  let node: HTMLElement | null = element
  while (node && node !== root) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

function segmentDuration(meters: number, msPerMeter: number) {
  // Нулевой кабель — нулевое время: иначе у двух излучателей с равной
  // задержкой кольца заполнялись бы по-разному.
  if (meters <= 0) return 0
  return Math.min(MAX_SEGMENT_MS, Math.max(MIN_SEGMENT_MS, meters * msPerMeter))
}

// Левый край элемента в координатах цепочки (по offset*, как centerWithin).
function leftWithin(element: HTMLElement, root: HTMLElement) {
  let x = 0
  let node: HTMLElement | null = element
  while (node && node !== root) {
    x += node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }
  return x
}

// Шкала времени прохода, мс от клика. Все различные приходы (м) плюс нулевой
// старт по возрастанию; каждый промежуток — segmentDuration с клампами, время —
// накопленная сумма от LEAD_MS. Одна шкала на обе линии: равные приходы получают
// равное время, больший путь — строго большее. times[k][i] — момент, когда сигнал
// приходит к излучателю i линии k; flashAt — приход к самому дальнему (вспышка).
// null — кабеля нет, объяснять нечего. На одной линии совпадает с прежними
// отрезками по кабелям.
export function signalTimes(lines: number[][]): { times: number[][]; flashAt: number } | null {
  const arrivals = lines.map(lineArrivals)
  const longest = Math.max(0, ...arrivals.flat())
  if (longest <= 0) return null
  const marks = Array.from(new Set([0, ...arrivals.flat()])).sort((a, b) => a - b)
  const msPerMeter = TRAVEL_MS / longest
  const at = new Map<number, number>([[0, LEAD_MS]])
  marks.forEach((mark, index) => {
    if (index === 0) return
    const previous = marks[index - 1] ?? 0
    at.set(mark, (at.get(previous) ?? LEAD_MS) + segmentDuration(mark - previous, msPerMeter))
  })
  return {
    times: arrivals.map((line) => line.map((arrival) => at.get(arrival) ?? LEAD_MS)),
    flashAt: at.get(marks[marks.length - 1] ?? 0) ?? LEAD_MS,
  }
}

// lines — длины кабелей по линиям, м (невалидное уже нулём).
// orientation — в зависимостях: смена раскладки сдвигает узлы, и идущий проход
// бежал бы по старым координатам.
export function useSignalAnimation(chainRef: RefObject<HTMLElement | null>, lines: number[][], orientation: string) {
  // Строка, а не массив, в зависимостях: массив новый на каждый рендер, и
  // проход обрывался бы от любого нажатия клавиши, не меняющего длины.
  const signature = lines.map((line) => line.join('|')).join('~')
  const playRef = useRef<(() => void) | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const chain = chainRef.current
    if (!chain || typeof chain.animate !== 'function') return
    const root: HTMLElement = chain
    const lengths = signature.split('~').map((line) => (line ? line.split('|').map(Number) : []))
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    let running: Animation[] = []
    let endTimer: number | undefined
    let busy = false

    // Снять всё: анимации отменяются, инлайн-покой колец и прозрачные точки
    // возвращаются сами.
    function stop() {
      window.clearTimeout(endTimer)
      running.forEach((animation) => animation.cancel())
      running = []
      busy = false
      setRunning(false)
    }

    function animate(element: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      if (!element) return
      running.push(element.animate(keyframes, options))
    }

    function finishAfter(ms: number) {
      endTimer = window.setTimeout(stop, ms)
    }

    // Отклик значка коротким «вздохом»: у мозгов и у пришедшего узла.
    const pulse = (element: Element | null | undefined, scale: number, options: KeyframeAnimationOptions) =>
      animate(element, [{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.3 }, { transform: 'scale(1)' }], options)

    function run() {
      if (busy || document.hidden) return
      const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-signal-dot]'))
      const lineEls = Array.from(root.querySelectorAll<HTMLElement>('[data-signal-line]'))
      const anchorsByLine = lineEls.map((line) => Array.from(line.querySelectorAll<HTMLElement>('[data-signal-anchor]')))
      const brain = root.querySelector<HTMLElement>('[data-signal-brain]')
      // Разметка не догнала длины (рендер ещё не закоммичен) — не рисуем точку мимо узлов.
      if (!brain || dots.length !== lengths.length || anchorsByLine.length !== lengths.length) return
      if (anchorsByLine.some((anchors, index) => anchors.length !== lengths[index]?.length)) return
      const schedule = signalTimes(lengths)
      // Кабеля нет — задержки все нулевые, и объяснять движением нечего.
      if (!schedule) return
      busy = true
      setRunning(true)

      // Без движения: вспышка одновременным fade подсветки всех видимых узлов
      // (скрытое начало второй линии в ряду не считается), кольца остаются в покое.
      if (media.matches) {
        root.querySelectorAll<HTMLElement>('[data-signal-glow]').forEach((glow) => {
          if (glow.offsetParent !== null) animate(glow, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: REDUCED_FLASH_MS, easing: 'ease-out' })
        })
        finishAfter(REDUCED_FLASH_MS)
        return
      }

      const { times, flashAt } = schedule
      const brainPoint = centerWithin(brain, root)
      const start = root.querySelector<HTMLElement>('[data-signal-start]')
      // Начало второй линии видно только в столбце: там её сигнал стартует из него.
      const startVisible = !!start && start.offsetParent !== null

      // Мозги отдают сигнал: короткий импульс перед стартом точек.
      const impulse = (box: HTMLElement | null, icon: Element | null | undefined) => {
        animate(box?.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: LEAD_MS + 200, easing: 'ease-out' })
        animate(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: LEAD_MS, easing: 'ease-out' })
      }
      impulse(brain, brain.querySelector('[data-signal-icon]'))
      if (startVisible) impulse(start, start)

      lengths.forEach((_, lineIndex) => {
        const anchors = anchorsByLine[lineIndex] ?? []
        const arrivals = times[lineIndex] ?? []
        const points = anchors.map((anchor) => centerWithin(anchor, root))
        const lineEnd = arrivals[arrivals.length - 1] ?? LEAD_MS
        const travel = lineEnd - LEAD_MS

        // Путь точки: старт, два угла отвода (только при двух линиях в ряду),
        // потом центры излучателей. Время первого отрезка делится между кусками
        // пропорционально их длине в px.
        const origin = lineIndex === 1 && startVisible && start ? centerWithin(start, root) : brainPoint
        const first = points[0]
        const firstCable = lineEls[lineIndex]?.querySelector<HTMLElement>('.delay-cable')
        const forked = lengths.length > 1 && orientation === 'row' && !!first && !!firstCable
        const corners = forked && first && firstCable
          ? [{ x: leftWithin(firstCable, root) - 1.5, y: origin.y }, { x: leftWithin(firstCable, root) - 1.5, y: first.y }]
          : []
        const legs = [origin, ...corners, ...(first ? [first] : [])]
        const legLength = legs.slice(1).map((point, index) => Math.abs(point.x - (legs[index]?.x ?? 0)) + Math.abs(point.y - (legs[index]?.y ?? 0)))
        const legTotal = legLength.reduce((sum, length) => sum + length, 0)
        const firstTime = (arrivals[0] ?? LEAD_MS) - LEAD_MS
        let elapsed = 0
        const path = [{ point: origin, at: 0 }]
        legs.slice(1).forEach((point, index) => {
          elapsed += legTotal > 0 ? (firstTime * (legLength[index] ?? 0)) / legTotal : 0
          path.push({ point, at: elapsed })
        })
        anchors.slice(1).forEach((_, index) => {
          const point = points[index + 1]
          if (point) path.push({ point, at: (arrivals[index + 1] ?? LEAD_MS) - LEAD_MS })
        })

        // Точка: положение и прозрачность — две анимации на разных свойствах,
        // иначе появление и угасание пришлось бы вклинивать между узлами. Линия
        // с нулевым путём (все её излучатели на нулевом приходе) точку не пускает.
        const dot = dots[lineIndex]
        if (travel > 0) {
          animate(dot, path.map(({ point, at }) => ({
            transform: `translate3d(${point.x - DOT_SIZE / 2}px, ${point.y - DOT_SIZE / 2}px, 0)`,
            offset: at / travel,
          })), { delay: LEAD_MS, duration: travel, easing: 'linear', fill: 'both' })
          const fadeDuration = travel + 220
          animate(dot, [
            { opacity: 0, offset: 0 },
            { opacity: 1, offset: Math.min(120 / fadeDuration, travel / fadeDuration) },
            { opacity: 1, offset: travel / fadeDuration },
            { opacity: 0, offset: 1 },
          ], { delay: LEAD_MS, duration: fadeDuration, fill: 'both' })
        }

        anchors.forEach((anchor, index) => {
          const arrival = arrivals[index] ?? flashAt
          const wait = flashAt - arrival
          const icon = anchor.querySelector('[data-signal-icon]')
          const halves = Array.from(anchor.querySelectorAll<HTMLElement>('[data-ring-sweep]'))

          // Сигнал пришёл — узел коротко отзывается.
          animate(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { delay: arrival, duration: 260, easing: 'ease-out' })

          // Кольцо: с начала прохода пусто (fill: both держит первый кадр в паузе),
          // потом правая половина, затем левая, каждая за половину задержки.
          // Вспышка — и возврат к доле покоя, лежащей инлайном. У самого дальнего
          // ждать нечего — кольцо не трогаем: оно и так пустое.
          if (wait > 0) {
            const sweep: Keyframe[] = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }]
            halves.forEach((half, halfIndex) => {
              const begin = arrival + (halfIndex * wait) / 2
              animate(half, sweep, { delay: begin, duration: wait / 2, easing: 'linear', fill: 'both' })
              // forwards, а не both: до старта возврата кадр держит предыдущая
              // анимация, а после него — инлайн-покой.
              animate(half, [{ transform: 'rotate(180deg)' }, { transform: half.style.transform || 'rotate(0deg)' }], { delay: flashAt + REST_DELAY_MS, duration: REST_MS, easing: 'ease-out', fill: 'forwards' })
            })
          }

          // Вспышка — у всех излучателей всех линий в один и тот же момент.
          animate(anchor.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { delay: flashAt, duration: 900, easing: 'ease-out' })
          pulse(icon, 1.16, { delay: flashAt, duration: 460, easing: 'ease-out' })
          anchor.querySelectorAll('[data-signal-wave]').forEach((wave, waveIndex) => {
            animate(wave, [
              { transform: 'scale(.85)', opacity: 0.6 },
              { transform: 'scale(2.5)', opacity: 0 },
            ], { delay: flashAt + waveIndex * 240, duration: 1000, easing: 'cubic-bezier(.2,.7,.2,1)' })
          })
        })
      })

      finishAfter(flashAt + REST_MS + TAIL_MS)
    }

    function onVisibilityChange() {
      if (document.hidden) stop()
    }

    // Узлы сдвинулись (поворот телефона, ширина окна) — точка бежала бы по
    // старым координатам. Первый вызов наблюдатель делает сам при подписке —
    // stop() на чистом состоянии безвреден.
    const observer = new ResizeObserver(stop)
    observer.observe(root)
    document.addEventListener('visibilitychange', onVisibilityChange)
    media.addEventListener('change', stop)
    playRef.current = run

    return () => {
      playRef.current = null
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      media.removeEventListener('change', stop)
    }
  }, [chainRef, signature, orientation])

  const play = useCallback(() => playRef.current?.(), [])
  return { play, running }
}
