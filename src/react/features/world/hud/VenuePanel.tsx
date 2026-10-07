import type { WorldVenue } from '../data/types'
import type { WorldStore } from '../worldStore'
import './world-venues.css'

type Props = {
  store: WorldStore
  venues: WorldVenue[]
}

// HUD «Площадок»: вывески участков (порталами в якоря движка), панель выбранного места.
// Смонтирован, пока камера стоит на зоне. Выбранное — pick из стора: parseLotId(pick)
// даёт часть участка и id места (контракт — worldStore.ts).
// ЗАГОТОВКА захода 1 Ш5 — наполняет кодер А (заход 2).
export function VenuePanel({ store, venues }: Props) {
  void store; void venues
  return null
}
