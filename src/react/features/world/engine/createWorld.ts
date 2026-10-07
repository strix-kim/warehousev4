// Экземпляр мира. Всё, что в макете было глобалями (W, roots, MATS, GEO…), — поля
// WorldCtx: на уровне модулей движка THREE-объектов нет, иначе StrictMode и HMR
// получают два мира на общих кэшах.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { CameraPose, WorldStore } from '../worldStore'
import type { WorldData } from '../data/types'
import { createLimit, fit, framePoints, placeCamera, pullIn, readPose, restorePose } from './camera'
import { buildCampus } from './zones/campus'
import type { WorldLook } from '../settings'
import { createStyle, disposeStyle, restyle, type WorldStyle } from './style'
import { readTokens } from './tokens'

// Сцена уже — вывески и клавиши HUD переходят в компактный вид
const HUD_COMPACT_WIDTH = 920

export type WorldCtx = {
  container: HTMLElement
  renderer: THREE.WebGLRenderer
  css2d: CSS2DRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  style: WorldStyle
  // Одна геометрия 1×1×1 на всё: размер — scale или матрица в сборке kit()
  box: THREE.BoxGeometry
  wheel: THREE.CylinderGeometry   // ось по y; в колесо — поворот на π/2 по z
  geo: Map<string, THREE.BufferGeometry>
  // id → корневая группа объекта
  roots: Map<string, THREE.Group>
  framePts: THREE.Vector3[]
  limit: THREE.Box3
  // Человек крутил камеру сам: ресайз больше не возвращает рабочий ракурс
  userMoved: boolean
}

export type WorldDeps = {
  store: WorldStore
  // Стартовый облик: палитра и тон контура из настроек устройства
  look: WorldLook
  // Неподвижный мир: без инерции камеры, кадр рисуется по требованию
  reducedMotion: boolean
  // Машины и люди кампуса; без данных кампус стоит пустым
  data?: WorldData
  pose?: CameraPose | null
  onFirstFrame?: () => void
  onContextLost?: () => void
}

export type World = {
  store: WorldStore
  getPose: () => CameraPose
  // Смена облика без перезагрузки: сцена пересобирается, камера остаётся на месте
  setStyle: (look: WorldLook) => void
  dispose: () => void
}

// Освободить всё, что висит на узле: геометрии, материалы и их текстуры
function release(root: THREE.Object3D) {
  root.traverse((o) => {
    const { geometry, material } = o as Partial<THREE.Mesh>
    geometry?.dispose()
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose()
      m.dispose()
    }
  })
}

export function createWorld(container: HTMLElement, deps: WorldDeps): World {
  const tokens = readTokens()
  const style = createStyle(tokens, deps.look)
  // Бросает, если браузер не отдал контекст (лимит контекстов, блок-лист GPU), — ловит вызывающий
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const canvas = renderer.domElement
  container.appendChild(canvas)
  const css2d = new CSS2DRenderer()
  css2d.domElement.className = 'w-labels'
  container.appendChild(css2d.domElement)

  const scene = new THREE.Scene()
  // Фон и туман — в тон земле палитры; setStyle перекрашивает их на месте
  const background = new THREE.Color(style.P.ground)
  scene.background = background
  // Туман цвета земли включён всегда, но вынесен за горизонт: переезд камеры будет
  // двигать near/far. Включать и выключать его нельзя — смена fog пересобирает шейдеры.
  const fog = new THREE.Fog(style.P.ground, 1e4, 1e4 + 1)
  scene.fog = fog
  // Свет: заливка + один направленный, теней нет — схема, а не «как в жизни»
  scene.add(new THREE.AmbientLight(0xffffff, 2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(0.5, 1, 0.25)
  scene.add(sun)

  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 600)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !deps.reducedMotion
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.minPolarAngle = 0.25   // не в зенит
  controls.maxPolarAngle = 1.38   // не под землю

  const ctx: WorldCtx = {
    container, renderer, css2d, scene, camera, controls, style,
    box: new THREE.BoxGeometry(1, 1, 1),
    wheel: new THREE.CylinderGeometry(1, 1, 1, 16),
    geo: new Map(),
    roots: new Map(),
    framePts: [],
    limit: createLimit(),
    userMoved: false,
  }
  controls.addEventListener('start', () => { ctx.userMoved = true })

  const tmp = new THREE.Vector3()
  let seenFrame = false
  const render = () => {
    pullIn(ctx.limit, controls.target, camera.position, tmp)   // сдвиг камеры не уводит цель за пределы сцены
    renderer.render(scene, camera)
    css2d.render(scene, camera)
    if (!seenFrame) { seenFrame = true; deps.onFirstFrame?.() }
  }
  let raf = 0
  const requestRender = () => {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; render() })
  }

  const resize = new ResizeObserver(() => {
    if (!fit(ctx)) return
    deps.store.setState({ hudCompact: container.clientWidth < HUD_COMPACT_WIDTH })
    if (!ctx.userMoved) placeCamera(ctx)
    if (deps.reducedMotion) requestRender()
  })

  const onContextLost = () => deps.onContextLost?.()

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    renderer.setAnimationLoop(null)
    if (raf) cancelAnimationFrame(raf)
    resize.disconnect()
    // Раньше forceContextLoss: собственный снос — не потеря контекста, запасной вид не нужен
    canvas.removeEventListener('webglcontextlost', onContextLost)
    controls.dispose()
    release(scene)
    scene.clear()
    ctx.geo.forEach((g) => g.dispose())
    ctx.geo.clear()
    ctx.box.dispose()
    ctx.wheel.dispose()
    disposeStyle(style)
    ctx.roots.clear()
    ctx.framePts.length = 0
    deps.store.setState({ hover: null, pick: null, labels: new Map() })
    renderer.dispose()
    // Без этого контекст живёт до сборки мусора, а браузер держит их около шестнадцати
    renderer.forceContextLoss()
    canvas.remove()
    css2d.domElement.remove()
  }

  // Наполнение сцены — одно место и на первый кадр, и на смену облика
  const build = () => {
    scene.add(buildCampus(ctx, deps.data ?? { cars: [], people: [] }))
    ctx.framePts = framePoints(ctx)
  }

  // Палитра меняет не только цвета, но и состав мешей: kit() сливает объёмы по
  // материалу, а материал в кэше один на цвет. Роли, совпавшие цветом в белой схеме
  // (стена, навес, вторая стена — все --card), в «Ночи» расходятся, и перекрасить
  // слитый меш на месте нельзя. Поэтому, как restyle макета, наполнение сносится и
  // собирается заново; renderer, свет, камера и её поза остаются.
  let look = deps.look
  const setStyle = (next: WorldLook) => {
    if (disposed || (next.palette === look.palette && next.ink === look.ink)) return
    look = next
    // Всё, кроме света: что именно лежит в сцене, этот код не знает и знать не должен
    for (const o of [...scene.children]) {
      if ((o as THREE.Light).isLight) continue
      release(o)   // общие ctx.box и ctx.wheel тоже: three зальёт их буферы заново при первом кадре
      scene.remove(o)
    }
    ctx.geo.forEach((g) => g.dispose())
    ctx.geo.clear()
    ctx.roots.clear()
    restyle(style, tokens, next)
    background.set(style.P.ground)
    fog.color.set(style.P.ground)
    build()
    if (deps.reducedMotion) requestRender()
  }

  try {
    build()
    // Синхронно, не дожидаясь ResizeObserver: первому кадру нужен верный аспект
    fit(ctx)
    placeCamera(ctx)
    if (deps.pose) restorePose(ctx, deps.pose)

    canvas.addEventListener('webglcontextlost', onContextLost)
    resize.observe(container)
    if (deps.reducedMotion) {
      // Без инерции OrbitControls обновляет камеру прямо в обработчике указателя
      controls.addEventListener('change', requestRender)
      requestRender()
    } else {
      renderer.setAnimationLoop(() => {
        controls.update()
        render()
      })
    }
  } catch (error) {
    dispose()
    throw error
  }

  return { store: deps.store, getPose: () => readPose(ctx), setStyle, dispose }
}
