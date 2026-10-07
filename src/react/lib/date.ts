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

// Момент времени короткой строкой («21.08, 14:32»). Год не показываем: строка
// стоит рядом с открытым документом и отвечает на «когда сохранял», а не «в каком
// году это было».
export function formatDateTime(value: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

// Часы и минуты момента. Нужны автоимени списка: дата отвечает на «когда
// мероприятие», время — на «который из сегодняшних списков это был».
export function formatTime(value: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

// Узбекские месяцы держим списком: Intl для `uz` даёт латиницу вперемешку с
// кириллицей в зависимости от движка, а дата мероприятия — то, что пользователь
// сверяет глазами.
const uzbekMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

// Календарный день словами («21 августа 2026», «21-avgust 2026-yil»). Живёт здесь,
// а не в AppDatePicker: свёрнутая полоса реквизитов показывает ту же дату, что и
// раскрытое поле, и разойтись эти два формата не должны.
export function formatEventDate(date: Date, locale: string) {
  if (locale.toLowerCase().startsWith('uz')) return `${date.getDate()}-${uzbekMonths[date.getMonth()]} ${date.getFullYear()}-yil`
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

// День и месяц без года («7 октября», «7-oktabr») — тем же списком месяцев.
export function formatDayMonth(date: Date, locale: string) {
  if (locale.toLowerCase().startsWith('uz')) return `${date.getDate()}-${uzbekMonths[date.getMonth()]}`
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date)
}

// Заголовок месяца в календаре — тот же список месяцев, без числа.
export function formatMonthTitle(date: Date, locale: string) {
  if (locale.toLowerCase().startsWith('uz')) return `${uzbekMonths[date.getMonth()]} ${date.getFullYear()}`
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}

type Tr = (ru: string, uz: string) => string

// Возраст данных словами. Числительные и склонения («2 минуты», «5 минут»,
// «2 daqiqa») отдаём Intl: свой список окончаний пришлось бы вести на два языка и
// править при каждом новом. Через tr проходит только корзина «моложе минуты»,
// которой у RelativeTimeFormat нет.
export function formatAge(touchedAt: number, locale: string, tr: Tr) {
  const seconds = Math.max(0, Math.round((Date.now() - touchedAt) / 1000))
  if (seconds < 60) return tr('только что', 'hozirgina')

  // Округление ТОЛЬКО вниз: round выдавал «1 час назад» уже на 59.7 минутах, то есть
  // приписывал данным возраст, которого у них ещё нет. Возраст занижать безопаснее,
  // чем завышать: бейдж отвечает на «насколько старое», и врать вверх ему нельзя.
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.floor(hours / 24), 'day')
}

// Границы месяца со сдвигом от текущего (0 — этот, -1 — прошлый, +1 — следующий).
// Считается от ЛОКАЛЬНОЙ даты пользователя, как и всё остальное здесь: фильтр
// периода сравнивает календарные дни, а не моменты времени. День 0 следующего
// месяца — последний день нужного, и переход через декабрь Date берёт на себя.
export function monthRange(offset: number) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: toDateValue(from), to: toDateValue(to) }
}

// Месяц строкой YYYY-MM — в таком виде он лежит в адресе журнала расходов
// (?m=2026-10). Разбор строгий: мусор из адреса обязан читаться как «месяц не
// задан», а не как 13-й месяц, который Date молча перенёс бы в следующий год.
// Год — четыре цифры без ведущего нуля: годы 0–99 конструктор Date относит к 1900-м.
function parseMonthValue(value: string) {
  const match = /^([1-9]\d{3})-(0[1-9]|1[0-2])$/.exec(value)
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

export function toMonthValue(date: Date) {
  return toDateValue(date).slice(0, 7)
}

// Границы месяца, обе включительно — как их ждёт expenses_period. null — строка
// не месяц. День 0 следующего месяца — последний день нужного (високосный
// февраль и декабрь Date берёт на себя, как и в monthRange выше).
export function monthBounds(month: string) {
  const parsed = parseMonthValue(month)
  if (!parsed) return null
  return { from: `${month}-01`, to: toDateValue(new Date(parsed.year, parsed.month, 0)) }
}

// Соседний месяц (delta = ±1). Не месяц на входе — возвращается как есть:
// вызывающий уже проверил строку через monthBounds.
export function shiftMonthValue(month: string, delta: number) {
  const parsed = parseMonthValue(month)
  return parsed ? toMonthValue(new Date(parsed.year, parsed.month - 1 + delta, 1)) : month
}
