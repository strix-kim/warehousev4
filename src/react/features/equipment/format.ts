// Подписи строки оборудования, общие для каталога и карточки: обе половины
// показывают один и тот же код и один и тот же «номер / учёт».
import type { Equipment } from './types'

export function equipmentCode(id: string) {
  return `EQ-${id.slice(0, 6).toUpperCase()}`
}

// Сколько единиц модели заденет правка общих данных. Склонение считает движок:
// «1 единица», «2 единицы», «596 единиц» — цифра без правильного слова читалась
// как «596 единиц» и «1 единиц» одинаково, а это разные по цене действия.
// В узбекском счётное слово после числа не склоняется — форма одна.
export function formatUnitCount(count: number, tr: (ru: string, uz: string) => string) {
  const plural = new Intl.PluralRules('ru').select(count)
  const word = plural === 'one' ? 'единица' : plural === 'few' ? 'единицы' : 'единиц'
  return tr(`${count} ${word}`, `${count} ta birlik`)
}

export function equipmentIdentifier(item: Equipment, tr: (ru: string, uz: string) => string) {
  if (item.tracking_mode === 'quantity') return item.inventory_code || tr('Без серийного номера', 'Seriya raqamisiz')
  return item.serialnumber || tr('Без серийного номера', 'Seriya raqamisiz')
}
