import { createPortal } from 'react-dom'
import type { WorldPerson } from '../data/types'
import { useWorldState, whoLabelId, type WorldStore } from '../worldStore'

// Чип имени над фигуркой — самый тихий уровень HUD: мышь не ловит, скринридеру не
// читается (сотрудники — раздел продукта, а не объект мира). Фамилию показывает CSS,
// когда движок ставит якорю is-near.
export function NameChip({ store, person }: { store: WorldStore; person: WorldPerson }) {
  const anchor = useWorldState(store, (state) => state.labels.get(whoLabelId(person.id)))
  if (!anchor) return null
  // aria-hidden — на своей обёртке: атрибуты якоря принадлежат движку
  return createPortal(<span aria-hidden="true">{person.firstName}<i> {person.lastName}</i></span>, anchor)
}
