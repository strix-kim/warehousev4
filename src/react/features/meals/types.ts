import { parseDateValue, toDateValue } from '../../lib/date'
import type { Tables } from '../../lib/database.types'

// Обеды на мероприятии (план meals-s56). Строки — ровно в виде базы: пробелы в
// блюде и имени гостя схлопывает триггер normalize_meal_order_fields.
export type ProjectMeal = Tables<'project_meals'>

export type MealSlot = 'lunch' | 'dinner'
export type MealStatus = 'collecting' | 'ordered' | 'delivered'

export const MEAL_SLOTS: MealSlot[] = ['lunch', 'dinner']
export const MEAL_STATUSES: MealStatus[] = ['collecting', 'ordered', 'delivered']

// Человек в строке — теми же тремя колонками, что показывает экран; паспорт
// сюда не едет. null — гость (guest_name) или сотрудник, которого уже удалили
// из базы (теоретически: restrict не даст).
export type MealOrderEmployee = Pick<Tables<'employees'>, 'id' | 'last_name' | 'first_name'>

// Одна строка на человека в приёме. dish null = «не ест / своё»; строки нет
// вовсе = «ещё не спросили». price — за порцию, целые сумы, необязательна.
export type MealOrder = Tables<'project_meal_orders'> & {
  employee: MealOrderEmployee | null
}

export type MealOrderInput = {
  dish: string | null
  qty: number
  price: number | null
}

// Пределы — копия CHECK-ов project_meal_orders_*: подсказка в UI, пара в базе.
export const MEAL_DISH_MAX = 120
export const MEAL_GUEST_MAX = 80
export const MEAL_QTY_MAX = 99
export const MEAL_PRICE_MAX = 10_000_000

export type Tr = (ru: string, uz: string) => string

// Дни периода мероприятия строками YYYY-MM-DD; date_to null = один день.
// Без дат — пустой массив (экран показывает «Укажите даты мероприятия»).
export function periodDays(from: string | null, to: string | null): string[] {
  if (!from) return []
  const start = parseDateValue(from)
  const end = parseDateValue(to ?? from)
  if (!start || !end || end < start) return []
  const days: string[] = []
  const cursor = new Date(start)
  // Страховка от опечатки в датах: год обедов никому не нужен.
  while (cursor <= end && days.length < 366) {
    days.push(toDateValue(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function isMealSlot(value: string | null | undefined): value is MealSlot {
  return value === 'lunch' || value === 'dinner'
}
