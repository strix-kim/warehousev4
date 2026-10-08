// Адаптер «продукт → мир»: собирает WorldData из тех же кэшей и запросов, что питают
// главную и реестры. Своих ключей persistentCache не заводит и ничего не пишет —
// владельцы значений остаются в своих фичах (home, lists, vehicles, employees,
// projects). Участки и архив — из реестра мероприятий (projects:list): его сбрасывают
// записи мероприятий, списков, состава и планов залов.
import { useEffect, useMemo, useState } from 'react'
import { todayDateValue } from '../../../lib/date'
import { reportAppError } from '../../../lib/reportAppError'
import { fetchEmployeeList, readCachedEmployeeList } from '../../employees/api'
import { fetchHomeSummary, readCachedHomeSummary } from '../../home/api'
import { fetchEquipmentLists, preferredListsPageSize, readCachedEquipmentLists } from '../../lists/api'
import { fetchProjects, readCachedProjects } from '../../projects/api'
import { fetchVehicles, readCachedVehicles } from '../../vehicles/api'
import { splitProjects } from './splitProjects'
import type { WorldArchivePlace, WorldData, WorldLot } from './types'

type Mock = { venues: WorldLot[]; archive: WorldArchivePlace[] }

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
  const [cachedProjects] = useState(() => readCachedProjects())
  // «Сегодня» — часы устройства на момент входа в мир; делит мероприятия на зоны
  const [today] = useState(todayDateValue)
  const [summary, setSummary] = useState(cachedSummary)
  const [lists, setLists] = useState(cachedLists)
  const [projects, setProjects] = useState(cachedProjects)
  // Машины и люди — наполнение сцены, и приходят одним обновлением (см. ниже)
  const [crowd, setCrowd] = useState({ vehicles: cachedVehicles, employees: cachedEmployees })
  // Площадки и архив — из реестра мероприятий. Макет худшего случая (fixtures.dev.ts)
  // подменяет их только в dev и только по ?mock=on; в проде mock всегда null.
  const [mock, setMock] = useState<Mock | null>(null)
  useEffect(() => {
    // Ветка целиком срезается из прод-сборки вместе с чанком фикстур
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('mock') !== 'on') return
    let isCurrent = true
    void import('./fixtures.dev').then((module) => {
      if (isCurrent) setMock({ venues: module.FIXTURE_VENUES, archive: module.FIXTURE_ARCHIVE })
    })
    return () => { isCurrent = false }
  }, [])

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
    void fetchProjects({ bypassCache: Boolean(cachedProjects) })
      .then((value) => { if (isCurrent) setProjects(value) }, failed('projects', Boolean(cachedProjects)))
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
  }, [cachedEmployees, cachedLists, cachedProjects, cachedSummary, cachedVehicles, listsQuery])

  // Новая ссылка — только с новым ответом реестра: иначе движок пересобирал бы зоны
  // на каждый ответ машин или списков (createWorld сравнивает venues и archive по ссылке)
  const split = useMemo(() => (projects ? splitProjects(projects, today) : null), [projects, today])

  return useMemo(() => {
    const { vehicles, employees } = crowd
    if (!summary && !lists && !vehicles && !employees && !split && !mock) return null
    return {
      // Реестр не ответил и в кэше пусто — зон нет, один кампус: выдумывать нечего
      venues: mock?.venues ?? split?.lots ?? null,
      archive: mock?.archive ?? split?.archive ?? null,
      mock: mock !== null,
      cars: (vehicles ?? []).map((row) => ({ id: row.id, brand: row.brand, model: row.model, color: row.color, plate: row.plate_number })),
      // Только штат: наёмные в «Сотрудники» не входят (решение прораба с53, п. 11)
      people: (employees ?? []).filter((row) => row.department === 'staff').map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name })),
      sites: {
        office: lists?.total ?? null,
        warehouse: summary?.equipment.units ?? null,
        garage: summary?.vehicles.count ?? null,
      },
    }
  }, [crowd, lists, mock, split, summary])
}
