// Камера: рабочий ракурс под окно, пределы цели, поза между пересозданиями мира.
import * as THREE from 'three'
import { WORLD_SITES, type CameraPose } from '../worldStore'
import type { WorldCtx } from './createWorld'
import { INK_WIDTH } from './style'

// Камера по виду: направление и пределы зума. Цель и дистанцию считает viewPose
// по «рамке интереса» под текущий аспект.
const CAM = {
  campus: { dir: [0.6, 0.5, 0.64], min: 14, max: 120 },
} as const

// Пределы цели камеры. Держит их кадр (сдвиг мышью), и в них же обязана лежать цель
// рабочего ракурса — иначе первый кадр после расстановки дёргает камеру.
export function createLimit() {
  return new THREE.Box3(new THREE.Vector3(-30, 0, -30), new THREE.Vector3(30, 14, 30))
}

export function pullIn(limit: THREE.Box3, t: THREE.Vector3, p: THREE.Vector3, tmp = new THREE.Vector3()) {
  tmp.copy(t).clamp(limit.min, limit.max).sub(t)
  if (tmp.lengthSq() > 0) { t.add(tmp); p.add(tmp) }
}

const corners = (b: THREE.Box3) => Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z))

// Рамка интереса — точки, которые обязаны попасть в кадр: углы габаритов каждого
// здания (не общий бокс — его пустые углы над землёй съедают кадр). Место под вывески
// добавляет placeCamera: оно задано в пикселях, а не в метрах. Край сетки на дороге
// (в макете там выезд и карточка события) в рамку вернётся вместе с «Сегодня»: пока
// там пустая земля, он только мельчит кампус.
// Машины в проёмах и на площадке — дети гаража и входят в его габарит; фургон и фигурки
// рамку не двигают.
export function framePoints(ctx: WorldCtx) {
  const pts: THREE.Vector3[] = []
  for (const id of WORLD_SITES) {
    const root = ctx.roots.get(id)
    if (!root) continue
    pts.push(...corners(new THREE.Box3().setFromObject(root)))
  }
  return pts
}

// Рабочий ракурс: направление задано, дистанция — минимальная, при которой все точки
// рамки попадают в кадр и по ширине, и по высоте (с учётом fov и aspect), плюс 5 % запаса.
// Для точки (rel = точка − цель) в осях камеры: глубина = dist − rel·dir, нужно
// |rel·right| ≤ tanH·глубина и |rel·up| ≤ tanV·глубина.
// Цель дважды сдвигаем к центру проекции — иначе перспектива оставляет пустую полосу с края.
// Чистая функция без сцены. От макета отличается одним: как цель возвращается в пределы.
export function viewPose(pts: THREE.Vector3[], direction: readonly [number, number, number], fov: number, aspect: number, limit: THREE.Box3) {
  const dir = new THREE.Vector3(...direction).normalize()
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
  const up = new THREE.Vector3().crossVectors(dir, right)
  const rel = new THREE.Vector3()
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2)), tanH = tanV * aspect
  const t = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3())
  let dist = 0
  for (let pass = 0; pass < 3; pass++) {
    dist = 0
    for (const q of pts) {
      const f = rel.subVectors(q, t).dot(dir)
      dist = Math.max(dist, f + Math.abs(rel.dot(right)) / tanH, f + Math.abs(rel.dot(up)) / tanV)
    }
    if (pass === 2) break
    // Края проекции в долях полукадра → сдвиг цели к середине
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    for (const q of pts) {
      rel.subVectors(q, t)
      const depth = dist - rel.dot(dir), x = rel.dot(right) / (depth * tanH), y = rel.dot(up) / (depth * tanV)
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    t.addScaledVector(right, ((x0 + x1) / 2) * dist * tanH).addScaledVector(up, ((y0 + y1) / 2) * dist * tanV)
  }
  dist *= 1.05
  const p = t.clone().addScaledVector(dir, dist)
  // Центр проекции рамки лежит под землёй (кампус — на 4,6 м), а пределы цели начинаются
  // с y = 0. Макет возвращал цель в пределы сдвигом цели И камеры — кадр уезжал вниз на
  // 0,2 полукадра: сверху пусто, конец дороги срезан. Здесь цель скользит к пределу вдоль
  // луча взгляда, камера стоит: картинка та же, меняется только дистанция до цели.
  const y = THREE.MathUtils.clamp(t.y, limit.min.y, limit.max.y)
  if (y !== t.y && dir.y > 1e-3) {
    const slide = (y - t.y) / dir.y
    t.addScaledVector(dir, slide)
    dist -= slide
  }
  pullIn(limit, t, p)   // поза вида = поза покоя: кадр после расстановки ничего не двигает
  return { t, p, dist }
}

// Размер canvas — по слоту. false — слот скрыт (0 × 0), такой ресайз пропускаем.
export function fit(ctx: WorldCtx) {
  const w = ctx.container.clientWidth, h = ctx.container.clientHeight
  if (!w || !h) return false
  ctx.renderer.setSize(w, h)
  ctx.css2d.setSize(w, h)
  ctx.camera.aspect = w / h
  ctx.camera.updateProjectionMatrix()
  ctx.style.hullPx.value.set(2 * INK_WIDTH / w, 2 * INK_WIDTH / h)
  return true
}

// Место над якорем вывески, px: плашка + ножка + поле от края сцены, в полном и
// компактном виде. Пара к высотам .w-sign__board и --leg в world-hud.css и к LEGS,
// HUD_EDGE раскладки.
const SIGN_ROOM = { full: 60 + 12 + 8, compact: 44 + 10 + 8 }

// Макет держал под вывеску 3,5 м над крышей: у дальнего здания это меньше высоты плашки,
// и спасал только рыхлый кадр. Здесь запас — в пикселях: рамка включает точку над
// каждым якорем на высоте вывески, пересчитанной в метры при найденной позе. Поза и
// пересчёт зависят друг от друга — два уточнения сходятся с запасом.
export function placeCamera(ctx: WorldCtx, compact: boolean) {
  const c = CAM.campus, { camera, controls } = ctx
  const room = compact ? SIGN_ROOM.compact : SIGN_ROOM.full
  const anchors = WORLD_SITES.flatMap((id) => { const o = ctx.labels.get(id); return o ? [o.getWorldPosition(new THREE.Vector3())] : [] })
  const tops = anchors.map((a) => a.clone())
  const at = new THREE.Vector3(), above = new THREE.Vector3()
  let v = viewPose([...ctx.framePts, ...tops], c.dir, camera.fov, camera.aspect, ctx.limit)
  for (let pass = 0; pass < 3; pass++) {
    controls.target.copy(v.t)
    camera.position.copy(v.p)
    controls.minDistance = c.min
    controls.maxDistance = Math.max(c.max, v.dist * 1.3)
    controls.update()
    if (pass === 2) break
    camera.updateMatrixWorld()
    const half = ctx.container.clientHeight / 2
    anchors.forEach((a, i) => {
      // Сколько пикселей экрана в одном метре высоты у этого якоря
      const perMeter = (above.copy(a).setY(a.y + 1).project(camera).y - at.copy(a).project(camera).y) * half
      if (perMeter > 0) tops[i]!.setY(a.y + room / perMeter)
    })
    v = viewPose([...ctx.framePts, ...tops], c.dir, camera.fov, camera.aspect, ctx.limit)
  }
}

export function readPose(ctx: WorldCtx): CameraPose {
  return { position: ctx.camera.position.toArray(), target: ctx.controls.target.toArray(), moved: ctx.userMoved }
}

// Позу возвращаем только ту, что человек выставил сам: нетронутый кадр честнее
// пересчитать под текущее окно.
export function restorePose(ctx: WorldCtx, pose: CameraPose) {
  if (!pose.moved) return
  ctx.camera.position.fromArray(pose.position)
  ctx.controls.target.fromArray(pose.target)
  ctx.controls.update()
  ctx.userMoved = true
}
