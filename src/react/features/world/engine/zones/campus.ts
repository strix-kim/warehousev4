// Кампус: земля, дороги, три здания, машины у гаража и фигурки сотрудников.
// Пока статично: движение (фургон, бригада, прохожие) придёт своим модулем.
import * as THREE from 'three'
import { carKind } from '../../data/carKinds'
import type { WorldData } from '../../data/types'
import { bayX, buildGarage, buildOffice, buildWarehouse } from '../buildings'
import { makeCar } from '../cars'
import type { WorldCtx } from '../createWorld'
import { CAMPUS_HALF, POS, ROAD_Z, ground, roads } from '../ground'
import { makePerson } from '../people'
import { kit } from '../primitives'

// Мест у гаража без фургона: три проёма и два на площадке
const PARKED = 5

// Место фигурки: [x, z, поворот, номер цвета одежды, с кейсом]
type Spot = readonly [x: number, z: number, rot: number, cloth: number, withCase: boolean]

// Места по порядку списка сотрудников: бригада с кейсами у рампы склада, трое на полосах
// (от склада, от офиса, вдоль главной дороги), шестеро стоят. Мест 13 — фигурок столько,
// сколько людей в данных, но не больше мест.
function peopleSpots(): Spot[] {
  const [OX, OZ] = POS.office, [WX, WZ] = POS.warehouse, [GX, GZ] = POS.garage
  const side = ROAD_Z - 1.7   // обочина главной дороги
  const crew: Spot[] = [[-6, 8.4], [-4.9, 8.6], [-3.8, 8.4], [-2.7, 8.6]]
    .map(([dx = 0, dz = 0], i) => [WX + dx, WZ + dz, 0.3, i, true])
  // Полосы прохожих: фигурка стоит на середине своей полосы лицом по ходу. У начала
  // полосы от склада стоит бригада — в неподвижном мире они бы слиплись.
  const lanes: Array<[[number, number], [number, number]]> = [
    [[WX - 4.6, WZ + 8], [WX - 4.6, side]], [[OX + 1.7, OZ + 5], [OX + 1.7, side]], [[GX + 7, side], [OX - 3, side]],
  ]
  const walkers: Spot[] = lanes.map(([[ax, az], [bx, bz]], i) => [(ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), i, false])
  const idle: Spot[] = [[OX + 4.2, OZ + 6.6, 2.6], [OX + 5, OZ + 7.1, -1.8], [WX + 10, WZ + 2.5, 1.2], [WX + 10.8, WZ + 3.2, -2.3], [GX - 7.4, GZ + 7.8, 0.4], [OX - 6, OZ + 9, 2.8]]
    .map(([x = 0, z = 0, rot = 0], i) => [x, z, rot, i + 1, false])
  return [...crew, ...walkers, ...idle]
}

export function buildCampus(ctx: WorldCtx, data: WorldData) {
  const g = new THREE.Group()
  ground(ctx, g, CAMPUS_HALF * 2)
  const k = kit(ctx)
  roads(ctx, k)
  k.into(g)

  // Фургон мероприятия — бортовой Bongo: стоит на площадке перед правым проёмом носом
  // к дороге, с кейсами на платформе. Нет его в парке — место занимает шестая машина.
  // Машины сверх шести на кампусе не стоят: весь парк — в гараже.
  const cars = [...data.cars]
  const vanAt = cars.findIndex((car) => carKind(car.brand, car.model) === 'bongo')
  const van = vanAt >= 0 ? cars.splice(vanAt, 1)[0] : cars[PARKED]
  g.add(buildOffice(ctx), buildWarehouse(ctx), buildGarage(ctx, cars.slice(0, PARKED)))
  if (van) {
    const [GX, GZ] = POS.garage, v = makeCar(ctx, van, true)
    v.position.set(GX + bayX(2), 0, GZ + 6.9)
    g.add(v)
  }

  const { cloth } = ctx.style.P
  const spots = peopleSpots()
  data.people.slice(0, spots.length).forEach((person, i) => {
    const [x, z, rot, c, withCase] = spots[i]!
    makePerson(ctx, g, x, z, rot, cloth[c % cloth.length]!, withCase).userData.id = person.id
  })
  return g
}
