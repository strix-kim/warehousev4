import { createPortal } from 'react-dom'
import type { WorldPerson } from '../data/types'
import { useWorldState, whoLabelId, type WorldStore } from '../worldStore'

// Чип имени над фигуркой — самый тихий уровень HUD: мышь не ловит, скринридеру не
// читается (сотрудники — раздел продукта, а не объект мира). Фамилию показывает CSS,
// когда движок ставит якорю is-near. short — чип на участке «Площадок»: фигурки стоят
// тесно, фамилии нет вовсе. muted — участок выбран: над бригадой встаёт табличка «Состав: N»
// (VenuePanel) и ложится на те же головы, а имена целиком читает панель участка — чип
// гаснет (world-hud.css), размер за ним остаётся.
export function NameChip({ store, person, short = false, muted = false }: { store: WorldStore; person: WorldPerson; short?: boolean; muted?: boolean }) {
  const anchor = useWorldState(store, (state) => state.labels.get(whoLabelId(person.id)))
  if (!anchor) return null
  // aria-hidden — на своей обёртке: атрибуты якоря принадлежат движку
  return createPortal(<span aria-hidden="true" data-muted={muted || undefined}>{person.firstName}{!short && <i> {person.lastName}</i>}</span>, anchor)
}
