// Парк у гаража (Э4 плана world-game-s59; контракт — worldStore.ts, «Гараж»). Мест —
// CAR_MAX: три проёма (машина стоит передком наружу, остальное прячет коробка), три на
// площадке перед ними и ещё два в тот же ряд правее площадки. Машины встают по порядку
// списка; фургон мероприятия — бортовой Bongo с кейсами на платформе — всегда на площадке
// перед правым проёмом носом к дороге. Машины сверх мест в сцену не встают.
// Машина — дитя гаража: входит в его габарит (рамка кадра кампуса) и на кампусе отвечает
// указателю как само здание. «Внутри» (ctx.inside) цель — машина: её id лежит в
// userData.car мешей, разбирает pointer.ts. У каждой — корень под carId, кольцо выбора
// на земле и якорь таблички (w-tag); место под новую машину — «плюс» ADD_CAR_ID на первом
// свободном месте площадки или ряда: пустой проём закрыт лентой ворот, «плюс» в нём не
// был бы виден. Якоря и «плюс» вне гаража скрыты (userData.inside — zones/layout.ts).
import * as THREE from 'three'
import { carKind } from '../../data/carKinds'
import type { WorldCar } from '../../data/types'
import { ADD_CAR_ID, carId, type WorldInside } from '../../worldStore'
import { bayX } from '../buildings'
import { carLength, makeCar } from '../cars'
import type { WorldCtx } from '../createWorld'
import { POS } from '../ground'
import { label } from '../primitives'
import { makePlus, makeRing } from '../selection'

const SITE: WorldInside = 'garage'
const BAYS = 3, VAN_SLOT = 5, CAR_MAX = 8
// В осях гаража: z передка машины в проёме, z центра машины на площадке и фургона
const BAY_NOSE = 4.7, PAD_Z = 6.6, VAN_Z = 6.9
// Место под новую машину: основание пунктира
const SPOT_W = 2.6, SPOT_D = 5
// Таблички (w-tag) двух рядов одного столбца на экране стояли друг на друге: якорь над
// передком машины в проёме и якорь над крышей машины перед ним разделяли ~20 px при
// плашке 28 px. Задний ряд поднят на перемычку над проёмом (стена — 4 м, лента ворот —
// до 3 м), крайние столбцы разведены от среднего: в ряду плашке шире шага столбца тесно
const BAY_TAG_Y = 3.6, TAG_SPREAD = 0.3

// Локальный x места: проём или место ряда перед ним (с четвёртого — правее площадки)
const slotX = (slot: number) => bayX(slot < BAYS ? slot : slot - BAYS)

// zone — группа кампуса: кольца и «плюс» лежат в ней, а не в здании (иначе стали бы
// целью «гараж» вместе с его мешами)
export function fillGarage(ctx: WorldCtx, zone: THREE.Group, garage: THREE.Group, all: readonly WorldCar[]) {
  const [GX, GZ] = POS.garage
  const cars = [...all]
  const vanAt = cars.findIndex((car) => carKind(car.brand, car.model) === 'bongo')
  const van = vanAt >= 0 ? cars.splice(vanAt, 1)[0] : undefined
  // Место фургона остальные обходят; нет его в парке — оно обычное
  const free = Array.from({ length: CAR_MAX }, (_, i) => i).filter((slot) => !van || slot !== VAN_SLOT)
  const parked: Array<readonly [WorldCar, number]> = cars.slice(0, free.length).map((car, i) => [car, free[i]!])
  if (van) parked.push([van, VAN_SLOT])

  for (const [car, slot] of parked) {
    const id = carId(car.id), bay = slot < BAYS, len = carLength(car)
    const v = makeCar(ctx, car, car === van)
    const x = slotX(slot), z = bay ? BAY_NOSE - len / 2 : car === van ? VAN_Z : PAD_Z
    v.position.set(x, 0, z)
    v.traverse((o) => { o.userData.car = id })
    garage.add(v)
    ctx.roots.set(id, v)
    // Табличка — над крышей; у машины в проёме крыша под коробкой гаража — над передком,
    // на перемычке. Столбцы правее среднего сдвинуты вместе: шаг между ними прежний
    const tagX = Math.sign((bay ? slot : slot - BAYS) - 1) * TAG_SPREAD
    label(ctx, v, id, 'w-tag', tagX, bay ? BAY_TAG_Y : (v.userData.top as number) + 0.5, bay ? len / 2 - 0.6 : 0).userData.inside = SITE
    // Кольцо: у машины в проёме из-под ворот видна только его передняя половина
    ctx.rings.set(id, makeRing(ctx, zone, bay ? 1.5 : 1.9, GX + x, GZ + (bay ? BAY_NOSE - 0.5 : z), 0.07, 0.9, 0.09))
  }

  // Место под новую машину — всегда одно
  const used = new Set(parked.map(([, slot]) => slot))
  let spot = BAYS
  while (used.has(spot)) spot++
  const plus = makePlus(ctx, zone, ADD_CAR_ID, GX + slotX(spot), GZ + PAD_Z, SPOT_W, SPOT_D)
  plus.root.visible = ctx.inside === SITE
  ctx.labels.get(ADD_CAR_ID)!.userData.inside = SITE

  // Кадр «внутри», в осях гаража (camera.ts, aimInside): фасад с проёмами, площадка и ряд
  // до последнего занятого места и «плюса», запас над машинами под таблички
  const x0 = -6.3, x1 = Math.max(6.3, slotX(Math.max(spot, ...used)) + SPOT_W / 2 + 0.6), front = PAD_Z + SPOT_D / 2 + 0.4
  garage.userData.view = [[x0, 0, 3.5], [x1, 0, 3.5], [x0, 4.2, 3.5], [6.3, 4.2, 3.5], [x0, 0, front], [x1, 0, front], [x0, 3.2, front], [x1, 3.2, front]]
    .map(([x = 0, y = 0, z = 0]) => new THREE.Vector3(x, y, z))
}
