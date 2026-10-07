import { formatEventDate, parseDateValue } from '../../lib/date'
import type { Tables } from '../../lib/database.types'

// Строки ровно в том виде, в каком их отдаёт база: края имени, заказчика и
// описания режет триггер normalize_project_fields, у места — normalize_venue_fields.
export type Project = Tables<'projects'>
export type Venue = Tables<'venues'>

// Место так, как его показывают рядом с мероприятием: без created_by и дат.
export type VenueBrief = Pick<Venue, 'id' | 'name' | 'city' | 'country'>

// Мероприятие для пикера «выбрать мероприятие» (списки, состав, залы) и для
// шапки документа: ровно реквизиты, по которым его узнают.
export type ProjectBrief = Pick<Project, 'id' | 'name' | 'client_name' | 'date_from' | 'date_to'> & {
  venue: VenueBrief | null
}

// Строка реестра. Счётчики — числа, а не вложенные строки: в кэш на диск идёт
// именно эта форма, и id сотрудников состава там делать нечего.
export type ProjectListItem = ProjectBrief & {
  updated_at: string
  listCount: number
  staffCount: number
  hasHallPlan: boolean
}

// Полная строка со встроенной площадкой — страница мероприятия и ответ записи.
export type ProjectWithVenue = Project & { venue: VenueBrief | null }

export type ProjectInput = {
  name: string
  clientName: string
  // Даты — строки YYYY-MM-DD, как их отдаёт AppDatePicker. Пустая строка значит
  // «не указана» и уезжает в базу как NULL. dateTo пусто при заданном dateFrom —
  // один день (так же читает projects_dates_check).
  dateFrom: string
  dateTo: string
  venueId: string | null
  description: string
}

export type VenueInput = {
  name: string
  city: string
  country: string
}

// Список оборудования на странице мероприятия: только то, чем его узнают в ряду.
export type ProjectListRow = Pick<Tables<'equipment_lists'>, 'id' | 'name' | 'created_at'>

// План залов на странице мероприятия. Свои название и период у плана остаются
// (план event-s53, развилка 9), поэтому показываем их, а не реквизиты мероприятия.
export type ProjectHallPlanRow = Pick<Tables<'hall_plans'>, 'id' | 'name' | 'event_from' | 'event_to'>

export type Tr = (ru: string, uz: string) => string

// Календарный день числами. Полдень в разборе — чтобы Ташкент (UTC+5) не увёл
// дату на сутки назад: в базе это дата без времени, а не момент.
function formatDay(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`))
}

// Период одной строкой. Правило то же, что у formatPlanPeriod в halls/types:
// один день словами, диапазон числами, открытый конец читается как один день.
// Своя копия, а не импорт: halls будет импортировать projects (привязка плана),
// и обратное ребро замкнуло бы цикл. Принимает пару строк, а не Project, — тем же
// вызовом форматируется период плана залов на странице мероприятия.
export function formatProjectPeriod(from: string | null, to: string | null, locale: string, tr: Tr): string {
  if (!from) return tr('Дата не указана', 'Sana ko‘rsatilmagan')
  if (!to || to === from) {
    const parsed = parseDateValue(from)
    return parsed ? formatEventDate(parsed, locale) : formatDay(from, locale)
  }
  return `${formatDay(from, locale)} — ${formatDay(to, locale)}`
}

// Место одной строкой: «Hyatt Regency · Ташкент». Страну не пишем — почти все
// площадки в одной стране, и она только удлиняла бы строку; полный адрес виден
// в реквизитах мероприятия.
export function venueLabel(venue: Pick<Venue, 'name' | 'city'>): string {
  return `${venue.name} · ${venue.city}`
}
