// Тип здания по названию места. Колонки venues.kind в базе нет (решение прораба с58:
// без миграций), поэтому силуэт угадываем по словам в названии. Это ГИПОТЕЗА до
// колонки: облик, а не данные — неверный силуэт ничего не ломает. Без three и React:
// чистая функция, её сверяет скаут скриптом.
import type { WorldArchiveKind, WorldVenueKind } from './types'

// Слова — в нижнем регистре, ищутся подстрокой. Порядок групп важен: «Hilton … Congress
// Hall» — конгресс-холл, а не отель; «Конгресс-зал гостиницы» — тоже зал.
const KIND_WORDS: ReadonlyArray<readonly [WorldVenueKind, readonly string[]]> = [
  ['arena', ['arena', 'арена', 'спорт', 'sport', 'стадион', 'stadium']],
  ['hall', ['центр', 'center', 'centre', 'холл', 'holl', 'hall', 'congress', 'конгресс', 'expo', 'экспо', 'павильон']],
  ['hotel', ['hotel', 'отель', 'гостиниц', 'mehmonxona', 'hilton', 'hyatt', 'marriott', 'wyndham', 'radisson', 'intercontinental', 'ramada', 'hampton', 'courtyard', 'mövenpick', 'movenpick', 'lotte', ' inn']],
]
// Дворец — силуэт только «Где работали»: на участке «Площадок» его чертежа нет.
// Отель сильнее дворца: «Lotte City Hotel Tashkent Palace» — отель
const PALACE_WORDS = ['дворец', 'palace', 'saroy']

// Не угадали — обычное здание: павильон конгресс-холла, самый нейтральный силуэт
export function venueKind(name: string): WorldVenueKind {
  const text = name.toLowerCase()
  return KIND_WORDS.find(([, words]) => words.some((word) => text.includes(word)))?.[0] ?? 'hall'
}

export function archiveKind(name: string): WorldArchiveKind {
  const kind = venueKind(name), text = name.toLowerCase()
  return kind !== 'hotel' && PALACE_WORDS.some((word) => text.includes(word)) ? 'palace' : kind
}
