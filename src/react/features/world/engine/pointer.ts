// Указатель по сцене: наведение и клик по зданию, чип имени у фигурки под указателем.
import * as THREE from 'three'
import { WORLD_SITES, type WorldStore } from '../worldStore'
import type { WorldCtx } from './createWorld'

// Сдвиг между нажатием и отпусканием больше — это поворот камеры, не клик
const CLICK_SLOP = 5
// Чип под указателем: ближе этого до проекции фигурки, px
const NEAR_PX = 26
// Палец чип не «держит» — показываем на время
const NEAR_TOUCH_MS = 2400

// Кликабельное — только меши зданий; рёбра и силуэт (userData.hull), кольца и земля
// в raycast не идут. Машины в проёмах — дети гаража и отвечают его id.
export function collectPicks(ctx: WorldCtx) {
  ctx.picks.length = 0
  for (const id of WORLD_SITES) {
    ctx.roots.get(id)?.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh || o.userData.hull) return
      o.userData.root = id
      ctx.picks.push(o)
    })
  }
}

type PointerDeps = { store: WorldStore; onActivate?: (id: string) => void }

// Возвращает снятие слушателей
export function bindPointer(ctx: WorldCtx, deps: PointerDeps) {
  const { store } = deps
  const canvas = ctx.renderer.domElement, scene = ctx.container
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), at = new THREE.Vector3()

  const pickAt = (e: PointerEvent): string | null => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, ctx.camera)
    const hit = ray.intersectObjects(ctx.picks, false)[0]
    return (hit?.object.userData.root as string | undefined) ?? null
  }

  // Наведение ставит и оболочка (фокус клавиши, указатель на вывеске). Движок снимает
  // только своё: пустая земля под мышью не должна гасить подсветку от фокуса. А своё
  // ставит заново, если его сняла оболочка (blur вывески при нажатии на сцену).
  let own: string | null = null
  const setHover = (id: string | null) => {
    if (id) store.setState({ hover: id })   // стор сам сверяет: то же значение никого не будит
    else if (own && store.getState().hover === own) store.setState({ hover: null })
    own = id
    scene.classList.toggle('is-pick', !!id)
  }

  // Фигурки не объекты навигации: raycast по ним не идёт, хватает расстояния в пикселях
  // до проекции якоря чипа. Экранные координаты — в долях рамки: zoom оболочки (gotchas §16).
  let nearTimer = 0
  const setNear = (id: string | null) => {
    if (ctx.near === id) return
    ctx.near = id
    ctx.invalidate()
  }
  const nearAt = (e: PointerEvent) => {
    const r = scene.getBoundingClientRect(), w = scene.clientWidth, h = scene.clientHeight
    const x = (e.clientX - r.left) / r.width * w, y = (e.clientY - r.top) / r.height * h
    let best: string | null = null, dist = NEAR_PX
    for (const [id, o] of ctx.labels) {
      if (!o.element.classList.contains('w-who')) continue
      at.setFromMatrixPosition(o.matrixWorld).project(ctx.camera)
      if (Math.abs(at.z) > 1) continue
      const d = Math.hypot((at.x + 1) / 2 * w - x, (1 - at.y) / 2 * h + 12 - y)
      if (d < dist) { dist = d; best = id }
    }
    setNear(best)
  }

  let down: [number, number] | null = null
  const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse' && !e.buttons) setHover(pickAt(e)) }
  const onLeave = () => setHover(null)
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY] }
  const onUp = (e: PointerEvent) => {
    const from = down
    down = null
    if (!from || Math.hypot(e.clientX - from[0], e.clientY - from[1]) > CLICK_SLOP) return
    const id = pickAt(e)
    if (!id) return
    store.setState({ pick: id })
    deps.onActivate?.(id)
  }
  const onCancel = () => { down = null }

  const onSceneMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') nearAt(e) }
  const onSceneDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    nearAt(e)
    window.clearTimeout(nearTimer)
    nearTimer = window.setTimeout(() => setNear(null), NEAR_TOUCH_MS)
  }
  const onSceneLeave = () => setNear(null)

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  scene.addEventListener('pointermove', onSceneMove)
  scene.addEventListener('pointerdown', onSceneDown)
  scene.addEventListener('pointerleave', onSceneLeave)

  return () => {
    window.clearTimeout(nearTimer)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerleave', onLeave)
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onCancel)
    scene.removeEventListener('pointermove', onSceneMove)
    scene.removeEventListener('pointerdown', onSceneDown)
    scene.removeEventListener('pointerleave', onSceneLeave)
    scene.classList.remove('is-pick')
  }
}
