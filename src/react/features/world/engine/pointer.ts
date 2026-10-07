// Указатель по сцене: наведение и клик по объекту зоны под камерой, кнопки на земле,
// приглушённые соседи целиком, чип имени у фигурки под указателем.
import * as THREE from 'three'
import { gateId, lotPartId, parseLotId, WORLD_SITES, type WorldStore, type WorldZone } from '../worldStore'
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
  for (const id of WORLD_SITES) {
    const root = ctx.roots.get(id)
    if (root) pickable(ctx, root, id)
  }
}

// Сделать объект целью указателя: все его меши (кроме контура) отвечают id. Зовут
// строители зон при сборке; зону цели потом проставит zones/layout.ts по предкам.
// Список живёт до пересборки сцены (clearFill в createWorld).
export function pickable(ctx: WorldCtx, root: THREE.Object3D, id: string) {
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || o.userData.hull) return
    o.userData.root = id
    ctx.picks.push(o)
  })
}

// Невидимая плоская цель на земле (весь участок, пустое место, вся зона): w × d с
// центром в (x, z) в осях parent. Невидима, но остаётся visible — иначе указатель её отсеет.
export function hitPlane(ctx: WorldCtx, parent: THREE.Object3D, w: number, d: number, x: number, z: number, id: string, y = 0.01) {
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
  hit.rotation.x = -Math.PI / 2
  hit.position.set(x, y, z)
  parent.add(hit)
  pickable(ctx, hit, id)
  return hit
}

type PointerDeps = { store: WorldStore }

// raycast на visible не смотрит: скрытое (кнопка зоны не в свою очередь) отсекаем сами
function shown(o: THREE.Object3D | null) {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}

// Возвращает снятие слушателей
export function bindPointer(ctx: WorldCtx, deps: PointerDeps) {
  const { store } = deps
  const canvas = ctx.renderer.domElement, scene = ctx.container
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), at = new THREE.Vector3()

  const pickAt = (e: PointerEvent): string | null => {
    // В переезде камеры ничего не наводится и не нажимается
    if (ctx.flight) return null
    const r = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, ctx.camera)
    const hit = ray.intersectObjects(ctx.picks, false).find((h) => shown(h.object))
    // От ближнего к клику угла поднимается ограда участка (selection.ts)
    ctx.hit = hit ? { point: hit.point.clone(), at: performance.now() } : null
    if (!hit) return null
    const id = hit.object.userData.root as string, zone = hit.object.userData.zone as WorldZone | null
    // Приглушённая зона целиком — цель своей кнопки на земле; пустая земля своей зоны — не цель
    if (zone && zone !== ctx.zone) return gateId(zone, ctx.zone)
    if (id.startsWith('zone:')) return null
    // Пальцем и в компактной сцене грузовик, отель и план в 44 px не помещаются: цель — весь участок
    const lot = parseLotId(id)
    if (lot && (e.pointerType !== 'mouse' || store.getState().hudCompact)) return lotPartId('lot', lot.venueId)
    return id
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
      // Чипы приглушённых зон сняты со слоя камеры
      if (!o.element.classList.contains('w-who') || !o.layers.test(ctx.camera.layers)) continue
      at.setFromMatrixPosition(o.matrixWorld).project(ctx.camera)
      if (Math.abs(at.z) > 1) continue
      const d = Math.hypot((at.x + 1) / 2 * w - x, (1 - at.y) / 2 * h + 12 - y)
      if (d < dist) { dist = d; best = id }
    }
    setNear(best)
  }

  let down: [number, number] | null = null
  const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse' && !e.buttons) setHover(pickAt(e)) }
  // Нажатая кнопка на земле вдавливается, пока палец или кнопка мыши не отпущены
  const setPress = (id: string | null) => {
    if (ctx.press === id) return
    ctx.press = id
    ctx.invalidate()
  }
  const onLeave = () => { setHover(null); setPress(null) }
  const onDown = (e: PointerEvent) => {
    down = [e.clientX, e.clientY]
    const id = pickAt(e)
    setPress(id?.startsWith('gate:') ? id : null)
  }
  const onUp = (e: PointerEvent) => {
    const from = down
    down = null
    setPress(null)
    if (!from || ctx.flight || Math.hypot(e.clientX - from[0], e.clientY - from[1]) > CLICK_SLOP) return
    const id = pickAt(e)
    if (id) ctx.activate(id)
    // Клик по пустой земле снимает выбор участка или места; у кампуса выбор — переход в раздел
    else if (ctx.zone !== 'campus') store.setState({ pick: null })
  }
  const onCancel = () => { down = null; setPress(null) }

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
