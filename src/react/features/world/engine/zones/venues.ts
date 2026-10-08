// «Площадки» — зона карты справа от кампуса: сетка участков 3 × 2, ближний ряд слева
// направо, потом дальний. Участок = мероприятие: здание места + грузовик у проезда (у
// мероприятия есть списки) + стол с макетом залов справа перед зданием (есть план
// залов). Грузовика или стола нет — пустое место с «плюсом». Всегда стоят кафе слева
// спереди (обеды) и отель расселения слева от здания места: расселения в базе нет,
// отель заперт — окна тёмные, вход за шлагбаумом. Над кафе и отелем — якоря табличек
// (w-tag), текст в них кладёт оболочка. После последнего участка — одна пустая ячейка
// «Новое мероприятие».
// Колец на участках нет: наведение и выбор показывает ограда надела (selection.ts).
// Числа — из макета voxel-world-s51.html, раздел «Площадки (с50): квадрат мира».
import * as THREE from 'three'
import { LOT_MAX } from '../../data/splitProjects'
import type { WorldCar, WorldLot } from '../../data/types'
import { ADD_LOT_ID, lotPartId } from '../../worldStore'
import { makeCar } from '../cars'
import type { WorldCtx } from '../createWorld'
import { CAMPUS_HALF, ground } from '../ground'
import { hitPlane, pickable } from '../pointer'
import { kit, label } from '../primitives'
import { makeFence, makePlus, type FencePlot } from '../selection'
import { flat, mat } from '../style'
import { LOT_SIGN_Y, LOT_TOP, VENUE_KINDS, VENUE_SCALE } from './venueKinds'

type XZ = readonly [x: number, z: number]

// Ячейка сетки (3 × 2, LOT_MAX участков): мероприятия сверх шести в сцену не встают
const LOT_W = 18, LOT_D = 26
const lotAt = (i: number): XZ => [(i % 3 - 1) * LOT_W, (i < 3 ? 0.5 : -0.5) * LOT_D]
// Блоки — в осях участка: центр в (0, 0), +z — к зрителю. LOT_LANE — ось проезда ряда.
const LOT_BLD: XZ = [0.5, -5], LOT_TRUCK: XZ = [2.6, 6.4], LOT_PLAN: XZ = [5.9, 2.9], LOT_LANE = 11.5
// Кафе — слева от площадки разгрузки, отель — слева от здания места, на линии его
// фасада: камера смотрит справа спереди, так он не закрыт зданием и сам не закрывает кафе
const LOT_CAFE: XZ = [-4.9, 5.4], LOT_STAY: XZ = [-5.9, -3.6]
// Надел — прямоугольник внутри ячейки: между соседними наделами улица 2 м, спереди —
// проезд ряда. Калитка в переднем бордюре стоит против съезда грузовика к проезду.
const PLOT: FencePlot = { hw: 8, z0: -11.4, z1: 9.8, curb: 0.4, gate: [3, 6] }
const PLOT_D = PLOT.z1 - PLOT.z0, PLOT_ZC = (PLOT.z0 + PLOT.z1) / 2
// Пустые места под грузовик и стол плана: центр и размер основания
const SLOTS = { addtruck: [LOT_TRUCK, 5.4, 2.6], addplan: [LOT_PLAN, 3.2, 2.6] } as const

// Грузовик на разгрузке — силуэт бортового Bongo с кейсами. Это знак «у мероприятия
// есть списки», а не машина из парка: связи машин с мероприятиями в схеме нет.
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
function buildLot(ctx: WorldCtx, zone: THREE.Group, lot: WorldLot, X: number, Z: number) {
  const { style } = ctx, { P } = style, id = lotPartId('lot', lot.id)
  const g = new THREE.Group(), k = kit(ctx)
  // Здание — своей группой в размерах чертежа, уменьшенной целиком (VENUE_SCALE):
  // контур и силуэт толщиной в пикселях, от масштаба не тоньше
  const bld = new THREE.Group(), kb = kit(ctx)
  bld.position.set(LOT_BLD[0], 0, LOT_BLD[1])
  bld.scale.setScalar(VENUE_SCALE)
  const [top, bx, bz] = VENUE_KINDS[lot.kind]({ ctx, g: bld, k: kb, body: mat(style, P.wall), roofMass: mat(style, P.roofMass), x: 0, z: 0 })
  // Вывески всех участков висят на одной высоте: соседние идут ровной лесенкой. У низкого
  // здания до этой высоты поднимается мачта — ножка вывески не висит в воздухе.
  if (top < LOT_TOP) kb(style.roles.dark, 0.2, LOT_TOP - top + 0.4, 0.2, bx, top - 0.4, bz)
  kb.into(bld)
  g.add(bld)
  // Точка над крышей — в осях участка
  const ax = LOT_BLD[0] + bx * VENUE_SCALE, az = LOT_BLD[1] + bz * VENUE_SCALE
  if (lot.lists > 0) {
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
  label(ctx, g, id, 'w-sign w-sign--lot', ax, LOT_SIGN_Y + 0.5, az)
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

// Кафе — низкий павильон с маркизой и парой столиков перед входом: обеды мероприятия.
// Самый низкий дом участка: здание места и вывеску не закрывает.
function buildCafe(ctx: WorldCtx) {
  const g = new THREE.Group(), k = kit(ctx), { roof, glass, door, canopy, dark, white, signMark } = ctx.style.roles
  k(mat(ctx.style, ctx.style.P.wall), 3.2, 2.1, 2.2, 0, 0, -0.9)
  k.slab(roof, 3.4, 0.2, 2.4, 0, 2.1, -0.9)
  k(glass, 1.5, 0.8, 0.1, 0.6, 0.9, 0.22)                      // витрина
  k(door, 0.8, 1.6, 0.12, -0.9, 0, 0.22)
  k.slab(canopy, 3.4, 0.16, 1.3, 0, 1.75, 0.85)               // маркиза
  k(signMark, 3.4, 0.14, 0.1, 0, 1.62, 1.5)                    // её красная кромка
  for (const dx of [-0.85, 0.85]) {                            // столики
    k(dark, 0.12, 0.62, 0.12, dx, 0, 2)
    k.slab(white, 0.7, 0.1, 0.7, dx, 0.62, 2)
  }
  k.into(g)
  return g
}

// Основание и высота отеля расселения в чертеже (до масштаба VENUE_SCALE)
const STAY_SIDE = 3.6, STAY_TOP = 5.6

// Отель расселения — башенка меньше и уже здания места, уменьшена тем же VENUE_SCALE.
// Заперт: окна и вход тёмные (не светятся и в «Ночи»), перед входом шлагбаум.
function buildStay(ctx: WorldCtx) {
  const g = new THREE.Group(), k = kit(ctx), { roof, dark, white, signMark } = ctx.style.roles, f = STAY_SIDE / 2 + 0.02
  g.scale.setScalar(VENUE_SCALE)
  k(mat(ctx.style, ctx.style.P.wall), STAY_SIDE, STAY_TOP, STAY_SIDE, 0, 0, 0)
  k.slab(roof, STAY_SIDE + 0.2, 0.3, STAY_SIDE + 0.2, 0, STAY_TOP, 0)
  for (const y of [2.2, 3.4, 4.6]) { k(dark, 2.8, 0.6, 0.1, 0, y, f); k(dark, 0.1, 0.6, 2.8, f, y, 0) }   // окна — на двух видимых гранях
  k(dark, 1.2, 1.7, 0.14, 0, 0, f)
  for (const dx of [-1.9, 1.9]) k(dark, 0.3, 1.3, 0.3, dx, 0, 2.7)                                       // шлагбаум
  k(white, 3.8, 0.22, 0.22, 0, 0.95, 2.7)
  for (const dx of [-1.2, 0, 1.2]) k(signMark, 0.6, 0.26, 0.26, dx, 0.93, 2.7)
  k.into(g)
  return g
}

// Группа зоны в своих осях: центр квадрата в (0, 0), +z — к зрителю; на место в ряду её
// ставит zones/layout.ts. userData.frame — точки (в осях зоны), которые обязаны попасть
// в кадр, когда камера стоит на зоне: земля и место над крышами под вывески.
export function buildVenues(ctx: WorldCtx, venues: WorldLot[]) {
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
  lots.forEach((lot, i) => {
    const [X, Z] = lotAt(i)
    buildLot(ctx, g, lot, X, Z)
    if (lot.lists > 0) {
      // Стоит на разгрузке носом вдоль проезда
      const truck = makeCar(ctx, TRUCK, true)
      truck.rotation.y = Math.PI / 2
      block(ctx, g, lotPartId('truck', lot.id), truck, X + LOT_TRUCK[0], Z + LOT_TRUCK[1])
    }
    if (lot.hasPlan) block(ctx, g, lotPartId('plan', lot.id), buildPlan(ctx), X + LOT_PLAN[0], Z + LOT_PLAN[1])
    // Кафе и запертый отель стоят всегда; над каждым — якорь таблички (в осях своей группы)
    const cafe = buildCafe(ctx), stay = buildStay(ctx)
    block(ctx, g, lotPartId('cafe', lot.id), cafe, X + LOT_CAFE[0], Z + LOT_CAFE[1])
    label(ctx, cafe, lotPartId('cafe', lot.id), 'w-tag', 0, 2.8, -0.9)
    block(ctx, g, lotPartId('stay', lot.id), stay, X + LOT_STAY[0], Z + LOT_STAY[1])
    label(ctx, stay, lotPartId('stay', lot.id), 'w-tag', 0, STAY_TOP + 0.9, 0)
    // Грузовика или стола у мероприятия нет — пустое место с «плюсом»
    for (const part of ['addtruck', 'addplan'] as const) {
      if (part === 'addtruck' ? lot.lists > 0 : lot.hasPlan) continue
      const [[x, z], w, d] = SLOTS[part]
      makePlus(ctx, g, lotPartId(part, lot.id), X + x, Z + z, w, d)
    }
  })
  // Одна пустая ячейка после последнего участка; сетка заполнена — ячейки нет
  if (lots.length < LOT_MAX) {
    const [X, Z] = lotAt(lots.length)
    makePlus(ctx, g, ADD_LOT_ID, X, Z + PLOT_ZC, 2 * PLOT.hw, PLOT_D)
  }

  // Кадр не зависит от числа участков: все шесть ячеек и запас над крышами под вывески
  const hw = LOT_W / 2 - 1, hd = LOT_D / 2 - 1
  g.userData.frame = Array.from({ length: LOT_MAX }, (_, i) => {
    const [X, Z] = lotAt(i)
    return [[X - hw, 0, Z - hd], [X + hw, 0, Z - hd], [X - hw, 0, Z + hd], [X + hw, 0, Z + hd], [X + LOT_BLD[0], LOT_SIGN_Y + 3.5, Z + LOT_BLD[1]]]
  }).flat().map(([x = 0, y = 0, z = 0]) => new THREE.Vector3(x, y, z))
  return g
}
