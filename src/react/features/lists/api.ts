import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, primeCachedQuery, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import type { Json, Tables } from '../../lib/database.types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { escapeLikePattern, quoteFilterValue } from '../../lib/postgrest'
import { reportAppError } from '../../lib/reportAppError'
import { fetchEquipmentByIds } from '../equipment/api'
import type { Equipment } from '../equipment/types'
import { LIST_DRAFT_TTL_MS, listCompositionCacheKey, listDraftCacheKey } from './cacheKeys'
import type { ExportListRow } from './xlsxExport'

export type EquipmentListItem = Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'> & {
  count: number
  equipment_id?: string
  tracking_mode: 'serialized' | 'quantity' | 'planned'
}

// Колонки equipment_lists, которые читает интерфейс (селект listColumns).
// Разъедется со схемой — упадёт компиляция нормализации ниже.
type EquipmentListRow = Pick<
  Tables<'equipment_lists'>,
  'id' | 'name' | 'description' | 'client_name' | 'venue' | 'type' | 'list_mode'
  | 'equipment_ids' | 'equipment_items' | 'created_at' | 'is_archived'
  | 'reservation_start' | 'reservation_end'
>

// Набор колонок старой схемы: реквизитов заказчика в ней ещё нет.
type LegacyEquipmentListRow = Pick<
  Tables<'equipment_lists'>,
  'id' | 'name' | 'description' | 'type' | 'list_mode' | 'equipment_ids'
  | 'equipment_items' | 'created_at' | 'is_archived'
>

// Доменный список: строка базы, где текстовый list_mode под CHECK и jsonb-колонка
// состава сужены до наших типов.
export type EquipmentList = Omit<
  EquipmentListRow,
  'list_mode' | 'equipment_items'
> & {
  list_mode: 'specific' | 'abstract'
  equipment_items: EquipmentListItem[] | null
}

const listColumns = 'id,name,description,client_name,venue,type,list_mode,equipment_ids,equipment_items,created_at,is_archived,reservation_start,reservation_end'

const legacyListColumns = 'id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived'

// Коды, которые означают ровно одно: в базе НЕТ того, что мы просим, — таблицы
// (PGRST205, 42P01) или колонки (PGRST204, 42703). Только они разрешают повтор
// запроса в старой схеме. Сетевой сбой, 401 и отказ RLS сюда не попадают: раньше
// они уводили в legacy-ветку, где статус жёстко проставлялся черновиком, и этот
// вымысел кэшировался на 10 минут.
const missingSchemaCodes = new Set(['PGRST205', '42P01', 'PGRST204', '42703'])

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && missingSchemaCodes.has(code)
}

// Единственная ветка фолбэка на старую схему: сначала запрос в современной схеме,
// и только код «нет колонки/таблицы» разрешает второй заход. Ошибка второго захода
// уходит наружу как есть.
async function withLegacySchemaFallback<Result>(run: (schema: 'modern' | 'legacy') => Promise<Result>): Promise<Result> {
  try {
    return await run('modern')
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error
    return run('legacy')
  }
}

export const LISTS_PAGE_SIZE = 12
export const MOBILE_LISTS_PAGE_SIZE = 6

// Размер страницы входит в ключ кэша, поэтому его выбирает сама фича: и страница,
// и прогрев в App.tsx обязаны спросить одно и то же число, иначе прогрев ляжет
// мимо ключа, который потом читает список.
export function preferredListsPageSize() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches ? MOBILE_LISTS_PAGE_SIZE : LISTS_PAGE_SIZE
}

// list_mode держит CHECK в базе, но в схеме это обычный text — сужаем на входе,
// чтобы дальше по коду ходил доменный тип.
function toListMode(value: string | null): 'specific' | 'abstract' {
  return value === 'abstract' ? 'abstract' : 'specific'
}

// jsonb-колонки схема отдаёт как Json. Проверяем, что пришёл массив; форму
// элементов задаёт та же RPC, которая их и пишет, поэтому их не пересобираем.
function toEquipmentListItems(value: Json): EquipmentListItem[] | null {
  return Array.isArray(value) ? (value as EquipmentListItem[]) : null
}

function normalizeList(row: EquipmentListRow): EquipmentList {
  return {
    ...row,
    list_mode: toListMode(row.list_mode),
    equipment_items: toEquipmentListItems(row.equipment_items),
  }
}

// Старая схема без реквизитов и дат: недостающие поля добираем теми же
// значениями, что подставлял фолбэк раньше.
function normalizeLegacyList(row: LegacyEquipmentListRow): EquipmentList {
  return {
    ...row,
    list_mode: toListMode(row.list_mode),
    equipment_items: toEquipmentListItems(row.equipment_items),
    client_name: null,
    venue: null,
    reservation_start: null,
    reservation_end: null,
  }
}

export type EquipmentListsQuery = {
  page?: number
  search?: string
  // Период приходит готовыми границами (YYYY-MM-DD), а не названием («этот
  // месяц»): название в ключе кэша означало бы, что первого числа страница
  // покажет прошлый месяц под видом текущего — границы же меняются сами и
  // уводят запрос на новый ключ.
  periodFrom?: string
  periodTo?: string
  pageSize?: number
  bypassCache?: boolean
}

export type EquipmentListsPage = {
  rows: EquipmentList[]
  // Счётчик ТЕКУЩЕЙ выборки: с фильтрами это «найдено», без них — «всего».
  // Второй ходки за общим числом нет намеренно.
  total: number
}

type NormalizedListsQuery = Required<Omit<EquipmentListsQuery, 'bypassCache'>>

function normalizeListsQuery({ page = 1, search = '', periodFrom = '', periodTo = '', pageSize = LISTS_PAGE_SIZE }: EquipmentListsQuery): NormalizedListsQuery {
  return { page, search: search.trim(), periodFrom, periodTo, pageSize }
}

// Ключ остаётся под префиксом `equipment-lists:` — его целиком сбрасывает любая
// запись (создание, правка, удаление, смена этапа), и страницы обязаны уехать
// вместе с ней.
function equipmentListsCacheKey(query: NormalizedListsQuery) {
  return `equipment-lists:page:${JSON.stringify(query)}`
}

export function readCachedEquipmentLists(query: Omit<EquipmentListsQuery, 'bypassCache'> = {}) {
  return readCachedQuery<EquipmentListsPage>(equipmentListsCacheKey(normalizeListsQuery(query)))
}

// Возраст той же страницы списков: ключ собирают те же две функции, что и выше.
export function readCachedEquipmentListsMeta(query: Omit<EquipmentListsQuery, 'bypassCache'> = {}) {
  return readCachedQueryMeta(equipmentListsCacheKey(normalizeListsQuery(query)))
}

export async function fetchEquipmentLists(query: EquipmentListsQuery = {}): Promise<EquipmentListsPage> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const normalized = normalizeListsQuery(query)
  const { page, search, periodFrom, periodTo, pageSize } = normalized
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const namePattern = search ? `%${escapeLikePattern(search)}%` : ''
  // Тот же шаблон, но закавыченный: внутри `.or(...)` сырое значение с запятой
  // или скобкой разобралось бы как границы условий.
  const searchExpression = namePattern
    ? ['name', 'client_name', 'venue'].map((column) => `${column}.ilike.${quoteFilterValue(namePattern)}`).join(',')
    : ''

  return cachedQuery(equipmentListsCacheKey(normalized), 10 * 60 * 1000, () => withLegacySchemaFallback(async (schema) => {
    if (schema === 'legacy') {
      // В старой схеме нет ни client_name/venue, ни reservation_start: поиск
      // остаётся по одному названию, а период здесь пуст всегда — дата
      // мероприятия там NULL, а NULL не попадает ни в один период, то же
      // правило, что и в современной ветке. Отдать вместо этого невыбранную
      // выборку было бы ложью: человек спросил месяц.
      if (periodFrom || periodTo) return { rows: [], total: 0 }
      let legacyQuery = client
        .from('equipment_lists')
        .select(legacyListColumns, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
      if (namePattern) legacyQuery = legacyQuery.ilike('name', namePattern)
      const { data, error, count } = await legacyQuery
      if (error) throw error
      return {
        rows: (data ?? []).map((item) => normalizeLegacyList(item)),
        total: count ?? 0,
      }
    }

    // Сортировка created_at desc, id desc: created_at не уникален (импорт кладёт
    // пачку одной секундой), и без второго ключа строка могла попасть на две
    // соседние страницы сразу либо не попасть ни на одну.
    let listsQuery = client
      .from('equipment_lists')
      .select(listColumns, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
    if (searchExpression) listsQuery = listsQuery.or(searchExpression)
    // Период меряется по дате НАЧАЛА мероприятия: список без даты (колонка
    // nullable) в любой период не попадает — сравнение с NULL ложно, и это
    // честнее, чем показывать «этот месяц» вперемешку с недатированными.
    if (periodFrom) listsQuery = listsQuery.gte('reservation_start', periodFrom)
    if (periodTo) listsQuery = listsQuery.lte('reservation_start', periodTo)
    const { data, error, count } = await listsQuery
    if (error) throw error
    return {
      rows: (data ?? []).map((item) => normalizeList(item)),
      total: count ?? 0,
    }
  }), { bypass: query.bypassCache ?? false })
}

function equipmentListCacheKey(listId: string) {
  return `equipment-lists:detail:${listId}`
}

export function readCachedEquipmentList(listId: string) {
  return readCachedQuery<EquipmentList>(equipmentListCacheKey(listId))
}

export async function fetchEquipmentList(listId: string, { bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(equipmentListCacheKey(listId), 10 * 60 * 1000, () => withLegacySchemaFallback(async (schema) => {
    if (schema === 'legacy') {
      const { data, error } = await client
        .from('equipment_lists')
        .select(legacyListColumns)
        .eq('id', listId)
        .single()
      if (error) throw error
      return normalizeLegacyList(data)
    }

    const { data, error } = await client
      .from('equipment_lists')
      .select(listColumns)
      .eq('id', listId)
      .single()
    if (error) throw error
    return normalizeList(data)
  }), { bypass: bypassCache })
}

// Состав сохранённого списка — строки для деталей и для Excel. Ключ кэша
// принадлежит этой фиче, но лежит в листовом cacheKeys.ts: сбрасывать его
// нужно и из equipment/api, а зависимость equipment → lists/api замкнула бы
// граф фич в цикл.
export { invalidateListCompositionCache } from './cacheKeys'

export type SavedListComposition = {
  rows: ExportListRow[]
  // Серийные единицы, чьи id остались в equipment_ids, а строк на складе уже нет
  // (позицию удалили). Счётчик в шапке списка считает по equipment_ids, состав —
  // по пришедшим строкам, и без этого числа расхождение ничем не объяснено.
  missingUnits: number
}

export function readCachedSavedListComposition(listId: string) {
  return readCachedQuery<SavedListComposition>(listCompositionCacheKey(listId))
}

// Ключ группировки позиции. Модель определяет нормализованная пара
// lower(trim(brand)) + lower(trim(model)) — ровно то правило, по которому модель
// правит серверная RPC. Сырой текст давал две строки на одну модель там, где в
// базе у одной единицы «Sony » с пробелом, а у другой «sony».
function modelGroupKey(brand: string, model: string) {
  return `${brand.trim().toLocaleLowerCase('ru')}::${model.trim().toLocaleLowerCase('ru')}`
}

async function loadSavedListComposition(list: EquipmentList): Promise<SavedListComposition> {
  const serializedIds = [...new Set(list.equipment_ids ?? [])]
  const quantityItems = list.equipment_items ?? []
  // Живые строки склада тянем и для количественных позиций: в jsonb у них лежит
  // СНИМОК бренда и модели на момент сохранения, а у серийной части подпись
  // читается из equipment. После переименования модели два источника расходились,
  // и одна позиция показывалась двумя строками. equipment_id авторитетнее текста,
  // поэтому подпись берём по нему; снимок остаётся фолбэком для позиций без id.
  const referencedIds = [...new Set([
    ...serializedIds,
    ...quantityItems.flatMap((item) => item.equipment_id ? [item.equipment_id] : []),
  ])]
  const units = await fetchEquipmentByIds(referencedIds)
  const unitById = new Map(units.map((unit) => [unit.id, unit]))

  const grouped = new Map<string, ExportListRow>()
  const addRow = (source: Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'>, count: number, serialNumber?: string | null) => {
    const key = modelGroupKey(source.brand, source.model)
    const current = grouped.get(key)
    if (current) {
      current.count += count
      if (serialNumber) current.serialNumbers.push(serialNumber)
      return
    }
    grouped.set(key, {
      category: source.type,
      equipment: `${source.brand} ${source.model}`.trim(),
      subtype: source.subtype,
      count,
      serialNumbers: serialNumber ? [serialNumber] : [],
    })
  }

  for (const equipmentId of serializedIds) {
    const unit = unitById.get(equipmentId)
    if (!unit) continue
    addRow(unit, 1, unit.serialnumber)
  }
  for (const item of quantityItems) {
    const unit = item.equipment_id ? unitById.get(item.equipment_id) : undefined
    addRow(unit ?? item, item.count)
  }

  return {
    rows: [...grouped.values()],
    missingUnits: serializedIds.filter((equipmentId) => !unitById.has(equipmentId)).length,
  }
}

export function buildSavedListComposition(list: EquipmentList, { bypassCache = false } = {}) {
  return cachedQuery(listCompositionCacheKey(list.id), 10 * 60 * 1000, () => loadSavedListComposition(list), { bypass: bypassCache })
}

// Прогрев карточки списка стоит РОВНО один запрос — состав. Деталь списка мы уже
// держим в руках: строка из equipment-lists:recent собрана тем же селектом, что и
// одиночная выборка, поэтому кладём её в кэш детали напрямую. История и дефицит
// грузятся при открытии деталей: reservation_shortages — полная агрегация склада,
// звать её вслепую на шесть карточек нечем оправдать.
export function prefetchSavedListDetails(list: EquipmentList) {
  primeCachedQuery(equipmentListCacheKey(list.id), 10 * 60 * 1000, list)
  return buildSavedListComposition(list).catch((error: unknown) => reportAppError(error, { scope: 'prefetch', detail: { source: 'list-composition', listId: list.id } }))
}

// Черновик редактора нового списка. Позиция хранится КЛЮЧОМ ГРУППЫ, а не снимком
// бренда и модели: восстановление всё равно пересобирает выборку по живому
// каталогу, и снимок разошёлся бы с ним после переименования модели.
export type ListDraftItem = {
  key: string
  count: number
  serialIds: string[]
}

export type ListDraft = {
  name: string
  clientName: string
  venue: string
  description: string
  eventDate: string
  items: ListDraftItem[]
}

// Без listId — черновик /lists/new; с listId — несохранённые правки открытого
// списка. Одна машинерия на оба случая: разница только в ключе.
export function readListDraft(listId?: string) {
  return readCachedQuery<ListDraft>(listDraftCacheKey(listId))
}

export function saveListDraft(draft: ListDraft, listId?: string) {
  primeCachedQuery(listDraftCacheKey(listId), LIST_DRAFT_TTL_MS, draft)
}

// Момент последней записи черновика — «Не сохранён · изменён 21.08, 18:40» на
// карточке реестра и в плашке восстановления. Спрашивать эту метку можно ТОЛЬКО
// про черновик, который вернул readListDraft: гейта по TTL у меты нет, и для
// протухшей записи она честно отдала бы время суточной давности.
export function readListDraftMeta(listId?: string) {
  return readCachedQueryMeta(listDraftCacheKey(listId))
}

// Точечного удаления одного ключа у persistentCache нет, поэтому стираем
// префиксом. Пустой вызов гасим сразу: invalidateCachePrefix поднимает поколение
// кэша, а это отменяет запись ВСЕХ ответов, летящих прямо сейчас, — и обычный
// заход на /lists/new без черновика выбрасывал бы прогрев каталога.
export function clearListDraft(listId?: string) {
  if (readListDraft(listId) === null) return
  invalidateCachePrefix(listDraftCacheKey(listId))
}

export type EquipmentListDocumentInput = {
  name: string
  description: string
  clientName: string
  venue: string
  listMode: 'specific' | 'abstract'
  reservationStart: string | null
  reservationEnd: string | null
  equipmentItems: EquipmentListItem[]
}

export async function createEquipmentList(input: EquipmentListDocumentInput) {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase.rpc('create_equipment_list_document', {
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_client_name: input.clientName.trim(),
    p_venue: input.venue.trim(),
    p_list_mode: input.listMode,
    p_reservation_start: input.reservationStart,
    p_reservation_end: input.reservationEnd,
    p_items: input.equipmentItems,
  })

  if (error) throw error
  invalidateCachePrefix('equipment-lists:')
  return data as string
}

export async function updateEquipmentList(listId: string, input: EquipmentListDocumentInput) {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase.rpc('update_equipment_list_document', {
    p_list_id: listId,
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_client_name: input.clientName.trim(),
    p_venue: input.venue.trim(),
    p_list_mode: input.listMode,
    p_reservation_start: input.reservationStart,
    p_reservation_end: input.reservationEnd,
    p_items: input.equipmentItems,
  })

  if (error) throw error
  invalidateCachePrefix('equipment-lists:')
  return data as string
}

// Отказ RLS на удалении: политика не возвращает ошибку — строка просто не попадает
// под delete, и ответ приходит пустым. Код-строка, а не текст: сообщение собирает
// интерфейс, здесь только причина.
export const LIST_DELETE_FORBIDDEN = 'list-delete-forbidden'

export async function deleteEquipmentList(listId: string) {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase
    .from('equipment_lists')
    .delete()
    .eq('id', listId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(LIST_DELETE_FORBIDDEN)
  invalidateCachePrefix('equipment-lists:')
  return data.id as string
}
