// Экземпляр мира. Всё, что в макете было глобалями (W, roots, MATS, GEO…), — поля
// WorldCtx: на уровне модулей движка THREE-объектов нет, иначе StrictMode и HMR
// получают два мира на общих кэшах.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { CameraPose, WorldStore } from '../worldStore'
import { buildOffice } from './buildings'
import { createLimit, fit, framePoints, placeCamera, pullIn, readPose, restorePose } from './camera'
import { CAMPUS_HALF, ground, roads } from './ground'
import { kit } from './primitives'
import { createStyle, disposeStyle, type WorldStyle } from './style'
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
  // Неподвижный мир: без инерции камеры, кадр рисуется по требованию
  reducedMotion: boolean
  pose?: CameraPose | null
  onFirstFrame?: () => void
  onContextLost?: () => void
}

export type World = {
  store: WorldStore
  getPose: () => CameraPose
  dispose: () => void
}

function buildCampus(ctx: WorldCtx) {
  const g = new THREE.Group()
  ground(ctx, g, CAMPUS_HALF * 2)
  const k = kit(ctx)
  roads(ctx, k)
  k.into(g)
  g.add(buildOffice(ctx))
  return g
}

export function createWorld(container: HTMLElement, deps: WorldDeps): World {
  const style = createStyle(readTokens())
  // Бросает, если браузер не отдал контекст (лимит контекстов, блок-лист GPU), — ловит вызывающий
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const canvas = renderer.domElement
  container.appendChild(canvas)
  const css2d = new CSS2DRenderer()
  css2d.domElement.className = 'w-labels'
  container.appendChild(css2d.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(style.P.ground)
  // Туман цвета земли включён всегда, но вынесен за горизонт: переезд камеры будет
  // двигать near/far. Включать и выключать его нельзя — смена fog пересобирает шейдеры.
  scene.fog = new THREE.Fog(style.P.ground, 1e4, 1e4 + 1)
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
    scene.traverse((o) => {
      const { geometry, material } = o as Partial<THREE.Mesh>
      geometry?.dispose()
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        (m as THREE.MeshBasicMaterial).map?.dispose()
        m.dispose()
      }
    })
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

  try {
    scene.add(buildCampus(ctx))
    ctx.framePts = framePoints(ctx)
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

  return { store: deps.store, getPose: () => readPose(ctx), dispose }
}
