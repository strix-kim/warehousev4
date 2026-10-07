// Экземпляр мира. Всё, что в макете было глобалями (W, roots, MATS, GEO…), — поля
// WorldCtx: на уровне модулей движка THREE-объектов нет, иначе StrictMode и HMR
// получают два мира на общих кэшах.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, type CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { CameraPose, WorldStore } from '../worldStore'
import type { WorldData } from '../data/types'
import { createLimit, fit, framePoints, placeCamera, pullIn, readPose, restorePose } from './camera'
import { createHudLayout } from './hudLayout'
import { bindPointer, collectPicks } from './pointer'
import { createSelection, type Ring } from './selection'
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
  // id → якорь подписи (здание — WorldSiteId, фигурка — whoLabelId); элементы уходят в стор
  labels: Map<string, CSS2DObject>
  // id здания → кольцо наведения и выбора на земле
  rings: Map<string, Ring>
  // Меши зданий для raycast
  picks: THREE.Object3D[]
  // Ключ подписи фигурки под указателем: её чип показан всегда
  near: string | null
  // Попросить кадр. Неподвижный мир рисуется только по требованию; в живом кадры идут сами
  invalidate: () => void
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
  // Машины и люди кампуса на момент сборки; без данных кампус стоит пустым.
  // Дальше данные приходят через setData.
  data?: WorldData | null
  pose?: CameraPose | null
  // Клик по объекту сцены (id здания): переход в раздел делает оболочка
  onActivate?: (id: string) => void
  onFirstFrame?: () => void
  onContextLost?: () => void
}

export type World = {
  store: WorldStore
  getPose: () => CameraPose
  // Смена облика без перезагрузки: сцена пересобирается, камера остаётся на месте
  setStyle: (look: WorldLook) => void
  // Новые данные: сцена пересобирается, только если изменились машины или люди
  setData: (data: WorldData | null) => void
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

const NO_DATA: WorldData = { cars: [], people: [], sites: { office: null, warehouse: null, garage: null } }

// Наполнение сцены зависит только от машин и людей (числа вывесок рисует оболочка),
// причём от порядка тоже: место у гаража и на кампусе — по номеру в списке
function sameFill(a: WorldData, b: WorldData) {
  return a.cars.length === b.cars.length && a.people.length === b.people.length
    && a.cars.every((car, i) => {
      const other = b.cars[i]!
      return car.id === other.id && car.brand === other.brand && car.model === other.model && car.color === other.color && car.plate === other.plate
    })
    && a.people.every((person, i) => {
      const other = b.people[i]!
      return person.id === other.id && person.firstName === other.firstName && person.lastName === other.lastName
    })
}

export function createWorld(container: HTMLElement, deps: WorldDeps): World {
  const tokens = readTokens()
  const style = createStyle(tokens, deps.look)
  // Бросает, если браузер не отдал контекст (лимит контекстов, блок-лист GPU), — ловит вызывающий
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const canvas = renderer.domElement
  // Картинка мира скринридеру не читается: её объекты продублированы вывесками и клавишами
  canvas.setAttribute('aria-hidden', 'true')
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
    labels: new Map(),
    rings: new Map(),
    picks: [],
    near: null,
    invalidate: () => {},
    framePts: [],
    limit: createLimit(),
    userMoved: false,
  }
  controls.addEventListener('start', () => { ctx.userMoved = true })

  const tmp = new THREE.Vector3()
  let seenFrame = false
  const render = (now: number) => {
    pullIn(ctx.limit, controls.target, camera.position, tmp)   // сдвиг камеры не уводит цель за пределы сцены
    selection.tick(now)
    renderer.render(scene, camera)
    css2d.render(scene, camera)
    hud.layout(now)
    if (!seenFrame) { seenFrame = true; deps.onFirstFrame?.() }
  }
  let raf = 0
  const requestRender = () => {
    if (!raf) raf = requestAnimationFrame((now) => { raf = 0; render(now) })
  }

  let disposed = false
  ctx.invalidate = () => { if (deps.reducedMotion && !disposed) requestRender() }
  const selection = createSelection(ctx, deps.store, deps.reducedMotion)
  const hud = createHudLayout(ctx, deps.store, deps.reducedMotion)
  const unbindPointer = bindPointer(ctx, deps)

  const resize = new ResizeObserver(() => {
    if (!fit(ctx)) return
    const compact = container.clientWidth < HUD_COMPACT_WIDTH
    deps.store.setState({ hudCompact: compact })
    if (!ctx.userMoved) placeCamera(ctx, compact)
    hud.dirty()   // он же просит кадр неподвижному миру
  })

  const onContextLost = () => deps.onContextLost?.()

  // Подписи и кольца живут вместе с наполнением сцены. Элементы подписей снимаем сами:
  // событие removed доходит только до снятого узла, а не до его CSS2DObject в глубине.
  const clearFill = () => {
    ctx.labels.forEach((o) => o.element.remove())
    ctx.labels.clear()
    ctx.rings.clear()
    ctx.picks.length = 0
    ctx.near = null
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    renderer.setAnimationLoop(null)
    if (raf) cancelAnimationFrame(raf)
    resize.disconnect()
    unbindPointer()
    selection.dispose()
    hud.dispose()
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
    clearFill()
    ctx.framePts.length = 0
    deps.store.setState({ hover: null, pick: null, labels: new Map() })
    renderer.dispose()
    // Без этого контекст живёт до сборки мусора, а браузер держит их около шестнадцати
    renderer.forceContextLoss()
    canvas.remove()
    css2d.domElement.remove()
  }

  // Наполнение сцены — одно место и на первый кадр, и на смену облика или данных
  let data = deps.data ?? NO_DATA
  const build = () => {
    scene.add(buildCampus(ctx, data))
    ctx.framePts = framePoints(ctx)
    collectPicks(ctx)
    // Карта — новым объектом: оболочка рисует в элементы порталом и следит за сменой
    deps.store.setState({ labels: new Map([...ctx.labels].map(([id, o]) => [id, o.element])) })
    selection.rebuilt()
    hud.dirty()
  }

  // Пересборка наполнения: renderer, свет, камера и её поза остаются, выбор и наведение
  // возвращает selection.rebuilt() внутри build(). change — что меняется между сносом
  // и сборкой (облик); данным менять нечего, они уже лежат в data.
  const refill = (change?: () => void) => {
    // Всё, кроме света: что именно лежит в сцене, этот код не знает и знать не должен
    for (const o of [...scene.children]) {
      if ((o as THREE.Light).isLight) continue
      // Общие ctx.box, ctx.wheel и материалы из кэша облика тоже: three зальёт буферы
      // и соберёт шейдеры заново при первом кадре
      release(o)
      scene.remove(o)
    }
    ctx.geo.forEach((g) => g.dispose())
    ctx.geo.clear()
    ctx.roots.clear()
    clearFill()
    change?.()
    build()
  }

  // Палитра меняет не только цвета, но и состав мешей: kit() сливает объёмы по
  // материалу, а материал в кэше один на цвет. Роли, совпавшие цветом в белой схеме
  // (стена, навес, вторая стена — все --card), в «Ночи» расходятся, и перекрасить
  // слитый меш на месте нельзя. Поэтому, как restyle макета, наполнение сносится и
  // собирается заново.
  let look = deps.look
  const setStyle = (next: WorldLook) => {
    if (disposed || (next.palette === look.palette && next.ink === look.ink)) return
    look = next
    refill(() => {
      restyle(style, tokens, next)
      background.set(style.P.ground)
      fog.color.set(style.P.ground)
    })
  }

  // Свежий ответ сервера обычно равен кэшу, с которого мир уже собран: сверяем по
  // содержимому, иначе каждая загрузка страницы стоила бы лишней пересборки
  const setData = (next: WorldData | null) => {
    if (disposed) return
    const prev = data
    data = next ?? NO_DATA
    if (!sameFill(prev, data)) refill()
  }

  try {
    build()
    // Синхронно, не дожидаясь ResizeObserver: первому кадру нужен верный аспект
    fit(ctx)
    placeCamera(ctx, container.clientWidth < HUD_COMPACT_WIDTH)
    if (deps.pose) restorePose(ctx, deps.pose)

    canvas.addEventListener('webglcontextlost', onContextLost)
    resize.observe(container)
    if (deps.reducedMotion) {
      // Без инерции OrbitControls обновляет камеру прямо в обработчике указателя
      controls.addEventListener('change', requestRender)
      requestRender()
    } else {
      renderer.setAnimationLoop((now) => {
        controls.update()
        render(now)
      })
    }
  } catch (error) {
    dispose()
    throw error
  }

  return { store: deps.store, getPose: () => readPose(ctx), setStyle, setData, dispose }
}
