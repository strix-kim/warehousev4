/* Раскладка HUD — каждый кадр после CSS2DRenderer. Правило наездов, по убыванию приоритета:
   1. Обвязка (элементы [data-w-chrome]: день, клавиши) неподвижна и всегда сверху.
   2. Вывески: сначала выбранная, потом наведённая/в фокусе, потом прижатая к краю кадра,
      потом ближняя к камере. Каждая ищет место: сдвиг вбок (ножка остаётся в якоре) →
      подъём на ступень → посадка на крышу без ножки → компактный вид → скрыта.
      Вернуться на ступень лучше можно только с запасом +10 px — без мерцания на границе
      при повороте камеры.
   3. Чипы имён — ниже всех: не двигаются, а гаснут, если легли бы на обвязку, вывеску
      или уже показанный чип. В компактном режиме скрыты все, кроме чипа под указателем.
   Скрытая вывеска не теряет объект: у каждого здания есть клавиша.
   Движок пишет только классы и переменные якоря (контракт — worldStore.ts), детей не трогает. */
import * as THREE from 'three'
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { WorldStore } from '../worldStore'
import type { WorldCtx } from './createWorld'

const HUD_GAP = 8, HUD_EDGE = 8   // зазор между плашками HUD и поле от края сцены
// Ступени вывески по высоте: подъём над соседкой; последние две — посадка на крышу
// (ножка прячется), когда сверху тесно
const LIFTS = [0, 26, 52, -12, -24]
// Высота ножки в полном и компактном виде — пара к --leg в CSS вывески
const LEGS = [12, 10] as const

type Rect = { x: number; y: number; w: number; h: number }
type Size = readonly [w: number, h: number]

type Item = {
  id: string
  o: CSS2DObject
  el: HTMLElement
  chip: boolean
  // Вывеска: [полная, компактная]; чип: один размер в обоих местах. null — ещё не измерена
  size: readonly [Size, Size] | null
  // Якорь был скрыт рендерером в момент перемера — размера у него не было
  hidden: boolean
  // Вывеска: 0 полная, 1 компактная, 2 скрыта. Чип: 0 показан, 1 скрыт
  level: number
  fresh: boolean
  x: number; y: number; z: number; ok: boolean; tight: boolean
  shift: number; lift: number; px: string
  near: boolean; dx: number
}

export type HudLayout = {
  layout: (now: number) => void
  // Размеры могли измениться (ресайз, пересборка сцены): перемер на следующем кадре
  dirty: () => void
  dispose: () => void
}

const hits = (a: Rect, b: Rect, m: number) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y

export function createHudLayout(ctx: WorldCtx, store: WorldStore, reduced: boolean): HudLayout {
  const scene = ctx.container, stage = scene.parentElement
  const at = new THREE.Vector3()
  let items: Item[] = [], chrome: Rect[] = []
  let w = 0, h = 0, last = 0, stale = true, disposed = false

  const dirty = () => {
    if (disposed) return
    stale = true
    ctx.invalidate()
  }
  // Содержимое подписей и обвязку рисует оболочка — перемер по изменению детей сцены.
  // Атрибуты не слушаем: классы и style якорям пишет сама раскладка.
  const watch = new MutationObserver(dirty)
  if (stage) watch.observe(stage, { childList: true, characterData: true, subtree: true })
  void document.fonts?.ready.then(dirty)

  // Прямоугольник элемента в осях сцены (transform не учитывается)
  const boxIn = (el: HTMLElement): Rect => {
    let x = 0, y = 0
    for (let n: HTMLElement | null = el; n && n !== stage; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight }
  }

  // Перемер: обвязка и размеры подписей. Вывеска меряется в обоих видах — полном и компактном
  const measure = () => {
    w = scene.clientWidth; h = scene.clientHeight
    if (!w) return
    stale = false
    chrome = stage ? [...stage.querySelectorAll<HTMLElement>('[data-w-chrome]')].map(boxIn).filter((b) => b.w && b.h) : []
    const old = new Map(items.map((s) => [s.o, s]))
    items = [...ctx.labels].map(([id, o]) => {
      const el = o.element, chip = el.classList.contains('w-who')
      // Новая подпись рождается скрытой и проявляется, когда раскладка нашла ей место
      const s: Item = old.get(o) ?? { id, o, el, chip, size: null, hidden: false, level: chip ? 1 : 2, fresh: true, x: 0, y: 0, z: 0, ok: false, tight: false, shift: 0, lift: 0, px: '', near: false, dx: 0 }
      if (!old.has(o)) el.classList.add('is-away')
      // Вне кадра рендерер ставит якорю display: none — размера нет; вернётся в кадр — перемерим
      s.hidden = el.style.display === 'none'
      if (s.hidden) { s.size = null; return s }
      let size: Item['size']
      if (chip) {
        const one: Size = [el.offsetWidth, el.offsetHeight]   // чип — сам элемент w-who
        size = [one, one]
      } else {
        const board = el.querySelector<HTMLElement>('.w-sign__board'), sm = el.classList.contains('w-sign--sm')
        const both = board && [false, true].map((v): Size => { el.classList.toggle('w-sign--sm', v); return [board.offsetWidth, board.offsetHeight] })
        el.classList.toggle('w-sign--sm', sm)
        size = both ? [both[0]!, both[1]!] : null
      }
      s.size = size && size[0][0] ? size : null   // содержимого ещё нет — подпись скрыта, перемерим
      return s
    })
  }

  // Место вывески в виде lvl (0 — полная, 1 — компактная): сдвиг вбок и подъём, при которых
  // плашка никого не задевает с зазором gap. Сдвиг ограничен: ножка остаётся под плашкой,
  // плашка — в кадре. Из свободных мест — ближайшее к якорю.
  const placeSign = (s: Item, lvl: 0 | 1, taken: Rect[], gap: number) => {
    const [bw, bh] = s.size![lvl], leg = LEGS[lvl], reach = bw / 2 - 14
    // Якорь под обвязкой (здание закрыто плашкой) — вывеску не показываем: ножка уходила бы под плашку
    if (chrome.some((b) => s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h)) return null
    const lo = Math.max(-reach, HUD_EDGE - (s.x - bw / 2)), hi = Math.min(reach, w - HUD_EDGE - (s.x + bw / 2))
    if (lo > hi) return null
    let best: { cost: number; shift: number; lift: number; rect: Rect } | null = null
    for (const lift of LIFTS) {
      const top = s.y - leg - lift - bh
      if (lift > 0 && top < HUD_EDGE) continue
      const near = taken.filter((b) => b.y < top + bh + gap && b.y + b.h + gap > top)
      // Ножка не должна пересекать чужую плашку
      if (taken.some((b) => s.x > b.x - 4 && s.x < b.x + b.w + 4 && b.y < s.y && b.y + b.h > top + bh)) continue
      const free = (v: number) => near.every((b) => s.x - bw / 2 + v >= b.x + b.w + gap || s.x + bw / 2 + v <= b.x - gap)
      const tries = [Math.min(hi, Math.max(lo, 0)), ...near.flatMap((b) => [b.x - gap - (s.x + bw / 2), b.x + b.w + gap - (s.x - bw / 2)])]
      for (const v of tries) {
        if (v < lo || v > hi || !free(v)) continue
        const cost = Math.abs(v) + (lift < 0 ? 60 - lift : lift * 1.2)
        if (!best || cost < best.cost) best = { cost, shift: v, lift, rect: { x: s.x - bw / 2 + v, y: top, w: bw, h: bh } }
      }
    }
    return best
  }

  const layout = (now: number) => {
    if (stale) measure()
    if (!w) return
    const { hover, pick, hudCompact: sm } = store.getState()
    // Плашка догоняет новое место, а не прыгает; после паузы и в неподвижном мире — встаёт сразу
    const k = reduced || now - last > 400 ? 1 : 1 - Math.exp(-(now - last) / 1000 * 14)
    last = now
    for (const s of items) {
      at.setFromMatrixPosition(s.o.matrixWorld).project(ctx.camera)
      s.x = (at.x + 1) / 2 * w; s.y = (1 - at.y) / 2 * h; s.z = at.z
      const seen = s.o.visible && Math.abs(s.z) <= 1
      s.ok = !!s.size && seen
      if (seen && !s.size) {
        stale = true
        // Якорь только что вернулся в кадр: в неподвижном мире следующего кадра иначе не будет.
        // Нет содержимого — ждём оболочку, её разбудит наблюдатель.
        if (s.hidden) ctx.invalidate()
      }
      // Прижата к краю кадра: плашке и так придётся сдвинуться — место ей ищем раньше свободных соседок
      s.tight = s.ok && !s.chip && (s.x - s.size![1][0] / 2 < HUD_EDGE || s.x + s.size![1][0] / 2 > w - HUD_EDGE)
    }
    const taken = [...chrome]
    const rank = (s: Item) => s.id === pick ? 0 : s.id === hover ? 1 : 2
    for (const s of items.filter((v) => !v.chip).sort((a, b) => rank(a) - rank(b) || +b.tight - +a.tight || a.z - b.z)) {
      let fit: ReturnType<typeof placeSign> = null, lvl: 0 | 1 | 2 = 2
      if (s.ok) for (const v of sm ? [1] as const : [0, 1] as const) if ((fit = placeSign(s, v, taken, v < s.level && !s.fresh ? HUD_GAP + 10 : HUD_GAP))) { lvl = v; break }
      const was = s.level
      s.level = lvl
      s.fresh = false
      if (fit) {
        taken.push(fit.rect)
        const snap = was === 2 || k === 1
        s.shift = snap ? fit.shift : s.shift + (fit.shift - s.shift) * k
        s.lift = snap ? fit.lift : s.lift + (fit.lift - s.lift) * k
        const shift = `${s.shift.toFixed(1)}px`, lift = `${s.lift.toFixed(1)}px`
        if (shift + lift !== s.px) { s.px = shift + lift; s.el.style.setProperty('--shift', shift); s.el.style.setProperty('--lift', lift) }
      }
      if (was !== s.level) {
        if (fit) s.el.classList.toggle('w-sign--sm', lvl === 1)
        s.el.classList.toggle('is-away', !fit)
      }
    }
    const chips = items.filter((v) => v.chip).sort((a, b) => +(b.id === ctx.near) - +(a.id === ctx.near))
    for (const s of chips) {
      const near = s.id === ctx.near
      let show = s.ok && (near || !sm), rect: Rect | null = null
      if (show) {
        const [cw, ch] = s.size![0], box = rect = { x: s.x - cw / 2, y: s.y - ch, w: cw, h: ch }
        // Чип под указателем показываем всегда; остальным нужно свободное место (вернуться — с запасом)
        if (!near) show = box.x > 0 && box.y > 0 && box.x + cw < w && box.y + ch < h && !taken.some((b) => hits(box, b, s.level && !s.fresh ? 8 : 3))
      }
      if (show && rect) taken.push(rect)
      if (s.level !== +!show) { s.level = +!show; s.el.classList.toggle('is-away', !show) }
      s.fresh = false
      if (s.near !== near) { s.near = near; s.el.classList.toggle('is-near', near); s.el.style.translate = ''; s.dx = 0 }
      // Чип с фамилией шире обычного — у края кадра сдвигаем внутрь
      if (near && s.ok) {
        const half = s.el.offsetWidth / 2, dx = Math.round(Math.max(4 - (s.x - half), 0) + Math.min(w - 4 - (s.x + half), 0))
        if (dx !== s.dx) { s.dx = dx; s.el.style.translate = `${dx}px 0` }
      }
    }
  }

  return {
    layout,
    dirty,
    dispose() {
      disposed = true
      watch.disconnect()
    },
  }
}
