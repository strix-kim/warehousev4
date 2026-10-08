// «Внутри» здания кампуса (сейчас только гараж; контракт — worldStore.ts, «Гараж») —
// часть экземпляра мира, вынесенная из createWorld.ts: просьба оболочки (World.goInside),
// подъезд камеры и отъезд, флаг ctx.inside и его зеркало в сторе.
// Хозяин — адрес: wish — последняя просьба оболочки, ctx.inside — камера уже приехала.
// Просьба не на кампусе или посреди переезда ждёт посадки на кампус; уход в другую зону
// её снимает.
import { ADD_CAR_ID, parseCarId, type WorldInside, type WorldZone } from '../worldStore'
import { aimHome, aimInside, type Flight } from './camera'
import type { WorldCtx, WorldDeps } from './createWorld'
import type { HudLayout } from './hudLayout'
import { zoneLabels } from './zones/layout'

// Состояние экземпляра, которое ведёт createWorld
type InsideEnv = {
  hud: HudLayout
  isCompact: () => boolean
  disposed: () => boolean
  // Пустить подводку камеры (неподвижный мир и мир до первого кадра — встаёт сразу).
  // done — камера встала либо подводку оборвали (рука человека, пересборка, ресайз)
  fly: (flight: Flight, done: () => void) => void
  // Остановить подводку там, где она есть; её done не зовётся
  halt: () => void
}

// Цель камеры ближе этого к цели подъезда — камера уже у здания, м
const NEAR_M = 8

export function createInside(ctx: WorldCtx, deps: WorldDeps, env: InsideEnv) {
  let wish: WorldInside | null = null
  // Подъезд начат, но камера ещё не встала
  let coming = false

  // То, что живёт только «внутри»: машина, место под новую
  const inner = (id: string | null) => id !== null && (id === ADD_CAR_ID || parseCarId(id) !== null)

  const set = (site: WorldInside | null) => {
    coming = false
    if (ctx.inside === site) return
    ctx.inside = site
    const { hover, pick } = deps.store.getState()
    // Вышли — машина больше не цель: её выбор и наведение снимаем
    deps.store.setState(site ? { inside: site } : { inside: null, hover: inner(hover) ? null : hover, pick: inner(pick) ? null : pick })
    // Якоря машин и «плюс» видны только внутри
    zoneLabels(ctx)
    const plus = ctx.pluses.get(ADD_CAR_ID)
    if (plus) plus.root.visible = site === 'garage'
    env.hud.dirty()   // он же просит кадр неподвижному миру
  }

  const approach = () => {
    const site = wish, root = site && ctx.roots.get(site)
    if (!site || !root) return
    const flight = aimInside(ctx, root, performance.now()), { camera, controls } = ctx
    const arrive = () => { if (wish === site) set(site) }
    // Камера уже у здания (оболочка вернула позу из истории, повторная просьба на отъезде)
    // — не дёргаем её
    if (controls.target.distanceTo(flight.t1) < NEAR_M && camera.position.distanceTo(controls.target) < flight.p1.distanceTo(flight.t1) * 1.5) {
      env.halt()
      arrive()
      return
    }
    coming = true
    env.fly(flight, arrive)
  }

  return {
    go(site: WorldInside | null) {
      if (env.disposed() || site === wish) return
      wish = site
      const here = ctx.zone === 'campus' && !ctx.flight
      if (site) {
        if (here) approach()
        return
      }
      const was = ctx.inside !== null || coming
      set(null)
      // Отъезд к рабочему ракурсу: поза снова «ничья» — ресайз пересчитывает её под окно
      if (was && here) env.fly(aimHome(ctx, env.isCompact(), performance.now()), () => { ctx.userMoved = false })
    },
    // Камера встала на зону: просьба, ждавшая посадки
    landed() {
      if (wish && !ctx.inside && !coming && ctx.zone === 'campus') approach()
    },
    // Камера уходит на зону to
    zone(to: WorldZone) {
      if (to === 'campus') return
      wish = null
      set(null)
    },
  }
}
