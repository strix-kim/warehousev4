import type { WorldArchivePlace } from '../data/types'
import type { WorldStore } from '../worldStore'
import './world-archive.css'

type Props = {
  store: WorldStore
  places: WorldArchivePlace[]
}

// HUD «Где работали»: подписи кварталов и мест (порталами в якоря движка), панель
// выбранного места с историей. Смонтирован, пока камера стоит на зоне. Выбранное —
// pick из стора: placeId(place.id) или blockId(n) (контракт — worldStore.ts).
// ЗАГОТОВКА захода 1 Ш5 — наполняет кодер Б (заход 2).
export function ArchivePanel({ store, places }: Props) {
  void store; void places
  return null
}
