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

// Машинный штамп импорта вместо номера: «AUTO-251010-194737», «QTY::AUTO::…».
// Для базы это значение, для человека — пустое место, и различать их приходится
// по форме, потому что колонка одна.
const GENERATED_IDENTIFIER = /^(AUTO-|QTY::)/

export type EquipmentHeadParts = {
  // Серийный номер — только у серийной единицы, и печатается плашкой. У единицы
  // по количеству здесь null: настоящего номера у неё нет вовсе.
  serial: string | null
  // Как единицу называет человек.
  name: string
  // Настоящий внутренний код, если он заведён руками. Машинный штамп сюда не
  // проходит.
  code: string | null
}

/**
 * Чем подписана шапка карточки единицы. Развилка по способу учёта, и она не
 * косметическая.
 *
 * У серийной единицы номер есть всегда, и опознают её именно им — как машину
 * госномером. У единицы по количеству номера нет: там, где он на вид «есть», в
 * базе лежит штамп импорта. Печатать штамп заголовком нельзя — он не то, чем
 * эту строку называет человек, а таких единиц в проде 50 из 1482.
 *
 * Запасной EQ-код только у серийной: отговорка «Без серийного номера» была бы у
 * всех пяти безномерных единиц одинаковой, а EQ-код хотя бы разный и годится
 * для ссылки.
 */
export function equipmentHeadParts(item: Equipment): EquipmentHeadParts {
  const name = `${item.brand} ${item.model}`.trim()
  const serial = item.tracking_mode === 'serialized'
    ? item.serialnumber?.trim() || equipmentCode(item.id)
    : null
  const code = item.inventory_code?.trim() || null
  return { serial, name, code: code && !GENERATED_IDENTIFIER.test(code) ? code : null }
}
