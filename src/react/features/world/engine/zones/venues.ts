// «Площадки» — зона карты справа от кампуса: сетка участков 3 × 2, ближний ряд слева
// направо, потом дальний. Участок = здание места + грузовик у проезда (к месту привязан
// список) + отель слева спереди (есть расселение) + стол с макетом залов справа перед
// зданием (есть план залов). Чего у места нет — пустое место с «плюсом»; после
// последнего участка — одна пустая ячейка «Новая площадка».
// Колец на участках нет: наведение и выбор показывает ограда надела (selection.ts).
// Числа — из макета voxel-world-s51.html, раздел «Площадки (с50): квадрат мира».
import * as THREE from 'three'
import type { WorldCar, WorldVenue } from '../../data/types'
import { ADD_LOT_ID, lotPartId } from '../../worldStore'
import { makeCar } from '../cars'
import type { WorldCtx } from '../createWorld'
import { CAMPUS_HALF, ground } from '../ground'
import { hitPlane, pickable } from '../pointer'
import { kit, label } from '../primitives'
import { makeFence, makePlus, type FencePlot } from '../selection'
import { flat, mat } from '../style'
import { LOT_TOP, VENUE_KINDS } from './venueKinds'

type XZ = readonly [x: number, z: number]

// Ячейка сетки и число участков в зоне (3 × 2): места сверх шести в сцену не встают
const LOT_W = 18, LOT_D = 26, LOT_MAX = 6
const lotAt = (i: number): XZ => [(i % 3 - 1) * LOT_W, (i < 3 ? 0.5 : -0.5) * LOT_D]
// Блоки — в осях участка: центр в (0, 0), +z — к зрителю. LOT_LANE — ось проезда ряда.
const LOT_BLD: XZ = [0.5, -5], LOT_TRUCK: XZ = [2.6, 6.4], LOT_STAY: XZ = [-5.2, 6.4], LOT_PLAN: XZ = [5.9, 2.9], LOT_LANE = 11.5
// Надел — прямоугольник внутри ячейки: между соседними наделами улица 2 м, спереди —
// проезд ряда. Калитка в переднем бордюре стоит против съезда грузовика к проезду.
const PLOT: FencePlot = { hw: 8, z0: -11.4, z1: 9.8, curb: 0.4, gate: [3, 6] }
const PLOT_D = PLOT.z1 - PLOT.z0, PLOT_ZC = (PLOT.z0 + PLOT.z1) / 2
// Пустые места под отель и стол плана: центр и размер основания
const SLOTS = { addstay: [LOT_STAY, 4.4, 4.4], addplan: [LOT_PLAN, 3.2, 2.6] } as const

// Грузовик на разгрузке — силуэт бортового Bongo с кейсами. Это знак «к месту привязан
// список», а не машина из парка: какая машина везёт список, в данных места нет.
const TRUCK: WorldCar = { id: 'lot-truck', brand: 'Kia', model: 'Bongo', color: null, plate: '' }

// Полосы бордюра по периметру надела с разрывом-калиткой: put(ширина, глубина, x, z)
function plotCurb(put: (w: number, d: number, x: number, z: number) => void) {
  const { hw, z0, z1, curb: c, gate: [g0, g1] } = PLOT
  put(2 * hw, c, 0, z0 + c / 2)
  put(c, PLOT_D - 2 * c, -hw + c / 2, PLOT_ZC)
  put(c, PLOT_D - 2 * c, hw - c / 2, PLOT_ZC)
  put(g0 + hw, c, (g0 - hw) / 2, z1 - c / 2)
  put(hw - g1, c, (g1 + hw) / 2, z1 - c / 2)
}

// Блок участка: своя группа в зоне, корень и цель указателя под одним id
function block(ctx: WorldCtx, zone: THREE.Group, id: string, root: THREE.Group, x: number, z: number) {
  root.position.set(x, 0, z)
  zone.add(root)
  ctx.roots.set(id, root)
  pickable(ctx, root, id)
}

// Участок: здание места, земля надела с бордюром, площадка разгрузки. Цель «весь
// участок» — надел с половиной улиц вокруг (без проезда): пальцем другой цели у участка нет.
function buildLot(ctx: WorldCtx, zone: THREE.Group, venue: WorldVenue, X: number, Z: number) {
  const { style } = ctx, { P } = style, id = lotPartId('lot', venue.id)
  const g = new THREE.Group(), k = kit(ctx)
  const [top, ax, az] = VENUE_KINDS[venue.kind]({ ctx, g, k, body: mat(style, P.wall), roofMass: mat(style, P.roofMass), x: LOT_BLD[0], z: LOT_BLD[1] })
  // Вывески всех участков висят на одной высоте: соседние идут ровной лесенкой. У низкого
  // здания до этой высоты поднимается мачта — ножка вывески не висит в воздухе.
  if (top < LOT_TOP) k(style.roles.dark, 0.2, LOT_TOP - top + 0.4, 0.2, ax, top - 0.4, az)
  if (venue.gearCount !== null) {
    // Площадка разгрузки: пятно асфальта под грузовиком и съезд к проезду
    const road = flat(style, P.road), [tx, tz] = LOT_TRUCK
    k(road, 7.6, 0.05, 3.8, tx, 0, tz)
    k(road, 2.4, 0.05, LOT_LANE - 1.2 - tz - 1.9, tx + 2, 0, (tz + 1.9 + LOT_LANE - 1.2) / 2)
  }
  // Земля надела и бордюр: полоса в тон разметки, 0,1 м над землёй
  k(flat(style, P.pad), 2 * PLOT.hw, 0.02, PLOT_D, 0, 0, PLOT_ZC)
  plotCurb((w, d, x, z) => k(flat(style, P.mark), w, 0.1, d, x, 0, z))
  k.into(g)
  block(ctx, zone, id, g, X, Z)
  hitPlane(ctx, g, LOT_W, PLOT_D + 1.6, 0, PLOT_ZC, id)
  // Ограда — после целей: её блоки в raycast не идут
  ctx.fences.set(id, makeFence(ctx, g, PLOT))
  label(ctx, g, id, 'w-sign w-sign--lot', ax, LOT_TOP + 0.5, az)
}

// Отель расселения — меньше и уже здания места: башенка с тёмными лентами окон и красным
// кубом на крыше («здесь живут наши»)
function buildStay(ctx: WorldCtx) {
  const g = new THREE.Group(), k = kit(ctx), { roof, door, signMark } = ctx.style.roles
  k(mat(ctx.style, ctx.style.P.wall), 4.4, 6.4, 4.4, 0, 0, 0)
  k.slab(roof, 4.6, 0.3, 4.6, 0, 6.4, 0)
  for (const y of [2.6, 3.8, 5]) { k(door, 3.4, 0.6, 0.1, 0, y, 2.22); k(door, 0.1, 0.6, 3.4, 2.22, y, 0) }
  k(door, 1.4, 1.9, 0.14, 0, 0, 2.22)
  k(signMark, 0.8, 0.8, 0.8, 0, 6.7, 0)
  k.into(g)
  return g
}

// План залов — стол с макетом: тёмная столешница, на ней белые объёмы залов и красный
// кубик «мы здесь». Самый низкий блок участка: стоит между входом и разгрузкой и ничего
// не закрывает.
function buildPlan(ctx: WorldCtx) {
  const g = new THREE.Group(), k = kit(ctx), { roof, white, signMark } = ctx.style.roles
  k(mat(ctx.style, ctx.style.P.wall), 2.8, 0.9, 2.2, 0, 0, 0)
  k.slab(roof, 3.2, 0.2, 2.6, 0, 0.9, 0)
  k(white, 1.2, 0.4, 0.9, -0.7, 1.1, -0.5)
  k(white, 0.8, 0.3, 0.7, 0.8, 1.1, -0.6)
  k(white, 1.7, 0.25, 0.6, 0.35, 1.1, 0.6)
  k(signMark, 0.36, 0.36, 0.36, -1.05, 1.1, 0.65)
  k.into(g)
  return g
}

// Группа зоны в своих осях: центр квадрата в (0, 0), +z — к зрителю; на место в ряду её
// ставит zones/layout.ts. userData.frame — точки (в осях зоны), которые обязаны попасть
// в кадр, когда камера стоит на зоне: земля и место над крышами под вывески.
export function buildVenues(ctx: WorldCtx, venues: WorldVenue[]) {
  const g = new THREE.Group(), h = CAMPUS_HALF, k = kit(ctx), { style } = ctx
  ground(ctx, g, h * 2)
  // Проезд вдоль фронта каждого ряда, с осевой — как главная дорога кампуса: проезд
  // ближнего ряда её и продолжает
  const road = flat(style, style.P.road), mark = flat(style, style.P.mark)
  for (const row of [0.5, -0.5]) {
    const z = row * LOT_D + LOT_LANE
    k(road, h * 2, 0.04, 2.4, 0, 0, z)
    for (let x = -h + 0.5; x < h; x += 2) k(mark, 1, 0.05, 0.14, x + 0.5, 0, z)
  }
  k.into(g)

  const lots = venues.slice(0, LOT_MAX)
  lots.forEach((venue, i) => {
    const [X, Z] = lotAt(i)
    buildLot(ctx, g, venue, X, Z)
    if (venue.gearCount !== null) {
      // Стоит на разгрузке носом вдоль проезда
      const truck = makeCar(ctx, TRUCK, true)
      truck.rotation.y = Math.PI / 2
      block(ctx, g, lotPartId('truck', venue.id), truck, X + LOT_TRUCK[0], Z + LOT_TRUCK[1])
    }
    if (venue.stay) block(ctx, g, lotPartId('stay', venue.id), buildStay(ctx), X + LOT_STAY[0], Z + LOT_STAY[1])
    if (venue.hasPlan) block(ctx, g, lotPartId('plan', venue.id), buildPlan(ctx), X + LOT_PLAN[0], Z + LOT_PLAN[1])
    // Чего у места нет — пустое место под здание с «плюсом»
    for (const part of ['addstay', 'addplan'] as const) {
      if (part === 'addstay' ? venue.stay : venue.hasPlan) continue
      const [[x, z], w, d] = SLOTS[part]
      makePlus(ctx, g, lotPartId(part, venue.id), X + x, Z + z, w, d)
    }
  })
  // Одна пустая ячейка после последнего участка; сетка заполнена — ячейки нет
  if (lots.length < LOT_MAX) {
    const [X, Z] = lotAt(lots.length)
    makePlus(ctx, g, ADD_LOT_ID, X, Z + PLOT_ZC, 2 * PLOT.hw, PLOT_D)
  }

  // Кадр не зависит от числа мест: все шесть ячеек и запас над крышами под вывески
  const hw = LOT_W / 2 - 1, hd = LOT_D / 2 - 1
  g.userData.frame = Array.from({ length: LOT_MAX }, (_, i) => {
    const [X, Z] = lotAt(i)
    return [[X - hw, 0, Z - hd], [X + hw, 0, Z - hd], [X - hw, 0, Z + hd], [X + hw, 0, Z + hd], [X + LOT_BLD[0], LOT_TOP + 3.5, Z + LOT_BLD[1]]]
  }).flat().map(([x = 0, y = 0, z = 0]) => new THREE.Vector3(x, y, z))
  return g
}
