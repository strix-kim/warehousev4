import { useCallback, useEffect, useRef, useState } from 'react'
import { reportAppError } from '../../../lib/reportAppError'
import { fetchProjectMealDays, type MealDayMark } from '../../meals/api'
import { fetchProjectHallPlans, fetchProjectLists } from '../../projects/api'
import { fetchProjectStaff, type ProjectStaffMember } from '../../projects/staffApi'
import type { ProjectHallPlanRow, ProjectListRow } from '../../projects/types'
import type { WorldLot } from '../data/types'

// Состояние одной секции карточки участка. idle — запрос не нужен: счётчик реестра
// уже сказал, что строк нет. failed и «пусто» — разные состояния (gotchas §11):
// отказ рисуется строкой «Не загрузилось · Повторить», а не «списков нет».
export type LotSection<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'failed' }

export type LotSectionHandle<T> = { section: LotSection<T>; retry: () => void }

const IDLE = { state: 'idle' } as const
const LOADING = { state: 'loading' } as const
const FAILED = { state: 'failed' } as const

// Один запрос секции. load — функция модуля (стабильная ссылка), иначе эффект
// перезапускался бы каждым рендером. Гонка: ответ принимается, только пока жив тот
// запуск эффекта, который его послал, — смена участка, повтор и размонтирование
// гасят флаг (gotchas §6). Повтор трогает только свою секцию.
// stamp — счётчик реестра этой секции. Мир после записи отдаёт участок новым объектом
// с тем же id: сменились только реквизиты (имя, место, даты) — stamp прежний, запроса
// нет; сменился счётчик — секция перечитывается. Перечитывание того же участка идёт
// под прежними строками, без скелета: панель не мигает, строки меняются на ответе.
function useLotSection<T>(lotId: string, stamp: number | boolean, load: (projectId: string) => Promise<T>, source: string): LotSectionHandle<T> {
  const enabled = Boolean(stamp)
  const [section, setSection] = useState<LotSection<T>>(enabled ? LOADING : IDLE)
  const [attempt, setAttempt] = useState(0)
  // Чьи строки сейчас в section: под чужими строками перечитывать нельзя
  const shownLot = useRef(lotId)

  useEffect(() => {
    if (!enabled) {
      setSection(IDLE)
      return
    }
    let isCurrent = true
    const sameLot = shownLot.current === lotId
    shownLot.current = lotId
    setSection((prev) => (sameLot && prev.state === 'ready' ? prev : LOADING))
    load(lotId)
      .then((data) => { if (isCurrent) setSection({ state: 'ready', data }) })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setSection(FAILED)
        reportAppError(error, { scope: 'loader', route: '/world', detail: { source } })
      })
    return () => { isCurrent = false }
  }, [lotId, enabled, stamp, load, source, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { section, retry }
}

export type LotDetails = {
  lists: LotSectionHandle<ProjectListRow[]>
  plans: LotSectionHandle<ProjectHallPlanRow[]>
  meals: LotSectionHandle<MealDayMark[]>
  staff: LotSectionHandle<ProjectStaffMember[]>
}

// Содержимое секций карточки: четыре запроса разом, без кэша — карточка показывает то,
// что в базе сейчас (как ProjectPage). Запросы, ответ которых известен из счётчиков
// реестра (списков нет, плана нет, состава нет), не шлются. У обедов счётчика нет —
// запрос идёт всегда и на обновление участка не перечитывается: сказать, что обеды
// изменились, реестру нечем.
export function useLotDetails(lot: WorldLot): LotDetails {
  return {
    lists: useLotSection(lot.id, lot.lists, fetchProjectLists, 'lot-lists'),
    plans: useLotSection(lot.id, lot.hasPlan, fetchProjectHallPlans, 'lot-hall-plans'),
    meals: useLotSection(lot.id, true, fetchProjectMealDays, 'lot-meals'),
    staff: useLotSection(lot.id, lot.staff, fetchProjectStaff, 'lot-staff'),
  }
}
