import { useEffect, type RefObject } from 'react'

// Анимация сигнала по цепочке — объяснение формулы движением, а не текстом.
// Точка бежит от мозгов вниз по кабелям; дойдя до излучателя, оставляет ему
// кольцо ожидания, которое заполняется до момента, когда сигнал доберётся до
// последнего. В этот момент все излучатели вспыхивают разом: первый ждал дольше
// всех, последний не ждал вовсе, а излучают вместе.
//
// Кольцо заполняется ровно за оставшийся путь точки, то есть за задержку
// излучателя в масштабе анимации. Это не steps × 25 нс, пересчитанные в
// миллисекунды: округление вверх и клампы отрезков ниже разнесли бы финиши
// колец, и одновременная вспышка — ради которой всё и затеяно — развалилась бы.
//
// Всё на Web Animations API и только по transform/opacity. Глобальное правило
// prefers-reduced-motion в 06-responsive гасит CSS-анимации, но до WAAPI не
// дотягивается — поэтому media query проверяется здесь. Скрытая вкладка не
// крутит ничего: таймеры и анимации снимаются по visibilitychange.
//
// Разметку хук находит по data-атрибутам внутри цепочки:
//   data-signal-dot     — бегущая точка (одна);
//   data-signal-anchor  — узлы по порядку: мозги, затем излучатели;
//   data-signal-icon / data-signal-glow — иконка и подсветка узла;
//   data-ring-fill / data-ring-sweep    — кольцо ожидания (две половины);
//   data-signal-wave    — волны вспышки.

const LEAD_MS = 380
// Целевой проход по всей цепочке; клампы отрезков сдвигают его в пределах 2–3 с.
const TRAVEL_MS = 2400
const MIN_SEGMENT_MS = 140
const MAX_SEGMENT_MS = 1100
const FLASH_MS = 1300
const PAUSE_MS = 1400
const RESTART_DEBOUNCE_MS = 400
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
export function useSignalAnimation(chainRef: RefObject<HTMLElement | null>, lengths: number[]) {
  // Строка, а не массив, в зависимостях: массив новый на каждый рендер, и
  // анимация перезапускалась бы от любого нажатия клавиши, не меняющего длины.
  const signature = lengths.join('|')

  useEffect(() => {
    const chain = chainRef.current
    if (!chain || typeof chain.animate !== 'function') return
    const root: HTMLElement = chain
    const segments = signature ? signature.split('|').map(Number) : []
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    let running: Animation[] = []
    let debounceTimer: number | undefined
    let cycleTimer: number | undefined

    function clearAnimations() {
      running.forEach((animation) => animation.cancel())
      running = []
    }

    function stop() {
      window.clearTimeout(debounceTimer)
      window.clearTimeout(cycleTimer)
      clearAnimations()
    }

    function schedule() {
      stop()
      if (media.matches || document.hidden) return
      debounceTimer = window.setTimeout(runCycle, RESTART_DEBOUNCE_MS)
    }

    function play(element: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      if (!element) return
      running.push(element.animate(keyframes, options))
    }

    function runCycle() {
      clearAnimations()
      const dot = root.querySelector<HTMLElement>('[data-signal-dot]')
      const anchors = Array.from(root.querySelectorAll<HTMLElement>('[data-signal-anchor]'))
      // Разметка не догнала длины (рендер ещё не закоммичен) — ждём следующего
      // перезапуска, а не рисуем точку мимо узлов.
      if (!dot || anchors.length !== segments.length + 1) return
      const totalMeters = segments.reduce((sum, meters) => sum + meters, 0)
      // Кабеля нет — задержки все нулевые, и объяснять движением нечего.
      if (totalMeters <= 0) return

      const msPerMeter = TRAVEL_MS / totalMeters
      const arrivals = [LEAD_MS]
      segments.forEach((meters, index) => arrivals.push((arrivals[index] ?? LEAD_MS) + segmentDuration(meters, msPerMeter)))
      const flashAt = arrivals[arrivals.length - 1] ?? LEAD_MS
      const travel = flashAt - LEAD_MS
      const points = anchors.map((anchor) => centerWithin(anchor, root))

      // Мозги отдают сигнал: короткий импульс перед стартом точки.
      const brain = anchors[0]
      play(brain?.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: LEAD_MS + 200, easing: 'ease-out' })
      play(brain?.querySelector('[data-signal-icon]'), [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: LEAD_MS, easing: 'ease-out' })

      // Точка: положение и прозрачность — две анимации на разных свойствах,
      // иначе появление и угасание пришлось бы вклинивать между узлами.
      play(dot, points.map((point, index) => ({
        transform: `translate3d(${point.x - DOT_SIZE / 2}px, ${point.y - DOT_SIZE / 2}px, 0)`,
        offset: ((arrivals[index] ?? LEAD_MS) - LEAD_MS) / travel,
      })), { delay: LEAD_MS, duration: travel, easing: 'linear', fill: 'both' })
      const fadeDuration = travel + 220
      play(dot, [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: Math.min(120 / fadeDuration, travel / fadeDuration) },
        { opacity: 1, offset: travel / fadeDuration },
        { opacity: 0, offset: 1 },
      ], { delay: LEAD_MS, duration: fadeDuration, fill: 'both' })

      anchors.slice(1).forEach((anchor, index) => {
        const arrival = arrivals[index + 1] ?? flashAt
        const wait = flashAt - arrival
        const icon = anchor.querySelector('[data-signal-icon]')
        const [firstHalf, secondHalf] = Array.from(anchor.querySelectorAll('[data-ring-sweep]'))

        // Сигнал пришёл — узел коротко отзывается.
        play(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { delay: arrival, duration: 260, easing: 'ease-out' })

        // Кольцо ожидания: правая половина, затем левая, каждая за половину
        // задержки. У последнего ждать нечего — кольцо не трогаем.
        if (wait > 0) {
          const sweep: Keyframe[] = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }]
          play(firstHalf, sweep, { delay: arrival, duration: wait / 2, easing: 'linear', fill: 'forwards' })
          play(secondHalf, sweep, { delay: arrival + wait / 2, duration: wait / 2, easing: 'linear', fill: 'forwards' })
          play(anchor.querySelector('[data-ring-fill]'), [{ opacity: 1 }, { opacity: 0 }], { delay: flashAt + 180, duration: 520, fill: 'forwards' })
        }

        // Вспышка — у всех в один и тот же момент.
        play(anchor.querySelector('[data-signal-glow]'), [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { delay: flashAt, duration: 900, easing: 'ease-out' })
        play(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.3 }, { transform: 'scale(1)' }], { delay: flashAt, duration: 460, easing: 'ease-out' })
        anchor.querySelectorAll('[data-signal-wave]').forEach((wave, waveIndex) => {
          play(wave, [
            { transform: 'scale(.85)', opacity: 0.6 },
            { transform: 'scale(2.5)', opacity: 0 },
          ], { delay: flashAt + waveIndex * 240, duration: 1000, easing: 'cubic-bezier(.2,.7,.2,1)' })
        })
      })

      cycleTimer = window.setTimeout(runCycle, flashAt + FLASH_MS + PAUSE_MS)
    }

    function onVisibilityChange() {
      if (document.hidden) stop()
      else schedule()
    }

    // Узлы сдвинулись (поворот телефона, ширина окна) — точка бежала бы по
    // старым координатам. Первый вызов наблюдатель делает сам при подписке,
    // он и запускает цикл через тот же дебаунс.
    const observer = new ResizeObserver(() => schedule())
    observer.observe(root)
    document.addEventListener('visibilitychange', onVisibilityChange)
    media.addEventListener('change', schedule)

    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      media.removeEventListener('change', schedule)
    }
  }, [chainRef, signature])
}
