// Дела мира — только из данных (план world-game-s59, решение 8): чего не хватает
// мероприятиям впереди и что горит сегодня. Чистые функции без React и three, текстов
// интерфейса здесь нет: слова делам даёт доска (hud/QuestBoard.tsx), действие —
// диспетчер (actions/useWorldActions.ts). «Сегодня» приходит аргументом — как в
// splitProjects.ts: модуль сверяется скриптом против выборки из базы.
import { expiryState } from '../../../lib/expiry'
import { parseDateValue } from '../../../lib/date'
import type { MealDayMark } from '../../meals/api'
import type { WorldLotPart } from '../worldStore'
import { lotReadiness, type ReadinessKey } from './readiness'
import { LOT_MAX } from './splitProjects'
import type { WorldLot } from './types'

export type QuestKind =
  // Впереди нет ни одного мероприятия
  | 'no-lots'
  // Пункты готовности участка (readiness.ts) и даты
  | 'no-place' | 'no-dates' | 'no-lists' | 'no-plan' | 'no-staff'
  // Мероприятие идёт сегодня, в составе есть люди: обеда на сегодня нет / заказы собираются
  | 'meal-missing' | 'meal-collecting'
  // Документы сотрудников (сводка главной): срок позади / истекает скоро
  | 'docs-expired' | 'docs-soon'

export type Quest = {
  // Устойчивый ключ строки доски: `<kind>` или `<kind>:<id мероприятия>`
  id: string
  kind: QuestKind
  // Мероприятие дела; null — дело не про участок (no-lots, документы)
  lot: WorldLot | null
  // Часть участка, к которой едет камера и которую выбирает строка доски. null — объекта
  // в сцене нет: дело не про участок либо участок вне сетки (седьмой и дальше по дате) —
  // строка ведёт на страницу мероприятия
  part: WorldLotPart | null
  // Сколько (документов); у остальных дел числа нет
  count?: number
}

// Обед на сегодня у одного мероприятия. Смотрим только слот lunch (план с59): ужин —
// не ежедневное дело. missing — метки на сегодня нет; done — заказан или доставлен.
export type MealToday = 'missing' | 'collecting' | 'done'

export function mealToday(marks: readonly Pick<MealDayMark, 'meal_on' | 'slot' | 'status'>[], today: string): MealToday {
  const lunch = marks.find((mark) => mark.meal_on === today && mark.slot === 'lunch')
  if (!lunch) return 'missing'
  return lunch.status === 'collecting' ? 'collecting' : 'done'
}

// Идёт ли мероприятие сегодня. Нет dateTo — один день; нет dateFrom — дат нет вовсе,
// «сегодня» про него сказать нечего.
export function runsToday(lot: Pick<WorldLot, 'dateFrom' | 'dateTo'>, today: string): boolean {
  if (lot.dateFrom === null) return false
  return lot.dateFrom <= today && today <= (lot.dateTo ?? lot.dateFrom)
}

// Кому сегодня нужен ответ про обед: идёт сегодня и в составе кто-то есть. По этим
// мероприятиям оболочка зовёт fetchProjectMealDays (обычно 0–2 запроса).
export const needsMealToday = (lot: Pick<WorldLot, 'dateFrom' | 'dateTo' | 'staff'>, today: string) => lot.staff > 0 && runsToday(lot, today)

const READINESS_QUEST: Record<ReadinessKey, { kind: QuestKind; part: WorldLotPart }> = {
  place: { kind: 'no-place', part: 'lot' },
  lists: { kind: 'no-lists', part: 'addtruck' },
  plan: { kind: 'no-plan', part: 'addplan' },
  staff: { kind: 'no-staff', part: 'addcrew' },
}

export type QuestInput = {
  // Все идущие и будущие мероприятия по дате начала (WorldData.venues); null — реестр
  // не ответил: дел про участки нет, выдумывать нечего
  lots: readonly WorldLot[] | null
  // Метки обедов по id мероприятия — только для тех, по кому пришёл ответ. Мероприятия
  // без записи (запрос ещё идёт или упал) дела про обед не дают: молчание честнее догадки
  meals: ReadonlyMap<string, readonly Pick<MealDayMark, 'meal_on' | 'slot' | 'status'>[]>
  // Сроки документов сотрудников, голые даты (HomeSummary.employees.expiries); null —
  // сводка не ответила
  expiries: readonly string[] | null
  // yyyy-mm-dd, часы устройства
  today: string
}

// Порядок — порядок строк доски: сначала горящее сегодня (обеды), затем участки по
// дате начала (у каждого — пункты в порядке готовности, перед ними даты), в конце —
// документы.
export function questsOf({ lots, meals, expiries, today }: QuestInput): Quest[] {
  const urgent: Quest[] = []
  const rest: Quest[] = []

  if (lots) {
    if (lots.length === 0) rest.push({ id: 'no-lots', kind: 'no-lots', lot: null, part: null })
    lots.forEach((lot, index) => {
      // В сцене стоят первые LOT_MAX участков
      const inScene = index < LOT_MAX
      const push = (list: Quest[], kind: QuestKind, part: WorldLotPart) => list.push({ id: `${kind}:${lot.id}`, kind, lot, part: inScene ? part : null })

      const marks = meals.get(lot.id)
      if (marks && needsMealToday(lot, today)) {
        const meal = mealToday(marks, today)
        if (meal === 'missing') push(urgent, 'meal-missing', 'cafe')
        else if (meal === 'collecting') push(urgent, 'meal-collecting', 'cafe')
      }

      if (lot.dateFrom === null) push(rest, 'no-dates', 'lot')
      for (const item of lotReadiness(lot).items) {
        if (!item.done) push(rest, READINESS_QUEST[item.key].kind, READINESS_QUEST[item.key].part)
      }
    })
  }

  if (expiries) {
    // «Сегодня» для сроков — тот же день, что и для мероприятий
    const now = parseDateValue(today) ?? new Date()
    let expired = 0, soon = 0
    for (const value of expiries) {
      const state = expiryState(value, undefined, now)
      if (state === 'expired') expired += 1
      else if (state === 'soon') soon += 1
    }
    if (expired > 0) rest.push({ id: 'docs-expired', kind: 'docs-expired', lot: null, part: null, count: expired })
    if (soon > 0) rest.push({ id: 'docs-soon', kind: 'docs-soon', lot: null, part: null, count: soon })
  }

  return [...urgent, ...rest]
}
