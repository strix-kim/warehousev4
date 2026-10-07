// Фигурки сотрудников: ноги, тело, голова — три объёма. Ходьба — покачивание, без шарниров.
// Фигурка (2,0) ≈ 2/3 двери офиса — нарочито крупная, машины ей под стать.
import * as THREE from 'three'
import type { WorldCtx } from './createWorld'
import { box, solid } from './primitives'
import { mat } from './style'

// Тело — капсула, одна геометрия на всех; живёт в кэше мира и уходит вместе с ним
function bodyCap(ctx: WorldCtx) {
  let geo = ctx.geo.get('person-body')
  if (!geo) ctx.geo.set('person-body', geo = new THREE.CapsuleGeometry(0.33, 0.09, 4, 12))
  return geo
}

// cloth — цвет одежды; withCase — кейс в руке (бригада)
export function makePerson(ctx: WorldCtx, parent: THREE.Object3D, x: number, z: number, rot: number, cloth: string, withCase = false) {
  const { style } = ctx
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rot
  // Качается внутренняя группа: позицию и поворот самой фигурки ведёт маршрут
  const inner = new THREE.Group()
  g.add(inner)
  box(ctx, inner, mat(style, style.P.legs), 0.5, 0.8, 0.34, 0, 0, 0)
  solid(ctx, inner, bodyCap(ctx), mat(style, cloth), 0, 1.175, 0, 1, 1, 0.64)
  box(ctx, inner, mat(style, style.P.skin), 0.46, 0.46, 0.46, 0, 1.55, 0)
  if (withCase) box(ctx, inner, style.roles.dark, 0.2, 0.5, 0.6, 0.48, 0.4, 0)
  g.userData = { inner }
  parent.add(g)
  return g
}

// Поза шага в момент t: фигурка подпрыгивает и покачивается; t = 0 — стоит ровно
export function pose(person: THREE.Object3D, t: number) {
  const a = Math.sin(t * 9), inner = person.userData.inner as THREE.Group
  inner.position.y = Math.abs(a) * 0.1
  inner.rotation.z = a * 0.07
}
