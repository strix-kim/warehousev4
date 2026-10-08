// Экземпляр мира. Всё, что в макете было глобалями (W, roots, MATS, GEO…), — поля
// WorldCtx: на уровне модулей движка THREE-объектов нет, иначе StrictMode и HMR
// получают два мира на общих кэшах.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, type CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { CameraPose, WorldStore, WorldTexts, WorldZone } from '../worldStore'
import type { WorldData } from '../data/types'
import { appear } from './appear'
import { aimAt, createLimit, fit, framePoints, limitTo, placeCamera, pullIn, readPose, restorePose, tickFlight, type Flight } from './camera'
import { still, type Glide } from './ease'
import type { Gate } from './groundLabel'
import { createHudLayout } from './hudLayout'
import { createPanelShift } from './panelShift'
import { bindPointer } from './pointer'
import { createSelection, type Fence, type Plus, type Ring } from './selection'
import { buildMap, retextGates, tickZones } from './zones/layout'
import { createZoneTravel, zoneOf } from './zoneTravel'
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
  // lotPartId('lot', venueId) → ограда участка; id → «плюс» пустого места (selection.ts)
  fences: Map<string, Fence>
  pluses: Map<string, Plus>
  // id → кнопка зоны на земле (groundLabel.ts)
  gates: Map<string, Gate>
  // Цели указателя: меши с userData.root = id. Пополняют pickable / hitPlane (pointer.ts)
  picks: THREE.Object3D[]
  // Покадровая работа зон (жизнь, рост зданий): строитель зоны кладёт сюда функцию при
  // сборке, кадр зовёт её перед рендером; список живёт до пересборки сцены. Нужен новый
  // кадр в неподвижном мире — ctx.invalidate().
  ticks: Array<(now: number) => void>
  // Зона под камерой; построенные зоны (в порядке ряда) и их группы
  zone: WorldZone
  zones: WorldZone[]
  zoneRoots: Map<WorldZone, THREE.Group>
  // Зона, под которую показаны кнопки на земле: в переезде — прежняя
  zoneShown: WorldZone
  // Уровень приглушения каждой зоны: 0 — яркая, 1 — приглушена
  zoneDim: Record<WorldZone, Glide>
  // Переезд камеры между зонами; пока он идёт, указатель ничего не активирует
  flight: Flight | null
  // Кнопка на земле под нажатым указателем
  press: string | null
  // Последнее попадание указателя в цель: точка в осях мира и момент (performance.now)
  hit: { point: THREE.Vector3; at: number } | null
  // Активация объекта: клик в сцене; кнопка зоны — переезд, остальное — выбор и оболочка
  activate: (id: string) => void
  // Неподвижный мир (prefers-reduced-motion): анимации встают в конечное состояние сразу
  reduced: boolean
  tmpColor: THREE.Color
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
  // Надписи кнопок на земле на момент сборки; дальше — setTexts
  texts: WorldTexts
  // Зона из адреса на момент сборки; дальше — goZone
  zone?: WorldZone
  // Клик по объекту сцены (id здания, участка, места, «плюса»): что с ним делать, решает оболочка
  onActivate?: (id: string) => void
  // Нажата кнопка зоны на земле: оболочка пишет зону в адрес и зовёт goZone
  onZone?: (zone: WorldZone) => void
  onFirstFrame?: () => void
  onContextLost?: () => void
}

export type World = {
  store: WorldStore
  getPose: () => CameraPose
  // Смена облика без перезагрузки: сцена пересобирается, камера остаётся на месте
  setStyle: (look: WorldLook) => void
  // Новые данные: сцена пересобирается, только если изменились машины, люди или зоны
  setData: (data: WorldData | null) => void
  // Новые надписи на земле (смена языка, чисел): перерисовка без пересборки
  setTexts: (texts: WorldTexts) => void
  // Камера переезжает к зоне (неподвижный мир — мгновенно). Зоны без данных нет на
  // карте — камера остаётся на кампусе, а просьбу мир помнит до появления данных.
  goZone: (zone: WorldZone) => void
  // Камера подъезжает к объекту по его id (неподвижный мир — мгновенно). Объект в другой
  // зоне — сначала переезд в неё: зону просим у оболочки (onZone), как кнопка на земле, и
  // смена зоны, как всегда, снимает выбор; в своей зоне pick не меняется. Незнакомый id —
  // ничего.
  focus: (id: string) => void
  dispose: () => void
}

// Освободить всё, что висит на узле: геометрии, материалы и их текстуры, буферы
// матриц InstancedMesh (ограды участков)
function release(root: THREE.Object3D) {
  root.traverse((o) => {
    const { geometry, material } = o as Partial<THREE.Mesh>
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose()
    geometry?.dispose()
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose()
      m.dispose()
    }
  })
}

const NO_DATA: WorldData = { cars: [], people: [], venues: null, archive: null, mock: false, sites: { office: null, warehouse: null, garage: null } }

// Наполнение сцены зависит от машин, людей, площадок и архива (числа вывесок рисует
// оболочка), причём от порядка тоже: место у гаража и на кампусе — по номеру в списке.
// Площадки и архив сверяются ссылкой: адаптер отдаёт тот же массив, пока источник не ответил заново.
function sameFill(a: WorldData, b: WorldData) {
  return a.venues === b.venues && a.archive === b.archive
    && a.cars.length === b.cars.length && a.people.length === b.people.length
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
    fences: new Map(),
    pluses: new Map(),
    gates: new Map(),
    picks: [],
    ticks: [],
    zone: 'campus',
    zones: ['campus'],
    zoneRoots: new Map(),
    zoneShown: 'campus',
    zoneDim: { campus: still(0), venues: still(1), archive: still(1) },
    flight: null,
    press: null,
    hit: null,
    activate: () => {},
    reduced: deps.reducedMotion,
    tmpColor: new THREE.Color(),
    near: null,
    invalidate: () => {},
    framePts: [],
    limit: createLimit(),
    userMoved: false,
  }
  // Подводка к объекту (focus): aim — камера едет к нему; aimNext — id объекта, к которому
  // она подъедет, когда встанет на зону (объект в другой зоне или переезд ещё идёт)
  let aim: Flight | null = null, aimNext: string | null = null
  // Человек взял камеру сам — подводка отпускает её там, где застал
  controls.addEventListener('start', () => { ctx.userMoved = true; aim = null })

  const tmp = new THREE.Vector3()
  let seenFrame = false
  const render = (now: number) => {
    if (ctx.flight) {
      // Переезд: камерой правит анимация, OrbitControls выключены
      aim = null
      if (tickFlight(ctx, ctx.flight, now)) land()
    } else if (aim) {
      if (tickFlight(ctx, aim, now)) endAim()
    } else pullIn(ctx.limit, controls.target, camera.position, tmp)   // сдвиг камеры не уводит цель за пределы сцены
    tickZones(ctx, now, deps.store.getState().hover)
    for (const tick of ctx.ticks) tick(now)
    selection.tick(now)
    panelShift(now)
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
  const panelShift = createPanelShift(ctx, deps.store, deps.reducedMotion)
  const unbindPointer = bindPointer(ctx, deps)

  const isCompact = () => container.clientWidth < HUD_COMPACT_WIDTH
  const resize = new ResizeObserver(() => {
    if (!fit(ctx)) return
    const compact = isCompact()
    deps.store.setState({ hudCompact: compact })
    if (ctx.flight) land()   // цель переезда посчитана под прежнее окно
    else if (aim) endAim()
    else if (!ctx.userMoved) placeCamera(ctx, compact)
    hud.dirty()   // он же просит кадр неподвижному миру
  })

  // Подводка встала (или оборвана пересборкой): камера — в конечной позе. Поза теперь
  // «своя», как после руки человека: ресайз не возвращает рабочий ракурс зоны.
  const endAim = () => {
    if (!aim) return
    camera.position.copy(aim.p1)
    controls.target.copy(aim.t1)
    aim = null
    controls.update()
    ctx.userMoved = true
    hud.dirty()   // он же просит кадр неподвижному миру
  }
  const focus = (id: string) => {
    if (disposed) return
    const root = ctx.roots.get(id), zone = zoneOf(root)
    if (!root || !zone) return
    aimNext = null
    if (zone !== ctx.zone) {
      // Хозяин зоны — адрес: просим оболочку, она позовёт goZone; подводка — с посадки
      aimNext = id
      if (deps.onZone) deps.onZone(zone)
      else goZone(zone)
      return
    }
    if (ctx.flight) { aimNext = id; return }
    aim = aimAt(ctx, root, performance.now())
    if (deps.reducedMotion || !seenFrame) endAim()
  }
  // Камера встала на зону: отложенная подводка — если объект ещё есть и зона его
  const landed = () => {
    const id = aimNext
    aimNext = null
    if (id && zoneOf(ctx.roots.get(id)) === ctx.zone) focus(id)
  }

  const travel = createZoneTravel(ctx, deps, { hud, isCompact, seenFrame: () => seenFrame, placed: () => placed, disposed: () => disposed, landed })
  const { land, goZone } = travel

  const onContextLost = () => deps.onContextLost?.()

  // Подписи и кольца живут вместе с наполнением сцены. Элементы подписей снимаем сами:
  // событие removed доходит только до снятого узла, а не до его CSS2DObject в глубине.
  const clearFill = () => {
    ctx.labels.forEach((o) => o.element.remove())
    ctx.labels.clear()
    ctx.rings.clear()
    ctx.fences.clear()
    ctx.pluses.clear()
    ctx.gates.clear()
    ctx.zoneRoots.clear()
    ctx.picks.length = 0
    ctx.ticks.length = 0
    ctx.press = null
    ctx.hit = null
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
    deps.store.setState({ hover: null, pick: null, flying: false, labels: new Map() })
    renderer.dispose()
    // Без этого контекст живёт до сборки мусора, а браузер держит их около шестнадцати
    renderer.forceContextLoss()
    canvas.remove()
    css2d.domElement.remove()
  }

  // Наполнение сцены — одно место и на первый кадр, и на смену облика или данных
  let data = deps.data ?? NO_DATA
  let texts = deps.texts
  // Камера уже расставлена под окно (после первого fit): до этого аспекта нет
  let placed = false
  const build = () => {
    const before = ctx.zones
    scene.add(buildMap(ctx, data, texts))
    ctx.framePts = framePoints(ctx)
    const same = before.length === ctx.zones.length && before.every((zone, i) => zone === ctx.zones[i])
    // Карта — новым объектом: оболочка рисует в элементы порталом и следит за сменой.
    // Состав зон — тем же массивом, пока не изменился.
    deps.store.setState({ labels: new Map([...ctx.labels].map(([id, o]) => [id, o.element])), zones: same ? deps.store.getState().zones : [...ctx.zones] })
    travel.settle(same)
    selection.rebuilt()
    hud.dirty()
    // Новое в сцене появляется движением. Последним: рамка кадра и состояние выбора уже
    // сняты с объектов в полный рост
    appear(ctx)
  }

  // Пересборка наполнения: renderer, свет, камера и её поза остаются, выбор и наведение
  // возвращает selection.rebuilt() внутри build(). change — что меняется между сносом
  // и сборкой (облик); данным менять нечего, они уже лежат в data.
  const refill = (change?: () => void) => {
    // Переезд и подводка целились в сцену, которой сейчас не станет
    if (ctx.flight) land()
    endAim()
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

  const setTexts = (next: WorldTexts) => {
    if (disposed) return
    texts = next
    retextGates(ctx, next)
  }

  try {
    build()
    // Синхронно, не дожидаясь ResizeObserver: первому кадру нужен верный аспект
    fit(ctx)
    placed = true
    limitTo(ctx.limit, ctx.zone)
    placeCamera(ctx, isCompact())
    if (deps.pose) restorePose(ctx, deps.pose)

    canvas.addEventListener('webglcontextlost', onContextLost)
    resize.observe(container)
    if (deps.reducedMotion) {
      // Без инерции OrbitControls обновляет камеру прямо в обработчике указателя
      controls.addEventListener('change', requestRender)
      requestRender()
    } else {
      renderer.setAnimationLoop((now) => {
        if (!ctx.flight && !aim) controls.update()
        render(now)
      })
    }
  } catch (error) {
    dispose()
    throw error
  }

  return { store: deps.store, getPose: () => readPose(ctx), setStyle, setData, setTexts, goZone, focus, dispose }
}
