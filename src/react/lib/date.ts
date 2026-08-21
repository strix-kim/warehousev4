// Дата события хранится строкой YYYY-MM-DD и означает КАЛЕНДАРНЫЙ день, а не
// момент времени. Поэтому и разбор, и сборка идут по локальным компонентам:
// toISOString() увёл бы Ташкент (UTC+5) на сутки назад для всего до 05:00.

export function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateValue() {
  return toDateValue(new Date())
}

export function parseDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

type Tr = (ru: string, uz: string) => string

// Возраст данных словами. Числительные и склонения («2 минуты», «5 минут»,
// «2 daqiqa») отдаём Intl: свой список окончаний пришлось бы вести на два языка и
// править при каждом новом. Через tr проходит только корзина «моложе минуты»,
// которой у RelativeTimeFormat нет.
export function formatAge(touchedAt: number, locale: string, tr: Tr) {
  const seconds = Math.max(0, Math.round((Date.now() - touchedAt) / 1000))
  if (seconds < 60) return tr('только что', 'hozirgina')

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}
