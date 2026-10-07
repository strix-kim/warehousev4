// Ограда участка и «плюс» пустого места — отклик «Площадок» на наведение и выбор.
// Состояние (hovOn, selOn) ведёт selection.ts по стору; здесь — сборка и кадр.
import * as THREE from 'three'
import { ADD_LOT_ID } from '../worldStore'
import type { WorldCtx } from './createWorld'
import { clamp01, easeOut, glide, glideStep, still, type Glide } from './ease'
import { hitPlane } from './pointer'
import { kit, label, type Kit } from './primitives'
import { dimmed, mix, own } from './style'

/* Ограда участка — вместо кольца: по периметру надела лежат блоки высотой 0. Наведение
   на любую часть участка поднимает их серой кромкой на FENCE_HOVER за 150 мс; выбор —
   красный забор с зубцами (0,7 / 0,45 м, столбы калитки 0,95 м) волной от ближнего к
   клику угла (ctx.hit) за 300 мс, снятие — разом за 150 мс; неподвижный мир — сразу.
   Надел — прямоугольник в осях parent (группа участка): hw — полуширина, z0…z1 —
   задний и передний край, curb — ширина бордюра, gate — калитка в переднем бордюре. */
export type FencePlot = { hw: number; z0: number; z1: number; curb: number; gate: readonly [number, number] }
// Блок ограды: x, z — центр, sx, sz — размер в плане, h — высота зубца, s — место на периметре
type FenceItem = { x: number; z: number; sx: number; sz: number; h: number; s: number }
export type Fence = {
  parent: THREE.Object3D
  plot: FencePlot
  hovOn: boolean; selOn: boolean
  h: Glide
  // Начало волны выбора или схлопывания
  sT0: number
  mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>
  items: FenceItem[]
  // Длина периметра и место на нём, откуда идёт волна
  len: number; s0: number
  // Подъём каждого блока (0…1): на момент sT0 и сейчас
  from: Float32Array; cur: Float32Array
  gray: THREE.Color; red: THREE.Color
  // Кадр досчитан до покоя: матрицы не трогаем, пока состояние не сменится
  idle: boolean
  mx: THREE.Matrix4
}

const FENCE_HOVER = 0.34, FENCE_HOVER_MS = 150
// Волна: задержка дальнего блока и подъём одного блока; снятие — FENCE_OFF_MS
const FENCE_WAVE_MS = 180, FENCE_RISE_MS = 120, FENCE_OFF_MS = 150
// Дольше самой длинной анимации выбора — после этого ограда в покое
const FENCE_BUSY_MS = FENCE_WAVE_MS + FENCE_RISE_MS + 20
// Свежесть точки клика: старше — волна идёт от калитки
const HIT_FRESH_MS = 800

// Обход периметра: передний край слева направо → правый → задний → левый
function fenceItems(plot: FencePlot): FenceItem[] {
  const { hw, z0, z1, curb, gate: [g0, g1] } = plot, depth = z1 - z0, zc = (z0 + z1) / 2, c = curb + 0.08
  const edge = (len: number, at: (a: number, l: number) => Omit<FenceItem, 'h' | 's'>, s0: number) => {
    const n = Math.max(1, Math.round(len)), step = len / n, out: FenceItem[] = []
    for (let j = 0; j < n; j++) out.push({ ...at((j + 0.5) * step - len / 2, step), h: j % 2 && j < n - 1 ? 0.45 : 0.7, s: s0 + (j + 0.5) * step })
    return out
  }
  // Калитка: блоков в проёме нет, по его сторонам — столбы
  const front = edge(2 * hw, (a, l) => ({ x: a, z: z1 - curb / 2, sx: l, sz: c }), 0).filter((q) => q.x < g0 || q.x > g1)
  const posts = [front.filter((q) => q.x < g0).at(-1), front.find((q) => q.x > g1)]
  for (const q of posts) if (q) Object.assign(q, { h: 0.95, sz: c + 0.2 })
  return [
    ...front,
    ...edge(depth - 2 * curb, (a, l) => ({ x: hw - curb / 2, z: zc - a, sx: c, sz: l }), 2 * hw + curb),
    ...edge(2 * hw, (a, l) => ({ x: -a, z: z0 + curb / 2, sx: l, sz: c }), 2 * hw + depth),
    ...edge(depth - 2 * curb, (a, l) => ({ x: -hw + curb / 2, z: zc + a, sx: c, sz: l }), 4 * hw + depth + curb),
  ]
}

// Ключ в ctx.fences — lotPartId('lot', venueId): по нему ограду находит выбор любой
// части участка. Кладёт вызывающий (zones/venues.ts): ctx.fences.set(key, makeFence(…)).
// Материал свой (цвет меняется), приглушается с зоной сборки; его, общий ctx.box и
// буфер матриц освобождает обход сцены (release в createWorld).
export function makeFence(ctx: WorldCtx, parent: THREE.Object3D, plot: FencePlot): Fence {
  const { P } = ctx.style, items = fenceItems(plot), n = items.length
  const mesh = new THREE.InstancedMesh(ctx.box, own(ctx.style, P.ringHover), n)
  mesh.userData.hull = true      // в raycast не идёт
  mesh.frustumCulled = false     // блоки меняют высоту — границы не пересчитываем
  mesh.visible = false
  parent.add(mesh)
  return {
    parent, plot, hovOn: false, selOn: false, h: still(), sT0: -1e9, mesh, items,
    len: 2 * (2 * plot.hw + plot.z1 - plot.z0), s0: 0, from: new Float32Array(n), cur: new Float32Array(n),
    // Кромка наведения темнее бордюра (в «Ночи» — светлее): иначе сливается с ним
    gray: new THREE.Color(mix(P.mark, P.gate, 0.5)), red: new THREE.Color(P.ringSel),
    idle: false, mx: new THREE.Matrix4(),
  }
}

// Место на периметре, откуда идёт волна: угол надела, ближний к точке клика; клика
// не было (клавиатура, вывеска) — правый передний, у калитки
function waveStart(ctx: WorldCtx, fence: Fence, now: number) {
  const { hw, z0, z1 } = fence.plot, depth = z1 - z0
  const corners = [[-hw, z1, 0], [hw, z1, 2 * hw], [hw, z0, 2 * hw + depth], [-hw, z0, 4 * hw + depth]] as const
  if (!ctx.hit || now - ctx.hit.at > HIT_FRESH_MS) return corners[1][2]
  // Точка клика — в осях мира; до первого кадра матрица участка ещё не посчитана
  fence.parent.updateWorldMatrix(true, false)
  const p = fence.parent.worldToLocal(ctx.hit.point.clone())
  return corners.reduce((a, b) => Math.hypot(b[0] - p.x, b[1] - p.z) < Math.hypot(a[0] - p.x, a[1] - p.z) ? b : a)[2]
}

export function selectFence(ctx: WorldCtx, fence: Fence, on: boolean, now: number) {
  if (fence.selOn === on) return
  fence.selOn = on
  fence.sT0 = now
  fence.from.set(fence.cur)
  if (on) fence.s0 = waveStart(ctx, fence, now)
  fence.idle = false
}

// Сразу в покое — после пересборки сцены (смена облика), без повторной волны
export function settleFence(fence: Fence) {
  fence.sT0 = -1e9
  fence.idle = false
}

// Кадр одной ограды; зовётся из tick в selection.ts, перед рендером
export function tickFence(fence: Fence, now: number, reduced: boolean) {
  const to = fence.hovOn && !fence.selOn ? 1 : 0
  if (fence.h.to !== to) fence.idle = false
  glide(fence.h, to, FENCE_HOVER_MS, now)
  const busy = !reduced && (now - fence.h.t0 < fence.h.dur || now - fence.sT0 < FENCE_BUSY_MS)
  if (fence.idle && !busy) return
  fence.idle = !busy
  const hv = glideStep(fence.h, now, reduced) * FENCE_HOVER
  const off = reduced ? 1 : easeOut(clamp01((now - fence.sT0) / FENCE_OFF_MS))
  let top = hv
  fence.items.forEach((q, j) => {
    const d = Math.abs(q.s - fence.s0), wave = Math.min(d, fence.len - d) / (fence.len / 2) * FENCE_WAVE_MS
    const was = fence.from[j] ?? 0
    const v = fence.selOn ? (reduced ? 1 : Math.max(was, easeOut(clamp01((now - fence.sT0 - wave) / FENCE_RISE_MS)))) : was * (1 - off)
    fence.cur[j] = v
    const h = Math.max(v * q.h, hv)
    top = Math.max(top, v)
    fence.mesh.setMatrixAt(j, fence.mx.makeScale(q.sx, Math.max(h, 0.001), q.sz).setPosition(q.x, h / 2, q.z))
  })
  fence.mesh.instanceMatrix.needsUpdate = true
  fence.mesh.visible = top > 0.001
  fence.mesh.material.color.copy(fence.selOn || top > hv + 0.001 ? fence.red : fence.gray)
}

/* «Плюс» — пустое место, которое можно заполнить: пунктир из плиток по контуру будущего
   основания и невидимая цель клика w × d с центром в (x, z) в осях parent. Сам «плюс» —
   кнопка HUD в якоре (класс w-plus, свободная подпись; hud/Plus.tsx): она же дубль для
   клавиатуры. Место внутри участка — модификатор w-plus--in (кнопка мельче). Наведение —
   класс is-hover на якоре (ставит paint в selection.ts) и hovOn здесь: пунктир темнеет
   (в «Ночи» — светлеет). Сам кладёт себя в ctx.pluses и ctx.roots. */
export type Plus = {
  root: THREE.Group
  hovOn: boolean
  dash: THREE.MeshBasicMaterial
  base: THREE.Color; hot: THREE.Color
  h: Glide
  idle: boolean
}

// Плитка пунктира и его толщина: пустая ячейка сетки — крупнее, в ширину бордюра участка
const DASH = { lot: [1, 0.4], slot: [0.5, 0.26] } as const
const PLUS_HOVER_MS = 150

// Пунктир из плиток по контуру прямоугольника w × d с центром в начале осей
function dashRect(k: Kit, m: THREE.MeshBasicMaterial, w: number, d: number, tile: number, thick: number) {
  for (const [len, along] of [[w, true], [d, false]] as const) {
    const n = Math.max(2, Math.round(len / (2 * tile))), step = (len - tile) / (n - 1)
    for (let j = 0; j < n; j++) for (const side of [-1, 1]) {
      const a = -len / 2 + tile / 2 + j * step, b = side * ((along ? d : w) - thick) / 2
      if (along) k(m, tile, 0.1, thick, a, 0, b)
      else k(m, thick, 0.1, tile, b, 0, a)
    }
  }
}

export function makePlus(ctx: WorldCtx, parent: THREE.Object3D, id: string, x: number, z: number, w: number, d: number): Plus {
  const { P } = ctx.style, lot = id === ADD_LOT_ID, [tile, thick] = lot ? DASH.lot : DASH.slot
  const root = new THREE.Group()
  root.position.set(x, 0, z)
  parent.add(root)
  // Материал свой (цвет меняется), без света — как разметка; ground — контур ему не рисуем
  const dash = dimmed(ctx.style, new THREE.MeshBasicMaterial({ color: P.mark }))
  dash.userData.ground = true
  const k = kit(ctx)
  dashRect(k, dash, w, d, tile, thick)
  k.into(root)
  hitPlane(ctx, root, w, d, 0, 0, id, 0.08)
  label(ctx, root, id, lot ? 'w-plus' : 'w-plus w-plus--in', 0, 0.3, 0).center.set(0.5, 0.5)
  const plus: Plus = { root, hovOn: false, dash, base: new THREE.Color(P.mark), hot: new THREE.Color(P.gate), h: still(), idle: true }
  ctx.roots.set(id, root)
  ctx.pluses.set(id, plus)
  return plus
}

// Кадр одного «плюса»; зовётся из tick в selection.ts
export function tickPlus(plus: Plus, now: number, reduced: boolean) {
  const to = plus.hovOn ? 1 : 0
  if (plus.h.to !== to) plus.idle = false
  glide(plus.h, to, PLUS_HOVER_MS, now)
  const busy = !reduced && now - plus.h.t0 < plus.h.dur
  if (plus.idle && !busy) return
  plus.idle = !busy
  plus.dash.color.lerpColors(plus.base, plus.hot, glideStep(plus.h, now, reduced))
}
