// Облик мира: палитра ролей и материалы из неё. Форма одна — «Галька + контур»
// (softline макета с50); остальные формы остались на стенде voxel-style-s48.
import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { WorldInk, WorldLook, WorldPalette } from '../settings'
import type { WorldZone } from '../worldStore'
import type { Tokens } from './tokens'

export const mix = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()

// Палитра — одна таблица ролей на все материалы мира. Значения — токены и их смеси.
//   ground земля (она же фон сцены и туман) · grid/gridA сетка и её непрозрачность · road дорога · mark осевая
//   floor пол гаража · pad площадка перед гаражом · yard двор за воротами · paint разметка мест
//   wall стена · wall2 вторая стена (рампа, полки, табличка, головы) · roof крыша-плита · roofMass крыша-объём
//   canopy навес · door ворота и вход · glass окна и светильники · carGlass салон машины
//   dark тёмная деталь (столбы, кейсы) · sign/signMark вывеска и её знак · steel сталь · tire шина
//   accent акцент · lamp фары · leaf зелень · edge тонкие линии · ink контур: три тона от мягкого к бледному
//   gate надпись на земле · ringSel/ringHover выбор и наведение · cloth одежда фигурок · skin головы · legs ноги
export type Palette = {
  ground: string; grid: string; gridA: number; road: string; mark: string; floor: string; pad: string; yard: string; paint: string
  wall: string; wall2: string; roof: string; roofMass: string; canopy: string; door: string; glass: string; carGlass: string
  dark: string; sign: string; signMark: string; steel: string; tire: string; accent: string; lamp: string; leaf: string
  edge: string; gate: string; ink: [string, string, string]; ringSel: string; ringHover: string
  cloth: [string, string, string]; skin: string; legs: string
}

function whitePalette(T: Tokens): Palette {
  return {
    ground: T.bg, grid: T.ink, gridA: 0.07, road: T.line, mark: T.ctl, floor: T.select, pad: T.sunk, yard: T.card, paint: T.card,
    wall: T.card, wall2: T.card, roof: T.night3, roofMass: T.card, canopy: T.card, door: T.night3, glass: T.select, carGlass: T.night3,
    dark: T.night3, sign: T.night3, signMark: T.red, steel: T.ctl, tire: T.night3, accent: T.red, lamp: T.warnBg, leaf: mix(T.ok, T.card, 0.4),
    edge: T.line, gate: T.ink, ink: [T.muted, T.soft, mix(T.soft, T.line, 0.4)], ringSel: T.red, ringHover: T.ctl,
    cloth: [T.select, T.night3, T.line], skin: T.card, legs: T.night3,
  }
}

// Тёмный мир в тон сайдбару: окна и проёмы светятся, акцент — --red-night.
// Контур в ночи ТЁМНЫЙ по серой стене: светлая линия по стене даёт контраст не выше 2,8
// и, тускнея к --night-line, проходит через цвет самой стены (пропадает); тёмная держит
// те же ступени контраста к заливке, что и в белой схеме. Силуэт к земле при этом
// слабый — объём от земли отделяет заливка.
function nightPalette(T: Tokens): Palette {
  return {
    ground: T.night, grid: T.nightLine, gridA: 1, road: T.night2, mark: mix(T.night3, T.onNight2, 0.5), floor: T.night2, pad: T.night2, yard: T.night3, paint: mix(T.night3, T.onNight2, 0.6),
    wall: mix(T.night3, T.onNight, 0.3), wall2: mix(T.night3, T.onNight, 0.42), roof: T.night3, roofMass: mix(T.night3, T.onNight, 0.16), canopy: mix(T.night3, T.onNight, 0.42), door: T.onNight2, glass: T.onNight, carGlass: T.night2,
    dark: mix(T.night3, T.onNight2, 0.5), sign: T.night, signMark: T.redNight, steel: T.onNight2, tire: T.nightLine, accent: T.redNight, lamp: T.warnBg, leaf: mix(T.ok, T.night3, 0.35),
    edge: mix(T.nightLine, T.onNight2, 0.35), gate: T.onNight, ink: [T.night3, mix(T.night3, T.onNight2, 0.1), mix(T.night3, T.onNight2, 0.25)], ringSel: T.red, ringHover: T.onNight2,
    cloth: [T.onNight2, mix(T.night3, T.onNight, 0.2), T.onNight], skin: T.onNight, legs: mix(T.night3, T.onNight2, 0.5),
  }
}

const PALETTES: Record<WorldPalette, (T: Tokens) => Palette> = { white: whitePalette, night: nightPalette }
// Ступень контура → место в роли ink палитры
const INK_STEP: Record<WorldInk, 0 | 1 | 2> = { ink1: 0, ink2: 1, ink3: 2 }

// Толщина контура в px экрана, одна на силуэт и на линии рёбер
export const INK_WIDTH = 2

export type Roles = Record<
  'glass' | 'band' | 'dark' | 'white' | 'red' | 'steel' | 'leaf' | 'roof' | 'canopy' | 'door' | 'sign' | 'signMark' | 'carGlass' | 'tire' | 'lamp',
  THREE.MeshLambertMaterial
>

// Материалы одной зоны карты. Кэш у каждой зоны свой — это и есть «зона в ключе
// кэша»: одинаковый цвет в кампусе и на «Площадках» — два материала, и приглушить
// соседа можно, не трогая активную зону. map — общее карты (дорога и кнопки в
// промежутках): не приглушается никогда.
export type ZoneKey = WorldZone | 'map'
const ZONE_KEYS: readonly ZoneKey[] = ['campus', 'venues', 'archive', 'map']
// Неактивная зона уведена к цвету земли на ZONE_FADE, контур — целиком
const ZONE_FADE = 0.7

type Dim = { value: number }
type ZoneLook = {
  mats: Map<string, THREE.MeshLambertMaterial>
  flats: Map<string, THREE.MeshBasicMaterial>
  roles: Roles
  ink: LineMaterial
  hull: THREE.MeshBasicMaterial
  // Uniform-ы приглушения: заливка и контур. Пишет setZoneDim, читают шейдеры зоны
  dim: Dim
  dimInk: Dim
}

export type WorldStyle = {
  P: Palette
  looks: Record<ZoneKey, ZoneLook>
  // Зона, чьи материалы сейчас отдают mat / flat / roles / ink / hull: её ставит
  // switchZone на время сборки зоны (zones/layout.ts). Поля ниже — ссылки в looks[zone].
  zone: ZoneKey
  // Кэши материалов по цвету: один материал на роль — условие слияния в kit()
  mats: Map<string, THREE.MeshLambertMaterial>
  flats: Map<string, THREE.MeshBasicMaterial>
  roles: Roles
  ink: LineMaterial
  hull: THREE.MeshBasicMaterial
  // Толщина силуэта в долях кадра; пишет fit() на каждый ресайз
  hullPx: { value: THREE.Vector2 }
}

// Приглушение — в шейдере, а не пересборкой: после тумана цвет фрагмента уходит к
// цвету тумана (он же цвет земли) на uZoneDim. Туман в сцене включён всегда
// (createWorld), так что USE_FOG и fogColor есть у каждого материала.
type Shader = { uniforms: Record<string, unknown>; fragmentShader: string }
function injectDim(shader: Shader, level: Dim) {
  shader.uniforms.uZoneDim = level
  shader.fragmentShader = 'uniform float uZoneDim;\n' + shader.fragmentShader.replace('#include <fog_fragment>',
    `#include <fog_fragment>
    #ifdef USE_FOG
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, uZoneDim );
    #endif`)
}

// Свой материал вне кэша (сетка земли, корпус здания) приглушается вместе с зоной
// сборки. ink — как контур: уходит целиком.
export function dimmed<M extends THREE.Material>(style: WorldStyle, m: M, ink = false): M {
  const look = style.looks[style.zone], level = ink ? look.dimInk : look.dim
  m.onBeforeCompile = (shader) => injectDim(shader, level)
  return m
}

export function mat(style: WorldStyle, color: string) {
  let m = style.mats.get(color)
  if (!m) style.mats.set(color, m = dimmed(style, new THREE.MeshLambertMaterial({ color })))
  return m
}

// Земля и разметка — без света, 1:1 с токеном; контур им не рисуем (userData.ground)
export function flat(style: WorldStyle, color: string) {
  let m = style.flats.get(color)
  if (!m) {
    m = dimmed(style, new THREE.MeshBasicMaterial({ color }))
    m.userData.ground = true
    style.flats.set(color, m)
  }
  return m
}

// Свой материал корпуса, мимо кэша: его будет подсвечивать наведение
export const own = (style: WorldStyle, color: string) => dimmed(style, new THREE.MeshLambertMaterial({ color }))

// Контур-силуэт: тот же меш задними гранями, раздвинутый по нормали на постоянную
// толщину в пикселях экрана. Скруглённым объёмам с гладкими нормалями это даёт
// сплошную линию по силуэту.
function hullMaterial(color: string, hullPx: WorldStyle['hullPx'], level: Dim) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHullPx = hullPx
    shader.vertexShader = 'uniform vec2 uHullPx;\n' + shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
      vec4 hullN = projectionMatrix * vec4( normalize( normalMatrix * normal ), 0.0 );
      gl_Position.xy += normalize( hullN.xy + vec2( 1e-6 ) ) * uHullPx * gl_Position.w;`)
    injectDim(shader, level)
  }
  return m
}

// Переключить зону сборки: дальше mat / flat / roles / ink / hull — её материалы.
// Материал, созданный позже сборки, получит зону, выставленную последней, — поэтому
// zones/layout.ts после сборки всегда возвращает 'map'.
export function switchZone(style: WorldStyle, zone: ZoneKey) {
  const look = style.looks[zone]
  style.zone = zone
  style.mats = look.mats
  style.flats = look.flats
  style.roles = look.roles
  style.ink = look.ink
  style.hull = look.hull
}

// Уровень приглушения зоны: 0 — яркая, 1 — приглушена
export function setZoneDim(style: WorldStyle, zone: WorldZone, level: number) {
  const look = style.looks[zone]
  look.dim.value = level * ZONE_FADE
  look.dimInk.value = level
}

// Собрать облик из палитры и ступени контура. Кэши на входе пусты.
function applyLook(style: WorldStyle, T: Tokens, look: WorldLook) {
  const P = style.P = PALETTES[look.palette](T)
  const ink = P.ink[INK_STEP[look.ink]]
  for (const zone of ZONE_KEYS) {
    // Уровни переживают смену облика: объекты uniform-ов остаются теми же
    const prev = style.looks[zone] as ZoneLook | undefined
    const dim = prev?.dim ?? { value: 0 }, dimInk = prev?.dimInk ?? { value: 0 }
    const zoneLook = style.looks[zone] = { mats: new Map(), flats: new Map(), dim, dimInk } as ZoneLook
    switchZone(style, zone)
    // Рёбра — LineSegments2: обычная линия в WebGL всегда 1 px и без сглаживания.
    // Разрешение LineMaterial ставит сам LineSegments2 перед кадром.
    zoneLook.ink = style.ink = dimmed(style, new LineMaterial({ color: ink, linewidth: INK_WIDTH, fog: true }), true)
    zoneLook.hull = style.hull = hullMaterial(ink, style.hullPx, dimInk)
    // Графит мира — только --night-3: чистый --night слишком тяжёлый, он остаётся за HTML-хромом (и за палитрой «Ночь»)
    const glass = mat(style, P.glass)
    zoneLook.roles = style.roles = {
      glass, band: glass, dark: mat(style, P.dark), white: mat(style, P.wall2), red: mat(style, P.accent), steel: mat(style, P.steel),
      leaf: mat(style, P.leaf), roof: mat(style, P.roof), canopy: mat(style, P.canopy), door: mat(style, P.door),
      sign: mat(style, P.sign), signMark: mat(style, P.signMark), carGlass: mat(style, P.carGlass), tire: mat(style, P.tire), lamp: mat(style, P.lamp),
    }
  }
  switchZone(style, 'map')
}

export function createStyle(T: Tokens, look: WorldLook): WorldStyle {
  const style = { looks: {}, hullPx: { value: new THREE.Vector2(0.002, 0.002) } } as unknown as WorldStyle
  applyLook(style, T, look)
  return style
}

// Смена облика на живом мире. Объект style остаётся тем же (его держит ctx, а hullPx
// пишет fit()), но ВСЕ материалы в нём новые: старые освобождены, и меши, собранные
// на них, обязаны быть пересобраны — это делает setStyle в createWorld.
export function restyle(style: WorldStyle, T: Tokens, look: WorldLook) {
  disposeStyle(style)
  applyLook(style, T, look)
}

export function disposeStyle(style: WorldStyle) {
  for (const look of Object.values(style.looks)) {
    for (const cache of [look.mats, look.flats]) {
      cache.forEach((m) => m.dispose())
      cache.clear()
    }
    look.ink.dispose()
    look.hull.dispose()
  }
}
