import { formatTime, parseDateValue } from '../../lib/date'
import type { Equipment } from '../equipment/types'
import type { EquipmentList, EquipmentListItem } from './api'
import { groupKey, type CatalogGroup } from './catalogGroups'
import { selectionLabel, type SelectedGroup, type SelectionLabel } from './listSelection'
import type { ExportListRow } from './xlsxExport'

// Снимок документа одной строкой — по нему считается «есть несохранённые
// правки». Серийники сортируются, порядок ключей фиксирован: иначе одна и та же
// правка давала бы разные строки, и предупреждение загоралось бы на ровном месте.
export function serializeDocument(input: {
  name: string
  clientName: string
  venue: string
  description: string
  eventDate: string
  items: { key: string; count: number; serialIds: string[] }[]
}) {
  return JSON.stringify({
    name: input.name.trim(),
    clientName: input.clientName.trim(),
    venue: input.venue.trim(),
    description: input.description.trim(),
    eventDate: input.eventDate,
    items: input.items.map(({ key, count, serialIds }) => ({ key, count, serialIds: [...serialIds].sort() })),
  })
}

export type ResolvedSelection = { item: SelectedGroup; group: CatalogGroup | null; label: SelectionLabel }[]

// Выборка, склеенная со свежим каталогом. group === null означает, что модели
// в каталоге больше нет: позицию не выбрасываем, рисуем по снимку подписи.
export function resolveSelection(selected: SelectedGroup[], groupsByKey: Map<string, CatalogGroup>): ResolvedSelection {
  return selected.map((item) => ({
    item,
    group: groupsByKey.get(item.key) ?? null,
    label: groupsByKey.get(item.key) ?? item.label,
  }))
}

// Состав документа собирается по АКТУАЛЬНОМУ каталогу: конкретные единицы
// берутся только из живой группы. Группы уже нет — вся позиция уходит
// планируемой строкой по снимку подписи, как и раньше.
export function buildListItems(resolved: ResolvedSelection): EquipmentListItem[] {
  return resolved.flatMap(({ item: selectedItem, group, label }) => {
    const concrete = selectedItem.serialIds.flatMap((id) => {
      const item = group?.serializedItems.find((candidate) => candidate.id === id)
      return item ? [{
        equipment_id: item.id,
        brand: item.brand,
        model: item.model,
        type: item.type,
        subtype: item.subtype,
        count: 1,
        tracking_mode: 'serialized' as const,
      }] : []
    })
    let remaining = selectedItem.count - concrete.length
    const quantityItems: EquipmentListItem[] = []
    for (const item of group?.quantityItems ?? []) {
      if (remaining <= 0) break
      const allocated = Math.min(remaining, Math.max(0, item.count))
      if (allocated <= 0) continue
      quantityItems.push({
        equipment_id: item.id,
        brand: item.brand,
        model: item.model,
        type: item.type,
        subtype: item.subtype,
        count: allocated,
        tracking_mode: 'quantity',
      })
      remaining -= allocated
    }
    const planned: EquipmentListItem[] = remaining > 0 ? [{
      brand: label.brand,
      model: label.model,
      type: label.type,
      subtype: label.subtype,
      count: remaining,
      tracking_mode: 'planned',
    }] : []
    return [...concrete, ...quantityItems, ...planned]
  })
}

export function buildExportRows(resolved: ResolvedSelection): ExportListRow[] {
  return resolved.map(({ item, group, label }) => ({
    category: label.type,
    equipment: `${label.brand} ${label.model}`.trim(),
    subtype: label.subtype,
    count: item.count,
    serialNumbers: item.serialIds.flatMap((id) => {
      const equipmentItem = group?.serializedItems.find((candidate) => candidate.id === id)
      return equipmentItem?.serialnumber ? [equipmentItem.serialnumber] : []
    }),
  }))
}

// Имя собирается в момент действия и только если поле пустое: дата мероприятия
// отвечает на «что искать в реестре», время — на «который из сегодняшних».
// Само поле не трогаем — пустое поле законно, и подставлять в него нечего.
export function resolveListName({ name, eventDate, locale, tr }: {
  name: string
  eventDate: string
  locale: string
  tr: (ru: string, uz: string) => string
}) {
  const trimmed = name.trim()
  if (trimmed) return trimmed
  const date = new Intl.DateTimeFormat(locale).format(parseDateValue(eventDate) ?? new Date())
  const time = formatTime(Date.now(), locale)
  return tr(`Список ${date} · ${time}`, `Ro‘yxat ${date} · ${time}`)
}

// Состав сохранённого списка, поднятый по живому каталогу. Гварды гидратации
// (каталог приехал, список ещё не поднимали) — на странице, здесь только сборка.
export function selectionFromList(list: EquipmentList, equipment: Equipment[], groupsByKey: Map<string, CatalogGroup>): SelectedGroup[] {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]))
  const restored = new Map<string, SelectedGroup>()
  const addRestored = (group: CatalogGroup, count: number, serialId?: string) => {
    const current = restored.get(group.key) ?? { key: group.key, label: selectionLabel(group), count: 0, serialIds: [], serialPickerOpen: false }
    current.count += count
    if (serialId && group.serializedItems.some((item) => item.id === serialId)) current.serialIds.push(serialId)
    restored.set(group.key, current)
  }

  for (const equipmentId of list.equipment_ids ?? []) {
    const item = equipmentById.get(equipmentId)
    const group = item ? groupsByKey.get(groupKey(item)) : undefined
    if (group) addRestored(group, 1, equipmentId)
  }
  for (const item of list.equipment_items ?? []) {
    const group = groupsByKey.get(groupKey(item))
    if (group) addRestored(group, Math.max(1, Number(item.count) || 1), item.tracking_mode === 'serialized' ? item.equipment_id : undefined)
  }

  return [...restored.values()]
}
