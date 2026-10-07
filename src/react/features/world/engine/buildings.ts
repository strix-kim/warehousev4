// Здания: у каждого свой силуэт и свой «жест».
// Диорама, а не макет района: ОФИС — эталон габаритов (≈12×10, высота 7,6, дверь 2,9),
// остальные здания — игрушки того же калибра: склад ≤ 1,5 офиса, гараж шириной с офис.
// Здание — 8–20 объёмов, окна — 1–3 широкие ленты --select. Сомневаешься в детали — убрать.
import * as THREE from 'three'
import type { WorldCar } from '../data/types'
import { carLength, makeCar } from './cars'
import type { WorldCtx } from './createWorld'
import { POS, crate, tree } from './ground'
import { kit } from './primitives'
import { mat, own } from './style'

// Здание: группа с собственным материалом корпуса (его подсвечивает наведение).
// userData: top — высота под вывеску, ring — [x, z, радиус] кольца выбора на земле.
function building(ctx: WorldCtx, id: string, x: number, z: number) {
  const { P } = ctx.style
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const body = own(ctx.style, P.wall)
  g.userData = { id, mats: [body] }
  ctx.roots.set(id, g)
  // roofMass — крыша-объём: в палитрах, где она цвета стены, это тот же материал корпуса (один меш)
  return { g, body, roofMass: P.roofMass === P.wall ? body : mat(ctx.style, P.roofMass), k: kit(ctx) }
}

// Офис: Г-образный план, второй этаж консолью над входом, угол — стеклянный атриум
export function buildOffice(ctx: WorldCtx) {
  const [X, Z] = POS.office, { g, body, k } = building(ctx, 'office', X, Z)
  const { roof, glass, band, door, sign, signMark, dark, red } = ctx.style.roles
  k(body, 4.5, 7, 6, -3.75, 0, -1.5)                  // западное крыло, 2 этажа
  k(body, 7.5, 3.5, 5, 2.25, 0, 1.5)                  // южное крыло, первый этаж
  k(body, 7.5, 3.5, 6.5, 2.25, 3.5, 2.25)             // второй этаж — консоль наружу
  k.slab(roof, 4.7, 0.3, 6.2, -3.75, 7, -1.5)         // крыша крыла
  k(glass, 4.5, 7.6, 3, -3.75, 0, 3)                  // атриум во всю высоту
  k(band, 6.6, 1.3, 0.1, 2.25, 4.6, 5.52)             // лента окон консоли
  k(band, 0.1, 1.3, 4.4, -6.02, 4.6, -1.8)            // лента окон крыла
  k(door, 2.8, 2.9, 0.14, 2.25, 0, 4.02)              // вход — крупный проём
  // Вывеска ARGO на торце консоли: графит + три крупных красных кубика
  k(sign, 4.4, 1.5, 0.2, 2.25, 4.9, 5.66)
  for (const dx of [-1.1, 0, 1.1]) k(signMark, 0.7, 0.7, 0.3, 2.25 + dx, 5.3, 5.8)
  // Флаг у входа — крупнее «настоящего»
  k(dark, 0.3, 7.5, 0.3, 7.2, 0, 6.2)
  k(red, 2.2, 1.4, 0.12, 8.35, 5.9, 6.2)
  tree(ctx, k, -7.8, 5.6, 1.1)
  k.into(g)
  g.userData.top = 7.6
  g.userData.ring = [X, Z + 0.5, Math.hypot(12, 10) / 2 + 1.2]
  return g
}

// Склад: ангар с пилой из 3 зубьев, башня-офис с торца чуть выше офиса, рампа с навесом.
// Длина 17 = 1,4 офиса.
export function buildWarehouse(ctx: WorldCtx) {
  const [X, Z] = POS.warehouse, { g, body, roofMass, k } = building(ctx, 'warehouse', X, Z)
  const { roof, band, door, white, canopy, dark } = ctx.style.roles
  k(body, 13, 4.5, 9, -2, 0, 0)                       // ангар: x −8,5…4,5
  for (let t = 0; t < 3; t++) {
    const a = -8.5 + t * (13 / 3)
    k(roofMass, 2.9, 1, 9, a + 2.85, 4.5, 0)          // зуб: две ступени
    k(roofMass, 1.45, 1, 9, a + 3.6, 5.5, 0)
  }
  k(body, 4, 8.6, 5.5, 6.5, 0, -1.75)                 // башня: 8,6 против 7,6 у офиса
  k.slab(roof, 4.2, 0.4, 5.7, 6.5, 8.6, -1.75)
  k(band, 0.1, 1.2, 4.4, 8.52, 6, -1.75)              // лента окон башни
  k(band, 4.6, 0.9, 0.1, 1.6, 2.6, 4.52)              // лента окон ангара
  k(door, 3.6, 3.2, 0.14, -4, 0.9, 4.52)              // ворота у рампы
  k(white, 5, 0.9, 2, -4, 0, 5.5)                     // рампа
  k.slab(canopy, 6, 0.3, 2.6, -4, 4.2, 5.8)           // навес
  for (const x of [-6.6, -1.4]) k(dark, 0.35, 4.2, 0.35, x, 0, 6.9)
  crate(ctx, k, -5, 0.9, 5.3)
  crate(ctx, k, -4.2, 0.9, 5.9)
  k.into(g)
  g.userData.top = 9.4
  g.userData.ring = [X, Z + 0.5, Math.hypot(17, 11) / 2 + 1]
  return g
}

// Локальный x проёма гаража; им же размечена площадка перед воротами
export const bayX = (b: number) => -3.8 + b * 3.8

// Гараж: коробка шириной с офис, 3 проёма, односкатная крыша ступенями, мезонин.
// cars — до пяти машин: первые три стоят в проёмах передками наружу (остальное прячет
// коробка), ещё две — на площадке перед левым и средним проёмом. Место перед правым —
// за фургоном, его ставит кампус.
export function buildGarage(ctx: WorldCtx, cars: readonly WorldCar[]) {
  const [X, Z] = POS.garage, { g, body, roofMass, k } = building(ctx, 'garage', X, Z)
  const { band, door, sign, signMark } = ctx.style.roles
  k(body, 12, 4, 7, 0, 0, 0)
  k(door, 11.4, 3, 0.1, 0, 0, 3.52)                   // проёмы — одна тёмная лента
  for (const x of [-1.9, 1.9]) k(body, 0.5, 3, 0.3, x, 0, 3.6)   // простенки
  k.slab(roofMass, 12.2, 0.5, 4.5, 0, 4, -1.25)       // односкат: две ступени к задней стене
  k.slab(roofMass, 12.2, 0.5, 2, 0, 4.5, -2.5)
  k(body, 4.5, 2, 3, 3, 5, -1.9)                      // мезонин
  k(band, 3.6, 0.9, 0.1, 3, 5.6, -0.38)
  k(sign, 3.6, 1.1, 0.2, -2.5, 4.5, 0.6)              // вывеска
  for (const dx of [-0.6, 0.4]) k(signMark, 0.55, 0.55, 0.2, -2.5 + dx, 4.8, 0.75)
  k(mat(ctx.style, ctx.style.P.pad), 12, 0.03, 5, 0, 0, 6)   // площадка перед гаражом
  k.into(g)
  cars.slice(0, 5).forEach((car, i) => {
    const v = makeCar(ctx, car)
    if (i < 3) v.position.set(bayX(i), 0, 4.7 - carLength(car) / 2)
    else v.position.set(bayX(i - 3), 0, 6.6)
    g.add(v)
  })
  g.userData.top = 7
  g.userData.ring = [X, Z + 1, Math.hypot(12, 9) / 2 + 1]
  return g
}
