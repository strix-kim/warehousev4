// Стор «движок → React»: движок пишет сюда из кадра и обработчиков указателя,
// HUD читает через useSyncExternalStore. Здесь же контракт между движком и
// оболочкой — типы без three: этот файл грузится во входном чанке.
import { useSyncExternalStore } from 'react'

export type WorldZone = 'campus' | 'venues' | 'archive'

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
