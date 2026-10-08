// Кампус: земля, дороги, три здания с вывесками и кольцами выбора, машины у гаража
// и фигурки сотрудников с чипами имён.
// Движение фигурок (прохожие, покачивание стоящих) — engine/life.ts.
import * as THREE from 'three'
import type { WorldData, WorldPerson } from '../../data/types'
import { buildGarage, buildOffice, buildWarehouse } from '../buildings'
import type { WorldCtx } from '../createWorld'
import { CAMPUS_HALF, POS, ground, roads } from '../ground'
import { campusLanes, createLife, type Lane, type Walker } from '../life'
import { makePerson } from '../people'
import { kit, label } from '../primitives'
import { makeRing } from '../selection'
import { WORLD_SITES, whoLabelId } from '../../worldStore'
import { fillGarage } from './garage'

// Место фигурки: [x, z, поворот, номер цвета одежды]
type Spot = readonly [x: number, z: number, rot: number, cloth: number]

// Места кампуса: четыре у рампы склада (бригада), трое на полосах (life.ts — от склада,
// от офиса, вдоль главной дороги), шестеро стоят. Мест 13 — фигурок столько, сколько
// людей в данных, но не больше мест.
// Кто куда (buildCampus): у рампы с кейсом — «сборы» (WorldPerson.packing, до четырёх);
// остальные по порядку списка — на полосы, потом на стоячие места; кому не хватило —
// на свободные места у рампы, без кейса.
// Имя над каждой фигуркой видно всегда (прораб, с58), поэтому места расставлены под чип,
// а не под фигурку: с рабочего ракурса чип 390-й сцены занимает на земле ≈ 10 м поперёк
// взгляда и ≈ 6,5 м вдоль. Никакие два места не стоят ближе этого сразу по обеим осям
// (поперёк взгляда — x·0,73 − z·0,68, вдоль — x·0,68 + z·0,73) и не ближе 2 клеток
// вообще; крайние не выходят за ±26 м поперёк взгляда — чип не режет край телефона.
// Двигаешь место — проверь соседей по обеим осям; остаток разводит раскладка (hudLayout.ts).
// Это про места при сборке: прохожий в пути проходит мимо стоящих, и там чипы разводит
// только раскладка.
function peopleSpots(lanes: Lane[]) {
  const [OX, OZ] = POS.office, [WX, WZ] = POS.warehouse, [GX, GZ] = POS.garage
  const crew: Spot[] = [[6.7, 8], [-8.6, 9], [12.3, 15.6], [-3.9, 16.9]]
    .map(([dx = 0, dz = 0], i) => [WX + dx, WZ + dz, 0.3, i])
  const walkers: Spot[] = lanes.map(([[ax, az], [bx, bz], t], i) => [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az), i])
  const idle: Spot[] = [[OX + 1, OZ + 21.5, 2.6], [OX - 9.3, OZ + 19.3, -1.8], [WX + 8.5, WZ + 33.2, 1.2], [WX + 12.3, WZ + 41.7, -2.3], [OX - 8.6, OZ + 0.2, 0.4], [GX - 0.9, GZ - 4.7, 2.8]]
    .map(([x = 0, z = 0, rot = 0], i) => [x, z, rot, i + 1])
  return { crew, walkers, idle }
}

export function buildCampus(ctx: WorldCtx, data: WorldData) {
  const g = new THREE.Group()
  ground(ctx, g, CAMPUS_HALF * 2)
  const k = kit(ctx)
  roads(ctx, k)
  k.into(g)

  const garage = buildGarage(ctx)
  g.add(buildOffice(ctx), buildWarehouse(ctx), garage)
  // Парк: машины в проёмах и на площадке, место под новую
  fillGarage(ctx, g, garage, data.cars)
  for (const id of WORLD_SITES) {
    const root = ctx.roots.get(id)
    if (!root) continue
    // Вывеска: якорь — чуть выше крыши, на нём шляпка ножки
    label(ctx, root, id, 'w-sign', 0, (root.userData.top as number) + 0.5, 0)
    // Кольцо лежит в группе кампуса, а не в здании
    const [x, z, r] = root.userData.ring as [number, number, number]
    ctx.rings.set(id, makeRing(ctx, g, r, x, z))
  }

  const { cloth } = ctx.style.P
  const lanes = campusLanes(), spots = peopleSpots(lanes)
  const put = (person: WorldPerson, [x, z, rot, c]: Spot, withCase: boolean) => {
    const figure = makePerson(ctx, g, x, z, rot, cloth[c % cloth.length]!, withCase)
    figure.userData.id = person.id
    // Чип имени: фигурки — не объекты навигации, скринридеру их не читаем
    label(ctx, figure, whoLabelId(person.id), 'w-who', 0, 2.5, 0).element.setAttribute('aria-hidden', 'true')
    return figure
  }
  // «Сборы» — у рампы с кейсом; пятый и дальше встают со всеми
  const packers = data.people.filter((person) => person.packing).slice(0, spots.crew.length)
  const rest = data.people.filter((person) => !packers.includes(person))
  const standing = packers.map((person, i) => put(person, spots.crew[i]!, true))
  // Свободные места у рампы — последними: туда встают без кейса
  const seats = [...spots.walkers, ...spots.idle, ...spots.crew.slice(packers.length)]
  const walkers: Walker[] = []
  rest.slice(0, seats.length).forEach((person, i) => {
    const figure = put(person, seats[i]!, false)
    if (i < lanes.length) walkers.push({ figure, lane: lanes[i]! })
    else standing.push(figure)
  })
  createLife(ctx, walkers, standing)
  return g
}
