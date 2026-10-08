import type { Json } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { MealOrder, MealOrderInput, MealSlot, MealStatus, ProjectMeal, Tr } from './types'

// Обеды на мероприятии (план meals-s56). НИЧЕГО отсюда в persistentCache не
// ложится (раздел 3.3): правят на бегу с телефона, и кэш показал бы
// несохранённое как сохранённое. Экран читает базу на каждом входе, а после
// записи кладёт к себе строку из ответа записи.

// Человек в строке — теми же тремя колонками, что MealOrderEmployee: паспорт и
// телефон сюда не едут.
const ORDER_SELECT = '*, employee:employees(id, last_name, first_name)'

// Предел Data API на один ответ (gotchas §1). Строк в приёме ≤ ~60 (состав +
// гости), батчи не нужны — но ровно 1000 значит обрезку, и неполный список
// показывался бы как полный (раздел 1.6).
const ROW_LIMIT = 1000

// Запись не применилась: ответ без ошибки и без строк. RLS на update и delete
// не отказывает, а молча отбирает ноль строк — и тем же нулём отвечает строка,
// которую уже удалила другая вкладка. Клиент эти случаи не различает.
export const MEAL_NOT_APPLIED = 'meal-not-applied'

export type MealDay = {
  meal: ProjectMeal | null
  orders: MealOrder[]
}

export type MealDayMark = Pick<ProjectMeal, 'id' | 'meal_on' | 'slot' | 'status'>

export type MealDishHint = {
  dish: string
  count: number
  price: number | null
}

// ─── Чтение ─────────────────────────────────────────────────────────────────

async function fetchMeal(projectId: string, day: string, slot: MealSlot): Promise<ProjectMeal | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meals')
    .select('*')
    .eq('project_id', projectId)
    .eq('meal_on', day)
    .eq('slot', slot)
    .maybeSingle()
  if (error) throw error
  return data
}

// Один приём (день × слот). Обеда нет — строк нет тоже, второй запрос не шлём:
// строка обеда создаётся лениво, при первом заказе (ensureMeal).
export async function fetchMealDay(projectId: string, day: string, slot: MealSlot): Promise<MealDay> {
  if (!supabase) throw new Error('Supabase не настроен')
  const meal = await fetchMeal(projectId, day, slot)
  if (!meal) return { meal: null, orders: [] }
  const { data, error } = await supabase
    .from('project_meal_orders')
    .select(ORDER_SELECT)
    .eq('meal_id', meal.id)
    .order('created_at')
    .order('id')
  if (error) throw error
  const orders = data ?? []
  if (orders.length >= ROW_LIMIT) throw new Error('project_meal_orders: ответ упёрся в предел 1000 строк')
  return { meal, orders }
}

// Все обеды мероприятия — для точек на ленте дней и для дней «вне периода»
// (даты мероприятия сдвинули после обеда). Порядок — день, слот; обедов у
// мероприятия десятки, предел 1000 недостижим, но ровно 1000 — тоже отказ.
export async function fetchProjectMealDays(projectId: string): Promise<MealDayMark[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meals')
    .select('id, meal_on, slot, status')
    .eq('project_id', projectId)
    .order('meal_on')
    .order('slot')
    .order('id')
  if (error) throw error
  const rows = data ?? []
  if (rows.length >= ROW_LIMIT) throw new Error('project_meals: ответ упёрся в предел 1000 строк')
  return rows
}

type JsonObject = { [key: string]: Json | undefined }

function asObject(value: Json | undefined): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

// Подсказки блюд по всему мероприятию — частоту считает база (project_meal_dishes).
// Ответ сужается из Json проверкой, а не приведением (как expenses_period):
// разъедется функция с клиентом — отказ, а не «undefined» на чипе. Цена —
// последняя введённая для блюда, её может не быть.
export async function fetchProjectDishes(projectId: string): Promise<MealDishHint[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.rpc('project_meal_dishes', { p_project_id: projectId })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('project_meal_dishes: неожиданная форма ответа')
  return data.map((item): MealDishHint => {
    const row = asObject(item)
    if (!row || typeof row.dish !== 'string' || typeof row.count !== 'number' || !Number.isFinite(row.count)) {
      throw new Error('project_meal_dishes: неожиданная форма строки')
    }
    return {
      dish: row.dish,
      count: row.count,
      price: typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : null,
    }
  })
}

// ─── Запись ─────────────────────────────────────────────────────────────────

// Строка обеда дня — создаётся при первой записи. Дубль project_meals_slot_key —
// не отказ, а гонка двух вкладок (тот же приём, что addProjectStaffMember):
// перечитываем и возвращаем ту, что создала другая. Проверки «до вставки» нет
// намеренно — гонку решает индекс. created_by не шлём: default auth.uid().
export async function ensureMeal(projectId: string, day: string, slot: MealSlot): Promise<ProjectMeal> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meals')
    .insert({ project_id: projectId, meal_on: day, slot })
    .select()
    .single()
  if (!error) return data
  if (error.code !== '23505' || !error.message.includes('project_meals_slot_key')) throw error
  const existing = await fetchMeal(projectId, day, slot)
  if (!existing) throw error
  return existing
}

// Заказ человека из состава — upsert по project_meal_orders_employee_key: вторая
// вкладка, записавшая того же человека, не даёт дубля, а перезаписывает строку.
// created_by в полезной нагрузке нет: на вставке его ставит default, на
// конфликте он не перетирается.
export async function saveStaffOrder(mealId: string, employeeId: string, input: MealOrderInput): Promise<MealOrder> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meal_orders')
    .upsert({ meal_id: mealId, employee_id: employeeId, dish: input.dish, qty: input.qty, price: input.price }, { onConflict: 'meal_id,employee_id' })
    .select(ORDER_SELECT)
    .single()
  if (error) throw error
  return data
}

// Гость (водитель, «Общее: лепёшки») — обычная вставка: дубль имени в приёме
// отбивает project_meal_orders_guest_key, разбирает mealErrorText.
export async function saveGuestOrder(mealId: string, guestName: string, input: MealOrderInput): Promise<MealOrder> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meal_orders')
    .insert({ meal_id: mealId, guest_name: guestName, dish: input.dish, qty: input.qty, price: input.price })
    .select(ORDER_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function updateOrder(id: string, input: MealOrderInput): Promise<MealOrder> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meal_orders')
    .update({ dish: input.dish, qty: input.qty, price: input.price })
    .eq('id', id)
    .select(ORDER_SELECT)
  if (error) throw error
  const row = data?.[0]
  if (!row) throw new Error(MEAL_NOT_APPLIED)
  return row
}

export async function deleteOrder(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.from('project_meal_orders').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(MEAL_NOT_APPLIED)
}

export async function setMealStatus(mealId: string, status: MealStatus): Promise<ProjectMeal> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_meals')
    .update({ status })
    .eq('id', mealId)
    .select()
  if (error) throw error
  const row = data?.[0]
  if (!row) throw new Error(MEAL_NOT_APPLIED)
  return row
}

// Перевод отказа базы в человеческую фразу — по имени ограничения, как
// projectStaffErrorText: под 23514 у строки заказа несколько разных CHECK.
export function mealErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (message === MEAL_NOT_APPLIED) {
    return tr('Не сохранено: нет прав или строку уже удалили. Обновите страницу.', 'Saqlanmadi: huquq yo‘q yoki qator allaqachon o‘chirilgan. Sahifani yangilang.')
  }
  // Обычный путь сюда не приходит: saveStaffOrder пишет upsert-ом.
  if (code === '23505' && message.includes('project_meal_orders_employee_key')) {
    return tr('У этого человека уже есть заказ на этот приём — обновите страницу.', 'Bu xodimning ushbu ovqatga buyurtmasi allaqachon bor — sahifani yangilang.')
  }
  if (code === '23505' && message.includes('project_meal_orders_guest_key')) {
    return tr('Гость с таким именем уже есть в этом приёме.', 'Bu ovqatda shu nomli mehmon allaqachon bor.')
  }
  // Обычный путь сюда не приходит: ensureMeal глотает дубль сам.
  if (code === '23505' && message.includes('project_meals_slot_key')) {
    return tr('Этот приём уже создан — обновите страницу.', 'Bu ovqat allaqachon yaratilgan — sahifani yangilang.')
  }
  if (message.includes('project_meal_orders_no_dish_no_price_check')) {
    return tr('«Не ест» — без цены: уберите цену или впишите блюдо.', '«Ovqatlanmaydi» — narxsiz: narxni olib tashlang yoki taomni yozing.')
  }
  if (message.includes('project_meal_orders_dish_check')) {
    return tr('Блюдо — не длиннее 120 знаков; без блюда цена не ставится.', 'Taom — 120 belgidan oshmasin; taomsiz narx qo‘yilmaydi.')
  }
  if (message.includes('project_meal_orders_guest_check')) {
    return tr('Имя гостя — не пустое и не длиннее 80 знаков.', 'Mehmon ismi bo‘sh bo‘lmasin va 80 belgidan oshmasin.')
  }
  if (message.includes('project_meal_orders_qty_check')) {
    return tr('Порций — от 1 до 99.', 'Porsiyalar — 1 dan 99 gacha.')
  }
  if (message.includes('project_meal_orders_price_check')) {
    return tr('Цена — от 1 до 10 000 000 сум за порцию.', 'Narx — porsiya uchun 1 dan 10 000 000 so‘mgacha.')
  }
  if (message.includes('project_meal_outside_period')) {
    return tr('Этот день вне периода мероприятия — проверьте даты мероприятия.', 'Bu kun tadbir davridan tashqarida — tadbir sanalarini tekshiring.')
  }
  if (code === '42501') {
    return tr('Недостаточно прав: обеды ведут техники, менеджеры и администраторы.', 'Huquq yetarli emas: ovqatlanishni texniklar, menejerlar va administratorlar yuritadi.')
  }
  return tr('Не удалось сохранить. Проверьте интернет и повторите.', 'Saqlab bo‘lmadi. Internetni tekshiring va qayta urinib ko‘ring.')
}
