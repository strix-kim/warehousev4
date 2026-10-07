// Облик мира: палитра ролей и материалы из неё. Форма одна — «Галька + контур»
// (softline макета с50); остальные формы остались на стенде voxel-style-s48.
import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Tokens } from './tokens'

const mix = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()

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

// Толщина контура в px экрана, одна на силуэт и на линии рёбер
export const INK_WIDTH = 2

export type Roles = Record<
  'glass' | 'band' | 'dark' | 'white' | 'red' | 'steel' | 'leaf' | 'roof' | 'canopy' | 'door' | 'sign' | 'signMark' | 'carGlass' | 'tire' | 'lamp',
  THREE.MeshLambertMaterial
>

export type WorldStyle = {
  P: Palette
  // Кэши материалов по цвету: один материал на роль — условие слияния в kit()
  mats: Map<string, THREE.MeshLambertMaterial>
  flats: Map<string, THREE.MeshBasicMaterial>
  roles: Roles
  ink: LineMaterial
  hull: THREE.MeshBasicMaterial
  // Толщина силуэта в долях кадра; пишет fit() на каждый ресайз
  hullPx: { value: THREE.Vector2 }
}

export function mat(style: WorldStyle, color: string) {
  let m = style.mats.get(color)
  if (!m) style.mats.set(color, m = new THREE.MeshLambertMaterial({ color }))
  return m
}

// Земля и разметка — без света, 1:1 с токеном; контур им не рисуем (userData.ground)
export function flat(style: WorldStyle, color: string) {
  let m = style.flats.get(color)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color })
    m.userData.ground = true
    style.flats.set(color, m)
  }
  return m
}

// Свой материал корпуса, мимо кэша: его будет подсвечивать наведение
export const own = (color: string) => new THREE.MeshLambertMaterial({ color })

// Контур-силуэт: тот же меш задними гранями, раздвинутый по нормали на постоянную
// толщину в пикселях экрана. Скруглённым объёмам с гладкими нормалями это даёт
// сплошную линию по силуэту.
function hullMaterial(color: string, hullPx: WorldStyle['hullPx']) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHullPx = hullPx
    shader.vertexShader = 'uniform vec2 uHullPx;\n' + shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
      vec4 hullN = projectionMatrix * vec4( normalize( normalMatrix * normal ), 0.0 );
      gl_Position.xy += normalize( hullN.xy + vec2( 1e-6 ) ) * uHullPx * gl_Position.w;`)
  }
  return m
}

export function createStyle(T: Tokens): WorldStyle {
  const P = whitePalette(T)
  const hullPx = { value: new THREE.Vector2(0.002, 0.002) }
  const ink = P.ink[0]
  const style: WorldStyle = {
    P, hullPx,
    mats: new Map(),
    flats: new Map(),
    roles: {} as Roles,
    // Рёбра — LineSegments2: обычная линия в WebGL всегда 1 px и без сглаживания.
    // Разрешение LineMaterial ставит сам LineSegments2 перед кадром.
    ink: new LineMaterial({ color: ink, linewidth: INK_WIDTH, fog: true }),
    hull: hullMaterial(ink, hullPx),
  }
  // Графит мира — только --night-3: чистый --night слишком тяжёлый, он остаётся за HTML-хромом
  const glass = mat(style, P.glass)
  style.roles = {
    glass, band: glass, dark: mat(style, P.dark), white: mat(style, P.wall2), red: mat(style, P.accent), steel: mat(style, P.steel),
    leaf: mat(style, P.leaf), roof: mat(style, P.roof), canopy: mat(style, P.canopy), door: mat(style, P.door),
    sign: mat(style, P.sign), signMark: mat(style, P.signMark), carGlass: mat(style, P.carGlass), tire: mat(style, P.tire), lamp: mat(style, P.lamp),
  }
  return style
}

export function disposeStyle(style: WorldStyle) {
  for (const cache of [style.mats, style.flats]) {
    cache.forEach((m) => m.dispose())
    cache.clear()
  }
  style.ink.dispose()
  style.hull.dispose()
}
