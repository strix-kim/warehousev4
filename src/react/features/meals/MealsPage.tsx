import { ArrowLeft, CalendarRange } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchMealDay, fetchProjectMealDays, type MealDay, type MealDayMark } from './api'
import { isMealSlot, MEAL_SLOTS, periodDays, type MealOrder, type MealSlot, type Tr } from './types'
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
  order: MealOrder | null
}

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
    order: byEmployee.get(member.employee_id) ?? null,
  }))
  for (const order of orders) {
    if (order.employee_id && !staffIds.has(order.employee_id)) {
      rows.push({ key: order.id, name: order.employee ? employeeDisplayName(order.employee) : tr('Сотрудник удалён', 'Xodim o‘chirilgan'), note: 'outside', order })
    }
  }
  for (const order of orders) {
    if (order.guest_name) rows.push({ key: order.id, name: order.guest_name, note: 'guest', order })
  }
  return rows
}

// Экран обедов мероприятия: день и слот — в адресе (?day=YYYY-MM-DD&slot=…),
// смена — replace, чтобы «назад» уводил на мероприятие, а не по дням (gotchas §7).
// Кэша нет (план 3.3): обеды правят на бегу, база читается на каждом входе.
// Шаг 2 — только чтение.
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

  const shown = mealDay?.key === dayKey ? mealDay : null
  const rows = shown ? buildRows(staff, shown.orders, tr) : []
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
                  : rows.length === 0
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
                          <li key={row.key} className="meal-row">
                            <span className="meal-row__who">
                              <strong>{row.name}</strong>
                              {row.note === 'outside' && <small>{tr('вне состава', 'tarkibdan tashqari')}</small>}
                              {row.note === 'guest' && <small>{tr('гость', 'mehmon')}</small>}
                            </span>
                            <span className={`meal-row__dish ${row.order?.dish ? '' : 'meal-row__dish--empty'}`}>
                              {!row.order ? '—' : row.order.dish === null ? tr('Не ест', 'Ovqatlanmaydi') : row.order.dish}
                              {row.order?.dish && row.order.qty > 1 && <em> ×{row.order.qty}</em>}
                            </span>
                            <span className="meal-row__price">
                              {row.order?.dish && row.order.price !== null ? `${formatSum(row.order.price)} ${currency}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
            </section>

            {shown && (
              <div className="meals-bar" role="status">
                {tr(
                  `Заказано ${ordered} · не ест ${notEating} · не спрошены ${notAsked} · ${formatSum(total)} ${currency}`,
                  `Buyurtma ${ordered} · ovqatlanmaydi ${notEating} · so‘ralmagan ${notAsked} · ${formatSum(total)} ${currency}`,
                )}
              </div>
            )}
          </>
        )}
    </>
  )
}
