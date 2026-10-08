// Сборка дел мира для сцены: метки обедов (useMealsToday) + чистый расчёт (quests.ts).
// Своего состояния о делах нет — доска пересчитывается из реестра: после записи из
// дровера reload приносит новый venues, и строка уходит сама.
import { useEffect, useMemo, useRef, useState } from 'react'
import { questsOf, type Quest } from './quests'
import type { WorldCar, WorldLot } from './types'
import { useMealsToday } from './useMealsToday'

type Input = {
  // WorldData.venues; null — реестр не ответил, доски нет
  venues: readonly WorldLot[] | null
  // Макет (?mock=on): его мероприятий в базе нет — обеды не спрашиваем
  mock: boolean
  // Машины гаража; null — выдача машин не ответила. Макет их не подменяет
  cars: readonly WorldCar[] | null
  expiries: readonly string[] | null
  today: string
}

export function useQuests({ venues, mock, cars, expiries, today }: Input) {
  const meals = useMealsToday(mock ? null : venues, today)
  const quests = useMemo<Quest[]>(() => questsOf({ lots: venues, meals, cars, expiries, today }), [venues, meals, cars, expiries, today])
  // Мероприятия с делом про обед на сегодня: над их кафе панель участка ставит «!»
  const mealAlerts = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>()
    for (const quest of quests) {
      if (quest.lot && (quest.kind === 'meal-missing' || quest.kind === 'meal-collecting')) ids.add(quest.lot.id)
    }
    return ids
  }, [quests])

  // Скринридеру: число дел при его смене. Первое значение не объявляется — это ещё не
  // ответ на действие; null — объявлять нечего (как said у состава в WorldActions).
  const count = venues === null ? null : quests.length
  const [said, setSaid] = useState<number | null>(null)
  const countRef = useRef<number | null>(null)
  useEffect(() => {
    const prev = countRef.current
    countRef.current = count
    if (count === null) setSaid(null)
    else if (prev !== null && prev !== count) setSaid(count)
  }, [count])

  return { quests, mealAlerts, said }
}
