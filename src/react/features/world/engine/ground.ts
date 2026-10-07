// Земля кампуса: плоскость, сетка, дороги, фонари, дерево, кейс.
import * as THREE from 'three'
import type { WorldCtx } from './createWorld'
import type { Kit } from './primitives'
import { dimmed, flat } from './style'

export const CAMPUS_HALF = 28   // край сетки кампуса
export const ROAD_Z = 25.25     // ось главной дороги вдоль фронта кампуса
// Кампус по диагонали от камеры (правка прораба с47: с рабочего ракурса здания не
// перекрывают друг друга): гараж слева-спереди, офис по центру, склад справа-сзади.
export const POS = {
  office: [-1.4, -0.5],
  warehouse: [13.6, -20],
  garage: [-19.7, 15],
} as const satisfies Record<string, readonly [number, number]>

export function ground(ctx: WorldCtx, parent: THREE.Object3D, size: number) {
  const { P } = ctx.style
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), flat(ctx.style, P.ground))
  plane.rotation.x = -Math.PI / 2
  parent.add(plane)
  // Сетка шагом 1 м: цвет --ink с низкой непрозрачностью, как --grid в токенах
  const grid = new THREE.GridHelper(size, size, P.grid, P.grid)
  grid.material.transparent = true
  grid.material.opacity = P.gridA
  grid.material.depthWrite = false
  dimmed(ctx.style, grid.material)
  grid.position.y = 0.06
  parent.add(grid)
}

// Дорожки — короткие светлые полосы без бордюров; два толстых фонаря.
// Главная дорога — вдоль фронта, от площадки гаража направо за край сетки (выезд);
// к ней от входа в офис и от рампы склада — по прямой полосе.
export function roads(ctx: WorldCtx, k: Kit) {
  const { P, roles } = ctx.style
  const road = flat(ctx.style, P.road), mark = flat(ctx.style, P.mark)
  const [OX, OZ] = POS.office, [WX, WZ] = POS.warehouse, [GX] = POS.garage, r0 = ROAD_Z - 1.25
  const rect = (x0: number, x1: number, z0: number, z1: number) => k(road, x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2)
  rect(GX - 8, CAMPUS_HALF + 4, r0, r0 + 2.5)
  // Осевая пунктиром --ctl: без неё полотно --line на фоне --bg не читается как дорога
  for (let x = GX - 7; x < CAMPUS_HALF + 4; x += 2) k(mark, 1, 0.05, 0.14, x + 0.5, 0, ROAD_Z)
  rect(WX - 5.25, WX - 2.75, WZ + 6.5, r0)
  rect(OX + 1.1, OX + 3.4, OZ + 4.1, r0)
  const lamps: Array<[number, number]> = [[OX + 5, r0 - 1.2], [WX - 6.6, WZ + 9]]
  for (const [x, z] of lamps) {
    k(roles.dark, 0.35, 3.6, 0.35, x, 0, z)
    k(roles.glass, 0.9, 0.7, 0.9, x, 3.6, z)
  }
}

// Дерево-игрушка: куб-ствол + одна-две крупные сильно скруглённые кроны
export function tree(ctx: WorldCtx, k: Kit, x: number, z: number, s = 1) {
  const { dark, leaf } = ctx.style.roles
  k(dark, 0.5 * s, 1.6 * s, 0.5 * s, x, 0, z)
  const crown = (w: number, h: number, d: number, cx: number, y0: number, cz: number) => k(leaf, w, h, d, cx, y0, cz, 0, 0.3 * Math.min(w, h, d))
  crown(2.6 * s, 2.2 * s, 2.6 * s, x, 1.6 * s, z)
  if (s > 1) crown(1.5, 1.2, 1.5, x + 0.2, 1.6 * s + 2.2 * s, z - 0.1)
}

// Кейс — один графитовый куб
export function crate(ctx: WorldCtx, k: Kit, x: number, y0: number, z: number, s = 0.7) {
  k(ctx.style.roles.dark, s, s, s, x, y0, z)
}
