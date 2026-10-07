// «Где работали» — зона карты слева от кампуса: архив мест с историей. Кварталы по
// пять зданий, высота здания — число мероприятий на месте.
// ЗАГОТОВКА захода 1 Ш5: размеченная пустая площадка. Наполняет кодер Б (заход 2) по
// макету voxel-world-s51.html, раздел «Архив (с50)».
import * as THREE from 'three'
import type { WorldArchivePlace } from '../../data/types'
import type { WorldCtx } from '../createWorld'
import { CAMPUS_HALF, ground } from '../ground'

// Группа зоны в своих осях: центр квадрата в (0, 0), +z — к зрителю; на место в ряду её
// ставит zones/layout.ts. userData.frame — точки (в осях зоны), которые обязаны попасть
// в кадр, когда камера стоит на зоне.
export function buildArchive(ctx: WorldCtx, places: WorldArchivePlace[]) {
  const g = new THREE.Group(), h = CAMPUS_HALF
  ground(ctx, g, h * 2)
  void places
  g.userData.frame = [[-h, -h], [h, -h], [-h, h], [h, h]].map(([x = 0, z = 0]) => new THREE.Vector3(x, 0, z))
  return g
}
