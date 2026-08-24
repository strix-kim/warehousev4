import { useEffect, useMemo, useState } from 'react'
import {
  createCatalogEntry,
  createHall,
  createHallAssignment,
  createPlanPosition,
  deleteCatalogEntry,
  deleteHall,
  deleteHallAssignment,
  deletePlanPosition,
  fetchHallAssignments,
  fetchHallPlan,
  fetchPlanPositions,
  fetchPositionCatalog,
  hallPlanErrorText,
  updateHall,
  updateHallAssignment,
  updateHallPlan,
  updatePlanPosition,
  type HallBrief,
  type HallPlanInput,
} from './api'
import {
  countPlan,
  nextHallColor,
  nextRole,
  sortHalls,
  sortPositions,
  type AssignmentWithEmployee,
  type HallPlan,
  type PlanPosition,
  type PositionCatalogEntry,
} from './types'
import { fetchEmployeeBriefs } from '../employees/api'
import type { EmployeeBrief } from '../employees/types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

export type HallPlanLoadState = 'loading' | 'ready' | 'missing' | 'failed'
export type HallPlanSaveState = 'saved' | 'saving' | 'failed'

// Клетка матрицы адресуется парой «строка × зал» — своего id у неё нет и быть не
// может: клетка это пересечение, а не запись. В самой клетке с миграции
// 20260824140000 стоит РОВНО ОДИН человек или никто.
export type CellKey = { hallId: string; positionId: string }

// Ключ клетки строкой — для Map раскладки и для «в какую клетку сейчас
// добавляют». Порядок частей фиксирован, иначе две половины кода собрали бы
// разные ключи на одну и ту же клетку.
export function cellKeyOf(key: CellKey): string {
  return `${key.positionId}:${key.hallId}`
}

// Ключ «человек в зале» — для раскладки связок (см. linkedInHall). Отдельная
// функция по той же причине, что и cellKeyOf: собирают его две половины кода,
// и порядок частей должен быть один.
export function hallPersonKeyOf(hallId: string, employeeId: string): string {
  return `${hallId}:${employeeId}`
}

// Всё состояние редактора в одном хуке: страница и ячейки остаются разметкой.
// Иначе три компонента правили бы одну и ту же матрицу каждый по-своему,
// а «Сохраняем…» считалось бы в четвёртом месте.
//
// Модель сохранения — автосейв на каждое действие, без кнопки «Сохранить».
// Правки применяются к локальному состоянию СРАЗУ (интерфейс не ждёт сеть), а
// ответ базы заменяет оптимистичную строку: btrim имени приезжает применённым.
// Отказ НЕ откатывается по одной правке — состояние уже могло уехать дальше;
// вместо этого статус встаёт в «Не сохранилось», и человек жмёт «Повторить» =
// полная перезагрузка плана. Это честнее точечного отката: после reload на
// экране ровно то, что лежит в базе.
export function useHallPlanEditor(planId: string | undefined) {
  const { tr } = useLanguage()

  const [plan, setPlan] = useState<HallPlan | null>(null)
  const [halls, setHalls] = useState<HallBrief[]>([])
  const [positions, setPositions] = useState<PlanPosition[]>([])
  const [assignments, setAssignments] = useState<AssignmentWithEmployee[]>([])
  const [loadState, setLoadState] = useState<HallPlanLoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  // Кандидаты в пикер — лениво и один раз на открытие плана: их ~200, а до
  // первого клика по «+» они не нужны вовсе.
  const [candidates, setCandidates] = useState<EmployeeBrief[]>([])
  const [candidatesState, setCandidatesState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  // Справочник позиций — общий на все планы (с20): чипы быстрого добавления
  // строк. Грузится вместе с планом, а не по клику: ряд чипов виден сразу под
  // матрицей, откладывать его некуда.
  const [catalog, setCatalog] = useState<PositionCatalogEntry[]>([])
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'failed'>('loading')

  // Счётчик незавершённых запросов, а не флаг: две правки подряд (переименовали
  // зал и тут же добавили строку) держат «Сохраняем…» до последнего ответа.
  const [pending, setPending] = useState(0)
  // Текст отказа, а не флаг: он уже собран hallPlanErrorText на языке, на
  // котором работали в момент отказа, и живёт до перезагрузки.
  const [errorText, setErrorText] = useState('')
  const [savedAt, setSavedAt] = useState(0)
  // Вставки ждут ответа базы (см. runInsert), поэтому у них есть своё «идёт»:
  // addingCell хранит ключ клетки, в которую сейчас добавляют, — по нему ячейка
  // показывает «Добавляем…». Вставка строки и вставка зала одна на редактор:
  // набирают по одной, два поля одновременно — не сценарий.
  const [addingHall, setAddingHall] = useState(false)
  const [addingPosition, setAddingPosition] = useState(false)
  const [addingCell, setAddingCell] = useState('')

  useEffect(() => {
    if (!planId) return
    let isCurrent = true
    setLoadState('loading')
    setCatalogState('loading')
    // Параллельно: план с залами, строки матрицы, ячейки и справочник позиций.
    // Последовательно было бы четыре круга сети там, где ни один запрос не
    // зависит от остальных — plan_id уже в адресе.
    Promise.all([
      fetchHallPlan(planId),
      fetchPlanPositions(planId),
      fetchHallAssignments(planId),
      // Справочник — единственный из четырёх, чей отказ НЕ закрывает план:
      // чипы это ускорение набора, а не сам план. Поэтому отказ гасится прямо
      // здесь и приезжает как null: ряд чипов не покажется, поле ввода
      // останется, матрица откроется.
      fetchPositionCatalog().catch((error: unknown) => {
        reportAppError(error, { scope: 'loader', route: '/halls/:planId', detail: { source: 'catalog', plan: planId } })
        return null
      }),
    ])
      .then(([row, positionRows, assignmentRows, catalogRows]) => {
        if (!isCurrent) return
        if (!row) {
          setLoadState('missing')
          return
        }
        // Залы вынимаем из ответа в своё состояние: два источника правды на один
        // список (plan.halls и halls) разъехались бы на первой же правке.
        const { halls: loadedHalls, ...planRow } = row
        setPlan(planRow)
        setHalls(sortHalls(loadedHalls))
        setPositions(sortPositions(positionRows))
        setAssignments(assignmentRows)
        setCatalog(catalogRows ?? [])
        setCatalogState(catalogRows ? 'ready' : 'failed')
        setErrorText('')
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        reportAppError(error, { scope: 'loader', route: '/halls/:planId', detail: { plan: planId } })
        setLoadState('failed')
      })
    return () => { isCurrent = false }
  }, [planId, reloadKey])

  function reload() {
    setErrorText('')
    setReloadKey((value) => value + 1)
  }

  // Отказ не гасим: у панели пикера своя кнопка повтора, иначе пустая выдача
  // читалась бы как «сотрудников нет».
  function loadCandidates() {
    setCandidatesState('loading')
    fetchEmployeeBriefs()
      .then((rows) => {
        setCandidates(rows)
        setCandidatesState('ready')
      })
      .catch((error: unknown) => {
        reportAppError(error, { scope: 'loader', route: '/halls/:planId', detail: { source: 'candidates', plan: planId ?? null } })
        setCandidatesState('failed')
      })
  }

  // Общий шов записи: счётчик «Сохраняем…», время последнего успеха и перевод
  // отказа в текст. Успех НЕ гасит уже показанный отказ: после сбоя локальная
  // копия расходится с базой, и снимать красный статус имеет право только
  // перезагрузка.
  async function run<T>(source: string, request: () => Promise<T>, apply: (row: T) => void) {
    setPending((value) => value + 1)
    try {
      apply(await request())
      setSavedAt(Date.now())
    } catch (error) {
      reportAppError(error, { scope: 'loader', route: '/halls/:planId', detail: { source, plan: planId ?? null } })
      setErrorText(hallPlanErrorText(error, tr))
    } finally {
      setPending((value) => value - 1)
    }
  }

  // ВСТАВКА ждёт ответа базы и только потом рисует строку — в отличие от правки,
  // которая оптимистична. Временный id выдумывать нельзя: по нему тут же можно
  // кликнуть «удалить», и запрос уйдёт с несуществующим id, а пришедший ответ
  // придётся сшивать с уже изменённой фиктивной строкой. Сеть здесь внутренняя,
  // вставка — сотни миллисекунд, и честное «добавляем…» дешевле такой сшивки.
  async function runInsert<T>(source: string, request: () => Promise<T>, apply: (row: T) => void): Promise<boolean> {
    let ok = false
    await run(source, request, (row) => { apply(row); ok = true })
    return ok
  }

  function replaceHall(row: HallBrief) {
    setHalls((current) => sortHalls(current.map((hall) => hall.id === row.id ? row : hall)))
  }

  function replacePosition(row: PlanPosition) {
    setPositions((current) => sortPositions(current.map((position) => position.id === row.id ? row : position)))
  }

  // ─── Залы (колонки матрицы) ────────────────────────────────────────────────

  function renameHall(id: string, name: string) {
    setHalls((current) => current.map((hall) => hall.id === id ? { ...hall, name } : hall))
    void run('rename-hall', () => updateHall(id, { name }), replaceHall)
  }

  function recolorHall(id: string, color: string) {
    setHalls((current) => current.map((hall) => hall.id === id ? { ...hall, color } : hall))
    void run('recolor-hall', () => updateHall(id, { color }), replaceHall)
  }

  function removeHall(id: string) {
    setHalls((current) => current.filter((hall) => hall.id !== id))
    // Ячейки зала база уносит каскадом составного FK — здесь их убирают из
    // локальной копии, чтобы они не всплыли в счётчиках до перезагрузки.
    setAssignments((current) => current.filter((cell) => cell.hall_id !== id))
    void run('delete-hall', () => deleteHall(id), () => {})
  }

  async function addHall(): Promise<void> {
    if (!planId || addingHall) return
    setAddingHall(true)
    // Имя — ДАННЫЕ: уходит в базу строкой на языке того, кто создаёт, ровно как
    // имена залов при создании плана. Номер — по количеству, а не по максимуму
    // из имён: имена правятся руками и номерами быть перестают.
    const name = tr(`Зал ${halls.length + 1}`, `${halls.length + 1}-zal`)
    const color = nextHallColor(halls.map((hall) => hall.color))
    const sortOrder = halls.reduce((max, hall) => Math.max(max, hall.sort_order), -1) + 1
    await runInsert('create-hall', () => createHall(planId, name, color, sortOrder), (row) => {
      setHalls((current) => sortHalls([...current, row]))
    })
    setAddingHall(false)
  }

  // ─── Строки матрицы ────────────────────────────────────────────────────────

  // true — строка легла в базу: поле добавления по нему очищается. При отказе
  // набранное имя остаётся в поле, и повторить можно тем же Enter.
  // role приходит от чипа справочника («Операторы» рождаются операторами);
  // свободный ввод — всегда видеоинженер, чип роли правится кликом в строке.
  async function addPosition(name: string, role: string = 'technician'): Promise<boolean> {
    if (!planId || addingPosition) return false
    const sortOrder = positions.reduce((max, position) => Math.max(max, position.sort_order), -1) + 1
    setAddingPosition(true)
    const ok = await runInsert('create-position', () => createPlanPosition(planId, name, role, sortOrder), (row) => {
      setPositions((current) => sortPositions([...current, row]))
    })
    setAddingPosition(false)
    if (ok) rememberInCatalog(name, role)
    return ok
  }

  // Пополнение справочника вписанным именем — ПОБОЧНОЕ действие, и идёт мимо
  // run() намеренно: строка плана уже легла в базу, человек добивался именно
  // этого. Отказ запоминания не имеет права ни поднять «Сохраняем…», ни зажечь
  // «Не сохранилось» — иначе успешно добавленная строка выглядела бы сбоем.
  // Доклад в канал остаётся: молчать о неудаче нельзя, пугать ею — незачем.
  //
  // Проверка «уже есть» здесь — экономия запроса, а не защита от дубля: дубль
  // держит индекс position_catalog_name_key, и createCatalogEntry вернёт на
  // него null (см. api.ts).
  function rememberInCatalog(name: string, role: string) {
    const key = name.trim().toLowerCase()
    if (!key || catalog.some((entry) => entry.name.trim().toLowerCase() === key)) return
    createCatalogEntry(name, role)
      .then((entry) => { if (entry) setCatalog((current) => [...current, entry]) })
      .catch((error: unknown) => {
        reportAppError(error, { scope: 'loader', route: '/halls/:planId', detail: { source: 'remember-position', plan: planId ?? null } })
      })
  }

  // Добавление строки чипом. Второго упserta в справочник тут не происходит:
  // имя пришло ИЗ справочника, и проверка в rememberInCatalog отсекает его.
  function addFromCatalog(entry: PositionCatalogEntry): Promise<boolean> {
    return addPosition(entry.name, entry.role)
  }

  // Удаление из справочника. Планы не трогает — ни этот, ни прошлые: у строки
  // плана своя копия имени, ссылки на справочник нет (миграция 20260824120000).
  function removeCatalogEntry(id: string) {
    setCatalog((current) => current.filter((entry) => entry.id !== id))
    void run('delete-catalog-entry', () => deleteCatalogEntry(id), () => {})
  }

  function renamePosition(id: string, name: string) {
    setPositions((current) => current.map((position) => position.id === id ? { ...position, name } : position))
    void run('rename-position', () => updatePlanPosition(id, { name }), replacePosition)
  }

  function cycleRole(positionId: string) {
    const current = positions.find((position) => position.id === positionId)
    if (!current) return
    const role = nextRole(current.role)
    setPositions((rows) => rows.map((position) => position.id === positionId ? { ...position, role } : position))
    void run('cycle-role', () => updatePlanPosition(positionId, { role }), replacePosition)
  }

  function removePosition(id: string) {
    setPositions((current) => current.filter((position) => position.id !== id))
    // Ячейки строки уносит каскад составного FK — из локальной копии убираем их
    // здесь, иначе люди из удалённой строки остались бы в счётчиках.
    setAssignments((current) => current.filter((cell) => cell.position_id !== id))
    void run('delete-position', () => deletePlanPosition(id), () => {})
  }

  // ─── Ячейки ────────────────────────────────────────────────────────────────

  // Назначение человека в клетку. Клетка занята — это ЗАМЕНА (update), пуста —
  // вставка: «одна ячейка — один человек» держит база (hall_assignments_cell_key),
  // и второй записью сюда всё равно не встать.
  //
  // Ждёт базу в обеих ветках, в отличие от прочих правок: вставка упирается в
  // тот же UNIQUE, и показать человека, которого база не приняла, здесь легче
  // всего.
  async function assign(key: CellKey, employee: EmployeeBrief): Promise<void> {
    if (!planId || addingCell) return
    // Ищем по списку, а не по cellMap: раскладка объявлена ниже по файлу, и
    // опираться отсюда на порядок объявлений — лишняя хрупкость.
    const current = assignments.find((cell) => cell.hall_id === key.hallId && cell.position_id === key.positionId)
    setAddingCell(cellKeyOf(key))
    if (current) {
      await run('replace-assignment', () => updateHallAssignment(current.id, { employee_id: employee.id }), (row) => {
        setAssignments((rows) => rows.map((cell) => cell.id === row.id ? { ...row, employees: employee } : cell))
      })
    } else {
      await runInsert(
        'create-assignment',
        () => createHallAssignment({ planId, hallId: key.hallId, positionId: key.positionId, employeeId: employee.id }),
        (row) => { setAssignments((rows) => [...rows, { ...row, employees: employee }]) },
      )
    }
    setAddingCell('')
  }

  // Освободить клетку — удалить запись: «место есть, человека нет» с миграции
  // 20260824140000 выражается пустой клеткой, и хранить для этого строку больше
  // не нужно.
  function clearCell(id: string) {
    setAssignments((current) => current.filter((cell) => cell.id !== id))
    void run('delete-assignment', () => deleteHallAssignment(id), () => {})
  }

  // Шапка плана правится дровером, и отказ здесь показывает ОН — форма остаётся
  // открытой с набранными полями, поэтому ошибка не глотается общим швом, а
  // летит наружу. Счётчик «Сохраняем…» при этом честно поднимается.
  async function updateMeta(input: HallPlanInput): Promise<void> {
    if (!planId) return
    setPending((value) => value + 1)
    try {
      setPlan(await updateHallPlan(planId, input))
      setSavedAt(Date.now())
    } finally {
      setPending((value) => value - 1)
    }
  }

  const counts = useMemo(() => countPlan(positions, assignments), [positions, assignments])

  // Сколько РАЗ человек стоит в плане — для бейджа ×N в клетке: страховка на
  // четыре зала это одна фамилия в четырёх клетках, и увидеть это нужно с любой
  // из них.
  const planCountByEmployee = useMemo(() => {
    const counter = new Map<string, number>()
    for (const cell of assignments) {
      counter.set(cell.employee_id, (counter.get(cell.employee_id) ?? 0) + 1)
    }
    return counter
  }, [assignments])

  // Связка «один человек на нескольких позициях ОДНОГО зала» — то, что на
  // бумажном образце нарисовано объединённой ячейкой: Крайнов ведёт в зале и
  // Zoom, и камеры, Данатаров закрывает весь Media Center. Считается здесь, а
  // не в клетке: клеток десятки, и скан всех ячеек в каждой из них — это
  // квадрат на каждый рендер матрицы.
  //
  // Внешний цикл по positions, а не по assignments: имена в подсказке обязаны
  // идти в порядке СТРОК матрицы (Zoom, PPT), а не в том, в каком база вернула
  // ячейки. Хранится positionId вместе с именем — по нему клетка выкидывает из
  // списка саму себя, и два одноимённых ряда не схлопываются в один.
  const linkedInHall = useMemo(() => {
    const map = new Map<string, { positionId: string; name: string }[]>()
    for (const position of positions) {
      for (const cell of assignments) {
        if (cell.position_id !== position.id) continue
        const key = hallPersonKeyOf(cell.hall_id, cell.employee_id)
        const list = map.get(key)
        if (list) list.push({ positionId: position.id, name: position.name })
        else map.set(key, [{ positionId: position.id, name: position.name }])
      }
    }
    return map
  }, [positions, assignments])

  // Раскладка ячеек по клеткам — один раз на смену списка, а не фильтром по
  // всему массиву в каждой из десятков клеток. Значение одно, а не список:
  // вторую запись в клетку не пустит база.
  const cellMap = useMemo(() => {
    const map = new Map<string, AssignmentWithEmployee>()
    for (const cell of assignments) map.set(cellKeyOf({ hallId: cell.hall_id, positionId: cell.position_id }), cell)
    return map
  }, [assignments])

  // «Уже в {зал}» в выдаче пикера: по человеку — первый зал, где он стоит.
  // Порядок залов здесь тот же, что на экране, поэтому «первый» одинаков для
  // всех клеток и не зависит от того, откуда открыли пикер.
  const firstHallByEmployee = useMemo(() => {
    const map = new Map<string, string>()
    for (const hall of halls) {
      for (const cell of assignments) {
        if (cell.hall_id !== hall.id) continue
        if (!map.has(cell.employee_id)) map.set(cell.employee_id, hall.name)
      }
    }
    return map
  }, [halls, assignments])

  const saveState: HallPlanSaveState = errorText ? 'failed' : pending > 0 ? 'saving' : 'saved'

  return {
    plan,
    halls,
    positions,
    assignments,
    cellMap,
    counts,
    planCountByEmployee,
    linkedInHall,
    firstHallByEmployee,
    candidates,
    candidatesState,
    loadCandidates,
    catalog,
    catalogState,
    loadState,
    saveState,
    savedAt,
    errorText,
    addingHall,
    addingPosition,
    addingCell,
    reload,
    renameHall,
    recolorHall,
    removeHall,
    addHall,
    addPosition,
    addFromCatalog,
    removeCatalogEntry,
    renamePosition,
    cycleRole,
    removePosition,
    assign,
    clearCell,
    updateMeta,
  }
}

export type HallPlanEditor = ReturnType<typeof useHallPlanEditor>
