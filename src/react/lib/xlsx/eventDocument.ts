// Реквизиты документа «на мероприятие» — общие для списка сотрудников и для
// будущего списка машин. В базу они не пишутся: документ собирается в браузере
// и уезжает файлом, поэтому проверка полей здесь — UX, а не защита.
//
// dateTo = null — мероприятие на один день. Язык документа отдельный от языка
// интерфейса: бумагу подписывают по-узбекски даже те, кто работает в RU.
import { companyLegalName } from './documentDefaults'

export type EventDocumentMeta = {
  name: string
  dateFrom: string
  dateTo: string | null
  language: 'ru' | 'uz'
}

// Выбор текста по языку ДОКУМЕНТА. Приём тот же, что у tr в интерфейсе, но язык
// берётся из реквизитов бумаги: русский интерфейс печатает узбекский документ и
// наоборот, поэтому смешивать эти два переключателя нельзя.
export function docText(language: 'ru' | 'uz', ru: string, uz: string) {
  return language === 'uz' ? uz : ru
}

// Месяцы своими списками, а не через Intl. RU нужен родительный падеж («20 июля»),
// а Intl в любом варианте приписывает сокращение «г.» и ставит своё окончание;
// UZ в этом документе кириллический, тогда как Intl для uz отдаёт латиницу.
const monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const monthsUz = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

// Разбор YYYY-MM-DD по компонентам, без Date: строка означает КАЛЕНДАРНЫЙ день, и
// прогон через Date увёл бы его на сутки в другом часовом поясе (lib/date.ts).
function dateParts(value: string) {
  const [year, month, day] = value.split('-')
  return { year: Number(year), month: Number(month), day: Number(day) }
}

function monthName(language: 'ru' | 'uz', month: number) {
  return (language === 'uz' ? monthsUz : monthsRu)[month - 1] ?? ''
}

// Период мероприятия человеческой фразой — той самой, что подписывают на бумаге.
// Один день, одни месяц, разные месяцы и разные годы — четыре разных склейки, а
// не одна с подстановкой: «с 20 по 22 июля 2026 года» и «с 30 июля по 2 августа
// 2026 года» отличаются местом, где стоит месяц.
export function formatEventPeriod(meta: EventDocumentMeta): string {
  const from = dateParts(meta.dateFrom)
  const single = !meta.dateTo || meta.dateTo === meta.dateFrom
  const to = single ? from : dateParts(meta.dateTo as string)

  if (meta.language === 'uz') {
    if (single) return `${from.year} йил ${from.day} ${monthName('uz', from.month)}`
    if (from.year !== to.year) return `${from.year} йил ${from.day} ${monthName('uz', from.month)} — ${to.year} йил ${to.day} ${monthName('uz', to.month)} кунлари`
    if (from.month !== to.month) return `${from.year} йил ${from.day} ${monthName('uz', from.month)} — ${to.day} ${monthName('uz', to.month)} кунлари`
    return `${from.year} йил ${from.day}–${to.day} ${monthName('uz', from.month)} кунлари`
  }

  if (single) return `${from.day} ${monthName('ru', from.month)} ${from.year} года`
  if (from.year !== to.year) return `в период с ${from.day} ${monthName('ru', from.month)} ${from.year} года по ${to.day} ${monthName('ru', to.month)} ${to.year} года`
  if (from.month !== to.month) return `в период с ${from.day} ${monthName('ru', from.month)} по ${to.day} ${monthName('ru', to.month)} ${to.year} года`
  return `в период с ${from.day} по ${to.day} ${monthName('ru', from.month)} ${from.year} года`
}

// Абзац-заголовок документа: одна фраза, которую читает принимающая сторона.
// Оба вида списка (люди и машины) держим здесь вместе — расползись они по своим
// генераторам, юрлицо и формулировка «привлекаемого к подготовке» разъехались бы.
export function eventDocumentTitle(kind: 'staff' | 'vehicles', meta: EventDocumentMeta): string {
  const period = formatEventPeriod(meta)
  if (meta.language === 'uz') {
    return kind === 'vehicles'
      ? `«ARGO MEDIA» МЧЖнинг «${meta.name}» тадбирини тайёрлаш ва ўтказишга жалб этилган ходимлари автотранспорт воситалари рўйхати, ${period}.`
      : `«ARGO MEDIA» МЧЖнинг «${meta.name}» тадбирини тайёрлаш ва ўтказишга жалб этилган ходимлари рўйхати, ${period}.`
  }
  return kind === 'vehicles'
    ? `Список автотранспортных средств персонала ${companyLegalName.ru}, привлекаемого к подготовке и проведению мероприятия «${meta.name}», ${period}.`
    : `Список персонала ${companyLegalName.ru}, привлекаемого к подготовке и проведению мероприятия «${meta.name}», ${period}.`
}

// Дата в теле таблицы — цифрами и одинаково на обоих языках, поэтому язык сюда и
// не передаётся: паспортную дату рождения в документе никто не читает словами.
export function formatDocumentDate(iso: string): string {
  const { year, month, day } = dateParts(iso)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}
