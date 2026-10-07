// Здания: у каждого свой силуэт и свой «жест».
// Диорама, а не макет района: ОФИС — эталон габаритов (≈12×10, высота 7,6, дверь 2,9),
// остальные здания — игрушки того же калибра. Здание — 8–20 объёмов, окна — 1–3 широкие
// ленты --select. Сомневаешься в детали — убрать.
import * as THREE from 'three'
import type { WorldCtx } from './createWorld'
import { POS, tree } from './ground'
import { kit } from './primitives'
import { mat, own } from './style'

// Здание: группа с собственным материалом корпуса (его подсвечивает наведение).
function building(ctx: WorldCtx, id: string, x: number, z: number) {
  const { P } = ctx.style
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const body = own(P.wall)
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
  return g
}
