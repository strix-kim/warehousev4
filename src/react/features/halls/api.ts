import { supabase } from '../../lib/supabase'
import {
  hallColorAt,
  sortHalls,
  sortPositions,
  type AssignmentWithEmployee,
  type Hall,
  type HallAssignment,
  type HallPlan,
  type PlanPosition,
  type PositionCatalogEntry,
  type Tr,
} from './types'
import { EMPLOYEE_BRIEF_COLUMNS } from '../employees/types'

// Зал на карточке плана — цветная точка с именем. Полная строка там не нужна:
// created_by и created_at на карточке не показывают, а редактор в Ш4 читает залы
// своим запросом.
export type HallBrief = Pick<Hall, 'id' | 'name' | 'color' | 'sort_order'>
export type HallPlanWithHalls = HallPlan & { halls: HallBrief[] }

export type HallPlanInput = {
  name: string
  // Даты — строки YYYY-MM-DD, как их отдаёт AppDatePicker. Пустая строка значит
  // «не указана» и уезжает в базу как NULL: пустая дата и NULL — одно и то же,
  // и второго способа записать «не знаю» быть не должно.
  eventFrom: string
  eventTo: string
}

// Раскладка формы в строку плана. Одна на вставку и на правку: разъедься они,
// новая колонка попала бы в создание и терялась при редактировании.
// Имя тримим здесь, а не триггером: normalize_hall_name висит на залах и
// позициях, у hall_plans его нет — там от имени осталась только проверка
// «не пустое» (btrim(name) <> ''), и хвостовые пробелы срезать больше некому.
function planRow(input: HallPlanInput) {
  return {
    name: input.name.trim(),
    event_from: input.eventFrom || null,
    event_to: input.eventTo || null,
  }
}

export async function fetchHallPlans(): Promise<HallPlanWithHalls[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .select('*, halls(id, name, color, sort_order)')
    // Свежий сверху: updated_at двигает база на любую правку зала или позиции,
    // поэтому «над чем работали вчера» стоит первым. Полный ключ (…, id) — от
    // двух планов, задетых одним триггером в одну миллисекунду.
    .order('updated_at', { ascending: false })
    .order('id')
    // Сто планов — предел ВИДИМОСТИ, а не хранения: из базы ничего не пропадает,
    // просто самые старые перестают приезжать на страницу. Тот же приём, что у
    // списков с их страницей на 50; упрёмся — сюда придёт пагинация.
    .limit(100)
  if (error) throw error
  return data ?? []
}

// Один план прямо по id — вместе с залами: прямая ссылка на /halls/:planId
// обязана открываться без загруженного списка. null — строки нет (или её не
// видно политикой), и это НЕ отказ запроса: отказ прилетает исключением.
export async function fetchHallPlan(id: string): Promise<HallPlanWithHalls | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .select('*, halls(id, name, color, sort_order)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Создание идёт в ДВЕ ступени: план, потом пачка залов — одним запросом их не
// вставить, у залов нужен plan_id из ответа первой. Вторая ступень отказывает
// отдельно: план при этом УЖЕ создан, и молча «откатывать» его удалением нельзя
// (удаление тоже может не пройти). Поэтому ошибка залов не бросается, а
// возвращается рядом с планом: вызывающий уводит человека в редактор, где залы
// добавляются кнопкой «+ Зал», и докладывает отказ в канал.
//
// Имена залов — ДАННЫЕ, а не интерфейс: они лягут в базу строкой и останутся
// такими для всех. Язык берём тот, на котором работает создатель, — ровно как
// если бы он набрал «Зал 1» руками.
export async function createHallPlan(
  input: HallPlanInput,
  hallCount: number,
  tr: Tr,
): Promise<{ plan: HallPlan; hallsError: unknown }> {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data: plan, error } = await supabase
    .from('hall_plans')
    .insert(planRow(input))
    .select()
    .single()
  if (error) throw error

  const hallRows = Array.from({ length: Math.max(hallCount, 0) }, (_, index) => ({
    plan_id: plan.id,
    name: tr(`Зал ${index + 1}`, `${index + 1}-zal`),
    color: hallColorAt(index),
    sort_order: index,
  }))
  // defaultToNull: false — это Prefer: missing=default. Без него пачечная
  // вставка подставляет NULL в НЕ переданный created_by, а политика вставки
  // требует created_by = auth.uid(): все строки отлетели бы по RLS.
  let insertError: unknown = null
  if (hallRows.length > 0) {
    const { error: hallsError } = await supabase.from('halls').insert(hallRows, { defaultToNull: false })
    insertError = hallsError ?? null
  }
  return { plan, hallsError: insertError }
}

// Правка шапки плана без оптимистичной блокировки: планов десятки, правят их по
// одному — при гонке двух вкладок выигрывает последняя запись (last-write-wins).
export async function updateHallPlan(id: string, input: HallPlanInput): Promise<HallPlan> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .update(planRow(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Залы, строки матрицы и ячейки уходят вместе с планом каскадом — отдельных
// удалений здесь нет и быть не должно: три запроса вместо одного дали бы план
// без залов, если второй не прошёл.
export async function deleteHallPlan(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from('hall_plans').delete().eq('id', id)
  if (error) throw error
}

// Перевод отказа базы в человеческую фразу. Разбираем ИМЕНЕМ ограничения, а не
// одним кодом 23514: под ним же придёт любой будущий CHECK, и «даты не сходятся»
// в ответ на другое нарушение было бы враньём.
export function hallPlanErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (message.includes('hall_plans_dates_check')) {
    return tr('Дата окончания раньше даты начала.', 'Tugash sanasi boshlanish sanasidan oldin.')
  }
  if (code === '23514' && message.includes('name')) {
    return tr('Название не может быть пустым.', 'Nom bo‘sh bo‘lishi mumkin emas.')
  }
  // Ячейка занята: пока здесь заполняли клетку, её занял кто-то из другой
  // вкладки. Клиент об этом узнать не мог — правило держит база (UNIQUE
  // (position_id, hall_id)), поэтому и текст про обновление, а не про ошибку
  // ввода. Ловится именем индекса, а не кодом 23505.
  if (message.includes('hall_assignments_cell_key')) {
    return tr('В этой ячейке уже стоит сотрудник — обновите план.', 'Bu katakda allaqachon xodim bor — rejani yangilang.')
  }
  // Дубль имени в справочнике позиций. Обычный путь сюда не приходит:
  // createCatalogEntry глотает этот отказ сам — «позиция уже есть» не ошибка.
  // Текст нужен любому другому пути записи в справочник, чтобы он не свалился
  // в общее «Не удалось сохранить план».
  if (message.includes('position_catalog_name_key')) {
    return tr('Такая позиция уже есть в справочнике.', 'Bunday lavozim ma’lumotnomada allaqachon bor.')
  }
  return tr('Не удалось сохранить план. Проверьте поля и повторите попытку.', 'Rejani saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}

// Строки матрицы плана. Порядок собирается на клиенте (sortPositions): sort_order
// не уникален, и полный ключ сортировки всё равно нужен здесь.
export async function fetchPlanPositions(planId: string): Promise<PlanPosition[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('plan_positions')
    .select('*')
    .eq('plan_id', planId)
  if (error) throw error
  return data ?? []
}

// Ячейки плана — ОДНИМ плоским запросом на весь план, вместе с сотрудником.
// Не вложенно в залы и не по клеткам: клеток на плане десятки (позиции × залы),
// и запрос на каждую превратил бы открытие плана в шторм. Раскладку по клеткам
// собирает редактор в памяти.
//
// employees приезжает встроенным, потому что чип показывает ФИО, а не id: без
// этого пришлось бы догружать сотрудников вторым запросом и склеивать руками.
export async function fetchHallAssignments(planId: string): Promise<AssignmentWithEmployee[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_assignments')
    .select(`*, employees(${EMPLOYEE_BRIEF_COLUMNS})`)
    .eq('plan_id', planId)
  if (error) throw error
  return data ?? []
}

// Все записи ниже возвращают СТРОКУ ИЗ БАЗЫ (.select().single()), а не то, что
// отправили: имя тримит триггер normalize_hall_name, и локальная копия обязана
// стать такой же, иначе «Зал 1 » на экране и «Зал 1» в базе разъедутся до
// перезагрузки. Тот же ответ несёт created_at, которым сортировка разводит
// одинаковый sort_order.
export async function createHall(planId: string, name: string, color: string, sortOrder: number): Promise<Hall> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('halls')
    .insert({ plan_id: planId, name, color, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHall(id: string, patch: { name?: string; color?: string; sort_order?: number }): Promise<Hall> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.from('halls').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Позиции зала уходят каскадом составного внешнего ключа — удалять их отдельно
// нельзя: два запроса вместо одного оставили бы зал без позиций, не удалив сам зал.
export async function deleteHall(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from('halls').delete().eq('id', id)
  if (error) throw error
}

export async function createPlanPosition(planId: string, name: string, role: string, sortOrder: number): Promise<PlanPosition> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('plan_positions')
    .insert({ plan_id: planId, name, role, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlanPosition(id: string, patch: { name?: string; role?: string; sort_order?: number }): Promise<PlanPosition> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.from('plan_positions').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Ячейки строки уходят каскадом составного FK — удалять их отдельно нельзя:
// два запроса вместо одного оставили бы строку без ячеек, не удалив саму строку.
export async function deletePlanPosition(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from('plan_positions').delete().eq('id', id)
  if (error) throw error
}

// plan_id передаётся явно, хотя выводится и из зала, и из строки: колонка
// NOT NULL, а два составных FK проверят, что зал и строка из ОДНОГО плана.
// Подставить чужую строку в обход интерфейса не выйдет — прилетит 23503.
//
// Человек обязателен: пустая клетка с миграции 20260824140000 — это отсутствие
// записи, а не запись без сотрудника.
export async function createHallAssignment({ planId, hallId, positionId, employeeId }: {
  planId: string
  hallId: string
  positionId: string
  employeeId: string
}): Promise<HallAssignment> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_assignments')
    .insert({ plan_id: planId, hall_id: hallId, position_id: positionId, employee_id: employeeId })
    .select()
    .single()
  if (error) throw error
  return data
}

// Единственная правка ячейки — замена человека: клетка одна, порядка в ней нет.
export async function updateHallAssignment(id: string, patch: { employee_id: string }): Promise<HallAssignment> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.from('hall_assignments').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteHallAssignment(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from('hall_assignments').delete().eq('id', id)
  if (error) throw error
}

// Копия плана: план → залы → строки → ячейки, каждая ступень своим запросом.
// Порядок обязателен — у ячейки составные FK на зал и на строку, и вставлять её
// раньше них некуда. Отказ любой ступени летит наверх исключением: копию,
// оборвавшуюся на середине, человек удалит сам — молча «докатывать» её
// удалением было бы вторым необратимым действием поверх первого.
//
// Старые id сопоставляются с новыми по sort_order, а НЕ по порядку строк в
// ответе: sort_order здесь раздаёт сам код (index), поэтому внутри копии он
// уникален и сопоставление не зависит от того, в каком порядке база вернула
// пачку.
export async function duplicateHallPlan(planId: string, tr: Tr): Promise<HallPlan> {
  if (!supabase) throw new Error('Supabase не настроен')

  const source = await fetchHallPlan(planId)
  if (!source) throw new Error('План не найден')
  const [positions, assignments] = await Promise.all([
    fetchPlanPositions(planId),
    fetchHallAssignments(planId),
  ])

  const { halls: sourceHalls, ...planFields } = source
  const { data: copy, error } = await supabase
    .from('hall_plans')
    .insert({
      name: tr(`${planFields.name} (копия)`, `${planFields.name} (nusxa)`),
      event_from: planFields.event_from,
      event_to: planFields.event_to,
    })
    .select()
    .single()
  if (error) throw error

  const orderedHalls = sortHalls(sourceHalls)
  const orderedPositions = sortPositions(positions)

  const hallMap = new Map<string, string>()
  if (orderedHalls.length > 0) {
    const { data: newHalls, error: hallsError } = await supabase
      .from('halls')
      .insert(orderedHalls.map((hall, index) => ({
        plan_id: copy.id,
        name: hall.name,
        color: hall.color,
        sort_order: index,
      })), { defaultToNull: false })
      .select('id, sort_order')
    if (hallsError) throw hallsError
    const bySortOrder = new Map((newHalls ?? []).map((hall) => [hall.sort_order, hall.id]))
    orderedHalls.forEach((hall, index) => {
      const created = bySortOrder.get(index)
      if (created) hallMap.set(hall.id, created)
    })
  }

  const positionMap = new Map<string, string>()
  if (orderedPositions.length > 0) {
    const { data: newPositions, error: positionsError } = await supabase
      .from('plan_positions')
      .insert(orderedPositions.map((position, index) => ({
        plan_id: copy.id,
        name: position.name,
        role: position.role,
        sort_order: index,
      })), { defaultToNull: false })
      .select('id, sort_order')
    if (positionsError) throw positionsError
    const bySortOrder = new Map((newPositions ?? []).map((position) => [position.sort_order, position.id]))
    orderedPositions.forEach((position, index) => {
      const created = bySortOrder.get(index)
      if (created) positionMap.set(position.id, created)
    })
  }

  // Ячейки, чьи зал или строка не переехали, пропускаем молча: это значит, что
  // родителя не отдала политика чтения, и переносить сироту некуда.
  const cellRows = assignments.flatMap((cell) => {
    const hallId = hallMap.get(cell.hall_id)
    const positionId = positionMap.get(cell.position_id)
    if (!hallId || !positionId) return []
    return [{
      plan_id: copy.id,
      hall_id: hallId,
      position_id: positionId,
      employee_id: cell.employee_id,
    }]
  })
  if (cellRows.length > 0) {
    const { error: cellsError } = await supabase.from('hall_assignments').insert(cellRows, { defaultToNull: false })
    if (cellsError) throw cellsError
  }

  return copy
}

// ─── Справочник позиций ─────────────────────────────────────────────────────

// Справочник общий на все планы, поэтому plan_id здесь нет. Порядок — created_at
// с полным ключом (…, id): чипы обязаны стоять в одном и том же порядке в каждом
// плане, а пятёрка засева легла одной миллисекундой в миграции.
export async function fetchPositionCatalog(): Promise<PositionCatalogEntry[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('position_catalog')
    .select('*')
    .order('created_at')
    .order('id')
  if (error) throw error
  return data ?? []
}

// Запоминание вписанной руками позиции. null — не отказ, а «такая позиция уже
// есть»: имя свёрнуто индексом position_catalog_name_key (lower + btrim), и
// «страховка» поверх «Страховки» — это норма набора, а не ошибка человека.
// Остальные отказы летят наверх исключением: их прячет уже вызывающий.
export async function createCatalogEntry(name: string, role: string): Promise<PositionCatalogEntry | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('position_catalog')
    .insert({ name, role })
    .select()
    .single()
  if (error) {
    if (error.message.includes('position_catalog_name_key')) return null
    throw error
  }
  return data
}

// Удаление из справочника планы не задевает: FK на него нет намеренно — строка
// плана хранит свою копию имени (см. миграцию 20260824120000).
export async function deleteCatalogEntry(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from('position_catalog').delete().eq('id', id)
  if (error) throw error
}
