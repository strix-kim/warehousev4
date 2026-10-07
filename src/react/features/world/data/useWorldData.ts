// Адаптер «продукт → мир»: собирает WorldData из тех же кэшей и запросов, что питают
// главную и реестры. Своих ключей persistentCache не заводит и ничего не пишет —
// владельцы значений остаются в своих фичах (home, lists, vehicles, employees).
import { useEffect, useMemo, useState } from 'react'
import { reportAppError } from '../../../lib/reportAppError'
import { fetchEmployeeList, readCachedEmployeeList } from '../../employees/api'
import { fetchHomeSummary, readCachedHomeSummary } from '../../home/api'
import { fetchEquipmentLists, preferredListsPageSize, readCachedEquipmentLists } from '../../lists/api'
import { fetchVehicles, readCachedVehicles } from '../../vehicles/api'
import type { WorldData } from './types'

// null — ни один источник ещё не ответил и в кэше пусто: кампус стоит без машин,
// фигурок и чисел. Ссылка меняется только вместе с ответом источника.
export function useWorldData(): WorldData | null {
  // Первый кадр — из кэша, затем свежий ответ (как на главной). Запрос списков —
  // тот же, что у плитки главной и первой страницы /lists: общий ключ и то же число.
  const [listsQuery] = useState(() => ({ page: 1, search: '', pageSize: preferredListsPageSize() }))
  const [cachedSummary] = useState(() => readCachedHomeSummary())
  const [cachedLists] = useState(() => readCachedEquipmentLists(listsQuery))
  const [cachedVehicles] = useState(() => readCachedVehicles())
  const [cachedEmployees] = useState(() => readCachedEmployeeList())
  const [summary, setSummary] = useState(cachedSummary)
  const [lists, setLists] = useState(cachedLists)
  // Машины и люди — наполнение сцены, и приходят одним обновлением (см. ниже)
  const [crowd, setCrowd] = useState({ vehicles: cachedVehicles, employees: cachedEmployees })

  useEffect(() => {
    let isCurrent = true
    const route = window.location.pathname
    // Отказ источника: его часть мира остаётся как была — из кэша или пустой.
    // Мир — витрина, а не реестр: экран ошибки здесь не нужен, нужен след.
    const failed = (source: string, servedFromCache: boolean) => (error: unknown) => {
      reportAppError(error, { scope: 'loader', route, detail: { source: `world-${source}`, servedFromCache } })
      return null
    }

    // Показали кэш — обязаны перепроверить у сервера
    void fetchHomeSummary({ bypassCache: Boolean(cachedSummary) })
      .then((value) => { if (isCurrent) setSummary(value) }, failed('summary', Boolean(cachedSummary)))
    void fetchEquipmentLists({ ...listsQuery, bypassCache: Boolean(cachedLists) })
      .then((value) => { if (isCurrent) setLists(value) }, failed('lists', Boolean(cachedLists)))
    // Каждый новый состав машин или людей — пересборка сцены. Ждём оба ответа, чтобы
    // мир с холодным кэшем пересобрался один раз, а не дважды подряд.
    void Promise.all([
      fetchVehicles({ bypassCache: Boolean(cachedVehicles) }).catch(failed('vehicles', Boolean(cachedVehicles))),
      fetchEmployeeList({ bypassCache: Boolean(cachedEmployees) }).catch(failed('employees', Boolean(cachedEmployees))),
    ]).then(([vehicles, employees]) => {
      if (!isCurrent) return
      // null — источник отказал: его прежнее значение не трогаем
      setCrowd((prev) => ({ vehicles: vehicles ?? prev.vehicles, employees: employees ?? prev.employees }))
    })
    return () => { isCurrent = false }
  }, [cachedEmployees, cachedLists, cachedSummary, cachedVehicles, listsQuery])

  return useMemo(() => {
    const { vehicles, employees } = crowd
    if (!summary && !lists && !vehicles && !employees) return null
    return {
      cars: (vehicles ?? []).map((row) => ({ id: row.id, brand: row.brand, model: row.model, color: row.color, plate: row.plate_number })),
      people: (employees ?? []).map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name })),
      sites: {
        office: lists?.total ?? null,
        warehouse: summary?.equipment.units ?? null,
        garage: summary?.vehicles.count ?? null,
      },
    }
  }, [crowd, lists, summary])
}
