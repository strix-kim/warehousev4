// Зона под камерой и переезд между зонами — часть экземпляра мира, вынесенная из
// createWorld.ts: посадка камеры, смена зоны, просьба оболочки (goZone), клик по
// объекту сцены и кнопке на земле (ctx.activate).
import type { Object3D } from 'three'
import { isAddId, WORLD_ZONES, type WorldZone } from '../worldStore'
import { limitTo, placeCamera, startFlight } from './camera'
import type { WorldCtx, WorldDeps } from './createWorld'
import { still } from './ease'
import { handOver } from './groundLabel'
import type { HudLayout } from './hudLayout'
import { zoneLabels } from './zones/layout'

// Состояние экземпляра, которое ведёт createWorld: читается на момент вызова
type TravelEnv = {
  hud: HudLayout
  isCompact: () => boolean
  // Первый кадр уже нарисован; камера расставлена под окно; мир снесён
  seenFrame: () => boolean
  placed: () => boolean
  disposed: () => boolean
  // Камера встала на зону — после переезда или сразу: отложенная подводка (World.focus)
  landed: () => void
}

// Зона объекта — по группе зоны среди предков (userData.zone ставит buildMap); у общего
// карты (кнопки зон, дорога) её нет
export function zoneOf(o: Object3D | null | undefined): WorldZone | null {
  for (; o; o = o.parent) if (o.userData.zone) return o.userData.zone as WorldZone
  return null
}

export function createZoneTravel(ctx: WorldCtx, deps: WorldDeps, env: TravelEnv) {
  // Камера встала на зону: позу покоя считаем заново (окно могло смениться), кнопки на
  // земле — под новую зону, нажатая гаснет. Её место в промежутке занимает двойник
  // (кнопка обратно) — он перенимает вдавленное состояние и отжимается плавно.
  function land() {
    ctx.flight = null
    ctx.controls.enabled = true
    ctx.zoneShown = ctx.zone
    const gates = [...ctx.gates.values()]
    for (const gate of gates) {
      if (!gate.lit) continue
      const twin = gates.find((q) => q.gap === gate.gap && q !== gate)
      if (twin) handOver(gate, twin)
    }
    for (const gate of gates) gate.lit = false
    ctx.userMoved = false
    placeCamera(ctx, env.isCompact())
    deps.store.setState({ flying: false })
    env.hud.dirty()
    env.landed()
  }

  // Зона из адреса (последняя просьба оболочки) и зона под камерой: расходятся, пока у
  // запрошенной нет данных
  let wanted: WorldZone = deps.zone ?? 'campus'
  // Сменить зону под камерой. fly — переезд по карте; иначе камера встаёт сразу
  // (неподвижный мир, сборка мира, пропавшая зона).
  const enterZone = (to: WorldZone, fly: boolean) => {
    const from = ctx.zone
    if (ctx.flight) land()
    ctx.zone = to
    limitTo(ctx.limit, to)
    zoneLabels(ctx)
    deps.store.setState({ zone: to, hover: null, pick: null, flying: fly })
    if (fly) startFlight(ctx, from, env.isCompact(), performance.now())
    else {
      ctx.zoneShown = to
      // Без переезда приглушение не перетекает, а встаёт
      for (const zone of WORLD_ZONES) ctx.zoneDim[zone] = still(zone === to ? 0 : 1)
      ctx.userMoved = false
      if (env.placed()) placeCamera(ctx, env.isCompact())
    }
    env.hud.dirty()
    if (!fly) env.landed()
  }
  const goZone = (zone: WorldZone) => {
    if (env.disposed()) return
    wanted = zone
    const to = ctx.zones.includes(zone) ? zone : 'campus'
    if (to !== ctx.zone) enterZone(to, !deps.reducedMotion && env.seenFrame())
  }

  // Клик по кнопке зоны: она загорается и держит свет до посадки; зону меняет адрес
  // (оболочка зовёт goZone). Переезд не начался — короткая вспышка.
  ctx.activate = (id) => {
    const gate = ctx.gates.get(id)
    if (!gate) {
      // «Плюс» — действие, а не выбор
      if (!isAddId(id)) deps.store.setState({ pick: id })
      deps.onActivate?.(id)
      return
    }
    gate.lit = true
    ctx.invalidate()
    deps.onZone?.(gate.to)
    window.setTimeout(() => { if (!ctx.flight && gate.lit) { gate.lit = false; ctx.invalidate() } }, 260)
  }

  // Сцена собрана заново. Зона из адреса могла появиться (данные пришли) или пропасть:
  // камера встаёт без переезда. same — состав зон не изменился.
  const settle = (same: boolean) => {
    const to = ctx.zones.includes(wanted) ? wanted : 'campus'
    if (to !== ctx.zone) enterZone(to, false)
    else {
      zoneLabels(ctx)
      // У кампуса появились или пропали соседи — в рамку вошли или вышли их кнопки
      if (!same && env.placed() && !ctx.userMoved) placeCamera(ctx, env.isCompact())
    }
  }

  return { land, goZone, settle }
}
