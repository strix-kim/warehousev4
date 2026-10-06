import type { CatalogGroup } from './catalogGroups'

export type SelectionLabel = Pick<CatalogGroup, 'brand' | 'model' | 'type' | 'subtype'>

// Выборка хранит КЛЮЧ группы, а не саму группу: сам объект берётся из актуальной
// Map на рендере. Иначе остатки, серийники и payload считались бы по каталогу
// на момент клика — обновление склада до выборки не доезжало.
export type SelectedGroup = {
  key: string
  label: SelectionLabel
  count: number
  serialIds: string[]
  serialPickerOpen: boolean
}

// Минимальный снимок подписи. Нужен ровно в одном случае: группы больше нет в
// свежем каталоге, и строку нечем нарисовать.
export function selectionLabel(group: CatalogGroup): SelectionLabel {
  return { brand: group.brand, model: group.model, type: group.type, subtype: group.subtype }
}

// Потолок количества в позиции. Правило живёт в базе: триггер
// trg_guard_equipment_list_items (миграция 20261006130000_equipment_list_items_guard.sql)
// пропускает только целое 1..999. Константа — зеркало, чтобы интерфейс не доводил до отказа.
export const MAX_ITEM_COUNT = 999

// Переходы выборки — чистые функции (current, …) => next: страница оборачивает
// их в setSelected и держит рядом побочные эффекты вроде сброса сообщений.

export function addGroupTo(current: SelectedGroup[], group: CatalogGroup): SelectedGroup[] {
  const existing = current.find((item) => item.key === group.key)
  if (existing) return current.map((item) => item.key === group.key ? { ...item, count: Math.min(MAX_ITEM_COUNT, item.count + 1) } : item)
  return [...current, { key: group.key, label: selectionLabel(group), count: 1, serialIds: [], serialPickerOpen: false }]
}

export function changeCountIn(current: SelectedGroup[], key: string, delta: number): SelectedGroup[] {
  return current
    .map((item) => {
      if (item.key !== key) return item
      const count = Math.min(MAX_ITEM_COUNT, Math.max(0, item.count + delta))
      return { ...item, count, serialIds: item.serialIds.slice(0, count) }
    })
    .filter((item) => item.count > 0)
}

// Количество, набранное с клавиатуры. Ноль сюда не доходит: удаление позиции —
// это корзина и «−» с единицы, а не пустое поле.
export function setCountIn(current: SelectedGroup[], key: string, count: number): SelectedGroup[] {
  const next = Math.min(MAX_ITEM_COUNT, Math.max(1, count))
  return current.map((item) => item.key === key
    ? { ...item, count: next, serialIds: item.serialIds.slice(0, next) }
    : item)
}

export function toggleSerialPickerIn(current: SelectedGroup[], key: string): SelectedGroup[] {
  return current.map((item) => item.key === key ? { ...item, serialPickerOpen: !item.serialPickerOpen } : item)
}

export function toggleSerialIn(current: SelectedGroup[], key: string, equipmentId: string): SelectedGroup[] {
  return current.map((item) => {
    if (item.key !== key) return item
    const exists = item.serialIds.includes(equipmentId)
    const serialIds = exists ? item.serialIds.filter((id) => id !== equipmentId) : [...item.serialIds, equipmentId]
    return { ...item, serialIds, count: Math.max(item.count, serialIds.length) }
  })
}
