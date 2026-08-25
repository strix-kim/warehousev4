import { formatEventDate, parseDateValue } from '../../lib/date'
import type { Tables } from '../../lib/database.types'
import type { EmployeeBrief } from '../employees/types'

// Строки таблиц ровно в том виде, в каком их отдаёт база: имена залов и строк
// матрицы тримит триггер normalize_hall_name, updated_at плана двигает
// touch_hall_plan.
export type HallPlan = Tables<'hall_plans'>
export type Hall = Tables<'halls'>

// Матрица (с20, по образцу прораба): строка — позиция ВСЕГО мероприятия, а не
// зала; ячейка на пересечении строки и зала — ОДИН человек, и второго туда не
// пустит hall_assignments_cell_key. Трое операторов в зале — это три строки
// матрицы, как три подстроки на бумаге (миграции 20260824110000, 20260824140000).
export type PlanPosition = Tables<'plan_positions'>
export type HallAssignment = Tables<'hall_assignments'>

// Справочник позиций (с20, миграция 20260824120000) — общие имена строк на все
// планы: готовую позицию берут чипом, вписанную руками справочник запоминает
// сам. Связи со строками плана НЕТ: plan_positions хранит свою копию имени,
// поэтому удаление из справочника старую расстановку не трогает.
export type PositionCatalogEntry = Tables<'position_catalog'>

// Ячейка со встроенным сотрудником — ровно то, что отдаёт fetchHallAssignments.
// employee_id снова бывает null, но значит это НЕ «человека не выбрали»: с
// миграции 20260824160000 null возможен только у слота «Наём» (is_external),
// и равенство держит CHECK базы. employees бывает null и у обычной ячейки:
// строку сотрудника может не отдать политика чтения. Пустая клетка — это
// по-прежнему ОТСУТСТВИЕ записи, а не запись без человека.
export type AssignmentWithEmployee = HallAssignment & { employees: EmployeeBrief | null }

export type Tr = (ru: string, uz: string) => string

// Роль позиции. В базе это text с CHECK, а не enum: союз существует только на
// клиенте, поэтому строка из ответа сужается до него явно (roleLabel).
export type HallRole = 'technician' | 'operator' | 'other'

// Палитра залов. Порядок фиксирован — по нему раздаются цвета при создании
// плана, и «Зал 1» обязан быть синим и завтра тоже. База проверяет только формат
// (`^#[0-9a-f]{6}$`), поэтому регистр здесь нижний и другим быть не может.
// Красный var(--accent) в палитру не входит: он занят действиями интерфейса.
//
// Контраст с белым (имя зала — 15px/800, порог 4.5) посчитан, а не заявлен: в
// с24 три цвета оказались ниже нормы и заменены на ступень темнее того же тона
// — #16a34a 3.30 → #15803d 5.02, #ea580c 3.56 → #c2410c 5.18, #0891b2 3.68 →
// #0e7490 5.36. Цвета в базе от этого не меняются: он там подсказка глазу, а не
// идентификатор, и старые планы остаются как есть — перекрасить их можно
// свотчами в шапке зала.
export const HALL_PALETTE = [
  '#2563eb', // 5.17
  '#15803d', // 5.02
  '#c2410c', // 5.18
  '#9333ea', // 5.38
  '#0e7490', // 5.36
  '#db2777', // 4.60
  '#b45309', // 5.02
  '#4b5563', // 7.56
] as const

// Цвет зала по его номеру, с кругом по палитре. Хвост `?? HALL_PALETTE[0]` —
// не перестраховка, а требование noUncheckedIndexedAccess: индекс по числу
// даёт `| undefined`, а в базе колонка color обязательная.
export function hallColorAt(index: number): string {
  return HALL_PALETTE[index % HALL_PALETTE.length] ?? HALL_PALETTE[0]
}

// Цвет следующего зала: сперва первый неиспользованный, а когда палитра
// исчерпана — по кругу от числа уже занятых. Повтор цвета законен: цвет здесь
// подсказка глазу, а не идентификатор, и уникальности на него в базе нет.
export function nextHallColor(used: string[]): string {
  const free = HALL_PALETTE.find((color) => !used.includes(color))
  return free ?? hallColorAt(used.length)
}

// Порядок залов. sort_order без UNIQUE (перестановка меняет два числа местами),
// поэтому ключ сортировки полный: одинаковый порядок разводит created_at, а
// одинаковую миллисекунду пачечной вставки — id. Без хвоста ключа три зала,
// созданные одним запросом, менялись бы местами между перезагрузками.
// created_at необязателен: на карточке списка залы приезжают краткой выборкой.
export function sortHalls<T extends { sort_order: number; created_at?: string; id: string }>(halls: T[]): T[] {
  return [...halls].sort((left, right) => left.sort_order - right.sort_order
    || (left.created_at ?? '').localeCompare(right.created_at ?? '')
    || left.id.localeCompare(right.id))
}

// Календарный день числами. Полдень в разборе — чтобы Ташкент (UTC+5) не увёл
// дату на сутки назад: в базе это дата без времени, а не момент.
function formatDay(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`))
}

// Период мероприятия одной строкой — то, чем человек узнаёт свой план в списке.
// Один день пишем словами («25 августа 2026»), диапазон — числами: «25 августа
// 2026 — 3 сентября 2026» в строку карточки не помещается. Открытый конец
// (начало без окончания) законен и читается как один день: пока известна только
// дата приезда, «25 августа 2026 — » выглядело бы обрывом.
export function formatPlanPeriod(plan: Pick<HallPlan, 'event_from' | 'event_to'>, locale: string, tr: Tr): string {
  if (!plan.event_from) return tr('Дата не указана', 'Sana ko‘rsatilmagan')
  if (!plan.event_to || plan.event_to === plan.event_from) {
    const parsed = parseDateValue(plan.event_from)
    return parsed ? formatEventDate(parsed, locale) : formatDay(plan.event_from, locale)
  }
  return `${formatDay(plan.event_from, locale)} — ${formatDay(plan.event_to, locale)}`
}

// Название роли. Принимает строку, а не HallRole: колонка в базе — text, и
// значение, добавленное будущей миграцией, обязано показаться как есть, а не
// уронить экран.
export function roleLabel(role: string, tr: Tr): string {
  switch (role) {
    case 'technician': return tr('Видеоинженер', 'Videoinjener')
    case 'operator': return tr('Оператор', 'Operator')
    case 'other': return tr('Другое', 'Boshqa')
    default: return role
  }
}

// Порядок строк матрицы. Ключ полный по той же причине, что у залов:
// sort_order без UNIQUE, и две строки, добавленные быстрым набором в одну
// миллисекунду, обязаны стоять в стабильном порядке, а не меняться на F5.
export function sortPositions<T extends { sort_order: number; created_at: string; id: string }>(positions: T[]): T[] {
  return [...positions].sort((left, right) => left.sort_order - right.sort_order
    || left.created_at.localeCompare(right.created_at)
    || left.id.localeCompare(right.id))
}

// Следующая роль по кругу: техник → оператор → другое → техник. Клик по чипу
// вместо выпадающего списка — ролей три, и перебор быстрее выбора. Неизвестное
// значение (будущая роль из миграции) возвращается в начало круга, а не роняет
// клик.
export function nextRole(role: string): HallRole {
  switch (role) {
    case 'technician': return 'operator'
    case 'operator': return 'other'
    default: return 'technician'
  }
}

// Счётчики плана. Люди считаются УНИКАЛЬНЫМИ, а не ячейками: страховка одного
// человека на четыре зала — это один техник в бригаде, а не четыре. Роль берётся
// от СТРОКИ, в которой человек стоит, — своей роли у ячейки нет; поэтому человек
// разом в строке техников и в строке операторов законно попадает в оба счётчика,
// и technicians + operators + others бывает больше totalPeople.
//
// «Свободно» здесь больше не считается: с одиночной ячейкой (миграция
// 20260824140000) незанятое место — это ОТСУТСТВИЕ записи, и посчитать его
// можно только по всей сетке «строки × залы», а не по списку ячеек.
//
// Слоты «Наём» (с21) считаются ЯЧЕЙКАМИ, а не людьми: два слота — это два
// найма, и сворачивать их уникальностью нечем — имени, по которому человека
// узнают дважды, у слота нет. Поэтому hired идёт отдельным числом и в счёт
// людей (everyone/byRole) не попадает.
export function countPlan(
  positions: Pick<PlanPosition, 'id' | 'role'>[],
  assignments: Pick<HallAssignment, 'position_id' | 'employee_id' | 'is_external'>[],
) {
  const roleOf = new Map(positions.map((position) => [position.id, position.role]))
  const byRole = new Map<string, Set<string>>()
  const everyone = new Set<string>()
  let hired = 0

  for (const cell of assignments) {
    if (cell.is_external) {
      hired += 1
      continue
    }
    // Человека нет, а слотом ячейка не помечена — такого база не пустит
    // (CHECK), но локальная копия могла разъехаться после отказа записи.
    if (!cell.employee_id) continue
    everyone.add(cell.employee_id)
    // Ячейка без своей строки в списке — гонка удаления, а не данные:
    // каскад базы уже унёс её, локальная копия ещё нет. В счёт не идёт.
    const role = roleOf.get(cell.position_id)
    if (!role) continue
    const bucket = byRole.get(role)
    if (bucket) bucket.add(cell.employee_id)
    else byRole.set(role, new Set([cell.employee_id]))
  }

  return {
    technicians: byRole.get('technician')?.size ?? 0,
    operators: byRole.get('operator')?.size ?? 0,
    others: byRole.get('other')?.size ?? 0,
    totalPeople: everyone.size,
    hired,
  }
}
