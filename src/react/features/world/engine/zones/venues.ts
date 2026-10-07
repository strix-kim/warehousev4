// «Площадки» — зона карты справа от кампуса: сетка участков 3 × 2, на участке здание
// места, грузовик, отель расселения и стол с планом залов.
// ЗАГОТОВКА захода 1 Ш5: размеченная пустая площадка. Наполняет кодер А (заход 2) по
// макету voxel-world-s51.html, раздел «Площадки (с50): квадрат мира».
import * as THREE from 'three'
import type { WorldVenue } from '../../data/types'
import type { WorldCtx } from '../createWorld'
import { CAMPUS_HALF, ground } from '../ground'

// Группа зоны в своих осях: центр квадрата в (0, 0), +z — к зрителю; на место в ряду её
// ставит zones/layout.ts. userData.frame — точки (в осях зоны), которые обязаны попасть
// в кадр, когда камера стоит на зоне: земля и место над крышами под вывески.
export function buildVenues(ctx: WorldCtx, venues: WorldVenue[]) {
  const g = new THREE.Group(), h = CAMPUS_HALF
  ground(ctx, g, h * 2)
  void venues
  g.userData.frame = [[-h, -h], [h, -h], [-h, h], [h, h]].map(([x = 0, z = 0]) => new THREE.Vector3(x, 0, z))
  return g
}
