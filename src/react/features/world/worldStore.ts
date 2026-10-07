// Стор «движок → React»: движок пишет сюда из кадра и обработчиков указателя,
// HUD читает через useSyncExternalStore. Здесь же контракт между движком и
// оболочкой — типы без three: этот файл грузится во входном чанке.
import { useSyncExternalStore } from 'react'

export type WorldZone = 'campus' | 'venues' | 'archive'

// Здания кампуса: у каждого вывеска над крышей, клавиша-дубль и раздел продукта
export type WorldSiteId = 'office' | 'warehouse' | 'garage'
export const WORLD_SITES: readonly WorldSiteId[] = ['office', 'warehouse', 'garage']

// Ключ подписи фигурки в labels; у здания ключ — сам WorldSiteId
export const whoLabelId = (personId: string) => `who:${personId}`

/* Контракт HUD между движком (engine/) и оболочкой (hud/, WorldStage). Обе стороны
   держатся его, а не кода друг друга.

   Подписи. Движок создаёт элемент CSS2DObject на каждое здание (класс w-sign) и на
   каждую фигурку (класс w-who) и кладёт его в labels. Элемент — точка-якорь 0×0, он
   движка: только движок пишет ему классы w-sign--sm (компактный вид), is-away (места
   нет), is-hover, is-selected, is-near (фигурка под указателем) и переменные --shift,
   --lift (px). Чип w-who — исключение: он сам и есть плашка (не якорь 0×0), меряется
   целиком, и у края кадра движок пишет ему style.translate. Содержимое — оболочки: порталом в w-sign идут .w-sign__leg и
   button.w-sign__board (движок меряет именно board, в полном и компактном виде), в
   w-who — текст чипа. Детей движок не трогает, оболочка не трогает сам элемент.

   Обвязка. Любой элемент внутри .w-stage с атрибутом data-w-chrome — неподвижная
   плашка (день, клавиши): вывески её обходят. Перемер движок запускает сам, по
   изменению детей сцены, — звать его не нужно.

   Наведение и выбор. hover и pick пишут обе стороны: движок — от указателя по сцене,
   оболочка — от наведения и фокуса на вывеске и клавише. Движок подписан на стор и
   по нему ведёт кольцо на земле и классы подписей. Клик по зданию в сцене: движок
   ставит pick и зовёт deps.onActivate(id); клик по вывеске или клавише — то же делает
   оболочка. Переход в раздел — всегда оболочка.

   Курсор. Над целью движок ставит класс is-pick на свой контейнер (.w-scene). */

export type WorldState = {
  zone: WorldZone
  // id объекта под указателем или в фокусе кнопки-дубля и id выбранного
  hover: string | null
  pick: string | null
  // id объекта → элемент CSS2DObject: в него HUD рисует порталом. Карта меняется
  // целиком, а не мутируется, иначе подписчики не увидят смены.
  labels: ReadonlyMap<string, HTMLElement>
  // Сцена уже 920 px: вывески и клавиши переходят в компактный вид
  hudCompact: boolean
}

// Поза камеры числами, без Vector3: её держит оболочка между пересозданиями мира.
// moved — человек крутил камеру сам; иначе позу считает движок под размер окна.
export type CameraPose = {
  position: [number, number, number]
  target: [number, number, number]
  moved: boolean
}

export type WorldStore = {
  getState: () => WorldState
  setState: (patch: Partial<WorldState>) => void
  subscribe: (listener: () => void) => () => void
}

const INITIAL: WorldState = { zone: 'campus', hover: null, pick: null, labels: new Map(), hudCompact: false }

export function createWorldStore(): WorldStore {
  let state = INITIAL
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    setState(patch) {
      // Движок зовёт это из кадра: без сверки каждое обращение будило бы React
      const keys = Object.keys(patch) as Array<keyof WorldState>
      if (keys.every((key) => Object.is(state[key], patch[key]))) return
      state = { ...state, ...patch }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export function useWorldState<T>(store: WorldStore, select: (state: WorldState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()))
}
