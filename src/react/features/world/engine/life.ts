// Жизнь кампуса: прохожие ходят по своим полосам туда-обратно, стоящие изредка
// покачиваются. Полосы заданы здесь же — расстановка (zones/campus.ts) ставит прохожего
// на ту же полосу, по которой его потом ведёт тик.
// Тик живёт функцией в ctx.ticks: список чистит clearFill (пересборка и снос мира), так
// что повторная сборка и dispose снимают жизнь сами. В неподвижном мире (ctx.reduced)
// жизни нет: кадр там рисуется по требованию, фигурки стоят на своих местах.
// Фигурки участков «Площадок» сюда не попадают — их движение только в appear.ts.
import type * as THREE from 'three'
import type { WorldCtx } from './createWorld'
import { POS, ROAD_Z } from './ground'
import { pose } from './people'

type XZ = readonly [x: number, z: number]
// Полоса прохожего: начало, конец и доля пути, на которой фигурка стоит при сборке
// (лицом к концу)
export type Lane = readonly [from: XZ, to: XZ, at: number]
export type Walker = { figure: THREE.Object3D; lane: Lane }

// Полосы кампуса в его осях: от склада к дороге, от офиса к дороге, вдоль главной дороги
export function campusLanes(): Lane[] {
  const [OX, OZ] = POS.office, [WX, WZ] = POS.warehouse, [GX] = POS.garage
  const side = ROAD_Z - 1.7   // обочина главной дороги
  return [[[WX - 4.6, WZ + 8], [WX - 4.6, side], 0.66], [[OX + 1.7, OZ + 5], [OX + 1.7, side], 0.18], [[GX + 7, side], [WX + 4, side], 0.75]]
}

// Спокойный шаг, м/с; разворот на конце полосы, с
const WALK_SPEED = 1.2, TURN_S = 0.7
// Вкладка спала или кадр после пересборки долгий — шаг времени не длиннее этого, с:
// прохожий не перескакивает полосу
const DT_MAX = 0.1
// Покачивание стоящего: одно движение из стороны в сторону за SWAY_S, угол в радианах
const SWAY_S = 1.4, SWAY_RAD = 0.045

export function createLife(ctx: WorldCtx, walkers: Walker[], standing: THREE.Object3D[]) {
  if (ctx.reduced || !(walkers.length || standing.length)) return
  // Всё состояние — здесь, при сборке: в кадре объектов не заводим
  const walks = walkers.map(({ figure, lane: [[ax, az], [bx, bz], at] }, i) => {
    const len = Math.hypot(bx - ax, bz - az) || 1
    return {
      figure, ax, az, ux: (bx - ax) / len, uz: (bz - az) / len, len,
      yaw: Math.atan2(bx - ax, bz - az),
      // s — пройдено от начала, м; fwd — идёт к концу; head — разворот: 0 лицом к концу,
      // 1 — к началу; t — фаза шага, у каждого своя
      s: len * at, fwd: true, head: 0, t: i * 0.37,
    }
  })
  // Период и сдвиг — от номера места: у соседей покачивание не совпадает, а после
  // пересборки сцены идёт так же
  const idles = standing.map((figure, i) => ({ inner: figure.userData.inner as THREE.Object3D, period: 4.5 + (i * 2.3) % 3.5, shift: i * 1.9 }))

  let last = 0
  ctx.ticks.push((now) => {
    // Первый кадр только заводит часы
    const dt = last ? Math.min((now - last) / 1000, DT_MAX) : 0
    last = now
    for (let i = 0; i < walks.length; i++) {
      const w = walks[i]!
      const want = w.fwd ? 0 : 1
      if (w.head !== want) {
        // Разворот на месте; шаг не замирает — фигурка переступает, поза без скачка
        w.head = w.fwd ? Math.max(0, w.head - dt / TURN_S) : Math.min(1, w.head + dt / TURN_S)
      } else {
        w.s += (w.fwd ? 1 : -1) * WALK_SPEED * dt
        if (w.s >= w.len) { w.s = w.len; w.fwd = false }
        else if (w.s <= 0) { w.s = 0; w.fwd = true }
      }
      w.t += dt
      w.figure.position.x = w.ax + w.ux * w.s
      w.figure.position.z = w.az + w.uz * w.s
      w.figure.rotation.y = w.yaw + Math.PI * w.head * w.head * (3 - 2 * w.head)
      pose(w.figure, w.t)
    }
    for (let i = 0; i < idles.length; i++) {
      const p = idles[i]!
      // По часам, а не по шагу: после сна вкладки ничего не догоняет
      const k = ((now / 1000 + p.shift) % p.period) / SWAY_S
      // Второй синус — окно: движение начинается и кончается плавно, в стойке
      p.inner.rotation.z = k < 1 ? Math.sin(k * 2 * Math.PI) * Math.sin(k * Math.PI) * SWAY_RAD : 0
    }
  })
}
