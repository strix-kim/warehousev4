import type { Tables } from '../../lib/database.types'

// Строка журнала ровно в том виде, в каком её отдаёт RPC expenses_period:
// created_by в ответ не входит — журнал и так только свой (owner-политика).
export type Expense = Pick<Tables<'expenses'>, 'id' | 'name' | 'spent_on' | 'amount' | 'spent_by' | 'created_at' | 'updated_at'>

// Журнал за период одним снимком. total и count считает база: сумма по
// подгруженным строкам соврала бы при обрезке выборки, а под фильтром «Кто
// потратил» — разошлась бы с тем, что уедет в файл.
export type ExpensesPeriod = {
  rows: Expense[]
  total: number
  count: number
}

// Какой период спрашиваем. Границы — YYYY-MM-DD, обе включительно; spentBy —
// фильтр «Кто потратил», пустая строка — без фильтра.
export type ExpensesQuery = {
  from: string
  to: string
  spentBy: string
}

export type ExpenseInput = {
  name: string
  spentOn: string
  amount: number
  spentBy: string | null
}

export type Tr = (ru: string, uz: string) => string
