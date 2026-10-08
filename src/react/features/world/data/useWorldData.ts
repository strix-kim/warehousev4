// Адаптер «продукт → мир»: собирает WorldData из тех же кэшей и запросов, что питают
// главную и реестры. Своих ключей persistentCache не заводит и ничего не пишет —
// владельцы значений остаются в своих фичах (home, lists, vehicles, employees,
// projects). Участки и архив — из реестра мероприятий (projects:list): его сбрасывают
// записи мероприятий, списков, состава и планов залов. Состав поимённо (project_staff)
// читается из базы на каждый ответ реестра и только для участков, где мероприятие идёт
// сегодня или начинается завтра; в кэш он не ложится (правило projects/staffApi.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { todayDateValue } from '../../../lib/date'
import { reportAppError } from '../../../lib/reportAppError'
import { fetchEmployeeList, readCachedEmployeeList } from '../../employees/api'
import { fetchHomeSummary, readCachedHomeSummary } from '../../home/api'
import { fetchEquipmentLists, preferredListsPageSize, readCachedEquipmentLists } from '../../lists/api'
import { fetchProjects, readCachedProjects } from '../../projects/api'
import { fetchStaffOfProjects, type StaffByProject } from '../../projects/staffApi'
import { fetchVehicles, readCachedVehicles } from '../../vehicles/api'
import type { VehicleWithDrivers } from '../../vehicles/types'
import { crewLotIds, placePeople, sameCrews } from './placePeople'
import { splitProjects } from './splitProjects'
import type { WorldArchivePlace, WorldData, WorldLot } from './types'

type Mock = { venues: WorldLot[]; archive: WorldArchivePlace[] }

// data: null — ни один источник ещё не ответил и в кэше пусто: кампус стоит без машин,
// фигурок и чисел. Ссылка меняется только вместе с ответом источника.
// reload — перечитать реестр мероприятий мимо кэша после записи из мира: участки и
// архив пересобираются тем же путём, что и на свежий ответ при входе.
// expiries — сроки документов сотрудников из сводки главной (голые даты) для доски
// «Дела»; null — сводка не ответила. В WorldData их нет: это вход движка, а сроки
// сцена не рисует. today — «сегодня» мира, одно на зоны, дела и обеды.
// vehicles — строки выдачи машин как есть (тот же ключ кэша, что питает cars): из них
// карточка машины в гараже берёт водителей по именам, а хост действий — строку для
// VehicleDrawer. null — выдача не ответила и в кэше пусто.
export function useWorldData(): { data: WorldData | null; reload: () => Promise<void>; expiries: string[] | null; today: string; vehicles: VehicleWithDrivers[] | null } {
  // Первый кадр — из кэша, затем свежий ответ (как на главной). Запрос списков —
  // тот же, что у плитки главной и первой страницы /lists: общий ключ и то же число.
  const [listsQuery] = useState(() => ({ page: 1, search: '', pageSize: preferredListsPageSize() }))
  const [cachedSummary] = useState(() => readCachedHomeSummary())
  const [cachedLists] = useState(() => readCachedEquipmentLists(listsQuery))
  const [cachedVehicles] = useState(() => readCachedVehicles())
  const [cachedEmployees] = useState(() => readCachedEmployeeList())
  const [cachedProjects] = useState(() => readCachedProjects())
  // «Сегодня» — часы устройства на момент входа в мир; делит мероприятия на зоны и
  // отвечает делам (data/quests.ts), что идёт сегодня
  const [today] = useState(todayDateValue)
  const [summary, setSummary] = useState(cachedSummary)
  const [lists, setLists] = useState(cachedLists)
  const [projects, setProjects] = useState(cachedProjects)
  // Сколько раз реестр мероприятий ответил с сервера (вход и reload): на каждый ответ
  // состав читается заново. Ноль — на экране кэш, состав ещё не спрашивали
  const [registryAnswers, setRegistryAnswers] = useState(0)
  // null — состав не ответил (или спрашивать некого): фигурки на участках серые
  const [staff, setStaff] = useState<StaffByProject | null>(null)
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
      .then((value) => {
        if (!isCurrent) return
        setProjects(value)
        setRegistryAnswers((count) => count + 1)
      }, failed('projects', Boolean(cachedProjects)))
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

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])
  // Ключ projects:list остаётся у своей фичи: запрос идёт её же функцией, она же кладёт
  // ответ в кэш. Промис не падает: отказ оставляет мир как был и след в журнале. При
  // живой записи кэша отказ сети сюда не доходит вовсе — cachedQuery отдаёт прежнее
  // значение (gotchas §4), и мир так же остаётся прежним.
  const reload = useCallback(() => fetchProjects({ bypassCache: true }).then(
    (value) => {
      if (!isMounted.current) return
      setProjects(value)
      setRegistryAnswers((count) => count + 1)
    },
    (error: unknown) => { reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { source: 'world-projects-reload' } }) },
  ), [])

  // Состав — после ответа реестра и заново после reload(): запись состава из мира должна
  // дойти до фигурок. Нет идущих сегодня и завтрашних — запроса нет. Ответ устаревшего
  // запроса отбрасывается (gotchas §6); отказ оставляет прежний состав и след в журнале.
  const crewIds = useMemo(() => (split ? crewLotIds(split.lots, today) : []), [split, today])
  useEffect(() => {
    if (registryAnswers === 0 || crewIds.length === 0) return
    let isCurrent = true
    void fetchStaffOfProjects(crewIds).then(
      (value) => { if (isCurrent) setStaff(value) },
      (error: unknown) => { reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { source: 'world-staff', servedFromCache: false } }) },
    )
    return () => { isCurrent = false }
  }, [crewIds, registryAnswers])

  // Только штат: наёмные в «Сотрудники» не входят (решение прораба с53, п. 11)
  const { employees } = crowd
  const campus = useMemo(
    () => (employees ?? []).filter((row) => row.department === 'staff').map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, packing: false })),
    [employees],
  )
  // Расстановка людей (placePeople.ts). Участки с составом — новый массив на каждый
  // расчёт, а движок сверяет venues ссылкой: пока реестр тот же и расклад по участкам
  // не изменился, отдаём прежний массив — иначе сцену пересобирал бы каждый ответ
  // сотрудников и каждое перечитывание состава. Фикстуры макета идут как есть.
  const lastLots = useRef<{ source: WorldLot[]; lots: WorldLot[] } | null>(null)
  const placed = useMemo(() => {
    if (!split || mock) return { people: campus, lots: split?.lots ?? null }
    const next = placePeople(campus, split.lots, staff, today)
    const last = lastLots.current
    if (last && last.source === split.lots && sameCrews(last.lots, next.lots)) return { people: next.people, lots: last.lots }
    lastLots.current = { source: split.lots, lots: next.lots }
    return next
  }, [campus, mock, split, staff, today])

  const data = useMemo(() => {
    const { vehicles, employees } = crowd
    if (!summary && !lists && !vehicles && !employees && !split && !mock) return null
    return {
      // Реестр не ответил и в кэше пусто — зон нет, один кампус: выдумывать нечего
      venues: mock?.venues ?? placed.lots,
      archive: mock?.archive ?? split?.archive ?? null,
      mock: mock !== null,
      cars: (vehicles ?? []).map((row) => ({ id: row.id, brand: row.brand, model: row.model, color: row.color, plate: row.plate_number, drivers: row.drivers.length })),
      people: placed.people,
      sites: {
        office: lists?.total ?? null,
        warehouse: summary?.equipment.units ?? null,
        garage: summary?.vehicles.count ?? null,
      },
    }
  }, [crowd, lists, mock, placed, split, summary])

  const expiries = summary?.employees.expiries ?? null
  const { vehicles } = crowd
  return useMemo(() => ({ data, reload, expiries, today, vehicles }), [data, reload, expiries, today, vehicles])
}
