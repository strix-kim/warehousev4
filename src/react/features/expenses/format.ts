import type { Language } from '../../lib/i18n'

// Форматы журнала расходов — свои, не Intl: для `uz` он отдаёт то ISO-дату, то
// разряды запятой в зависимости от движка, а сумму и дату человек сверяет
// глазами с бумажным чеком. Парные ограничения в базе — expenses_amount_check
// и expenses_name_check; здесь только подсказка и вид.
export const EXPENSE_AMOUNT_MAX = 1_000_000_000
export const EXPENSE_NAME_MAX = 200

// Неразрывный пробел: «102 000» не должно рваться между разрядами ни в ячейке,
// ни в плашке итога.
const GROUP_SEPARATOR = ' '

// Разрядка строки ИЗ ЦИФР. Строкой, а не числом: поле ввода держит то, что
// набрано, и число за пределом точности не должно превращаться в «1e+21».
export function groupDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR)
}

// Целая сумма с разрядами: 102000 → «102 000». Валюту дописывает вызывающий —
// через tr('сум', 'so‘m').
export function formatSum(value: number) {
  if (!Number.isFinite(value)) return '—'
  const whole = Math.trunc(Math.abs(value))
  return `${value < 0 ? '−' : ''}${groupDigits(String(whole))}`
}

// Из набранного остаются одни цифры: пробелы любого рода, буквы и знаки
// выпадают, ведущие нули снимаются («000» → «0»).
export function sumDigits(input: string) {
  return input.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

// null — цифр нет вовсе. Попадание в границы здесь НЕ проверяется: «0» и
// «9 999 999 999» — разобранные числа, годность решает isSumInRange.
export function parseSum(input: string): number | null {
  const digits = sumDigits(input)
  return digits ? Number(digits) : null
}

export function isSumInRange(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0 && value <= EXPENSE_AMOUNT_MAX
}

// Куда поставить каретку в разряженной строке, чтобы слева от неё осталось
// столько же цифр, сколько было до переразрядки.
export function caretAfterDigits(formatted: string, digitsBefore: number) {
  if (digitsBefore <= 0) return 0
  let seen = 0
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted.charAt(index))) seen += 1
    if (seen === digitsBefore) return index + 1
  }
  return formatted.length
}

// «2026-09-21» → «21.09.2026» прямо из строки, без Date: день календарный, и
// часовому поясу в нём взяться неоткуда. Не дата — возвращается как есть.
export function formatDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value
}

const russianMonths = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const uzbekMonths = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

// Название месяца из «2026-10» — именительным падежом, с заглавной. Пустая
// строка — на входе не месяц.
export function monthName(month: string, language: Language) {
  const index = Number(month.slice(5, 7)) - 1
  return (language === 'uz' ? uzbekMonths : russianMonths)[index] ?? ''
}

// «Октябрь 2026» — подпись переключателя и заголовок выгрузки.
export function formatMonthLabel(month: string, language: Language) {
  return `${monthName(month, language)} ${month.slice(0, 4)}`
}
