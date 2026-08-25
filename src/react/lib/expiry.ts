// Состояние срока годности: паспорт сотрудника, допуск, всё, что однажды
// истекает. Ответ на один вопрос — «можно ли ставить в работу сегодня», поэтому
// сравниваются КАЛЕНДАРНЫЕ дни, а не моменты времени: срок «до 25 августа»
// действителен весь этот день целиком, включая 23:59 в Ташкенте.
//
// Пустое значение состояния НЕ имеет (решение прораба, с27): карточка показывает
// только заполненные поля, и молчание про незаполненный срок честнее серого
// бейджа «не указан» — тот выглядел бы как проверенный факт.

import { parseDateValue, toDateValue } from './date'

export type ExpiryState = 'expired' | 'soon' | 'valid'

// Порог «скоро истекает». Меньше — предупреждение приходит поздно, больше —
// оранжевый бейдж висит месяцами и перестаёт что-либо значить.
const EXPIRY_SOON_DAYS = 30

// Полных календарных дней от сегодня до срока. Отрицательное — срок позади.
// Наружу не выставлено намеренно: сроку в интерфейсе нужен ответ «истёк / скоро
// / в порядке», а не число дней. Понадобится «осталось 12 дней» — экспортировать
// тогда, а не заранее.
// Обе даты приводятся к локальной полуночи: иначе «сегодня вечером» и «сегодня
// утром» давали бы разный ответ на один и тот же срок.
function daysUntilExpiry(value: string | null | undefined, now = new Date()): number | null {
  if (!value) return null
  const date = parseDateValue(value)
  if (!date) return null
  // parseDateValue отсеивает только нечисловой мусор: «2026-13-45» Date молча
  // перекатывает в февраль 2027, и срок показал бы состояние, которого нет.
  // Из базы такое не придёт (колонка типа date), но состояние срока — довод
  // «ставить в работу или нет», и додумывать данные ему нельзя.
  if (toDateValue(date) !== value) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Делим на сутки в миллисекундах и округляем: переход на летнее время сдвинул
  // бы сутки на час, и floor потерял бы день дважды в год. В Узбекистане перевода
  // часов нет, но модуль общий, и закладываться на это незачем.
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

// Состояние срока или null, если срока нет вовсе.
export function expiryState(value: string | null | undefined, soonDays = EXPIRY_SOON_DAYS, now = new Date()): ExpiryState | null {
  const days = daysUntilExpiry(value, now)
  if (days === null) return null
  if (days < 0) return 'expired'
  return days <= soonDays ? 'soon' : 'valid'
}

// Модификатор общего класса .badge. Сам .badge не трогаем — его потребляют
// дроверы оборудования и каталог редактора списков.
export function expiryBadgeClass(state: ExpiryState) {
  if (state === 'expired') return 'badge badge--danger'
  return state === 'soon' ? 'badge badge--warning' : 'badge badge--success'
}
