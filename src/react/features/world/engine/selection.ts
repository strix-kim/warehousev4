// Наведение и выбор: кольцо на земле у здания, ограда участка, «плюс» пустого места и
// классы подписи. Корпус и рёбра не меняются. Источник — стор: hover и pick пишут и
// движок (указатель), и оболочка (наведение и фокус на вывеске и клавише) — отзыв один,
// откуда бы значение ни пришло.
import * as THREE from 'three'
import { lotPartId, parseLotId, type WorldStore } from '../worldStore'
import type { WorldCtx } from './createWorld'
import { easeOut, glide, glideStep, still, type Glide } from './ease'
import { selectFence, settleFence, tickFence, tickPlus } from './fence'

// Ограда и «плюс» живут в fence.ts; строители зон и createWorld берут их отсюда
export { makeFence, makePlus, type Fence, type FencePlot, type Plus } from './fence'

type Flat = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>

/* Кольцо: наведение/фокус — тонкое серое (--ctl 0,6) за 150 мс от g0 к 1. Выбор —
   сплошной красный «пятак»: заливка растёт от центра за 300 мс, по краю кольцо того же
   цвета делает пульс 0,8 → 1,08 → 1 за 350 мс и в покое сливается с диском — один круг
   чуть шире серого. Снятие — кольцо и диск схлопываются за 150 мс. */
export type Ring = {
  gray: Flat; red: Flat; fill: Flat
  g0: number
  hovOn: boolean; selOn: boolean
  h: Glide; f: Glide
  // Начало пульса или схлопывания и масштаб красного кольца в этот момент
  sT0: number; s0: number
}

// Кольцо лежит в группе зоны, а не в здании. Геометрии и материалы — свои: их
// освобождает общий обход сцены (release в createWorld).
export function makeRing(ctx: WorldCtx, parent: THREE.Object3D, r: number, x: number, z: number, half = 0.16, g0 = 0.9, y = 0.08): Ring {
  const { P } = ctx.style
  const flatMesh = (geo: THREE.BufferGeometry, color: string, opacity: number, dy: number, order: number): Flat => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y + dy, z)
    m.renderOrder = order
    m.visible = false
    parent.add(m)
    return m
  }
  const disc = (w: number, color: string) => flatMesh(new THREE.RingGeometry(r - w, r + w, 72), color, 0, 0, 2)
  // Заливка на 5 мм выше кольца, но рисуется до него. Цвет один, шва нет: кольцо — край
  // диска. transparent + depthWrite: false — диск не z-файтит с землёй.
  const fill = flatMesh(new THREE.CircleGeometry(r, 72), P.ringSel, 1, 0.005, 1)
  return { gray: disc(half, P.ringHover), red: disc(half * 1.9, P.ringSel), fill, g0, hovOn: false, selOn: false, h: still(), f: still(), sT0: -1e9, s0: 0 }
}

function selectRing(ring: Ring, on: boolean, now: number) {
  if (ring.selOn === on) return
  ring.selOn = on
  ring.sT0 = now
  ring.s0 = ring.red.visible ? ring.red.scale.x : 0
}

// Сразу в покое «выбрано» — после пересборки сцены (смена облика), без повторного пульса
function settleRing(ring: Ring) {
  Object.assign(ring, { selOn: true, sT0: -1e9 })
  ring.f = still(1)
}

// Пульс: 0,8 → 1,08 за 45 % времени, затем → 1
const pulse = (k: number) => k < 0.45 ? 0.8 + 0.28 * easeOut(k / 0.45) : 1.08 - 0.08 * easeOut((k - 0.45) / 0.55)

export type Selection = {
  // Кадр колец; зовётся перед рендером сцены
  tick: (now: number) => void
  // Сцена пересобрана: кольца и подписи новые — вернуть им состояние стора без анимации
  rebuilt: () => void
  dispose: () => void
}

export function createSelection(ctx: WorldCtx, store: WorldStore, reduced: boolean): Selection {
  let { hover, pick } = store.getState()
  const paint = (id: string) => {
    const hot = hover === id, sel = pick === id
    const ring = ctx.rings.get(id)
    if (ring) {
      ring.hovOn = hot
      selectRing(ring, sel, performance.now())
    }
    const el = ctx.labels.get(id)?.element
    el?.classList.toggle('is-hover', hot)
    el?.classList.toggle('is-selected', sel)
    const plus = ctx.pluses.get(id)
    if (plus) plus.hovOn = hot
    // Ограда — одна на участок: отвечает наведению и выбору любой его части
    const lot = parseLotId(id)
    const fence = lot && ctx.fences.get(lotPartId('lot', lot.venueId))
    if (lot && fence) {
      const on = (v: string | null) => parseLotId(v)?.venueId === lot.venueId
      fence.hovOn = on(hover)
      selectFence(ctx, fence, on(pick), performance.now())
      // «Плюсы» выбранного участка — с подписью, что добавляется
      for (const part of ['addtruck', 'addplan', 'addcrew'] as const) ctx.labels.get(lotPartId(part, lot.venueId))?.element.classList.toggle('w-plus--cap', on(pick))
    }
  }

  const unsubscribe = store.subscribe(() => {
    const next = store.getState()
    if (next.hover === hover && next.pick === pick) return
    const touched = new Set([hover, pick, next.hover, next.pick])
    hover = next.hover
    pick = next.pick
    for (const id of touched) if (id) paint(id)
    ctx.invalidate()
  })

  const step = (v: Glide, now: number) => glideStep(v, now, reduced)
  // Доля пути анимации длиной dur от момента sT0; в неподвижном мире — сразу конец
  const span = (ring: Ring, now: number, dur: number) => reduced ? 1 : Math.min(1, Math.max(0, (now - ring.sT0) / dur))

  return {
    tick(now) {
      for (const r of ctx.rings.values()) {
        glide(r.h, r.hovOn && !r.selOn ? 1 : 0, 150, now)
        const p = step(r.h, now)
        r.gray.visible = p > 0.001
        r.gray.scale.setScalar(r.g0 + (1 - r.g0) * p)
        r.gray.material.opacity = 0.6 * p
        if (r.selOn) {
          const k = span(r, now, 350)
          r.red.visible = true
          r.red.scale.setScalar(pulse(k))
          r.red.material.opacity = Math.min(1, k * 4)
        } else {
          const s = r.s0 * (1 - easeOut(span(r, now, 150)))
          r.red.visible = s > 0.001
          r.red.scale.setScalar(Math.max(s, 0.001))
        }
        // Диск: от центра к краю за 300 мс, обратно за 150 мс
        glide(r.f, r.selOn ? 1 : 0, r.selOn ? 300 : 150, now)
        const f = step(r.f, now)
        r.fill.visible = f > 0.001
        r.fill.scale.setScalar(Math.max(f, 0.001))
      }
      for (const f of ctx.fences.values()) tickFence(f, now, reduced)
      for (const p of ctx.pluses.values()) tickPlus(p, now, reduced)
    },
    rebuilt() {
      if (hover) paint(hover)
      if (pick) {
        paint(pick)
        const ring = ctx.rings.get(pick)
        if (ring) settleRing(ring)
        // Ограда выбранного участка — тоже сразу в покое, без повторной волны
        const lot = parseLotId(pick)
        const fence = lot && ctx.fences.get(lotPartId('lot', lot.venueId))
        if (fence) settleFence(fence)
      }
    },
    dispose: unsubscribe,
  }
}
