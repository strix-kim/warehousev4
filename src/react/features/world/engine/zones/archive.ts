// «Где работали» — зона карты слева от кампуса: архив мест с историей. Сетка кварталов
// 3 × 2: квартал — 2 × 3 ячейки, пять зданий и площадь с вывеской в ближней к камере
// ячейке. Порядок кварталов — ближний ряд слева направо, затем дальний; внутри
// квартала — от дальней ячейки к ближней. Высота здания — число мероприятий на месте.
// Постоянных вывесок у зданий нет: имя — чип под указателем и у выбранного.
// Облик — макет voxel-world-s51.html, раздел «Архив (с50)».
import * as THREE from 'three'
import { ARCH_BLOCK, ARCH_EMPTY_ID, ARCH_MAX } from '../../archiveBlocks'
import type { WorldArchiveKind, WorldArchivePlace } from '../../data/types'
import { blockId, placeId } from '../../worldStore'
import type { WorldCtx } from '../createWorld'
import { glide, glideStep, still, type Glide } from '../ease'
import { CAMPUS_HALF, ground, tree } from '../ground'
import { hitPlane, pickable } from '../pointer'
import { kit, label, type Kit } from '../primitives'
import { makeRing } from '../selection'
import { dimmed, flat, mat, mix, type Roles } from '../style'

// cell — ячейка сетки, qw × qd — квартал, gx / gz — улицы между кварталами,
// foot — габарит здания в плане
const AR = { cell: 8.5, qw: 17, qd: 25.5, gx: 2.5, gz: 5, foot: 5.6 }
// [столбец, ряд] ячейки в квартале; [1, 2] — площадь с вывеской
const CELLS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]
const BLOCKS = ARCH_MAX / ARCH_BLOCK
// Потолок высоты здания, в мероприятиях
const TOP = 12
// Запас кадра над крышей — под чип имени, м
const CHIP_ROOM = 2.2
// Поле от края сцены до чипа имени, px
const CHIP_EDGE = 6

// Центр квартала в осях зоны
const quarter = (q: number): [number, number] => [(q % 3 - 1) * (AR.qw + AR.gx), (q < 3 ? 1 : -1) * (AR.qd + AR.gz) / 2]
function spot(i: number): [number, number] {
  const [qx, qz] = quarter(Math.floor(i / ARCH_BLOCK)), [a, b] = CELLS[i % ARCH_BLOCK]!
  return [qx + (a - 0.5) * AR.cell, qz + (b - 1) * AR.cell]
}
// Цоколь 2,2 м + 0,6 м на мероприятие: одно — павильон 2,8 м, двенадцать и больше —
// башня 9,4 м (чуть выше склада кампуса); башня не закрывает больше одного здания за собой
const heightOf = (events: number) => 2.2 + 0.6 * Math.min(events, TOP)

// Силуэты по типу места — 5–9 объёмов в габарите 5,6 × 5,6 м; H — полная высота, она
// одна на все типы. Окна — ленты на двух видимых с рабочего ракурса фасадах (+z и +x).
type Body = THREE.MeshLambertMaterial
const MAKE: Record<WorldArchiveKind, (k: Kit, r: Roles, body: Body, H: number) => void> = {
  // Отель: башня на стилобате
  hotel(k, r, body, H) {
    const ph = Math.min(1.3, H * 0.4), tw = 3.6, th = H - ph, n = th > 5 ? 3 : th > 2.6 ? 2 : 1
    k(body, 5.6, ph, 5.2, 0, 0, 0)
    k(body, tw, th, tw, -0.6, ph, -0.5)
    k.slab(r.roof, tw + 0.3, 0.25, tw + 0.3, -0.6, H, -0.5)
    for (let b = 0; b < n; b++) {
      const y = ph + th * (b + 0.5) / n - 0.3
      k(r.band, tw - 0.9, 0.6, 0.1, -0.6, y, 1.32)
      k(r.band, 0.1, 0.6, tw - 0.9, 1.22, y, -0.5)
    }
    k(r.door, 1.5, ph - 0.25, 0.12, 1.4, 0, 2.62)
  },
  // Конгресс-холл: широкий зал, стеклянное фойе под навесом, надстройка
  hall(k, r, body, H) {
    const h1 = H * 0.62, hf = Math.max(1.4, h1 * 0.7)
    k(body, 5.6, h1, 4.2, 0, 0, -0.7)
    k(r.glass, 4.4, hf, 1.3, 0, 0, 2.05)
    k.slab(r.canopy, 5, 0.22, 1.7, 0, hf, 2.05)
    k(body, 3.8, H - h1, 3, -0.6, h1, -1)
    k.slab(r.roof, 4.1, 0.25, 3.3, -0.6, H, -1)
    k(r.band, 0.1, 0.6, 3.2, 2.82, h1 * 0.5, -0.7)
  },
  // Арена: чаша ступенями и тёмный купол
  arena(k, r, body, H) {
    const h1 = H * 0.5, h2 = H * 0.32
    k(body, 5.6, h1, 5.6, 0, 0, 0)
    k(body, 4.5, h2, 4.5, 0, h1, 0)
    k.slab(r.roof, 3.4, H - h1 - h2, 3.4, 0, h1 + h2, 0)
    k(r.band, 3.4, h2 * 0.5, 0.1, 0, h1 + h2 * 0.25, 2.27)
    k(r.band, 0.1, h2 * 0.5, 3.4, 2.27, h1 + h2 * 0.25, 0)
    k(r.door, 1.9, Math.min(1.5, h1 - 0.3), 0.12, 0, 0, 2.82)
  },
  // Дворец: высокий центр, два крыла, портик на четырёх колоннах
  palace(k, r, body, H) {
    const hw = H * 0.62, hp = Math.min(hw, 2.6)
    k(body, 3, H, 4.4, 0, 0, -0.4)
    for (const sx of [-1, 1]) k(body, 1.5, hw, 3.6, sx * 2.05, 0, -0.6)
    k.slab(r.roof, 3.3, 0.25, 4.7, 0, H, -0.4)
    k.slab(r.canopy, 5, 0.25, 1.4, 0, hp, 2.3)
    for (const x of [-2.1, -0.7, 0.7, 2.1]) k(r.white, 0.3, hp, 0.3, x, 0, 2.75)
    k(r.band, 2.2, 0.6, 0.1, 0, Math.max(hp + 0.4, H * 0.72), 1.82)
    k(r.door, 1.4, hp - 0.4, 0.12, 0, 0, 1.82)
  },
}

const lineGeo = (pts: number[]) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))

// Участок квартала: заливка светлеет под указателем, в фокусе вывески и при выборе
type Plot = { sign: HTMLElement; fill: THREE.MeshBasicMaterial; base: THREE.Color; hot: THREE.Color; tone: Glide; shown: number }
// Чип имени: on — показан (наведение или выбор), half — половина ширины, dx — сдвиг от края
type Chip = { o: ReturnType<typeof label>; on: boolean; half: number; dx: number }

// Группа зоны в своих осях: центр квадрата в (0, 0), +z — к зрителю; на место в ряду её
// ставит zones/layout.ts. userData.frame — точки (в осях зоны), которые обязаны попасть
// в кадр, когда камера стоит на зоне.
export function buildArchive(ctx: WorldCtx, places: WorldArchivePlace[]) {
  const g = new THREE.Group(), h = CAMPUS_HALF, { style } = ctx, { P } = style
  const scene = places.slice(0, ARCH_MAX)
  ground(ctx, g, h * 2)
  // Улица между рядами кварталов — тем же языком, что главная дорога кампуса
  const k = kit(ctx)
  k(flat(style, P.road), h * 2, 0.04, 2.4, 0, 0, 0)
  for (let x = -h + 1; x < h - 1; x += 2) k(flat(style, P.mark), 1, 0.05, 0.14, x + 0.5, 0, 0)
  k.into(g)

  // Кварталы: участок светлее земли (P.yard) с тонкой границей, на площади — дерево и
  // вывеска. У квартала без мест — только пунктирная граница.
  const plots: Plot[] = []
  for (let q = 0; q < BLOCKS; q++) {
    const [qx, qz] = quarter(q), sx = qx + AR.cell / 2, sz = qz + AR.cell, hw = AR.qw / 2, hd = AR.qd / 2, y = 0.07
    const loop = [-hw, y, -hd, hw, y, -hd, hw, y, -hd, hw, y, hd, hw, y, hd, -hw, y, hd, -hw, y, hd, -hw, y, -hd]
    const qg = new THREE.Group()
    g.add(qg)
    if (q * ARCH_BLOCK >= scene.length) {
      const rim = new THREE.LineSegments(lineGeo(loop), dimmed(style, new THREE.LineDashedMaterial({ color: P.mark, dashSize: 0.6, gapSize: 0.45 })))
      rim.computeLineDistances()
      rim.position.set(qx, 0, qz)
      qg.add(rim)
      continue
    }
    // Материал заливки свой: её тон у каждого квартала меняется отдельно
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(AR.qw, AR.qd), dimmed(style, new THREE.MeshBasicMaterial({ color: P.yard })))
    fill.rotation.x = -Math.PI / 2
    fill.position.set(qx, 0.05, qz)
    const edge = new THREE.LineSegments(lineGeo(loop), dimmed(style, new THREE.LineBasicMaterial({ color: P.mark })))
    edge.position.set(qx, 0, qz)
    qg.add(fill, edge)
    const kd = kit(ctx)
    tree(ctx, kd, sx - 2.5, sz - 2.6)
    kd.into(qg)
    // Цель «квартал» — участок с половиной улиц вокруг: шесть целей делят квадрат без
    // зазоров. Отвечает пальцу и компактной сцене; мышью цель — только здание (pointer.ts).
    hitPlane(ctx, qg, AR.qw + AR.gx, AR.qd + AR.gz, qx, qz, blockId(q), 0.02)
    ctx.roots.set(blockId(q), qg)
    const sign = label(ctx, qg, blockId(q), 'w-sign w-sign--block', sx + 0.6, 0.2, sz + 0.6)
    plots.push({ sign: sign.element, fill: fill.material, base: new THREE.Color(P.yard), hot: new THREE.Color(mix(P.yard, P.mark, 0.3)), tone: still(), shown: 0 })
  }

  // Здания: группа на место; кольцо выбора лежит в группе зоны, как у зданий кампуса.
  // Якорь чипа имени — над крышей: свободная подпись (класс w-place), содержимое рисует
  // оболочка, пока место под указателем или выбрано.
  const f = AR.foot / 2, pts: THREE.Vector3[] = [], chips: Chip[] = []
  const quad = (x0: number, x1: number, z0: number, z1: number, y: number) => { for (const x of [x0, x1]) for (const z of [z0, z1]) pts.push(new THREE.Vector3(x, y, z)) }
  quad(-h, h, -h, h, 0)
  scene.forEach((place, i) => {
    const id = placeId(place.id), b = new THREE.Group(), kb = kit(ctx), [x, z] = spot(i), H = heightOf(place.events)
    b.position.set(x, 0, z)
    MAKE[place.kind](kb, style.roles, mat(style, P.wall), H)
    kb.into(b)
    b.userData.top = H
    g.add(b)
    ctx.roots.set(id, b)
    pickable(ctx, b, id)
    // Пальцем и в компактной сцене здание отвечает как свой квартал (pointer.ts)
    b.traverse((o) => { o.userData.block = blockId(Math.floor(i / ARCH_BLOCK)) })
    ctx.rings.set(id, makeRing(ctx, g, Math.hypot(AR.foot, AR.foot) / 2 + 0.3, x, z, 0.12, 0.9, 0.09))
    const chip = label(ctx, b, id, 'w-place', 0, H + 0.5, 0)
    chip.element.setAttribute('aria-hidden', 'true')
    chips.push({ o: chip, on: false, half: 0, dx: 0 })
    // Рамка кадра: крыша здания и запас под чип над ней
    quad(x - f, x + f, z - f, z + f, H)
    pts.push(new THREE.Vector3(x, H + CHIP_ROOM, z))
  })
  // Пустой архив: вывеска посреди квадрата, в кадре — место под неё
  if (!scene.length) {
    label(ctx, g, ARCH_EMPTY_ID, 'w-aempty', 0, 0.2, 0)
    pts.push(new THREE.Vector3(0, 7, 0))
  }
  g.userData.frame = pts

  // Кадр зоны. Наведение и выбор читаем с якорей подписей: классы is-hover и is-selected
  // им пишет selection.ts по стору — это состояние движка, а не оболочки.
  const at = new THREE.Vector3()
  ctx.ticks.push((now) => {
    for (const plot of plots) {
      const hot = plot.sign.classList.contains('is-hover') || plot.sign.classList.contains('is-selected')
      glide(plot.tone, hot ? 1 : 0, 160, now)
      const t = glideStep(plot.tone, now, ctx.reduced)
      if (t !== plot.shown) plot.fill.color.lerpColors(plot.base, plot.hot, plot.shown = t)
    }
    // Чип у края кадра сдвигается внутрь. Сдвиг — свойством translate самого якоря:
    // его transform занят CSS2DRenderer.
    for (const chip of chips) {
      const el = chip.o.element, on = el.classList.contains('is-hover') || el.classList.contains('is-selected')
      if (on !== chip.on) { chip.on = on; chip.half = 0; chip.dx = 0; el.style.translate = '' }
      if (!on) continue
      chip.half ||= el.offsetWidth / 2   // до первого кадра с содержимым ширины ещё нет
      if (!chip.half) continue
      const w = ctx.container.clientWidth, x = (at.setFromMatrixPosition(chip.o.matrixWorld).project(ctx.camera).x + 1) / 2 * w
      const dx = Math.round(Math.max(CHIP_EDGE - (x - chip.half), 0) + Math.min(w - CHIP_EDGE - (x + chip.half), 0))
      if (dx !== chip.dx) { chip.dx = dx; el.style.translate = `${dx}px 0` }
    }
  })
  return g
}
