// Появление новых объектов после пересборки наполнения. refill() сносит и собирает сцену
// целиком, поэтому «новое» узнаём сравнением: id корней (ctx.roots) против множества уже
// виденных (worldMemory.ts — уровень модуля, переживает пересоздание мира: вернулся из
// редактора списка — грузовик подъезжает). Новое здание, стол, кафе поднимается из земли,
// грузовик въезжает на разгрузку вдоль своей оси, бригада выходит от здания по одному.
// У бригады id один на блок, а людей в ней прибывает: новичка узнаём по номеру места —
// ключ `<id>#<место>` живёт только в множестве виденных, в корни, подписи и цели указателя
// не попадает. Состав вырос с двух до трёх — выходит один третий.
// Без движения — только пометка: первый мир сессии (множество пусто); зона, из которой
// ещё ничего не видели (реестр ответил после первого кадра — вся зона «новая», и расти ей
// разом незачем); неподвижный мир; плоское (пустые места, кварталы) и кнопки зон.
// Исчезнувшие id из множества не уходят: объект, который вернулся, уже не новость.
// Анимация живёт функцией в ctx.ticks: список чистит clearFill (пересборка и снос мира),
// так что повторный refill и dispose снимают её сами — вместе с корнями, которые она
// держит. Собранное заново стоит в конечном состоянии: его id уже виден.
import * as THREE from 'three'
import { hasSeen, markSeen, seenIds } from '../worldMemory'
import { isAddId, parseLotId, type WorldZone } from '../worldStore'
import type { WorldCtx } from './createWorld'
import { clamp01, easeOut } from './ease'
import { pose } from './people'
import { zoneOf } from './zoneTravel'

const RISE_MS = 520
// Въезд короткий: дальше 3,6 м позади грузовика стоят столики кафе своего участка
const DRIVE_MS = 700, DRIVE_M = 3.6
// Выход бригады: шаг от здания (−z осей блока) к своему месту, следующий — с задержкой.
// WALK_SWING — фаза покачивания на старте: к месту фигурка приходит ровно в стойку.
const WALK_MS = 560, WALK_M = 1.4, WALK_GAP_MS = 80, WALK_SWING = 0.7
// Подъём с лёгким перелётом (≈ 5 % выше роста) и возвратом
const BACK = 1.2
const overshoot = (k: number) => 1 + (BACK + 1) * (k - 1) ** 3 + BACK * (k - 1) ** 2

// Плоское и служебное не растёт: «плюс» пустого места, квартал архива, кнопка зоны
const grows = (ctx: WorldCtx, id: string) => !isAddId(id) && !id.startsWith('block:') && !ctx.gates.has(id)

// Зовётся после каждой сборки наполнения (build в createWorld)
export function appear(ctx: WorldCtx) {
  const first = seenIds.size === 0
  // Зоны, где что-то уже видели: сверяем до пометки новых
  const known = new Set<WorldZone | null>()
  for (const [id, root] of ctx.roots) if (hasSeen(id)) known.add(zoneOf(root))

  const steps: Array<{ dur: number; wait?: number; step: (k: number) => void }> = []
  for (const [id, root] of ctx.roots) {
    const zone = zoneOf(root)
    const still = first || ctx.reduced || !zone || !known.has(zone) || !grows(ctx, id)
    const crew = root.userData.crew as THREE.Object3D[] | undefined
    if (crew) {
      // Блок целиком не растёт: движется каждая новая фигурка, табличка стоит на месте
      let queue = 0
      crew.forEach((person, i) => {
        const key = `${id}#${i}`
        if (hasSeen(key)) return
        markSeen(key)
        if (still) return
        // Ноль в масштаб не ставим — фигурка тоже цель указателя (см. ниже)
        const home = person.position.z
        const step = (k: number) => {
          const left = 1 - easeOut(k)
          person.position.z = home - WALK_M * left
          person.scale.setScalar(Math.max(0.001, Math.min(1, k * 4)))
          pose(person, left * WALK_SWING)
        }
        steps.push({ dur: WALK_MS, wait: queue++ * WALK_GAP_MS, step })
      })
      markSeen(id)
      continue
    }
    if (hasSeen(id)) continue
    markSeen(id)
    if (still) continue
    if (parseLotId(id)?.part === 'truck') {
      // Перёд машины — +z её осей (cars.ts): старт позади, на своей оси
      const home = root.position.clone(), nose = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion)
      const step = (k: number) => { root.position.copy(home).addScaledVector(nose, -DRIVE_M * (1 - easeOut(k))) }
      steps.push({ dur: DRIVE_MS, step })
    } else {
      // Масштаб корня свой (отель уменьшен целиком) — растём до него. Ноль не ставим:
      // цели указателя и ограда участка лежат в корне, вырожденная матрица их ломает;
      // плоская цель «весь участок» от масштаба по y не меняется и отвечает с первого кадра.
      const full = root.scale.y
      const step = (k: number) => { root.scale.y = full * Math.max(0.001, overshoot(k)) }
      steps.push({ dur: RISE_MS, step })
    }
  }
  if (!steps.length) return
  for (const a of steps) a.step(0)

  // Кадр после пересборки долгий (буферы и шейдеры заливаются заново): часы пускаем со
  // второго кадра, иначе начало движения съедает эта пауза
  let frame = 0, t0 = 0
  ctx.ticks.push((now) => {
    if (!steps.length || frame++ === 0) return
    if (frame === 2) t0 = now
    let live = false
    for (const a of steps) {
      const k = clamp01((now - t0 - (a.wait ?? 0)) / a.dur)
      a.step(k)
      live ||= k < 1
    }
    // Все встали точно в конечное состояние (k = 1) — корни больше не держим
    if (!live) steps.length = 0
  })
}
