// Сводка приёма пищи (план meals-s56, шаг 4): схлопнутые блюда, итог и тексты
// для чата. Чистые функции — ни React, ни supabase: считает клиент из уже
// загруженных строк приёма (их ≤ ~60), сумма здесь — подсказка на экране и в
// тексте, а не деньги (деньги вводит человек в дровере расхода, раздел 1.6).
//
// Разметки в текстах нет по той же причине, что в halls/planText.ts: Telegram
// не разбирает markdown во вставленном тексте — держатся только переносы строк.

import { formatSum } from '../expenses/format'
import type { MealOrder, MealSlot, Tr } from './types'

export type MealSummaryDish = {
  dish: string
  qty: number
  // Σ qty·price по строкам группы с ценой; null — ни у одной строки цены нет.
  priced: number | null
}

export type MealSummary = {
  dishes: MealSummaryDish[]
  // Строки (люди), а не порции: «заказали 12 человек, не едят 2».
  eating: number
  notEating: number
  total: number
  // Строки с блюдом, но без цены: итог по ним неполон, и это надо сказать.
  unpriced: number
}

export type MealTextContext = {
  projectName: string
  day: string // YYYY-MM-DD
  slot: MealSlot
  // Пока не используется: дата в заголовке — «21.08» в обоих языках, а Intl для
  // uz отдаёт формат по-разному в разных движках (см. expenses/format.ts).
  locale: string
}

// _tr — в подписи для единообразия с текстовыми функциями модуля: расчёт от
// языка не зависит.
export function summarizeMeal(orders: MealOrder[], _tr: Tr): MealSummary {
  // Группа по lower(dish) — как в базе (project_meal_dishes). Лицо группы —
  // первое встреченное написание с заглавной первой буквой: регистр база хранит
  // как ввели, и без этого «лагман» первым в списке делал бы лицом строчное
  // написание (чекпоинт плана: «лагман» ×2 + «Лагман» → «Лагман × 3»).
  const groups = new Map<string, MealSummaryDish>()
  let eating = 0
  let notEating = 0
  let total = 0
  let unpriced = 0

  for (const order of orders) {
    if (order.dish === null) {
      notEating += 1
      continue
    }
    eating += 1
    const key = order.dish.toLowerCase()
    let group = groups.get(key)
    if (!group) {
      group = { dish: capitalize(order.dish), qty: 0, priced: null }
      groups.set(key, group)
    }
    group.qty += order.qty
    if (order.price === null) {
      unpriced += 1
    } else {
      const sum = order.qty * order.price
      group.priced = (group.priced ?? 0) + sum
      total += sum
    }
  }

  // Больше порций — выше: кафе сначала видит главное. Равные — по имени.
  const dishes = [...groups.values()].sort((a, b) => b.qty - a.qty || a.dish.localeCompare(b.dish))
  return { dishes, eating, notEating, total, unpriced }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function slotLabel(slot: MealSlot, tr: Tr) {
  return slot === 'lunch' ? tr('Обед', 'Tushlik') : tr('Ужин', 'Kechki ovqat')
}

// «2026-08-21» → «21.08» прямо из строки, без Date: день календарный.
function shortDay(day: string) {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(day)
  return match ? `${match[2]}.${match[1]}` : day
}

function headerLine(ctx: MealTextContext, tr: Tr) {
  return [ctx.projectName.trim(), shortDay(ctx.day), slotLabel(ctx.slot, tr)].filter(Boolean).join(' · ')
}

function money(value: number, tr: Tr) {
  return `${formatSum(value)} ${tr('сум', 'so‘m')}`
}

function portionsOf(summary: MealSummary) {
  return summary.dishes.reduce((sum, item) => sum + item.qty, 0)
}

// Строка итога денег. Без единой цены её нет вовсе: «Итого: 0 сум» читалось бы
// как «бесплатно». Часть без цены — называем, иначе итог выглядит полным.
function totalLine(summary: MealSummary, tr: Tr): string | null {
  if (summary.total <= 0) return null
  const line = `${tr('Итого', 'Jami')}: ${money(summary.total, tr)}`
  return summary.unpriced > 0
    ? `${line} · ${tr('без цены', 'narxsiz')}: ${summary.unpriced}`
    : line
}

function dishLines(summary: MealSummary) {
  return summary.dishes.map((item) => `${item.dish} × ${item.qty}`)
}

// Для кафе: только блюда и порции, без имён людей.
export function buildCafeText(summary: MealSummary, ctx: MealTextContext, tr: Tr): string {
  const blocks: string[] = [headerLine(ctx, tr)]
  if (summary.dishes.length === 0) {
    blocks.push(tr('Заказов нет', 'Buyurtmalar yo‘q'))
    return blocks.join('\n\n')
  }
  blocks.push(dishLines(summary).join('\n'))
  const totals = [`${tr('Всего порций', 'Jami porsiya')}: ${portionsOf(summary)}`]
  const moneyLine = totalLine(summary, tr)
  if (moneyLine) totals.push(moneyLine)
  blocks.push(totals.join('\n'))
  return blocks.join('\n\n')
}

// «Фамилия Имя» сотрудника, имя гостя как ввели. Сотрудника нет в строке
// (удалён из базы) — общая подпись, чтобы строка не потерялась.
function personName(order: MealOrder, tr: Tr) {
  if (order.employee) {
    const name = [order.employee.last_name, order.employee.first_name].filter(Boolean).join(' ')
    if (name) return name
  }
  return order.guest_name ?? tr('Сотрудник', 'Xodim')
}

function personLine(order: MealOrder, tr: Tr) {
  const name = personName(order, tr)
  if (order.dish === null) return `${name} — ${tr('не ест', 'ovqatlanmaydi')}`
  const qty = order.qty > 1 ? ` ×${order.qty}` : ''
  const price = order.price === null ? '' : ` (${formatSum(order.qty * order.price)})`
  return `${name} — ${order.dish}${qty}${price}`
}

// Полная: то же, что для кафе, плюс «кто что» — раздать при приезде. Порядок
// людей — как пришли строки: порядок списка задаёт экран (состав, вне состава,
// гости), и в тексте он должен совпадать с тем, что человек видел.
export function buildFullText(orders: MealOrder[], summary: MealSummary, ctx: MealTextContext, tr: Tr): string {
  const blocks: string[] = [headerLine(ctx, tr)]
  if (orders.length === 0) {
    blocks.push(tr('Заказов нет', 'Buyurtmalar yo‘q'))
    return blocks.join('\n\n')
  }
  if (summary.dishes.length > 0) blocks.push(dishLines(summary).join('\n'))
  blocks.push([`${tr('Кто что', 'Kim nima')}:`, ...orders.map((order) => personLine(order, tr))].join('\n'))

  const counts = [`${tr('Всего порций', 'Jami porsiya')}: ${portionsOf(summary)}`]
  if (summary.notEating > 0) counts.push(`${tr('не ест', 'ovqatlanmaydi')}: ${summary.notEating}`)
  const totals = [counts.join(' · ')]
  const moneyLine = totalLine(summary, tr)
  if (moneyLine) totals.push(moneyLine)
  blocks.push(totals.join('\n'))
  return blocks.join('\n\n')
}

// Комментарий расхода: «Для кафе» в две строки. Предел — expenses_comment_check
// (≤ 500, пара в базе); обрезка с «…» здесь лишь чтобы запрос не упал. Длину
// считаем кодовыми точками, как char_length в Postgres: срез по UTF-16 мог бы
// разрезать суррогатную пару.
export function buildExpenseComment(summary: MealSummary, ctx: MealTextContext, tr: Tr, max = 500): string {
  const body = summary.dishes.length > 0
    ? `${dishLines(summary).join(', ')} · ${tr('порций', 'porsiya')}: ${portionsOf(summary)}`
    : tr('Заказов нет', 'Buyurtmalar yo‘q')
  const text = `${headerLine(ctx, tr)}\n${body}`
  const chars = Array.from(text)
  if (chars.length <= max) return text
  // Хвостовые пробел, запятая и «·» перед многоточием — мусор: «Плов × 1,…».
  return `${chars.slice(0, Math.max(0, max - 1)).join('').replace(/[\s,·]+$/, '')}…`
}
