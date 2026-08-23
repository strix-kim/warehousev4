import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import type { Json } from '../../lib/database.types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
// Только листовой cacheKeys, не lists/api: обратное ребро замкнуло бы цикл фич.
import { invalidateListCompositionCache } from '../lists/cacheKeys'
import type { EquipmentAvailability } from './availability'
import type { Equipment, EquipmentRow } from './types'

export const EQUIPMENT_PAGE_SIZE = 50
export const MOBILE_EQUIPMENT_PAGE_SIZE = 8

// Размер страницы каталога входит в ключ кэша, поэтому его выбирает эта фича:
// прогрев в App.tsx и сама страница обязаны спрашивать одно и то же число.
export function preferredEquipmentPageSize() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches ? MOBILE_EQUIPMENT_PAGE_SIZE : EQUIPMENT_PAGE_SIZE
}

const quantityPlaceholders = new Set(['', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-'])

function normalizeEquipment(row: EquipmentRow): Equipment {
  const storedIdentifier = row.serialnumber.trim()
  const normalizedIdentifier = storedIdentifier.toLowerCase()
  const generatedQuantityCode = storedIdentifier.startsWith('QTY::')
  const isQuantity = (row.count ?? 0) > 1
    || storedIdentifier.startsWith('AUTO-')
    || generatedQuantityCode
    || quantityPlaceholders.has(normalizedIdentifier)
    || /^0+$/.test(storedIdentifier)

  let inventoryCode: string | null = null
  if (isQuantity && !quantityPlaceholders.has(normalizedIdentifier) && !/^0+$/.test(storedIdentifier)) {
    if (storedIdentifier.startsWith('QTY::CODE::')) inventoryCode = storedIdentifier.slice(11) || null
    else if (!storedIdentifier.startsWith('QTY::AUTO::')) inventoryCode = generatedQuantityCode ? storedIdentifier.slice(5) || null : storedIdentifier
  }

  return {
    ...row,
    availability: row.availability ?? '',
    count: row.count ?? 0,
    serialnumber: isQuantity ? null : storedIdentifier,
    tracking_mode: isQuantity ? 'quantity' : 'serialized',
    inventory_code: inventoryCode,
  }
}

function storedQuantityIdentifier(inventoryCode?: string) {
  const code = inventoryCode?.trim()
  if (code) return `QTY::CODE::${code}`
  const generated = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `QTY::AUTO::${generated}`
}

type EquipmentQuery = {
  page: number
  search: string
  availability: string
  // Фильтр по категории и подкатегории. Пустая строка — «все»; оба поля входят в
  // ключ кэша ВСЕГДА, поэтому прогрев в App.tsx без них попадает в ту же запись,
  // что и страница с пустыми фильтрами.
  type?: string
  subtype?: string
  pageSize?: number
  bypassCache?: boolean
}

function safeSearch(value: string) {
  return value.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ')
}

export function readCachedAllEquipment() {
  return readCachedQuery<Equipment[]>('equipment:all')
}

// U29: строка каталога — модель, а не единица. Агрегат считает RPC
// fetch_equipment_models (миграция 20260823110000); клиентская группировка
// потребовала бы тянуть весь каталог, от чего U29 и лечит.
export type EquipmentModelSummary = {
  brand: string
  model: string
  type: string
  subtype: string
  rowsTotal: number
  unitsTotal: number
  unitsAvailable: number
}

export type EquipmentModelsPage = {
  rows: EquipmentModelSummary[]
  totalModels: number
  totalUnits: number
}

// Ключ живёт под префиксом equipment: — вся существующая инвалидация
// («создал», «поправил», «партия») сбрасывает агрегат без своей ветки.
function equipmentModelsCacheKey({ page, search, availability, type = '', subtype = '', pageSize = EQUIPMENT_PAGE_SIZE }: Omit<EquipmentQuery, 'bypassCache'>) {
  return `equipment:models:${JSON.stringify({ page, search: safeSearch(search), availability, type, subtype, pageSize })}`
}

export function readCachedEquipmentModels(query: Omit<EquipmentQuery, 'bypassCache'>) {
  return readCachedQuery<EquipmentModelsPage>(equipmentModelsCacheKey(query))
}

export function readCachedEquipmentModelsMeta(query: Omit<EquipmentQuery, 'bypassCache'>) {
  return readCachedQueryMeta(equipmentModelsCacheKey(query))
}

export async function fetchEquipmentModels({ page, search, availability, type = '', subtype = '', pageSize = EQUIPMENT_PAGE_SIZE, bypassCache = false }: EquipmentQuery): Promise<EquipmentModelsPage> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase

  const cacheKey = equipmentModelsCacheKey({ page, search, availability, type, subtype, pageSize })
  return cachedQuery(cacheKey, 10 * 60 * 1000, async () => {
    const { data, error } = await client.rpc('fetch_equipment_models', {
      p_search: safeSearch(search),
      p_type: type,
      p_subtype: subtype,
      p_availability: availability,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    if (error) throw error
    const payload = (data ?? {}) as { total_models?: unknown; total_units?: unknown; rows?: unknown }
    const rows = Array.isArray(payload.rows) ? payload.rows as Record<string, unknown>[] : []
    return {
      totalModels: typeof payload.total_models === 'number' ? payload.total_models : 0,
      totalUnits: typeof payload.total_units === 'number' ? payload.total_units : 0,
      rows: rows.map((row) => ({
        brand: String(row.brand ?? ''),
        model: String(row.model ?? ''),
        type: String(row.type ?? ''),
        subtype: String(row.subtype ?? ''),
        rowsTotal: typeof row.rows_total === 'number' ? row.rows_total : 0,
        unitsTotal: typeof row.units_total === 'number' ? row.units_total : 0,
        unitsAvailable: typeof row.units_available === 'number' ? row.units_available : 0,
      })),
    }
  }, { bypass: bypassCache })
}

/**
 * Единицы одной модели для дровера каталога. Самая крупная модель прода — 596
 * строк, лимита PostgREST (1000) хватает с запасом; появится модель крупнее —
 * появится и пагинация внутри дровера.
 */
export async function fetchEquipmentUnitsByModel(brand: string, model: string, { bypassCache = false } = {}): Promise<Equipment[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(`equipment:model-units:${JSON.stringify([brand, model])}`, 10 * 60 * 1000, async () => {
    const { data, error } = await client
      .from('equipment')
      .select('*')
      .eq('brand', brand)
      .eq('model', model)
      .order('serialnumber', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => normalizeEquipment(row))
  }, { bypass: bypassCache })
}

// Полная выгрузка каталога — это ~1.4 МБ JSON, поэтому она живёт ТОЛЬКО в памяти
// сессии (persist: false): в localStorage она одна съедала треть квоты Safari,
// а с сервера батчами приезжает за секунды. Цена — после перезагрузки страницы
// редактор списка ждёт сеть вместо первого кадра из кэша.
export async function fetchAllEquipment({ bypassCache = false } = {}): Promise<Equipment[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery('equipment:all', 10 * 60 * 1000, async () => {
    const rows: Equipment[] = []
    const batchSize = 1000
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await client
        .from('equipment')
        .select('*')
        .order('type', { ascending: true })
        .order('brand', { ascending: true })
        .order('model', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1)
      if (error) throw error
      const batch = (data ?? []).map((row) => normalizeEquipment(row))
      rows.push(...batch)
      if (batch.length < batchSize) break
    }
    return rows
  }, { bypass: bypassCache, persist: false })
}

export async function fetchEquipmentByIds(ids: string[]): Promise<Equipment[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .in('id', ids)

  if (error) throw error
  return (data ?? []).map((row) => normalizeEquipment(row))
}

// Одна карточка прямо с сервера, в обход кэша каталога: drawer перечитывает ею
// запись при открытии и после конфликта версий. null — строки в базе больше нет,
// это НЕ отказ запроса (отказ прилетает исключением).
export async function fetchEquipmentById(id: string): Promise<Equipment | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? normalizeEquipment(data) : null
}

export type EquipmentTaxonomy = {
  types: string[]
  subtypes: string[]
  // Подкатегории по категориям: фильтр каталога сужает второй селект первым, и
  // считать эту карту на клиенте из каталога нельзя — на экране одна страница.
  subtypesByType: Record<string, string[]>
}

export const emptyEquipmentTaxonomy: EquipmentTaxonomy = { types: [], subtypes: [], subtypesByType: {} }

export async function fetchEquipmentTaxonomy(): Promise<EquipmentTaxonomy> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  // v2 в ключе — форма записи изменилась: старая запись без subtypesByType живёт
  // в localStorage сутки и уронила бы селект подкатегорий на неопределённом поле.
  return cachedQuery('equipment-taxonomy:v2', 24 * 60 * 60 * 1000, async () => {
    // Батчами, а не одним .range(0, 1999): Data API отдаёт не больше 1000 строк за
    // ответ (gotchas §1), и с явным порядком по type обрезка стала бы РОВНОЙ —
    // последняя категория пропала бы из фильтра целиком.
    const rows: { type: string; subtype: string }[] = []
    const batchSize = 1000
    for (let from = 0; ; from += batchSize) {
      const { data: batch, error } = await client
        .from('equipment')
        .select('type,subtype')
        .order('type', { ascending: true })
        .order('subtype', { ascending: true })
        // id — на случай одинаковых пар: без полного порядка страницы могут
        // перекрываться и терять строки между собой.
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1)
      if (error) throw error
      rows.push(...(batch ?? []))
      if ((batch ?? []).length < batchSize) break
    }

    const byType = new Map<string, Set<string>>()
    for (const item of rows) {
      if (!item.type || !item.subtype) continue
      const bucket = byType.get(item.type) ?? new Set<string>()
      bucket.add(item.subtype)
      byType.set(item.type, bucket)
    }
    const byRu = (a: string, b: string) => a.localeCompare(b, 'ru')
    return {
      types: [...new Set(rows.map((item) => item.type).filter(Boolean))].sort(byRu),
      subtypes: [...new Set(rows.map((item) => item.subtype).filter(Boolean))].sort(byRu),
      subtypesByType: Object.fromEntries([...byType].map(([type, values]) => [type, [...values].sort(byRu)])),
    }
  })
}

export type CreateEquipmentInput = {
  brand: string
  model: string
  trackingMode: 'serialized' | 'quantity'
  serialnumber?: string
  inventoryCode?: string
  type: string
  subtype: string
  count: number
  // Новая запись заводится только с кодом из словаря; правка существующей
  // единицы (UpdateEquipmentInput) остаётся строкой — там в поле может лежать
  // историческое значение, которое интерфейс не сужает.
  availability: EquipmentAvailability
  location: string
  technicalspecification?: string
  lengthinmeters?: string
  description?: string
}

export async function createEquipment(input: CreateEquipmentInput) {
  if (!supabase) throw new Error('Supabase не настроен')
  // serialnumber в базе NOT NULL: для серийного учёта номер обязателен, для
  // количественного его заменяет служебный идентификатор. Раньше пустое значение
  // уезжало в базу и падало там же на NOT NULL — теперь отказ виден на месте.
  const serialnumber = input.trackingMode === 'serialized'
    ? input.serialnumber?.trim()
    : storedQuantityIdentifier(input.inventoryCode)
  if (!serialnumber) throw new Error('Серийный номер обязателен')

  const { data, error } = await supabase
    .from('equipment')
    .insert({
      brand: input.brand.trim(),
      model: input.model.trim(),
      serialnumber,
      type: input.type.trim(),
      subtype: input.subtype.trim(),
      count: input.count,
      availability: input.availability,
      location: input.location.trim(),
      technicalspecification: input.technicalspecification?.trim() || null,
      lengthinmeters: input.lengthinmeters?.trim() || 'N/A',
      description: input.description?.trim() || null,
    })
    .select('id')
    .single()

  if (error) throw error
  invalidateCachePrefix('equipment:')
  invalidateCachePrefix('equipment-taxonomy')
  return data.id as string
}

export type CreateEquipmentBatchInput = Omit<CreateEquipmentInput, 'trackingMode' | 'serialnumber' | 'inventoryCode' | 'count'> & {
  serialNumbers: string[]
}

// 'duplicates' — не ошибка, а ответ: ничего не вставлено, serials — номера,
// которые повторяются в партии или уже есть в каталоге.
export type CreateEquipmentBatchResult =
  | { status: 'created'; count: number }
  | { status: 'duplicates'; serials: string[] }

/**
 * Партия серийных единиц одной транзакцией — RPC create_equipment_batch
 * (миграция 20260823100000). Дубли проверяет СЕРВЕР, под advisory-локом по
 * нормализованному номеру: это единственный путь заведения, где гонка двух
 * вкладок с одним серийником закрыта (UNIQUE-индекса в базе нет, бэклог).
 */
export async function createEquipmentBatch(input: CreateEquipmentBatchInput): Promise<CreateEquipmentBatchResult> {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase.rpc('create_equipment_batch', {
    p_brand: input.brand.trim(),
    p_model: input.model.trim(),
    p_type: input.type.trim(),
    p_subtype: input.subtype.trim(),
    p_availability: input.availability,
    p_location: input.location.trim(),
    p_lengthinmeters: input.lengthinmeters?.trim() ?? '',
    p_technicalspecification: input.technicalspecification?.trim() ?? '',
    p_description: input.description?.trim() ?? '',
    p_serialnumbers: input.serialNumbers,
  })

  if (error) throw error
  const result = (data ?? {}) as { status?: unknown; count?: unknown; serials?: unknown }
  if (result.status === 'duplicates') {
    const serials = Array.isArray(result.serials) ? result.serials.filter((value): value is string => typeof value === 'string') : []
    return { status: 'duplicates', serials }
  }
  invalidateCachePrefix('equipment:')
  invalidateCachePrefix('equipment-taxonomy')
  return { status: 'created', count: typeof result.count === 'number' ? result.count : input.serialNumbers.length }
}

// В шаблоне LIKE/ILIKE `%` и `_` — подстановочные знаки, а `\` — знак
// экранирования. Без экранирования серийник `AB_1234` совпадал с `AB-1234`
// и давал ложный дубль. Обратная косая идёт первой, иначе она экранировала бы
// уже добавленные косые.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function serialNumberExists(serialNumber: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const { count, error } = await supabase
    .from('equipment')
    .select('id', { count: 'exact', head: true })
    .ilike('serialnumber', escapeLikePattern(serialNumber.trim()))

  if (error) throw error
  return (count ?? 0) > 0
}

export async function countEquipmentModelUnits(brand: string, model: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const cacheKey = `equipment:model-count:${brand.trim().toLocaleLowerCase('ru')}::${model.trim().toLocaleLowerCase('ru')}`
  return cachedQuery(cacheKey, 10 * 60 * 1000, async () => {
    // Считает база по тому же правилу, по которому правит модель серверная RPC:
    // lower(btrim(brand/model)). Клиентский .eq по сырым строкам расходился с ней
    // на записях с ведущими пробелами.
    const { data, error } = await client.rpc('count_equipment_model_units', {
      p_brand: brand,
      p_model: model,
    })

    // ВРЕМЕННЫЙ фолбэк: пока миграция с count_equipment_model_units не применена,
    // база отвечает «функции нет» — считаем по-старому, .eq по сырым строкам.
    // Гейт строго по коду отсутствия функции. После применения миграции ветка
    // мертва — удалить вместе с этим комментарием.
    if (error && (error.code === 'PGRST202' || error.code === '42883')) {
      const legacy = await client
        .from('equipment')
        .select('id', { count: 'exact', head: true })
        .eq('brand', brand)
        .eq('model', model)
      if (legacy.error) throw legacy.error
      return legacy.count ?? 0
    }
    if (error) throw error
    return data ?? 0
  })
}

export type UpdateEquipmentInput = {
  id: string
  brand: string
  model: string
  type: string
  subtype: string
  technicalspecification: string
  lengthinmeters: string
  description: string
  availability: string
  location: string
  // Количество принадлежит количественному учёту: для серийной карточки поле не
  // заполняется, и параметр не уезжает в базу вовсе.
  count?: number
  // Версия записи, на которой открыли карточку. Разошлась с базой — RPC отказывает
  // кодом 40001. null (у записи нет updated_at) значит «сверить нечем».
  updatedAt: string | null
}

export type UpdateEquipmentResult = {
  item: Equipment
  // Сколько строк реально задел серверный update. null — ответ без счётчика, число называть нельзя.
  updatedModelUnits: number | null
}

// Счётчик задетых строк из ответа update_equipment_model_and_unit. RPC возвращает
// jsonb, то есть Json, — число подтверждаем проверками, а не приведением типа.
function readUpdatedModelUnits(value: Json): number | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const reported = value.updated_model_units
  return typeof reported === 'number' && Number.isFinite(reported) ? reported : null
}

export async function updateEquipmentModelAndUnit(input: UpdateEquipmentInput): Promise<UpdateEquipmentResult> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const args = {
    p_equipment_id: input.id,
    p_brand: input.brand.trim(),
    p_model: input.model.trim(),
    p_type: input.type.trim(),
    p_subtype: input.subtype.trim(),
    p_technicalspecification: input.technicalspecification.trim(),
    p_lengthinmeters: input.lengthinmeters.trim(),
    p_description: input.description.trim(),
    p_availability: input.availability,
    p_location: input.location.trim(),
    p_expected_updated_at: input.updatedAt,
  }
  // Без count база оставляет его как есть. Раньше серийная карточка всегда
  // отправляла 1 и на записи с другим количеством плодила фантомную строку
  // «Изменено количество» в журнале движения при правке одного описания.
  const { data: rpcResult, error } = await client.rpc(
    'update_equipment_model_and_unit',
    input.count === undefined ? args : { ...args, p_count: input.count },
  )
  if (error) throw error

  const updatedModelUnits = readUpdatedModelUnits(rpcResult)

  const { data, error: fetchError } = await client
    .from('equipment')
    .select('*')
    .eq('id', input.id)
    .single()
  if (fetchError) throw fetchError

  invalidateCachePrefix('equipment:')
  invalidateCachePrefix('equipment-taxonomy')
  // Состав сохранённых списков подписан данными модели — ключ принадлежит фиче списков.
  invalidateListCompositionCache()
  return { item: normalizeEquipment(data), updatedModelUnits }
}

export type EquipmentMovement = {
  id: string
  list_id: string | null
  movement_type: 'created' | 'quantity_changed' | 'status_changed' | 'quantity_and_status_changed' | 'status_normalized' | 'issued' | 'returned'
  quantity_delta: number
  quantity_before: number | null
  quantity_after: number | null
  status_before: string | null
  status_after: string | null
  note: string | null
  changed_at: string
}

function equipmentMovementsCacheKey(equipmentId: string) {
  return `equipment:movements:${equipmentId}`
}

export function readCachedEquipmentMovements(equipmentId: string) {
  return readCachedQuery<EquipmentMovement[]>(equipmentMovementsCacheKey(equipmentId))
}

export async function fetchEquipmentMovements(equipmentId: string, { bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(equipmentMovementsCacheKey(equipmentId), 5 * 60 * 1000, async () => {
    const { data, error } = await client
      .from('equipment_movements')
      .select('id,list_id,movement_type,quantity_delta,quantity_before,quantity_after,status_before,status_after,note,changed_at')
      .eq('equipment_id', equipmentId)
      .order('changed_at', { ascending: false })
      .limit(50)
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) return []
    if (error) throw error
    return (data ?? []) as EquipmentMovement[]
  }, { bypass: bypassCache })
}
