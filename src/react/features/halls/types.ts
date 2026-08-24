import { formatEventDate, parseDateValue } from '../../lib/date'
import type { Tables } from '../../lib/database.types'

// Строки таблиц ровно в том виде, в каком их отдаёт база: имена залов и позиций
// тримит триггер normalize_hall_name, updated_at плана двигает touch_hall_plan.
export type HallPlan = Tables<'hall_plans'>
export type Hall = Tables<'halls'>
export type HallPosition = Tables<'hall_positions'>

export type Tr = (ru: string, uz: string) => string

// Роль позиции. В базе это text с CHECK, а не enum: союз существует только на
// клиенте, поэтому строка из ответа сужается до него явно (roleLabel).
export type HallRole = 'technician' | 'operator' | 'other'

// Палитра залов. Порядок фиксирован — по нему раздаются цвета при создании
// плана, и «Зал 1» обязан быть синим и завтра тоже. База проверяет только формат
// (`^#[0-9a-f]{6}$`), поэтому регистр здесь нижний и другим быть не может.
// Красный var(--accent) в палитру не входит: он занят действиями интерфейса.
export const HALL_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#b45309',
  '#4b5563',
] as const

// Цвет зала по его номеру, с кругом по палитре. Хвост `?? HALL_PALETTE[0]` —
// не перестраховка, а требование noUncheckedIndexedAccess: индекс по числу
// даёт `| undefined`, а в базе колонка color обязательная.
export function hallColorAt(index: number): string {
  return HALL_PALETTE[index % HALL_PALETTE.length] ?? HALL_PALETTE[0]
}

// Цвет следующего зала: сперва первый неиспользованный, а когда палитра
// исчерпана — по кругу от числа уже занятых. Повтор цвета законен: цвет здесь
// подсказка глазу, а не идентификатор, и уникальности на него в базе нет.
export function nextHallColor(used: string[]): string {
  const free = HALL_PALETTE.find((color) => !used.includes(color))
  return free ?? hallColorAt(used.length)
}

// Порядок залов. sort_order без UNIQUE (перестановка меняет два числа местами),
// поэтому ключ сортировки полный: одинаковый порядок разводит created_at, а
// одинаковую миллисекунду пачечной вставки — id. Без хвоста ключа три зала,
// созданные одним запросом, менялись бы местами между перезагрузками.
// created_at необязателен: на карточке списка залы приезжают краткой выборкой.
export function sortHalls<T extends { sort_order: number; created_at?: string; id: string }>(halls: T[]): T[] {
  return [...halls].sort((left, right) => left.sort_order - right.sort_order
    || (left.created_at ?? '').localeCompare(right.created_at ?? '')
    || left.id.localeCompare(right.id))
}

// Календарный день числами. Полдень в разборе — чтобы Ташкент (UTC+5) не увёл
// дату на сутки назад: в базе это дата без времени, а не момент.
function formatDay(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`))
}

// Период мероприятия одной строкой — то, чем человек узнаёт свой план в списке.
// Один день пишем словами («25 августа 2026»), диапазон — числами: «25 августа
// 2026 — 3 сентября 2026» в строку карточки не помещается. Открытый конец
// (начало без окончания) законен и читается как один день: пока известна только
// дата приезда, «25 августа 2026 — » выглядело бы обрывом.
export function formatPlanPeriod(plan: Pick<HallPlan, 'event_from' | 'event_to'>, locale: string, tr: Tr): string {
  if (!plan.event_from) return tr('Дата не указана', 'Sana ko‘rsatilmagan')
  if (!plan.event_to || plan.event_to === plan.event_from) {
    const parsed = parseDateValue(plan.event_from)
    return parsed ? formatEventDate(parsed, locale) : formatDay(plan.event_from, locale)
  }
  return `${formatDay(plan.event_from, locale)} — ${formatDay(plan.event_to, locale)}`
}

// Название роли. Принимает строку, а не HallRole: колонка в базе — text, и
// значение, добавленное будущей миграцией, обязано показаться как есть, а не
// уронить экран.
export function roleLabel(role: string, tr: Tr): string {
  switch (role) {
    case 'technician': return tr('Техник', 'Texnik')
    case 'operator': return tr('Оператор', 'Operator')
    case 'other': return tr('Другое', 'Boshqa')
    default: return role
  }
}
