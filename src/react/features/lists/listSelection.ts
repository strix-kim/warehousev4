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
