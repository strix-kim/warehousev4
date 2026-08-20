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
