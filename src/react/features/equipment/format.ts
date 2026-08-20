// Подписи строки оборудования, общие для каталога и карточки: обе половины
// показывают один и тот же код и один и тот же «номер / учёт».
import type { Equipment } from './types'

export function equipmentCode(id: string) {
  return `EQ-${id.slice(0, 6).toUpperCase()}`
}

export function equipmentIdentifier(item: Equipment, tr: (ru: string, uz: string) => string) {
  if (item.tracking_mode === 'quantity') return item.inventory_code || tr('Без серийного номера', 'Seriya raqamisiz')
  return item.serialnumber || tr('Без серийного номера', 'Seriya raqamisiz')
}
