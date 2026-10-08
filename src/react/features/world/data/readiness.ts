// Готовность участка «N из 4» — единственный счёт мира (план world-game-s59, решение 6):
// площадка, список, план, состав. Прямые счётчики реестра мероприятий, своих запросов
// нет. Чистая функция без React и three, текстов интерфейса здесь нет: слова пунктам
// дают вывеска и карточка участка (hud/), позже — доска «Дела».
import type { WorldLot } from './types'

// Порядок фиксирован: в нём стоят точки на вывеске и пункты в карточке
export const READINESS_KEYS = ['place', 'lists', 'plan', 'staff'] as const
export type ReadinessKey = (typeof READINESS_KEYS)[number]

export type LotReadiness = {
  items: Array<{ key: ReadinessKey; done: boolean }>
  // Сколько пунктов готово; всего их items.length
  done: number
}

export function lotReadiness(lot: Pick<WorldLot, 'place' | 'lists' | 'hasPlan' | 'staff'>): LotReadiness {
  const state: Record<ReadinessKey, boolean> = { place: lot.place !== null, lists: lot.lists > 0, plan: lot.hasPlan, staff: lot.staff > 0 }
  const items = READINESS_KEYS.map((key) => ({ key, done: state[key] }))
  return { items, done: items.filter((item) => item.done).length }
}
