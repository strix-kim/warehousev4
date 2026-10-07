import type { Json } from '../../lib/database.types'
import { cachedQuery, invalidateCachePrefix, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import { supabase } from '../../lib/supabase'
import type { Expense, ExpenseInput, ExpensesPeriod, ExpensesQuery, Tr } from './types'

// Общий префикс на весь модуль: периодов в кэше столько, сколько месяцев и
// фильтров человек открывал, и любая запись сбрасывает их все одним вызовом —
// правка даты переносит строку из месяца в месяц, а «Кто потратил» меняет итог
// под фильтром. Владелец значения — этот модуль, правило сброса — собственные
// записи плюс TTL. Суммы ложатся и на диск: кэш привязан к пользователю и
// стирается на выходе (persistentCache).
const EXPENSES_CACHE_PREFIX = 'expenses:'
const EXPENSES_CACHE_TTL = 10 * 60 * 1000

function periodCacheKey({ from, to, spentBy }: ExpensesQuery) {
  return `${EXPENSES_CACHE_PREFIX}period:${from}:${to}${spentBy ? `:${spentBy}` : ''}`
}

type JsonObject = { [key: string]: Json | undefined }

function asObject(value: Json | undefined): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function asNumber(value: Json | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('expenses_period: число не пришло')
  return value
}

function asString(value: Json | undefined): string {
  if (typeof value !== 'string') throw new Error('expenses_period: строка не пришла')
  return value
}

// Ответ RPC сужается из Json проверкой, а не приведением (как home_summary):
// разъедется функция с клиентом — журнал покажет отказ, а не «NaN сум» в итоге.
// Битая строка роняет весь ответ намеренно: молча пропущенная трата разошлась
// бы с total, который считала база.
function parseExpensesPeriod(data: Json): ExpensesPeriod {
  const root = asObject(data)
  if (!root || !Array.isArray(root.rows)) throw new Error('expenses_period: неожиданная форма ответа')

  const rows = root.rows.map((item): Expense => {
    const row = asObject(item)
    if (!row) throw new Error('expenses_period: неожиданная форма строки')
    return {
      id: asString(row.id),
      name: asString(row.name),
      spent_on: asString(row.spent_on),
      amount: asNumber(row.amount),
      spent_by: typeof row.spent_by === 'string' ? row.spent_by : null,
      created_at: asString(row.created_at),
      updated_at: asString(row.updated_at),
    }
  })

  return { rows, total: asNumber(root.total), count: asNumber(root.count) }
}

async function loadExpensesPeriod({ from, to, spentBy }: ExpensesQuery): Promise<ExpensesPeriod> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.rpc('expenses_period', spentBy
    ? { p_from: from, p_to: to, p_spent_by: spentBy }
    : { p_from: from, p_to: to })
  if (error) throw error
  return parseExpensesPeriod(data)
}

export function fetchExpensesPeriod(query: ExpensesQuery, { bypassCache = false } = {}): Promise<ExpensesPeriod> {
  return cachedQuery(periodCacheKey(query), EXPENSES_CACHE_TTL, () => loadExpensesPeriod(query), { bypass: bypassCache })
}

// Чтение МИМО кэша целиком — для выгрузки. bypass у cachedQuery здесь не годится:
// при живой записи он подменяет провал запроса последним значением (gotchas §4),
// и файл с деньгами собрался бы из того, что база сейчас не подтвердила.
export function fetchExpensesPeriodFresh(query: ExpensesQuery): Promise<ExpensesPeriod> {
  return loadExpensesPeriod(query)
}

// Синхронное чтение той же записи — для первого кадра страницы.
export function readCachedExpensesPeriod(query: ExpensesQuery): ExpensesPeriod | null {
  return readCachedQuery<ExpensesPeriod>(periodCacheKey(query))
}

export function readCachedExpensesPeriodMeta(query: ExpensesQuery) {
  return readCachedQueryMeta(periodCacheKey(query))
}

// Раскладка формы в строку таблицы — одна на вставку и на правку. Имя уходит
// как введено: края обрезает триггер базы (normalize_hall_name), второй канон
// на клиенте не заводим. created_by не шлём — его ставит default auth.uid().
function expenseRow(fields: ExpenseInput) {
  return {
    name: fields.name,
    spent_on: fields.spentOn,
    amount: fields.amount,
    spent_by: fields.spentBy,
  }
}

// Запись не применилась: ответ пришёл без ошибки и без строк. RLS на update и
// delete не отказывает, а молча отбирает ноль строк — и тем же нулём отвечает
// строка, которую уже удалили в другой вкладке. Клиент эти случаи не различает.
export const EXPENSE_NOT_APPLIED = 'expense-not-applied'

export async function createExpense(fields: ExpenseInput): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase
    .from('expenses')
    .insert(expenseRow(fields))
    .select('id')
    .single()
  if (error) throw error
  invalidateCachePrefix(EXPENSES_CACHE_PREFIX)
}

export async function updateExpense(id: string, fields: ExpenseInput): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('expenses')
    .update(expenseRow(fields))
    .eq('id', id)
    .select('id')
  if (error) throw error
  // Сброс и при нуле строк: раз запись не нашлась, показанный журнал уже врёт.
  invalidateCachePrefix(EXPENSES_CACHE_PREFIX)
  if (!data?.length) throw new Error(EXPENSE_NOT_APPLIED)
}

export async function deleteExpense(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  invalidateCachePrefix(EXPENSES_CACHE_PREFIX)
  if (!data?.length) throw new Error(EXPENSE_NOT_APPLIED)
}

// Перевод отказа базы в человеческую фразу. Разбираем ИМЕНЕМ ограничения, а не
// одним кодом 23514: под ним два разных CHECK, и «сумма вне границ» в ответ на
// пустое название было бы враньём.
export function expenseErrorText(error: unknown, tr: Tr, action: 'save' | 'delete' = 'save'): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (message === EXPENSE_NOT_APPLIED) {
    return tr('Запись не изменилась: её уже нет или она не ваша. Закройте карточку — журнал обновлён.', 'Yozuv o‘zgarmadi: u endi yo‘q yoki sizniki emas. Kartani yoping — jurnal yangilandi.')
  }
  if (message.includes('expenses_name_check')) {
    return tr('Наименование не может быть пустым и длиннее 200 знаков.', 'Nom bo‘sh yoki 200 belgidan uzun bo‘lishi mumkin emas.')
  }
  if (message.includes('expenses_amount_check')) {
    return tr('Сумма — от 1 до 1 000 000 000 сум.', 'Summa — 1 dan 1 000 000 000 so‘mgacha.')
  }
  // Сотрудника удалили, пока карточка была открыта: выбранного «Кто потратил»
  // в базе уже нет.
  if (code === '23503' && message.includes('expenses_spent_by_fkey')) {
    return tr('Выбранного сотрудника больше нет в базе — выберите другого или оставьте поле пустым.', 'Tanlangan xodim bazada yo‘q — boshqasini tanlang yoki maydonni bo‘sh qoldiring.')
  }
  if (code === '42501') {
    return tr('Нет прав на запись расходов.', 'Xarajatlarni yozishga huquq yo‘q.')
  }
  if (action === 'delete') {
    return tr('Не удалось удалить расход. Повторите попытку.', 'Xarajatni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.')
  }
  return tr('Не удалось сохранить расход. Проверьте поля и повторите попытку.', 'Xarajatni saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}
