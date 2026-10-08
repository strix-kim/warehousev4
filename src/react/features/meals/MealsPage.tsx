import { ArrowLeft, CalendarRange, CircleAlert, ClipboardList, Plus } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { deleteOrder, ensureMeal, fetchMealDay, fetchProjectDishes, fetchProjectMealDays, mealErrorText, saveGuestOrder, saveStaffOrder, setMealStatus, updateOrder, type MealDay, type MealDayMark, type MealDishHint } from './api'
import { MealExpenseDrawer } from './MealExpenseDrawer'
import { MealOrderSheet } from './MealOrderSheet'
import { MealPersonRow } from './MealPersonRow'
import { MealStatusBar } from './MealStatusBar'
import { MealSummarySheet } from './MealSummarySheet'
import { summarizeMeal, type MealTextContext } from './mealSummary'
import { isMealSlot, MEAL_SLOTS, MEAL_STATUSES, periodDays, type MealOrder, type MealOrderInput, type MealSlot, type MealStatus, type ProjectMeal, type Tr } from './types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, RetryButton } from '../../components/ErrorState'
import { employeeDisplayName } from '../employees/types'
import { formatSum } from '../expenses/format'
import { fetchProject } from '../projects/api'
import { fetchProjectStaff, type ProjectStaffMember } from '../projects/staffApi'
import { formatProjectPeriod, type ProjectWithVenue } from '../projects/types'
import { formatDayMonth, parseDateValue, todayDateValue } from '../../lib/date'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import './meals.css'

const ROUTE = '/projects/:projectId/meals'

type LoadState = 'loading' | 'ready' | 'missing' | 'failed'

// Строка списка: человек состава (заказа может не быть — «не спросили»),
// человек вне состава (убрали после заказа) или гость.
type PersonRow = {
  key: string
  name: string
  note: 'outside' | 'guest' | null
  // Сотрудник состава или вне состава; у гостя null.
  employeeId: string | null
  order: MealOrder | null
}

// Запись строки: идёт или не прошла. Неудавшийся черновик держим, чтобы
// «не сохранено, повторить» открывало лист с набранным, а не со строкой базы.
type RowPending = { state: 'saving' } | { state: 'failed'; input: MealOrderInput }

// Открытый лист — ОДИН на экран (у каждого свой useModalLayer, два слоя
// разом снимали бы блокировку прокрутки друг у друга): строка списка, новый
// гость, сводка или «В расходы». session — номер открытия:
// «Сохранить → следующий» меняет key строки, но не session, и лист остаётся
// тем же смонтированным (MealOrderSheet, draftKey). Новое открытие — новый
// номер: строку, закрытую на прошлом, AnimatePresence не вернёт с её уходом.
type SheetTarget =
  | { kind: 'row'; key: string; session: number }
  | { kind: 'guest'; session: number }
  | { kind: 'summary' | 'expense' }

const NOT_EATING: MealOrderInput = { dish: null, qty: 1, price: null }

// Узбекские дни недели — своим списком, как в AppDatePicker: Intl для `uz`
// отдаёт то латиницу, то кириллицу в зависимости от движка. С воскресенья —
// под порядок Date.getDay().
const uzbekWeekdays = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']

function weekdayShort(date: Date, locale: string) {
  if (locale.toLowerCase().startsWith('uz')) return uzbekWeekdays[date.getDay()]!
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace('.', '')
}

function slotLabel(slot: MealSlot, tr: Tr) {
  return slot === 'lunch' ? tr('Обед', 'Tushlik') : tr('Ужин', 'Kechki ovqat')
}

// Порядок списка — план 3.2: состав (порядок sortStaff), затем строки людей,
// которых убрали из состава после заказа, затем гости — оба хвоста в порядке
// ввода (created_at, как пришли из базы).
function buildRows(staff: ProjectStaffMember[], orders: MealOrder[], tr: Tr): PersonRow[] {
  const byEmployee = new Map(orders.flatMap((order) => (order.employee_id ? [[order.employee_id, order] as const] : [])))
  const staffIds = new Set(staff.map((member) => member.employee_id))
  const rows: PersonRow[] = staff.map((member) => ({
    key: `staff:${member.employee_id}`,
    name: employeeDisplayName(member.employee),
    note: null,
    employeeId: member.employee_id,
    order: byEmployee.get(member.employee_id) ?? null,
  }))
  for (const order of orders) {
    if (order.employee_id && !staffIds.has(order.employee_id)) {
      rows.push({ key: order.id, name: order.employee ? employeeDisplayName(order.employee) : tr('Сотрудник удалён', 'Xodim o‘chirilgan'), note: 'outside', employeeId: order.employee_id, order })
    }
  }
  for (const order of orders) {
    if (order.guest_name) rows.push({ key: order.id, name: order.guest_name, note: 'guest', employeeId: null, order })
  }
  return rows
}

// Подсказки блюд (план 3.2): сначала блюда этого приёма по частоте — из уже
// загруженных строк, потом блюда мероприятия (частоту считает база). Слияние
// без дублей по lower(), как группирует сводка; пишется так, как ввели первым.
// Цена — последняя введённая в приёме, нет её — последняя по мероприятию.
function buildDishHints(orders: MealOrder[], projectDishes: MealDishHint[]): MealDishHint[] {
  const local = new Map<string, MealDishHint>()
  for (const order of orders) {
    if (!order.dish) continue
    const key = order.dish.toLowerCase()
    const hint = local.get(key)
    if (!hint) local.set(key, { dish: order.dish, count: 1, price: order.price })
    else {
      hint.count += 1
      if (order.price !== null) hint.price = order.price
    }
  }
  const projectPrice = new Map(projectDishes.map((hint) => [hint.dish.toLowerCase(), hint.price]))
  // sort устойчив: при равной частоте — порядок ввода.
  const first = [...local.values()]
    .sort((a, b) => b.count - a.count)
    .map((hint) => (hint.price === null ? { ...hint, price: projectPrice.get(hint.dish.toLowerCase()) ?? null } : hint))
  return [...first, ...projectDishes.filter((hint) => !local.has(hint.dish.toLowerCase()))]
}

// Экран обедов мероприятия: день и слот — в адресе (?day=YYYY-MM-DD&slot=…),
// смена — replace, чтобы «назад» уводил на мероприятие, а не по дням (gotchas §7).
// Кэша нет (план 3.3): обеды правят на бегу, база читается на каждом входе,
// а после записи строка в списке заменяется ответом базы — без оптимистичной
// записи: пока запрос летит, строка помечена «сохраняем…».
export function MealsPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const currency = tr('сум', 'so‘m')
  const { projectId } = useParams<{ projectId: string }>()
  const [params, setParams] = useSearchParams()
  const [project, setProject] = useState<ProjectWithVenue | null>(null)
  const [staff, setStaff] = useState<ProjectStaffMember[]>([])
  const [mealDays, setMealDays] = useState<MealDayMark[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  // Приём на экране — с ключом «день:слот», под которым он прочитан: при смене дня
  // старые строки не показываются под новым днём, пока летит ответ.
  const [mealDay, setMealDay] = useState<(MealDay & { key: string }) | null>(null)
  const [dayFailedKey, setDayFailedKey] = useState<string | null>(null)
  const [dayReloadKey, setDayReloadKey] = useState(0)
  // Подсказки блюд мероприятия — один раз на вход: после записи хватает
  // локальных строк приёма (buildDishHints).
  const [projectDishes, setProjectDishes] = useState<MealDishHint[]>([])
  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  // Ключ — «день:слот|строка»: у человека состава ключ строки один на все дни.
  const [pending, setPending] = useState<Record<string, RowPending>>({})
  const sheetSessionRef = useRef(0)
  const [statusBusy, setStatusBusy] = useState(false)
  // Отказ смены статуса — под ключом приёма: на другом дне его не показываем.
  const [statusError, setStatusError] = useState<{ key: string; text: string } | null>(null)

  useDocumentTitle(project ? tr(`Обеды — ${project.name}`, `Ovqatlanish — ${project.name}`) : '')

  useEffect(() => {
    if (!projectId) {
      setLoadState('missing')
      return
    }
    let isCurrent = true
    setLoadState('loading')
    // Один исход на страницу (gotchas §11): состав, показанный пустым из-за
    // отказа своего запроса, читался бы как «в составе никого».
    Promise.all([fetchProject(projectId), fetchProjectStaff(projectId), fetchProjectMealDays(projectId)])
      .then(([row, members, marks]) => {
        if (!isCurrent) return
        setProject(row)
        setStaff(members)
        setMealDays(marks)
        setLoadState(row ? 'ready' : 'missing')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', route: ROUTE })
      })
    return () => { isCurrent = false }
  }, [projectId, reloadKey])

  // Подсказки — удобство, а не данные: отказ не валит страницу, чипов просто
  // нет, блюдо вписывают руками (gotchas §11: здесь человеку всё равно). Отказ —
  // в канал.
  useEffect(() => {
    if (!projectId) return
    let isCurrent = true
    setProjectDishes([])
    fetchProjectDishes(projectId)
      .then((hints) => {
        if (isCurrent) setProjectDishes(hints)
      })
      .catch((error: unknown) => {
        if (isCurrent) reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-dishes' } })
      })
    return () => { isCurrent = false }
  }, [projectId])

  const days = useMemo(() => periodDays(project?.date_from ?? null, project?.date_to ?? null), [project])
  // Дни с обедами вне периода (даты мероприятия сдвинули потом) — в конце ленты.
  const outsideDays = useMemo(() => {
    const inPeriod = new Set(days)
    return [...new Set(mealDays.map((mark) => mark.meal_on))].filter((day) => !inPeriod.has(day)).sort()
  }, [days, mealDays])

  const requestedDay = params.get('day') ?? ''
  const today = todayDateValue()
  const day = days.includes(requestedDay) || outsideDays.includes(requestedDay)
    ? requestedDay
    : days.includes(today) ? today : days[0] ?? ''
  const requestedSlot = params.get('slot')
  const slot: MealSlot = isMealSlot(requestedSlot) ? requestedSlot : 'lunch'
  const dayKey = `${day}:${slot}`
  const markedDays = useMemo(() => new Set(mealDays.filter((mark) => mark.slot === slot).map((mark) => mark.meal_on)), [mealDays, slot])

  // Строки, сводка и контекст текста — до раннего выхода (хуки) и в useMemo:
  // текст сводки иначе пересобирался бы на каждый рендер страницы.
  const shown = mealDay?.key === dayKey ? mealDay : null
  const rows = useMemo(() => (shown ? buildRows(staff, shown.orders, tr) : []), [shown, staff, tr])
  // Порядок «Полной» сводки — как в списке: состав, вне состава, гости.
  const summaryOrders = useMemo(() => rows.flatMap((row) => (row.order ? [row.order] : [])), [rows])
  const summary = useMemo(() => summarizeMeal(summaryOrders, tr), [summaryOrders, tr])
  const projectName = project?.name ?? ''
  const textContext = useMemo<MealTextContext>(() => ({ projectName, day, slot, locale }), [projectName, day, slot, locale])

  useEffect(() => {
    if (loadState !== 'ready' || !projectId || !day) return
    let isCurrent = true
    const key = `${day}:${slot}`
    setDayFailedKey(null)
    fetchMealDay(projectId, day, slot)
      .then((value) => {
        if (isCurrent) setMealDay({ ...value, key })
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setDayFailedKey(key)
        reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-day' } })
      })
    return () => { isCurrent = false }
  }, [loadState, projectId, day, slot, dayReloadKey])

  if (loadState !== 'ready' || !project) {
    return (
      <section className="data-panel">
        {loadState === 'loading' && <div className="meals-skeleton" role="status" aria-label={tr('Загружаем обеды…', 'Ovqatlanish yuklanmoqda…')}><span /><span /><span /></div>}
        {loadState === 'missing' && (
          <EmptyState
            icon={<CalendarRange size={27} />}
            title={tr('Мероприятие не найдено', 'Tadbir topilmadi')}
            text={tr('Возможно, его удалили или ссылка устарела.', 'Ehtimol, u o‘chirilgan yoki havola eskirgan.')}
            action={<button className="button button--secondary" onClick={() => navigate('/projects')}>{tr('К мероприятиям', 'Tadbirlarga')}</button>}
          />
        )}
        {loadState === 'failed' && (
          <ErrorState
            title={tr('Не удалось открыть обеды', 'Ovqatlanishni ochib bo‘lmadi')}
            text={tr('Проверьте интернет и повторите. Данные не изменились.', 'Internetni tekshiring va qayta urinib ko‘ring. Ma’lumotlar o‘zgarmadi.')}
            action={<RetryButton onClick={() => setReloadKey((current) => current + 1)} />}
          />
        )}
      </section>
    )
  }

  const current = project

  // Смена дня или слота — replace: история не копит каждый тап по ленте.
  function selectView(nextDay: string, nextSlot: MealSlot) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('day', nextDay)
      next.set('slot', nextSlot)
      return next
    }, { replace: true })
  }

  // Итог плашки — простым проходом по строкам (план 1.6: UX, не деньги).
  let ordered = 0
  let notEating = 0
  let notAsked = 0
  let total = 0
  for (const row of rows) {
    if (!row.order) notAsked += 1
    else if (row.order.dish === null) notEating += 1
    else {
      ordered += 1
      if (row.order.price !== null) total += row.order.qty * row.order.price
    }
  }

  // Обед в расходах — ввод заперт (пара в базе: guard_meal_orders_locked).
  const isLocked = Boolean(shown?.meal?.expense_id)
  // Статус из базы строкой — сужаем до известных; обеда нет — «Собираем».
  const mealStatus: MealStatus = MEAL_STATUSES.find((value) => value === shown?.meal?.status) ?? 'collecting'
  const dishHints = shown ? buildDishHints(shown.orders, projectDishes) : []

  function setRowPending(key: string, value: RowPending | null) {
    setPending((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  // Строка обеда дня — лениво, при первой записи (ensureMeal глотает гонку
  // двух вкладок). Точка на ленте дней появляется сразу, без перечитывания.
  async function mealForWrite(view: MealDay & { key: string }): Promise<ProjectMeal> {
    if (view.meal) return view.meal
    const meal = await ensureMeal(current.id, day, slot)
    setMealDay((prev) => (prev?.key === view.key ? { ...prev, meal: prev.meal ?? meal } : prev))
    setMealDays((marks) => (marks.some((mark) => mark.id === meal.id)
      ? marks
      : [...marks, { id: meal.id, meal_on: meal.meal_on, slot: meal.slot, status: meal.status }]))
    return meal
  }

  // Ответ записи — в список приёма. Совпадение по id или по сотруднику: строку
  // того же человека могла создать вторая вкладка, upsert вернул её id.
  function putOrder(viewKey: string, saved: MealOrder) {
    setMealDay((prev) => {
      if (prev?.key !== viewKey) return prev
      const index = prev.orders.findIndex((order) => order.id === saved.id || (saved.employee_id !== null && order.employee_id === saved.employee_id))
      const orders = index === -1 ? [...prev.orders, saved] : prev.orders.map((order, position) => (position === index ? saved : order))
      return { ...prev, orders }
    })
  }

  // Человек состава — upsert по (обед, сотрудник); строка вне состава или
  // гость — правка по id. Отказ: строка «не сохранено, повторить», текст отказа
  // показывает лист (он ловит проброшенную ошибку).
  async function writeRow(view: MealDay & { key: string }, row: PersonRow, input: MealOrderInput) {
    const key = `${view.key}|${row.key}`
    setRowPending(key, { state: 'saving' })
    try {
      let saved: MealOrder
      if (row.note === null && row.employeeId) {
        const meal = await mealForWrite(view)
        saved = await saveStaffOrder(meal.id, row.employeeId, input)
      } else if (row.order) {
        saved = await updateOrder(row.order.id, input)
      } else {
        throw new Error('meal row: нет ни сотрудника состава, ни строки')
      }
      putOrder(view.key, saved)
      setRowPending(key, null)
    } catch (error) {
      setRowPending(key, { state: 'failed', input })
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-order' } })
      throw error
    }
  }

  // Следующий неспрошенный после строки — по кругу, мимо тех, чья запись ещё
  // летит. «Неспрошенный» бывает только в составе: у остальных строка есть.
  function nextUnasked(fromKey: string): PersonRow | null {
    const start = rows.findIndex((row) => row.key === fromKey)
    const ordered = [...rows.slice(start + 1), ...rows.slice(0, Math.max(start, 0))]
    return ordered.find((row) => row.order === null && pending[`${dayKey}|${row.key}`]?.state !== 'saving') ?? null
  }

  // Лист закрывается или сменяется, только если он всё ещё открыт на этой
  // строке: его могли закрыть, пока летел запрос.
  function leaveRowSheet(rowKey: string, next: PersonRow | null) {
    setSheet((prev) => (prev?.kind === 'row' && prev.key === rowKey
      ? (next ? { ...prev, key: next.key } : null)
      : prev))
  }

  function openRow(row: PersonRow) {
    if (pending[`${dayKey}|${row.key}`]?.state === 'saving') return
    sheetSessionRef.current += 1
    setSheet({ kind: 'row', key: row.key, session: sheetSessionRef.current })
  }

  const sheetRow = sheet?.kind === 'row' ? rows.find((row) => row.key === sheet.key) ?? null : null

  function renderRowSheet(view: MealDay & { key: string }, row: PersonRow, session: number) {
    const rowPending = pending[`${view.key}|${row.key}`]
    const order = row.order
    return (
      <MealOrderSheet
        key={`row-${session}`}
        draftKey={row.key}
        title={row.name}
        order={order}
        initialInput={rowPending?.state === 'failed' ? rowPending.input : null}
        dishHints={dishHints}
        hasNext={nextUnasked(row.key) !== null}
        onSave={async (input, andNext) => {
          await writeRow(view, row, input)
          leaveRowSheet(row.key, andNext ? nextUnasked(row.key) : null)
        }}
        onNotEating={async () => {
          await writeRow(view, row, NOT_EATING)
          leaveRowSheet(row.key, null)
        }}
        // Человеку состава строку не удаляют — ему ставят «Не ест».
        onDelete={row.note !== null && order
          ? async () => {
            try {
              await deleteOrder(order.id)
            } catch (error) {
              reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-order-delete' } })
              throw error
            }
            setMealDay((prev) => (prev?.key === view.key ? { ...prev, orders: prev.orders.filter((item) => item.id !== order.id) } : prev))
            setRowPending(`${view.key}|${row.key}`, null)
            leaveRowSheet(row.key, null)
          }
          : undefined}
        onRequestClose={() => setSheet(null)}
      />
    )
  }

  function renderGuestSheet(view: MealDay & { key: string }, session: number) {
    return (
      <MealOrderSheet
        key={`guest-${session}`}
        draftKey="guest"
        title={tr('Новый гость', 'Yangi mehmon')}
        order={null}
        dishHints={dishHints}
        hasNext={false}
        guestNameEditable
        onSave={async (input, _andNext, guestName) => {
          try {
            const meal = await mealForWrite(view)
            putOrder(view.key, await saveGuestOrder(meal.id, guestName ?? '', input))
          } catch (error) {
            reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-guest' } })
            throw error
          }
          setSheet((prev) => (prev?.kind === 'guest' ? null : prev))
        }}
        onRequestClose={() => setSheet(null)}
      />
    )
  }

  // Смена статуса: первый «Дальше» создаёт обед (ensureMeal), строка в state —
  // из ответа базы. Шаг назад и замок после внесения держит база
  // (project_meals_expense_status_check), бар лишь не предлагает мёртвое.
  async function changeStatus(view: MealDay & { key: string }, next: MealStatus) {
    setStatusBusy(true)
    setStatusError(null)
    try {
      const meal = await mealForWrite(view)
      const updated = await setMealStatus(meal.id, next)
      setMealDay((prev) => (prev?.key === view.key ? { ...prev, meal: updated } : prev))
      setMealDays((marks) => marks.map((mark) => (mark.id === updated.id ? { ...mark, status: updated.status } : mark)))
    } catch (error) {
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-status' } })
      setStatusError({ key: view.key, text: mealErrorText(error, tr) })
    } finally {
      setStatusBusy(false)
    }
  }

  // Расход внесён: ссылка — в обед на экране, ввод запирается тем же замком.
  function markExpense(viewKey: string, expenseId: string) {
    setMealDay((prev) => (prev?.key === viewKey && prev.meal ? { ...prev, meal: { ...prev.meal, expense_id: expenseId } } : prev))
    setSheet(null)
  }

  function chip(value: string, isOutside: boolean) {
    const date = parseDateValue(value)
    if (!date) return null
    const isSelected = value === day
    return (
      <button
        key={value}
        type="button"
        className={`meals-day ${isOutside ? 'meals-day--outside' : ''}`}
        aria-pressed={isSelected}
        title={formatDayMonth(date, locale)}
        onClick={() => selectView(value, slot)}
      >
        <small>{isOutside ? tr('вне периода', 'davrdan tashqari') : weekdayShort(date, locale)}</small>
        <strong>{date.getDate()}</strong>
        {markedDays.has(value) && <span className="meals-day__dot" aria-label={tr('есть обед', 'ovqat bor')} />}
      </button>
    )
  }

  return (
    <>
      <header className="editor-header meals-header">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate(`/projects/${current.id}`)} aria-label={tr('Назад к мероприятию', 'Tadbirga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{tr('Обеды', 'Ovqatlanish')} · {formatProjectPeriod(current.date_from, current.date_to, locale, tr)}</p>
          <h1>{current.name}</h1>
        </div>
      </header>

      {days.length === 0
        ? (
          <section className="data-panel">
            <EmptyState
              icon={<CalendarRange size={27} />}
              title={tr('Укажите даты мероприятия', 'Tadbir sanalarini ko‘rsating')}
              text={tr('Обеды ведутся по дням периода. Откройте мероприятие → «Изменить» → период.', 'Ovqatlanish davr kunlari bo‘yicha yuritiladi. Tadbirni oching → «O‘zgartirish» → davr.')}
              action={<Link className="button button--secondary" to={`/projects/${current.id}`}>{tr('К мероприятию', 'Tadbirga')}</Link>}
            />
          </section>
        )
        : (
          <>
            <div className="meals-days" role="group" aria-label={tr('День', 'Kun')}>
              {days.map((value) => chip(value, false))}
              {outsideDays.map((value) => chip(value, true))}
            </div>

            <div className="segmented meals-slot" role="group" aria-label={tr('Приём пищи', 'Ovqat vaqti')}>
              {MEAL_SLOTS.map((value) => (
                <button key={value} type="button" aria-pressed={slot === value} onClick={() => selectView(day, value)}>
                  {slot === value && <span className="segmented__thumb" />}
                  {slotLabel(value, tr)}
                </button>
              ))}
            </div>

            {shown && (
              <div className="meals-status">
                <MealStatusBar
                  status={mealStatus}
                  hasMeal={Boolean(shown.meal)}
                  expenseId={shown.meal?.expense_id ?? null}
                  // Расход виден только автору (owner-таблица), а кто автор —
                  // без запроса не узнать: ссылка ведёт в журнал, подпись честная.
                  expenseNote={<Link to="/expenses">{tr('в журнале автора', 'muallif jurnalida')}</Link>}
                  busy={statusBusy}
                  onAdvance={(next) => void changeStatus(shown, next)}
                  onStepBack={(prev) => void changeStatus(shown, prev)}
                  onCreateExpense={() => setSheet({ kind: 'expense' })}
                />
                {statusError?.key === dayKey && <p className="form-error" role="alert"><CircleAlert size={15} /> {statusError.text}</p>}
              </div>
            )}

            <section className="data-panel meals-panel">
              {dayFailedKey === dayKey
                ? (
                  <ErrorState
                    title={tr('Не удалось загрузить приём', 'Ovqatni yuklab bo‘lmadi')}
                    text={tr('Проверьте интернет и повторите.', 'Internetni tekshiring va qayta urinib ko‘ring.')}
                    action={<RetryButton onClick={() => setDayReloadKey((value) => value + 1)} />}
                  />
                )
                : !shown
                  ? <div className="meals-skeleton" role="status" aria-label={tr('Загружаем приём…', 'Ovqat yuklanmoqda…')}><span /><span /><span /></div>
                  : (
                    <>
                      {rows.length === 0
                        ? (
                          <EmptyState
                            icon={<CalendarRange size={27} />}
                            title={tr('В составе никого', 'Tarkibda hech kim yo‘q')}
                            text={tr('Добавьте людей в состав на странице мероприятия.', 'Tadbir sahifasida tarkibga odam qo‘shing.')}
                            action={<Link className="button button--secondary" to={`/projects/${current.id}`}>{tr('К мероприятию', 'Tadbirga')}</Link>}
                          />
                        )
                        : (
                          <ul className="meal-rows">
                            {rows.map((row) => (
                              <li key={row.key}>
                                <MealPersonRow
                                  name={row.name}
                                  note={row.note}
                                  order={row.order}
                                  pending={pending[`${dayKey}|${row.key}`]?.state}
                                  onClick={isLocked ? undefined : () => openRow(row)}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      {!isLocked && (
                        <button type="button" className="meal-add" onClick={() => {
                          sheetSessionRef.current += 1
                          setSheet({ kind: 'guest', session: sheetSessionRef.current })
                        }}>
                          <Plus size={17} /> {tr('Гость', 'Mehmon')}
                        </button>
                      )}
                    </>
                  )}
            </section>

            {shown && (
              <div className="meals-bar">
                <span className="meals-bar__text" role="status">
                  {tr(
                    `Заказано ${ordered} · не ест ${notEating} · не спрошены ${notAsked} · ${formatSum(total)} ${currency}`,
                    `Buyurtma ${ordered} · ovqatlanmaydi ${notEating} · so‘ralmagan ${notAsked} · ${formatSum(total)} ${currency}`,
                  )}
                  {isLocked && <small className="meals-bar__locked">{tr('В расходах — ввод закрыт', 'Xarajatlarda — kiritish yopiq')}</small>}
                </span>
                <button type="button" className="button button--secondary meals-bar__summary" onClick={() => setSheet({ kind: 'summary' })}>
                  <ClipboardList size={16} /> {tr('Сводка', 'Xulosa')}
                </button>
              </div>
            )}
          </>
        )}

      <AnimatePresence>
        {shown && !isLocked && sheet?.kind === 'guest' && renderGuestSheet(shown, sheet.session)}
        {shown && !isLocked && sheet?.kind === 'row' && sheetRow && renderRowSheet(shown, sheetRow, sheet.session)}
        {shown && sheet?.kind === 'summary' && (
          <MealSummarySheet key="summary" orders={summaryOrders} ctx={textContext} onRequestClose={() => setSheet(null)} />
        )}
        {shown?.meal && !isLocked && sheet?.kind === 'expense' && (
          <MealExpenseDrawer
            key="expense"
            mealId={shown.meal.id}
            summary={summary}
            ctx={textContext}
            onRequestClose={() => setSheet(null)}
            onCreated={(expenseId) => markExpense(shown.key, expenseId)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
