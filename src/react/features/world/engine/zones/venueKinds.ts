// Здания мест «Площадок»: силуэт — по типу места. Тот же игрушечный калибр, что у офиса
// кампуса (≈ 11 × 9, высота до 9). Числа — из макета voxel-world-s51.html (VENUE_KINDS).
import * as THREE from 'three'
import type { WorldVenueKind } from '../../data/types'
import type { WorldCtx } from '../createWorld'
import { solid, type Kit } from '../primitives'

// Самое высокое здание места: на этой высоте висят вывески всех участков, под неё
// рассчитан кадр зоны
export const LOT_TOP = 9.3

// Что строитель участка даёт зданию: сборка, группа участка (в неё идут круглые объёмы
// мимо сборки), материалы корпуса и крыши-объёма, (x, z) — центр здания в осях участка
export type VenueShell = {
  ctx: WorldCtx
  g: THREE.Group
  k: Kit
  body: THREE.MeshLambertMaterial
  roofMass: THREE.MeshLambertMaterial
  x: number
  z: number
}
// Точка на крыше, над которой встанет вывеска: [высота, x, z]
type RoofPoint = readonly [top: number, x: number, z: number]

// Круглые объёмы арены. В kit() их нет (там кубы и колёса), поэтому чаша и купол —
// отдельные меши на геометриях из кэша мира: ctx.geo живёт и освобождается со сценой.
function round(ctx: WorldCtx, kind: 'drum' | 'dome') {
  const key = `venue:${kind}`
  let geo = ctx.geo.get(key)
  if (!geo) ctx.geo.set(key, geo = kind === 'drum' ? new THREE.CylinderGeometry(1, 1, 1, 28) : new THREE.SphereGeometry(1, 18, 12))
  return geo
}
// Овальная башня w × h × d, y0 — низ
const drum = ({ ctx, g }: VenueShell, m: THREE.MeshLambertMaterial, w: number, h: number, d: number, x: number, y0: number, z: number) =>
  solid(ctx, g, round(ctx, 'drum'), m, x, y0 + h / 2, z, w / 2, h, d / 2)
// Эллипсоид, вписанный в w × h × d
const dome = ({ ctx, g }: VenueShell, m: THREE.MeshLambertMaterial, w: number, h: number, d: number, x: number, y0: number, z: number) =>
  solid(ctx, g, round(ctx, 'dome'), m, x, y0 + h / 2, z, w / 2, h / 2, d / 2)

export const VENUE_KINDS: Record<WorldVenueKind, (shell: VenueShell) => RoofPoint> = {
  // Отель-конгресс: низкий подиум с залом и узкая башня номеров над входом
  hotel({ ctx, k, body, x, z }) {
    const { roof, band, door, canopy, dark, sign, signMark } = ctx.style.roles
    k(body, 10.5, 3.2, 8, x, 0, z)                              // подиум
    k(body, 4.6, 9, 5, x - 2.6, 0, z - 1.2)                     // башня
    k.slab(roof, 4.8, 0.3, 5.2, x - 2.6, 9, z - 1.2)
    for (const y of [4.3, 5.9, 7.5]) {                          // ленты окон номеров — на двух видимых гранях
      k(band, 3.8, 0.8, 0.1, x - 2.6, y, z + 1.32)
      k(band, 0.1, 0.8, 4.2, x - 0.28, y, z - 1.2)
    }
    k(band, 5, 1.2, 0.1, x + 2.3, 1.3, z + 4.02)                // витраж зала
    k(door, 2.2, 2.4, 0.14, x - 2.6, 0, z + 4.02)
    k.slab(canopy, 3.6, 0.3, 2, x - 2.6, 2.6, z + 4.9)          // козырёк входа
    for (const dx of [-1.5, 1.5]) k(dark, 0.3, 2.6, 0.3, x - 2.6 + dx, 0, z + 5.6)
    k(sign, 3, 1, 0.2, x + 2.8, 3.2, z + 3.4)                   // знак на крыше подиума
    k(signMark, 0.6, 0.6, 0.3, x + 2, 3.4, z + 3.45)
    return [LOT_TOP, x - 2.6, z - 1.2]
  },
  // Арена: овальная чаша с кольцом крыши и куполом, портал входа спереди
  arena(shell) {
    const { ctx, k, body, roofMass, x, z } = shell
    const { roof, door, sign, signMark } = ctx.style.roles
    drum(shell, body, 11.5, 3.4, 10, x, 0, z)
    drum(shell, roof, 12.1, 0.5, 10.6, x, 3.4, z)
    dome(shell, roofMass, 9.6, 3.8, 8.2, x, 2.4, z)             // над кольцом виден только верх эллипсоида
    k(body, 4.2, 3, 1.8, x, 0, z + 5.2)                         // портал
    k(door, 2.6, 2.3, 0.14, x, 0, z + 6.12)
    k(sign, 3.2, 0.9, 0.2, x, 3, z + 5.9)
    for (const dx of [-0.6, 0.6]) k(signMark, 0.5, 0.5, 0.2, x + dx, 3.2, z + 6)
    return [6.2, x, z]
  },
  // Конгресс-холл: длинный павильон со ступенчатым коньком, стеклянное фойе под плитой портала
  hall({ ctx, k, body, roofMass, x, z }) {
    const { glass, canopy, door, dark, sign, signMark } = ctx.style.roles
    k(body, 11.5, 3.6, 7.6, x, 0, z - 0.6)
    k(roofMass, 11.5, 1.2, 4.6, x, 3.6, z - 0.6)                // конёк: две ступени
    k(roofMass, 11.5, 1, 2, x, 4.8, z - 0.6)
    k(glass, 7.4, 3, 1.8, x, 0, z + 3.9)                        // фойе
    k.slab(canopy, 9, 0.35, 2.8, x, 3, z + 4.3)                 // плита портала
    k(door, 2.4, 2.4, 0.14, x, 0, z + 4.82)
    for (const dx of [-4.1, 4.1]) k(dark, 0.35, 3, 0.35, x + dx, 0, z + 5.3)
    k(sign, 3.2, 0.9, 0.2, x, 3.75, z + 1.76)                   // знак на торце конька
    for (const dx of [-0.6, 0.6]) k(signMark, 0.5, 0.5, 0.2, x + dx, 3.95, z + 1.86)
    return [5.8, x, z]
  },
}
