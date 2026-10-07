// Кнопка на земле — переход между зонами в языке мира: объёмная плита со скруглёнными
// в плане углами и контуром, лежит в гнезде (плита в тон разметки). На верхней грани —
// значок зоны, имя и подстрочник (CanvasTexture). Наведение и фокус дубля — приподнята
// и светлее; нажатие — вдавлена в гнездо и горит акцентом; после активации держит свет,
// пока едет камера (lit). Неподвижный мир — без движения, только цвет.
// Характер — «Клавиша» макета с51 (тёмная, как плашки вывесок); «Галька» не перенесена.
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { WorldZone } from '../worldStore'
import type { WorldCtx } from './createWorld'
import { glide, glideStep, still, type Glide } from './ease'
import { inkLines } from './primitives'
import { flat, mix } from './style'

const GATE_LIFT = 0.3
// Уже этого сцена — надпись на земле не читается: кнопок нет, остаются кнопки HUD
export const GATE_MIN_WIDTH = 560
// Толщина плиты и радиус углов в долях меньшей стороны
const LOOK = { h: 0.75, round: 0.3, bevel: 0.2 }

export type Gate = {
  id: string
  to: WorldZone
  // Промежуток между зонами, в котором лежит кнопка (см. gateId в worldStore)
  gap: number
  g: THREE.Group
  slab: THREE.Group
  top: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  words: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  // Держит свет: ставит активация, снимает конец переезда
  lit: boolean
  base: THREE.Color; hot: THREE.Color; glowC: THREE.Color; ink: THREE.Color; litInk: THREE.Color
  lift: Glide; tone: Glide; glow: Glide
  // Перерисовать надпись: новые строки (смена языка, чисел) или догрузился шрифт
  retext: (name?: string, sub?: string) => void
}

// Плита w × d × h на земле: углы в плане радиусом r, кромка-фаска b. smooth — сглаженные
// нормали (нужны контуру-силуэту)
function padGeo(w: number, d: number, h: number, r: number, b: number, smooth = false) {
  const s = new THREE.Shape(), x = w / 2 - b, y = d / 2 - b, q = Math.min(Math.max(r - b, 0.05), x, y), H = Math.PI / 2
  s.moveTo(-x + q, -y)
  s.absarc(x - q, -y + q, q, -H, 0); s.absarc(x - q, y - q, q, 0, H); s.absarc(-x + q, y - q, q, H, 2 * H); s.absarc(-x + q, -y + q, q, 2 * H, 3 * H)
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 })
  g.deleteAttribute('uv')
  if (smooth) { g.deleteAttribute('normal'); const m = mergeVertices(g, 1e-3); g.dispose(); g = m; g.computeVertexNormals() }
  return g.rotateX(-H).translate(0, b, 0)
}

// Контур плиты в плане на высоте y — пары точек для inkLines
function padRim(w: number, d: number, r: number, y: number) {
  const x = w / 2, z = d / 2, q = Math.min(r, x, z), pts: number[] = [], path: Array<[number, number]> = []
  for (const [cx, cz, a0] of [[x - q, z - q, 0], [-x + q, z - q, 1], [-x + q, -z + q, 2], [x - q, -z + q, 3]] as const)
    for (let j = 0; j <= 8; j++) { const a = (a0 + j / 8) * Math.PI / 2; path.push([cx + q * Math.cos(a), cz + q * Math.sin(a)]) }
  path.forEach((a, j) => { const b = path[(j + 1) % path.length]!; pts.push(a[0], y, a[1], b[0], y, b[1]) })
  return pts
}

// Значки зон: белым в квадрате s × s от (x, y); цвет даёт материал надписи
type Draw = CanvasRenderingContext2D
const ICONS: Record<WorldZone, (g: Draw, x: number, y: number, s: number) => void> = {
  campus(g, x, y, s) {   // офис с флагом
    const r = (a: number, b: number, w: number, h: number) => { g.beginPath(); g.roundRect(x + s * a, y + s * b, s * w, s * h, s * 0.05); g.fill() }
    r(0.06, 0.4, 0.48, 0.52); r(0.6, 0.6, 0.34, 0.32); r(0.2, 0.08, 0.07, 0.36); r(0.2, 0.08, 0.34, 0.18)
  },
  venues(g, x, y, s) {   // арена: купол на кольце
    g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.58, s * 0.38, s * 0.38, 0, Math.PI, 2 * Math.PI); g.fill()
    g.beginPath(); g.roundRect(x + s * 0.04, y + s * 0.64, s * 0.92, s * 0.26, s * 0.08); g.fill()
  },
  archive(g, x, y, s) {   // три здания разной высоты
    for (const [a, b] of [[0.06, 0.48], [0.38, 0.12], [0.7, 0.32]] as const) { g.beginPath(); g.roundRect(x + s * a, y + s * b, s * 0.24, s * (0.9 - b), s * 0.05); g.fill() }
  },
}

// Надпись на верхней грани: значок слева, справа имя и подстрочник. Холст 1024 × h
// под пропорции грани.
function gateTexture(ctx: WorldCtx, icon: WorldZone, aspect: number, name: string, sub: string) {
  const c = document.createElement('canvas'), tex = new THREE.CanvasTexture(c)
  c.width = 1024; c.height = Math.round(1024 / aspect)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const css = getComputedStyle(document.documentElement)
  const fonts = { '800': css.getPropertyValue('--f-display').trim(), '600': css.getPropertyValue('--f-text').trim() }
  const draw = () => {
    const g = c.getContext('2d')
    if (!g) return
    const H = c.height, s = Math.min(H * 0.8, 300), x0 = s + Math.min(H * 0.2, 64), room = c.width - x0 - 8
    g.clearRect(0, 0, c.width, H)
    g.fillStyle = g.strokeStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'
    ICONS[icon](g, 4, (H - s) / 2, s)
    // Имя — крупно, но не шире грани; подстрочник — тем же правилом
    const fit = (str: string, weight: '800' | '600', px: number) => {
      g.font = `${weight} ${px}px ${fonts[weight]}`
      const w = g.measureText(str).width
      if (w > room) g.font = `${weight} ${Math.floor(px * room / w)}px ${fonts[weight]}`
    }
    fit(name, '800', Math.min(H * 0.44, 150))
    g.fillText(name, x0, sub ? H * 0.34 : H * 0.5)
    if (sub) { fit(sub, '600', Math.min(H * 0.27, 92)); g.globalAlpha = 0.82; g.fillText(sub, x0, H * 0.73); g.globalAlpha = 1 }
    tex.needsUpdate = true
    ctx.invalidate()
  }
  const retext = (nextName = name, nextSub = sub) => {
    name = nextName; sub = nextSub
    draw()   // до загрузки шрифта — системным
    // fonts.ready не ждёт начертания, которого на странице ещё не было (Manrope 800 с
    // кириллицей или «o‘»): просим его явно под эту строку и перерисовываем
    const loads = [document.fonts?.load(`800 100px ${fonts['800']}`, name), sub ? document.fonts?.load(`600 100px ${fonts['600']}`, sub) : null]
    void Promise.all(loads).then(() => { if (nextName === name && nextSub === sub) draw() }, () => {})
  }
  retext()
  return { tex, retext }
}

// (x, z) — центр, w — вдоль строки текста, d — глубина, rot — поворот вокруг y.
// Материалы свои (плита меняет цвет по кадрам) и вне приглушения зон: кнопка лежит в
// промежутке. Геометрии, материалы и текстуру освобождает общий обход сцены.
export function makeGate(ctx: WorldCtx, parent: THREE.Object3D, id: string, to: WorldZone, gap: number, text: { name: string; sub: string }, at: { x: number; z: number; w: number; d: number; rot: number }): Gate {
  const { P } = ctx.style, { w, d } = at, { h, bevel: b } = LOOK
  const g = new THREE.Group(), slab = new THREE.Group()
  const r = Math.min(w, d) * LOOK.round
  g.position.set(at.x, 0, at.z)
  g.rotation.y = at.rot
  // Гнездо: остаётся на земле, когда кнопка приподнята, и принимает её, когда она нажата
  g.add(new THREE.Mesh(padGeo(w + 1, d + 1, 0.12, r + 0.5, 0), flat(ctx.style, P.mark)))
  const top = new THREE.Mesh(padGeo(w, d, h, r, b), new THREE.MeshLambertMaterial({ color: P.gate }))
  const hm = new THREE.Mesh(padGeo(w, d, h, r, b, true), ctx.style.hull)
  hm.userData.hull = true
  slab.add(top, hm, inkLines(ctx, padRim(w - 2 * b, d - 2 * b, Math.max(r - b, 0), h + 0.004)))
  // Надпись лежит на верхней грани, с полями от кромки
  const tw = w - Math.max(1.4, r * 0.9), th = d - Math.max(1, r * 0.5)
  const { tex, retext } = gateTexture(ctx, to, tw / th, text.name, text.sub)
  const words = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshBasicMaterial({ map: tex, color: P.ground, transparent: true, depthWrite: false }))
  words.rotation.x = -Math.PI / 2
  words.position.y = h + 0.012
  slab.add(words)
  slab.position.y = 0.1
  g.add(slab)
  parent.add(g)
  const C = (c: string) => new THREE.Color(c)
  const gate: Gate = {
    id, to, gap, g, slab, top, words, lit: false, retext,
    base: C(P.gate), hot: C(mix(P.gate, P.ground, 0.1)), glowC: C(P.accent), ink: C(P.ground), litInk: C(P.ground),
    lift: still(), tone: still(), glow: still(),
  }
  ctx.roots.set(id, g)
  ctx.gates.set(id, gate)
  return gate
}

// Кадр кнопок: подъём, тон и свет. on(gate) — видна ли кнопка сейчас (решает раскладка
// зон); hover — id под указателем или в фокусе дубля.
export function tickGates(ctx: WorldCtx, now: number, hover: string | null, on: (gate: Gate) => boolean) {
  const still = ctx.reduced, tmp = ctx.tmpColor
  for (const q of ctx.gates.values()) {
    const hot = hover === q.id, down = q.lit || ctx.press === q.id
    q.g.visible = on(q)
    glide(q.lift, still ? 0 : down ? 0.14 - LOOK.h : hot ? GATE_LIFT : 0, down ? 90 : 180, now)
    glide(q.tone, hot ? 1 : 0, 160, now)
    glide(q.glow, down ? 1 : 0, down ? 90 : 260, now)
    q.slab.position.y = 0.1 + glideStep(q.lift, now, still)
    const glow = glideStep(q.glow, now, still)
    q.top.material.color.lerpColors(q.base, q.hot, glideStep(q.tone, now, still)).lerp(q.glowC, glow)
    q.top.material.emissive.copy(tmp.copy(q.glowC).multiplyScalar(0.4 * glow))
    q.words.material.color.lerpColors(q.ink, q.litInk, glow)
  }
}
