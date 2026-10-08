// Одна карта: три зоны в ряд вдоль главной дороги — «Где работали», кампус, «Площадки».
// Активная зона — та, на которой стоит камера (ctx.zone); остальные приглушены шейдером
// (uniform-ы зоны в style.ts), без вывесок, и целиком служат целью своей кнопки на
// земле. Между зонами промежуток ZONE_GAP: в нём лежит кнопка соседней зоны.
// Зона без источника данных не строится вовсе (решение 6 плана world-s51).
import * as THREE from 'three'
import type { WorldData } from '../../data/types'
import { gateId, WORLD_ZONES, type WorldInside, type WorldTexts, type WorldZone } from '../../worldStore'
import type { WorldCtx } from '../createWorld'
import { glide, glideStep } from '../ease'
import { GATE_MIN_WIDTH, makeGate, tickGates, type Gate } from '../groundLabel'
import { CAMPUS_HALF, POS, ROAD_Z } from '../ground'
import { collectPicks, hitPlane, pickable } from '../pointer'
import { kit } from '../primitives'
import { flat, setZoneDim, switchZone } from '../style'
import { buildArchive } from './archive'
import { buildCampus } from './campus'
import { buildVenues } from './venues'

// Зона — квадрат 56 × 56 м, шаг ряда 66 м
export const ZONE_HALF = 28
const ZONE_GAP = 10, ZONE_STEP = 2 * ZONE_HALF + ZONE_GAP
// Сдвиг зоны: x — по ряду; z — так, чтобы главная дорога (ROAD_Z) шла перед зоной: у
// «Площадок» с ней совпадает проезд ближнего ряда участков, архив отодвинут за дорогу.
// Кампус стоит в начале координат.
const ZONE_AT: Record<WorldZone, readonly [number, number]> = { archive: [-ZONE_STEP, -5], campus: [0, 0], venues: [ZONE_STEP, 0.75] }
// Приглушение перетекает за 520 мс
const DIM_MS = 520
// Кнопка зоны лежит в промежутке перед главной дорогой — ближе к зрителю, чем здания
// зон: её ничто не закрывает. w — вдоль промежутка, d — поперёк.
const SLAB = { w: 18, d: 6.6, x: ZONE_HALF + ZONE_GAP / 2, z: ROAD_Z + 1.25 + 1.5 + 9 }

export function zoneOffset(zone: WorldZone, out: THREE.Vector3) {
  const [x, z] = ZONE_AT[zone]
  return out.set(x, 0, z)
}

// Зоны, которые встанут на карту при этих данных, в порядке ряда
export function zonesOf(data: WorldData): WorldZone[] {
  return WORLD_ZONES.filter((zone) => zone === 'campus' || data[zone] !== null)
}

// Зона объекта — по группе зоны среди предков; у общего карты (кнопки, дорога) её нет
function zoneOfObject(o: THREE.Object3D | null): WorldZone | null {
  for (; o; o = o.parent) if (o.userData.zone) return o.userData.zone as WorldZone
  return null
}

// Собрать карту: группы зон на своих местах, дорога в промежутках, кнопки зон и цели
// «вся зона». Материалы каждой зоны — свои (switchZone), иначе соседа не приглушить.
export function buildMap(ctx: WorldCtx, data: WorldData, texts: WorldTexts) {
  const map = new THREE.Group(), { style } = ctx
  ctx.zones = zonesOf(data)
  for (const zone of ctx.zones) {
    switchZone(style, zone)
    const g = zone === 'campus' ? buildCampus(ctx, data) : zone === 'venues' ? buildVenues(ctx, data.venues ?? []) : buildArchive(ctx, data.archive ?? [])
    zoneOffset(zone, g.position)
    g.userData.zone = zone
    ctx.zoneRoots.set(zone, g)
    // Цель «вся зона»: приглушённый сосед отвечает кликом в любую точку
    hitPlane(ctx, g, 2 * ZONE_HALF, 2 * ZONE_HALF, 0, 0, `zone:${zone}`, 0.005)
    map.add(g)
  }
  const has = (zone: WorldZone) => ctx.zones.includes(zone)
  const road = (x0: number, x1: number) => {
    const k = kit(ctx), P = style.P
    k(flat(style, P.road), x1 - x0, 0.04, 2.5, (x0 + x1) / 2, 0, ROAD_Z)
    for (let x = x0 + 0.5; x < x1 - 1; x += 2) k(flat(style, P.mark), 1, 0.05, 0.14, x + 0.5, 0, ROAD_Z)
    k.into(map)
  }
  // Дорога перед архивом — его материалами (гаснет вместе с ним); в промежутках — общими
  if (has('archive')) { switchZone(style, 'archive'); road(-ZONE_STEP - ZONE_HALF, -ZONE_STEP + ZONE_HALF) }
  switchZone(style, 'map')
  if (has('archive')) road(-ZONE_STEP + ZONE_HALF, POS.garage[0] - 8)
  if (has('venues')) road(CAMPUS_HALF, ZONE_STEP - ZONE_HALF)
  // В промежутке две кнопки — в левую зону и в правую; видна та, что ведёт ОТ зоны под камерой
  WORLD_ZONES.slice(0, -1).forEach((left, gap) => {
    const right = WORLD_ZONES[gap + 1]!
    if (!has(left) || !has(right)) return
    for (const to of [left, right]) {
      const id = gateId(to, to === left ? right : left)
      const gate = makeGate(ctx, map, id, to, gap, texts.zones[to], { x: (gap ? 1 : -1) * SLAB.x, z: SLAB.z, w: SLAB.w, d: SLAB.d, rot: Math.PI / 2 })
      pickable(ctx, gate.g, id)
    }
  })
  // Здания кампуса — цели; до расстановки зон: без зоны приглушённый кампус отвечал бы
  // кликом по зданию (переход в раздел) вместо своей кнопки на земле
  collectPicks(ctx)
  // Зона у подписей и целей — по предкам: строители зон о ней не думают
  for (const o of ctx.picks) o.userData.zone = zoneOfObject(o)
  return map
}

// Подписи неактивных зон уходят со слоя камеры (CSS2DRenderer сверяет layers и ставит
// им display: none): группы зон остаются видимыми. Так же прячутся подписи, которые живут
// только «внутри» здания (userData.inside — якоря машин и «плюс» гаража), пока камера не
// там; им же по контракту пишется is-away. Зовётся после сборки, смены зоны и ctx.inside.
export function zoneLabels(ctx: WorldCtx) {
  for (const o of ctx.labels.values()) {
    const zone = zoneOfObject(o), inside = o.userData.inside as WorldInside | undefined
    const on = (!zone || zone === ctx.zone) && (!inside || inside === ctx.inside)
    o.layers.set(on ? 0 : 1)
    if (inside) o.element.classList.toggle('is-away', !on)
  }
}

// Видна кнопка, ведущая от зоны, под которую показаны кнопки (в переезде она прежняя:
// нажатая кнопка горит до посадки); в узкой сцене кнопок нет
const gatesOn = (ctx: WorldCtx) => ctx.container.clientWidth >= GATE_MIN_WIDTH
const gateShown = (ctx: WorldCtx, q: Gate) => q.to === (WORLD_ZONES.indexOf(ctx.zoneShown) > q.gap ? WORLD_ZONES[q.gap] : WORLD_ZONES[q.gap + 1])

// Кадр карты: уровни приглушения идут к цели, кнопки живут
export function tickZones(ctx: WorldCtx, now: number, hover: string | null) {
  for (const zone of WORLD_ZONES) {
    const v = ctx.zoneDim[zone]
    glide(v, zone === ctx.zone ? 0 : 1, DIM_MS, now)
    setZoneDim(ctx.style, zone, glideStep(v, now, ctx.reduced))
  }
  const on = gatesOn(ctx)
  tickGates(ctx, now, hover, (q) => on && gateShown(ctx, q))
}

// Новые строки (смена языка, чисел) — надписи перерисовываются на месте, без пересборки
export function retextGates(ctx: WorldCtx, texts: WorldTexts) {
  for (const q of ctx.gates.values()) q.retext(texts.zones[q.to].name, texts.zones[q.to].sub)
}

// Рамка кадра зоны под камерой, в осях мира. Кампус — габариты зданий (ctx.framePts);
// «Площадки» и «Где работали» — точки userData.frame своей группы (в осях зоны).
// Плюс кнопки соседних зон: ближний край соседа виден за ними.
export function zoneFrame(ctx: WorldCtx) {
  const zone = ctx.zone, off = zoneOffset(zone, new THREE.Vector3())
  const own = zone === 'campus' ? ctx.framePts : ((ctx.zoneRoots.get(zone)?.userData.frame as THREE.Vector3[] | undefined) ?? []).map((p) => p.clone().add(off))
  if (!gatesOn(ctx)) return own
  // С запасом: кнопка объёмная, ближний конец не должен уходить под обвязку
  const hd = SLAB.d / 2 + 0.6, hw = SLAB.w / 2 + 3, at = WORLD_ZONES.indexOf(zone), gates: THREE.Vector3[] = []
  for (const side of [-1, 1]) {
    const next = WORLD_ZONES[at + side]
    if (!next || !ctx.zones.includes(next)) continue
    const x = (at - 1 + side * 0.5) * ZONE_STEP
    for (const dx of [-hd, hd]) for (const dz of [-hw, hw]) gates.push(new THREE.Vector3(x + dx, 0, SLAB.z + dz))
  }
  return [...own, ...gates]
}
