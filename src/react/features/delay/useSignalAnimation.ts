import { useCallback, useEffect, useRef, type RefObject } from 'react'

// Анимация сигнала по цепочке — объяснение формулы движением, а не текстом.
// Запускается ТОЛЬКО кнопкой (play): один проход ≈2,4 с, без автозапуска и без
// цикла (макет с31, «Motion»). Точка бежит от мозгов по кабелям; в начале прохода
// кольца всех излучателей пусты, и каждое заполняется от прихода сигнала до
// вспышки. В момент, когда сигнал доберётся до последнего, все излучатели
// вспыхивают разом: первый ждал дольше всех, последний не ждал вовсе, а излучают
// вместе. Потом кольца за 350 мс возвращаются к доле покоя.
//
// Кольцо заполняется ровно за оставшийся путь точки, то есть за задержку
// излучателя в масштабе анимации. Это не steps × 25 нс, пересчитанные в
// миллисекунды: округление вверх и клампы отрезков ниже разнесли бы финиши
// колец, и одновременная вспышка — ради которой всё и затеяно — развалилась бы.
//
// Покой колец живёт инлайн-transform'ом из React (DelayChain): анимации кладутся
// поверх него и в конце снимаются cancel() — без скачка, потому что последний
// кадр возврата совпадает с инлайном. Повторный play() во время прохода
// игнорируется. Смена длин, ориентации, размера, скрытая вкладка и смена
// prefers-reduced-motion обрывают проход и возвращают покой.
//
// Всё на Web Animations API и только по transform/opacity. Глобальное правило
// prefers-reduced-motion в 06-responsive гасит CSS-анимации, но до WAAPI не
// дотягивается — поэтому media query проверяется здесь: точка не бежит, кольца
// не крутятся, вспышка — только opacity.
//
// Разметку хук находит по data-атрибутам внутри цепочки:
//   data-signal-dot     — бегущая точка (одна);
//   data-signal-anchor  — коробки узлов по порядку: мозги, затем излучатели;
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

// lengths — длины кабелей до каждого излучателя, м (невалидное уже нулём).
// orientation — в зависимостях: смена раскладки сдвигает узлы, и идущий проход
// бежал бы по старым координатам.
export function useSignalAnimation(chainRef: RefObject<HTMLElement | null>, lengths: number[], orientation: string) {
  // Строка, а не массив, в зависимостях: массив новый на каждый рендер, и
  // проход обрывался бы от любого нажатия клавиши, не меняющего длины.
  const signature = lengths.join('|')
  const playRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const chain = chainRef.current
    if (!chain || typeof chain.animate !== 'function') return
    const root: HTMLElement = chain
    const segments = signature ? signature.split('|').map(Number) : []
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    let running: Animation[] = []
    let endTimer: number | undefined
    let busy = false

    // Снять всё: анимации отменяются, инлайн-покой колец и прозрачная точка
    // возвращаются сами.
    function stop() {
      window.clearTimeout(endTimer)
      running.forEach((animation) => animation.cancel())
      running = []
      busy = false
    }

    function animate(element: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      if (!element) return
      running.push(element.animate(keyframes, options))
    }

    function finishAfter(ms: number) {
      endTimer = window.setTimeout(stop, ms)
    }

    function run() {
      if (busy || document.hidden) return
      const dot = root.querySelector<HTMLElement>('[data-signal-dot]')
      const anchors = Array.from(root.querySelectorAll<HTMLElement>('[data-signal-anchor]'))
      // Разметка не догнала длины (рендер ещё не закоммичен) — не рисуем точку мимо узлов.
      if (!dot || anchors.length !== segments.length + 1) return
      const totalMeters = segments.reduce((sum, meters) => sum + meters, 0)
      // Кабеля нет — задержки все нулевые, и объяснять движением нечего.
      if (totalMeters <= 0) return
      busy = true

      // Без движения: вспышка одновременным fade подсветки, кольца остаются в покое.
      if (media.matches) {
        anchors.forEach((anchor) => animate(anchor.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: REDUCED_FLASH_MS, easing: 'ease-out' }))
        finishAfter(REDUCED_FLASH_MS)
        return
      }

      const msPerMeter = TRAVEL_MS / totalMeters
      const arrivals = [LEAD_MS]
      segments.forEach((meters, index) => arrivals.push((arrivals[index] ?? LEAD_MS) + segmentDuration(meters, msPerMeter)))
      const flashAt = arrivals[arrivals.length - 1] ?? LEAD_MS
      const travel = flashAt - LEAD_MS
      const points = anchors.map((anchor) => centerWithin(anchor, root))

      // Мозги отдают сигнал: короткий импульс перед стартом точки.
      const brain = anchors[0]
      animate(brain?.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: LEAD_MS + 200, easing: 'ease-out' })
      animate(brain?.querySelector('[data-signal-icon]'), [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: LEAD_MS, easing: 'ease-out' })

      // Точка: положение и прозрачность — две анимации на разных свойствах,
      // иначе появление и угасание пришлось бы вклинивать между узлами.
      animate(dot, points.map((point, index) => ({
        transform: `translate3d(${point.x - DOT_SIZE / 2}px, ${point.y - DOT_SIZE / 2}px, 0)`,
        offset: ((arrivals[index] ?? LEAD_MS) - LEAD_MS) / travel,
      })), { delay: LEAD_MS, duration: travel, easing: 'linear', fill: 'both' })
      const fadeDuration = travel + 220
      animate(dot, [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: Math.min(120 / fadeDuration, travel / fadeDuration) },
        { opacity: 1, offset: travel / fadeDuration },
        { opacity: 0, offset: 1 },
      ], { delay: LEAD_MS, duration: fadeDuration, fill: 'both' })

      anchors.slice(1).forEach((anchor, index) => {
        const arrival = arrivals[index + 1] ?? flashAt
        const wait = flashAt - arrival
        const icon = anchor.querySelector('[data-signal-icon]')
        const halves = Array.from(anchor.querySelectorAll<HTMLElement>('[data-ring-sweep]'))

        // Сигнал пришёл — узел коротко отзывается.
        animate(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { delay: arrival, duration: 260, easing: 'ease-out' })

        // Кольцо: с начала прохода пусто (fill: both держит первый кадр в паузе),
        // потом правая половина, затем левая, каждая за половину задержки.
        // Вспышка — и возврат к доле покоя, лежащей инлайном. У последнего ждать
        // нечего — кольцо не трогаем: оно и так пустое.
        if (wait > 0) {
          const sweep: Keyframe[] = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }]
          halves.forEach((half, halfIndex) => {
            const start = arrival + (halfIndex * wait) / 2
            animate(half, sweep, { delay: start, duration: wait / 2, easing: 'linear', fill: 'both' })
            // forwards, а не both: до старта возврата кадр держит предыдущая
            // анимация, а после него — инлайн-покой.
            animate(half, [{ transform: 'rotate(180deg)' }, { transform: half.style.transform || 'rotate(0deg)' }], { delay: flashAt + REST_DELAY_MS, duration: REST_MS, easing: 'ease-out', fill: 'forwards' })
          })
        }

        // Вспышка — у всех в один и тот же момент.
        animate(anchor.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { delay: flashAt, duration: 900, easing: 'ease-out' })
        animate(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.3 }, { transform: 'scale(1)' }], { delay: flashAt, duration: 460, easing: 'ease-out' })
        anchor.querySelectorAll('[data-signal-wave]').forEach((wave, waveIndex) => {
          animate(wave, [
            { transform: 'scale(.85)', opacity: 0.6 },
            { transform: 'scale(2.5)', opacity: 0 },
          ], { delay: flashAt + waveIndex * 240, duration: 1000, easing: 'cubic-bezier(.2,.7,.2,1)' })
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
  return { play }
}
