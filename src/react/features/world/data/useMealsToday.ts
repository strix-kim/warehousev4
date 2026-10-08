// Метки обедов для дел мира: в реестре мероприятий их нет, поэтому по мероприятиям,
// которым сегодня нужен ответ про обед (needsMealToday — идёт сегодня и в составе кто-то
// есть, обычно 0–2), оболочка зовёт тот же fetchProjectMealDays, что и экран обедов.
// Кэша и своих ключей нет: каждый вход в мир читает базу заново — с экрана обедов
// человек возвращается уже к свежему ответу.
import { useEffect, useMemo, useState } from 'react'
import { reportAppError } from '../../../lib/reportAppError'
import { fetchProjectMealDays, type MealDayMark } from '../../meals/api'
import { needsMealToday } from './quests'
import type { WorldLot } from './types'

const NONE: ReadonlyMap<string, MealDayMark[]> = new Map()

// Карта «id мероприятия → метки» только по ответившим: запрос идёт или упал — записи
// нет, и дела про обед у мероприятия нет (data/quests.ts). Ссылка меняется только с ответом.
export function useMealsToday(venues: readonly WorldLot[] | null, today: string): ReadonlyMap<string, MealDayMark[]> {
  // Реестр перечитывается после каждой записи из мира, и venues приходит новой ссылкой.
  // Ключ запроса — набор id, а не ссылка: тот же набор базу не тревожит.
  const key = useMemo(
    () => (venues ?? []).filter((lot) => needsMealToday(lot, today)).map((lot) => lot.id).sort().join(','),
    [venues, today],
  )
  const [meals, setMeals] = useState(NONE)

  useEffect(() => {
    // Гонка (gotchas §6): набор сменился или мир размонтирован — ответ прежнего набора не пишем
    let isCurrent = true
    if (!key) {
      setMeals((prev) => (prev.size === 0 ? prev : NONE))
      return
    }
    const ids = key.split(',')
    const route = window.location.pathname
    // Ждём все ответы: дела пересчитываются один раз, а не на каждое мероприятие.
    // До ответа карта прежняя — мероприятия, оставшиеся в наборе, дело не теряют.
    void Promise.all(ids.map((id) => fetchProjectMealDays(id).then(
      (marks) => [id, marks] as const,
      (error: unknown) => {
        reportAppError(error, { scope: 'loader', route, detail: { source: 'world-meals-today', project: id } })
        return null
      },
    ))).then((answers) => {
      if (isCurrent) setMeals(new Map(answers.filter((answer) => answer !== null)))
    })
    return () => { isCurrent = false }
  }, [key])

  return meals
}
