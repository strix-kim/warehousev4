// Примитивы формы «Галька + контур»: скруглённый объём, контур по рёбрам и силуэт.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { WorldCtx } from './createWorld'

// ratio — радиус скругления в долях меньшей стороны объёма, cap — потолок радиуса
// (крупные стены не становятся подушками), seg — сегментов на скругление
const SHAPE = { ratio: 0.14, cap: 0.35, seg: 2 }

type BodyMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial

const r3 = (v: number) => Math.round(v * 1000) / 1000

// Скруглённый куб нельзя масштабировать как единичный (радиус исказится) —
// геометрия по размерам, кэш по w|h|d|r; живёт вместе с миром
function rbox(ctx: WorldCtx, w: number, h: number, d: number, r: number) {
  const key = `${r3(w)}|${r3(h)}|${r3(d)}|${r3(r)}`
  let geo = ctx.geo.get(key)
  if (!geo) ctx.geo.set(key, geo = new RoundedBoxGeometry(w, h, d, SHAPE.seg, r))
  return geo
}

// Радиус скругления объёма: доля меньшей стороны с потолком; тонкие пластины
// (< 3 см радиуса) остаются кубом
function radiusOf(w: number, h: number, d: number, rr?: number) {
  const r = Math.min(rr ?? Math.min(SHAPE.ratio * Math.min(w, h, d), SHAPE.cap), Math.min(w, h, d) / 2)
  return r < 0.03 ? 0 : r
}

// Контур скруглённого куба: по линии на каждое из 12 рёбер — она идёт по середине
// скругления и на концах дугой уходит к «макушке» угла, где сходятся три ребра.
// EdgesGeometry здесь не годится: у скруглённого куба нет острых рёбер.
// Точки — в осях объёма (sy — сжатие по высоте у плит), затем поворот q и перенос p.
// ARC — от макушки угла к середине ребра: [вдоль ребра, поперёк].
const ARC: ReadonlyArray<readonly [number, number]> = [[0.5774, 0.5774], [0.303, 0.674], [0, 0.7071]]
function crease(out: number[], w: number, h: number, d: number, r: number, p?: THREE.Vector3 | null, q?: THREE.Quaternion | null, sy = 1) {
  const half = new THREE.Vector3(w / 2, h / 2, d / 2)
  for (let ax = 0; ax < 3; ax++) {
    const b = (ax + 1) % 3, c = (ax + 2) % 3
    for (const sb of [-1, 1]) for (const sc of [-1, 1]) {
      const pts: THREE.Vector3[] = []
      const add = (sa: number, da: number, dbc: number) => {
        const v = new THREE.Vector3()
        v.setComponent(ax, sa * (half.getComponent(ax) - r + da * r))
        v.setComponent(b, sb * (half.getComponent(b) - r + dbc * r))
        v.setComponent(c, sc * (half.getComponent(c) - r + dbc * r))
        v.y *= sy
        if (q) v.applyQuaternion(q)
        if (p) v.add(p)
        pts.push(v)
      }
      if (r) {
        for (const [da, dbc] of ARC) add(-1, da, dbc)
        for (const [da, dbc] of [...ARC].reverse()) add(1, da, dbc)
      } else {
        add(-1, 0, 0.7071)
        add(1, 0, 0.7071)
      }
      let prev: THREE.Vector3 | null = null
      for (const v of pts) {
        if (prev) out.push(prev.x, prev.y, prev.z, v.x, v.y, v.z)
        prev = v
      }
    }
  }
}

// Линии контура одним объектом: пары точек → толстые отрезки.
// userData.hull — как у силуэта: в raycast не идёт
function inkLines(ctx: WorldCtx, pts: number[]) {
  const o = new LineSegments2(new LineSegmentsGeometry().setPositions(pts), ctx.style.ink)
  o.userData.hull = true
  return o
}

// Силуэт «чернилами»: тем же объёмом, задними гранями
function hull(ctx: WorldCtx, o: THREE.Mesh) {
  const hm = new THREE.Mesh(o.geometry, ctx.style.hull)
  hm.userData.hull = true
  o.add(hm)
}

// Отдельный куб: размеры w×h×d, (x, z) — центр, y0 — низ
export function box(ctx: WorldCtx, parent: THREE.Object3D, m: BodyMaterial, w: number, h: number, d: number, x: number, y0: number, z: number) {
  const r = radiusOf(w, h, d)
  const o = new THREE.Mesh(r ? rbox(ctx, w, h, d, r) : ctx.box, m)
  if (!r) o.scale.set(w, h, d)
  o.position.set(x, y0 + h / 2, z)
  const pts: number[] = []
  if (r) crease(pts, w, h, d, r)
  else crease(pts, 1, 1, 1, 0)
  o.add(inkLines(ctx, pts))
  hull(ctx, o)
  parent.add(o)
  return o
}

// Отдельный круглый объём (фигурки): готовая геометрия + масштаб
export function solid(ctx: WorldCtx, parent: THREE.Object3D, geo: THREE.BufferGeometry, m: BodyMaterial, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geo, m)
  o.scale.set(sx, sy, sz)
  o.position.set(x, y, z)
  hull(ctx, o)
  parent.add(o)
  return o
}

// Сборка: копит объёмы и в конце сливает их в один меш на материал.
// Здание из 150 деталей = 6–8 мешей вместо 150.
// rx — наклон вокруг x (стёкла машин: положительный опускает передний край); rr — свой радиус скругления.
// k.cyl — цилиндр с осью по x (колесо): радиус r, ширина w, (x, y, z) — центр.
// k.slab — плита со скруглёнными в плане углами (крыши, навесы).
// Объём, стоящий на земле, утоплен на радиус — скругление низа уходит под землю
// и стена встаёт на неё плоско (иначе двери и ворота висят перед скруглённым цоколем).
export type Kit = {
  (m: BodyMaterial, w: number, h: number, d: number, x: number, y0: number, z: number, rx?: number, rr?: number): void
  cyl: (m: BodyMaterial, r: number, w: number, x: number, y: number, z: number) => void
  slab: (m: BodyMaterial, w: number, h: number, d: number, x: number, y0: number, z: number) => void
  into: (parent: THREE.Object3D) => void
}

export function kit(ctx: WorldCtx): Kit {
  const buckets = new Map<string, { m: BodyMaterial; list: THREE.BufferGeometry[] }>()
  const ink: number[] = []
  const mx = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion()
  const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1), Q0 = new THREE.Quaternion()

  const put = (geo: THREE.BufferGeometry, m: BodyMaterial) => {
    let bucket = buckets.get(m.uuid)
    if (!bucket) buckets.set(m.uuid, bucket = { m, list: [] })
    let g = geo.clone().applyMatrix4(mx)
    // mergeGeometries сливает только однородные — приводим всё к неиндексированному
    if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n }
    bucket.list.push(g)
  }

  const k = (m: BodyMaterial, w: number, h: number, d: number, x: number, y0: number, z: number, rx = 0, rr?: number) => {
    const r = radiusOf(w, h, d, rr)
    if (r && y0 < 0.001 && !rx && h > 2 * r) { h += r; y0 -= r }
    p.set(x, y0 + h / 2, z); q.setFromAxisAngle(AX, rx)
    if (r) { mx.compose(p, q, s.set(1, 1, 1)); put(rbox(ctx, w, h, d, r), m) }
    else { mx.compose(p, q, s.set(w, h, d)); put(ctx.box, m) }
    if (!m.userData.ground) crease(ink, w, h, d, r, p, q)
  }

  const cyl: Kit['cyl'] = (m, r, w, x, y, z) => {
    mx.compose(p.set(x, y, z), q.setFromAxisAngle(AZ, Math.PI / 2), s.set(r, w, r))
    put(ctx.wheel, m)
  }

  const slab: Kit['slab'] = (m, w, h, d, x, y0, z) => {
    const R = Math.min(SHAPE.ratio * Math.min(w, d), SHAPE.cap), H = Math.max(h, 2 * R)
    if (R < 0.03 || H === h) return k(m, w, h, d, x, y0, z)
    mx.compose(p.set(x, y0 + h / 2, z), Q0, s.set(1, h / H, 1))
    put(rbox(ctx, w, H, d, R), m)
    crease(ink, w, H, d, R, p, null, h / H)
  }

  const into: Kit['into'] = (parent) => {
    for (const { m, list } of buckets.values()) {
      // null — несовместимые атрибуты; put() приводит всё к одному виду, так что это дефект сборки
      const geo: THREE.BufferGeometry | null = mergeGeometries(list)
      list.forEach((g) => g.dispose())
      if (!geo) throw new Error('kit: геометрии не слились')
      const mesh = new THREE.Mesh(geo, m)
      parent.add(mesh)
      if (!m.userData.ground) hull(ctx, mesh)
    }
    if (ink.length) parent.add(inkLines(ctx, ink))
    buckets.clear()
    ink.length = 0
  }

  return Object.assign(k, { cyl, slab, into })
}
