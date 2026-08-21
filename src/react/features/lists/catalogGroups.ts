import type { Equipment } from '../equipment/types'

// Модель каталога редактора: единицы оборудования свёрнуты в модели, одна
// группа — одна строка каталога. Перенесено из ListEditorPage без правок.
export type CatalogGroup = {
  key: string
  brand: string
  model: string
  type: string
  subtype: string
  allItems: Equipment[]
  serializedItems: Equipment[]
  quantityItems: Equipment[]
  quantityAvailable: number
  availableCount: number
  totalCount: number
}

export function groupKey(item: Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'>) {
  return [item.brand, item.model, item.type, item.subtype].map((value) => value.trim().toLocaleLowerCase('ru')).join('::')
}

function isAvailable(item: Equipment) {
  const status = item.availability.toLocaleLowerCase('ru')
  if (status.startsWith('не ') || status.includes('диагност') || status === 'issued' || status === 'unavailable') return false
  return status === 'available' || status.startsWith('в н')
}

export function buildCatalogGroups(equipment: Equipment[]): CatalogGroup[] {
  const map = new Map<string, CatalogGroup>()
  for (const item of equipment) {
    const key = groupKey(item)
    const group = map.get(key) ?? {
      key,
      brand: item.brand,
      model: item.model,
      type: item.type,
      subtype: item.subtype,
      allItems: [],
      serializedItems: [],
      quantityItems: [],
      quantityAvailable: 0,
      availableCount: 0,
      totalCount: 0,
    }
    const units = item.tracking_mode === 'serialized' ? 1 : Math.max(0, item.count)
    group.allItems.push(item)
    group.totalCount += units
    if (isAvailable(item)) {
      if (item.tracking_mode === 'serialized') group.serializedItems.push(item)
      else {
        group.quantityItems.push(item)
        group.quantityAvailable += units
      }
      group.availableCount += units
    }
    map.set(key, group)
  }
  return [...map.values()]
    .map((group) => ({ ...group, serializedItems: group.serializedItems.sort((a, b) => (a.serialnumber ?? '').localeCompare(b.serialnumber ?? '')) }))
    // Подтип в ключе сортировки стоит перед брендом: без него микрофоны, микшеры и
    // стойки одной категории чередовались в ленте по алфавиту бренда, и глазу
    // не за что было зацепиться.
    .sort((a, b) => `${a.type} ${a.subtype} ${a.brand} ${a.model}`.localeCompare(`${b.type} ${b.subtype} ${b.brand} ${b.model}`, 'ru'))
}
