// Камера: рабочий ракурс под окно, пределы цели, переезд между зонами, поза между
// пересозданиями мира.
import * as THREE from 'three'
import { WORLD_SITES, WORLD_ZONES, type CameraPose, type WorldInside, type WorldZone } from '../worldStore'
import type { WorldCtx } from './createWorld'
import { INK_WIDTH } from './style'
import { zoneFrame, zoneOffset } from './zones/layout'

// Направление — углом от вертикали (polar) и поворотом от фронтальной оси +z к +x
// (azimuth), в градусах
const sph = (polar: number, az: number): [number, number, number] => {
  const p = THREE.MathUtils.degToRad(polar), a = THREE.MathUtils.degToRad(az)
  return [Math.sin(p) * Math.sin(a), Math.cos(p), Math.sin(p) * Math.cos(a)]
}

// Телефон: цель тапа — участок или квартал, ракурс круче, чтобы ромб цели вмещал 44 px
const PHONE_WIDTH = 640
// Камера по зоне: направление и пределы зума. Цель и дистанцию считает viewPose
// по «рамке интереса» под текущий аспект.
const CAM: Record<WorldZone, { dir: (phone: boolean) => [number, number, number]; min: number; max: number }> = {
  campus: { dir: () => [0.6, 0.5, 0.64], min: 14, max: 120 },
  venues: { dir: (phone) => phone ? sph(40, 43) : [0.6, 0.5, 0.64], min: 14, max: 120 },
  archive: { dir: (phone) => sph(phone ? 36 : 52, 43), min: 14, max: 140 },
}

// Пределы цели камеры. Держит их кадр (сдвиг мышью), и в них же обязана лежать цель
// рабочего ракурса — иначе первый кадр после расстановки дёргает камеру. Пределы стоят
// вокруг зоны под камерой: их двигает limitTo.
const LIMIT = { min: [-30, 0, -30], max: [30, 14, 30] } as const
export function createLimit() {
  return new THREE.Box3(new THREE.Vector3(...LIMIT.min), new THREE.Vector3(...LIMIT.max))
}
export function limitTo(limit: THREE.Box3, zone: WorldZone) {
  const off = zoneOffset(zone, new THREE.Vector3())
  limit.min.set(...LIMIT.min).add(off)
  limit.max.set(...LIMIT.max).add(off)
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
// Машины парка — дети гаража и входят в его габарит (zones/garage.ts); фигурки рамку
// не двигают.
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

// Высота переключателя зон с полем, px — пара к .w-zones в world-hud.css
const ZONES_ROOM = 56

// Макет держал под вывеску 3,5 м над крышей: у дальнего здания это меньше высоты плашки,
// и спасал только рыхлый кадр. Здесь запас — в пикселях: рамка включает точку над
// каждым якорем на высоте вывески, пересчитанной в метры при найденной позе. Поза и
// пересчёт зависят друг от друга — два уточнения сходятся с запасом.
// Кадр — зоны под камерой (ctx.zone): её рамка и кнопки соседей. Вывески на ножках
// есть только у кампуса; «Площадки» и «Где работали» кладут место под подписи в свою
// рамку сами (userData.frame).
export function placeCamera(ctx: WorldCtx, compact: boolean) {
  const c = CAM[ctx.zone], { camera, controls } = ctx
  // С соседями сверху встаёт переключатель зон: вывеске дальнего здания нужно место под ним
  const room = (compact ? SIGN_ROOM.compact : SIGN_ROOM.full) + (ctx.zones.length > 1 ? ZONES_ROOM : 0)
  const dir = c.dir(ctx.container.clientWidth <= PHONE_WIDTH), pts = zoneFrame(ctx)
  const anchors = ctx.zone !== 'campus' ? [] : WORLD_SITES.flatMap((id) => { const o = ctx.labels.get(id); return o ? [o.getWorldPosition(new THREE.Vector3())] : [] })
  const tops = anchors.map((a) => a.clone())
  const at = new THREE.Vector3(), above = new THREE.Vector3()
  let v = viewPose([...pts, ...tops], dir, camera.fov, camera.aspect, ctx.limit)
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
    v = viewPose([...pts, ...tops], dir, camera.fov, camera.aspect, ctx.limit)
  }
}

// Переезд камеры по карте к рабочему ракурсу зоны под камерой (ctx.zone уже новая):
// 700 мс к соседу, 900 мс через зону — вдвое дальше, но не вдвое дольше. На время
// переезда OrbitControls выключены, камерой правит tickFlight. Поза цели считается тем
// же placeCamera — камера на миг встаёт в неё и возвращается на место.
export type Flight = { t0: number; dur: number; p0: THREE.Vector3; t0v: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3 }

export function startFlight(ctx: WorldCtx, from: WorldZone, compact: boolean, now: number) {
  const far = Math.abs(WORLD_ZONES.indexOf(from) - WORLD_ZONES.indexOf(ctx.zone)) > 1
  ctx.controls.enabled = false
  ctx.flight = { ...aimHome(ctx, compact, now), dur: far ? 900 : 700 }
}

// Кадр переезда; true — приехали (позу покоя и управление возвращает вызывающий)
export function tickFlight(ctx: WorldCtx, flight: Flight, now: number) {
  const k = Math.min(1, Math.max(0, (now - flight.t0) / flight.dur)), s = k * k * (3 - 2 * k)
  ctx.camera.position.lerpVectors(flight.p0, flight.p1, s)
  ctx.controls.target.lerpVectors(flight.t0v, flight.t1, s)
  ctx.camera.lookAt(ctx.controls.target)
  return k >= 1
}

// Подводка к объекту (World.focus) в зоне под камерой: направление взгляда прежнее, цель —
// основание объекта, дистанция — чтобы он вошёл в кадр с запасом, но не ближе AIM_NEAR:
// рядом с мелким (грузовик, стол) должен читаться его участок. Кадр — тот же tickFlight;
// OrbitControls при этом не выключаются: человек может перехватить камеру (createWorld).
const AIM_MS = 600, AIM_NEAR = 34

export function aimAt(ctx: WorldCtx, root: THREE.Object3D, now: number): Flight {
  const { camera, controls } = ctx
  // Сразу после пересборки матрицы предков ещё не считаны — кадра не было
  root.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(root), size = new THREE.Vector3()
  const t1 = box.isEmpty() ? root.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3())
  if (!box.isEmpty()) box.getSize(size)
  t1.y = 0
  // Радиус — по основанию и высоте; угол — меньший из полууглов кадра (на телефоне — по ширине)
  const r = Math.max(Math.hypot(size.x, size.z) / 2, size.y)
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect))
  const dist = THREE.MathUtils.clamp(Math.max(AIM_NEAR, r / Math.sin(half) * 1.15), controls.minDistance, controls.maxDistance)
  const p0 = camera.position.clone(), t0v = controls.target.clone()
  const p1 = p0.clone().sub(t0v).normalize().multiplyScalar(dist).add(t1)
  pullIn(ctx.limit, t1, p1)
  return { t0: now, dur: AIM_MS, p0, t0v, p1, t1 }
}

// Возврат к рабочему ракурсу зоны под камерой: отъезд из гаража (engine/inside.ts) и цель
// переезда между зонами
export function aimHome(ctx: WorldCtx, compact: boolean, now: number): Flight {
  const { camera, controls } = ctx
  const p0 = camera.position.clone(), t0v = controls.target.clone()
  placeCamera(ctx, compact)
  const p1 = camera.position.clone(), t1 = controls.target.clone()
  camera.position.copy(p0)
  controls.target.copy(t0v)
  camera.lookAt(t0v)
  return { t0: now, dur: AIM_MS, p0, t0v, p1, t1 }
}

// Ракурс «внутри» здания кампуса: спереди и ниже рабочего — проёмы и машины перед ними
// крупно, табличкам над машинами есть место
const INSIDE_DIR: Record<WorldInside, [number, number, number]> = { garage: sph(60, 30) }
const INSIDE_ROOM = 1.3

// Подъезд «внутрь» (World.goInside): направление задано, кадр — точки userData.view
// здания (в его осях; гаражу их считает zones/garage.ts). Кадр — тот же tickFlight.
export function aimInside(ctx: WorldCtx, root: THREE.Object3D, now: number): Flight {
  const { camera, controls } = ctx
  // Сразу после пересборки матрицы предков ещё не считаны — кадра не было
  root.updateWorldMatrix(true, false)
  const pts = ((root.userData.view as THREE.Vector3[] | undefined) ?? []).map((p) => root.localToWorld(p.clone()))
  const v = viewPose(pts, INSIDE_DIR[root.userData.id as WorldInside], camera.fov, camera.aspect, ctx.limit)
  // Ближе minDistance нельзя: OrbitControls оттолкнул бы камеру первым же кадром после подъезда
  // Длину берём из v.dist: sub() правит v.p на месте, и distanceTo после него мерил бы
  // уже не камеру, а её смещение от цели. Кадр впритык (v.dist) на широкой сцене уводит
  // левую машину под доску «Дела», а верхний ряд табличек — под переключатель зон:
  // отступаем на INSIDE_ROOM. На телефоне обвязка стоит сверху и снизу, кадр — по ширине.
  const room = ctx.container.clientWidth <= PHONE_WIDTH ? 1 : INSIDE_ROOM
  const p1 = v.p.sub(v.t).setLength(Math.max(v.dist * room, controls.minDistance)).add(v.t)
  return { t0: now, dur: AIM_MS, p0: camera.position.clone(), t0v: controls.target.clone(), p1, t1: v.t }
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
