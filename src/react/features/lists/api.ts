import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, readCachedQuery } from '../../lib/persistentCache'
import type { Json, Tables } from '../../lib/database.types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { fetchEquipmentByIds } from '../equipment/api'
import type { Equipment } from '../equipment/types'
import { listCompositionCacheKey } from './cacheKeys'
import type { ExportListRow } from './xlsxExport'

export type ReservationStatus = 'draft' | 'confirmed' | 'issued' | 'returned'

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
  | 'reservation_status' | 'reservation_start' | 'reservation_end' | 'shortage_snapshot'
>

// Набор колонок старой схемы: полей брони в ней ещё нет.
type LegacyEquipmentListRow = Pick<
  Tables<'equipment_lists'>,
  'id' | 'name' | 'description' | 'type' | 'list_mode' | 'equipment_ids'
  | 'equipment_items' | 'created_at' | 'is_archived'
>

// Доменный список: строка базы, где текстовые статусы под CHECK и jsonb-колонки
// сужены до наших типов, плюс advanced_features — вычисляемый клиентом признак
// того, что схема отдала колонки брони.
export type EquipmentList = Omit<
  EquipmentListRow,
  'list_mode' | 'reservation_status' | 'equipment_items' | 'shortage_snapshot'
> & {
  list_mode: 'specific' | 'abstract'
  reservation_status: ReservationStatus
  equipment_items: EquipmentListItem[] | null
  shortage_snapshot: ReservationShortage[] | null
  advanced_features: boolean
}

export type ReservationShortage = {
  brand: string
  model: string
  type: string
  subtype: string
  requested: number
  capacity: number
  reserved: number
  available: number
  specific_conflicts: number
  shortage: number
}

// Колонки reservation_status_history, которые читает интерфейс.
type ReservationHistoryRow = Pick<
  Tables<'reservation_status_history'>,
  'id' | 'from_status' | 'to_status' | 'note' | 'shortage_snapshot' | 'changed_at'
>

// Статусы в журнале так же лежат текстом под CHECK, а снимок дефицита — в jsonb.
export type ReservationHistory = Omit<
  ReservationHistoryRow,
  'from_status' | 'to_status' | 'shortage_snapshot'
> & {
  from_status: ReservationStatus | null
  to_status: ReservationStatus
  shortage_snapshot: ReservationShortage[] | null
}

const listColumns = 'id,name,description,client_name,venue,type,list_mode,equipment_ids,equipment_items,created_at,is_archived,reservation_status,reservation_start,reservation_end,shortage_snapshot'

const reservationStatuses: ReservationStatus[] = ['draft', 'confirmed', 'issued', 'returned']

// Сохранённые списки пагинируются на клиенте, но размер страницы — тоже контракт
// фичи: он один и там, где список рисуется, и там, где его прогревают.
export function preferredListsPageSize() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches ? 6 : 12
}

// list_mode и reservation_status держит CHECK в базе, но в схеме это обычный text —
// сужаем на входе, чтобы дальше по коду ходил доменный тип.
function toReservationStatus(value: string): ReservationStatus {
  return reservationStatuses.find((status) => status === value) ?? 'draft'
}

function toListMode(value: string | null): 'specific' | 'abstract' {
  return value === 'abstract' ? 'abstract' : 'specific'
}

// jsonb-колонки схема отдаёт как Json. Проверяем, что пришёл массив; форму
// элементов задаёт та же RPC, которая их и пишет, поэтому их не пересобираем.
function toEquipmentListItems(value: Json): EquipmentListItem[] | null {
  return Array.isArray(value) ? (value as EquipmentListItem[]) : null
}

function toReservationShortages(value: Json): ReservationShortage[] | null {
  return Array.isArray(value) ? (value as ReservationShortage[]) : null
}

function normalizeList(row: EquipmentListRow): EquipmentList {
  return {
    ...row,
    list_mode: toListMode(row.list_mode),
    reservation_status: toReservationStatus(row.reservation_status),
    equipment_items: toEquipmentListItems(row.equipment_items),
    shortage_snapshot: toReservationShortages(row.shortage_snapshot),
    advanced_features: true,
  }
}

function normalizeHistoryEntry(row: ReservationHistoryRow): ReservationHistory {
  return {
    ...row,
    from_status: row.from_status === null ? null : toReservationStatus(row.from_status),
    to_status: toReservationStatus(row.to_status),
    shortage_snapshot: toReservationShortages(row.shortage_snapshot),
  }
}

// Старая схема без колонок брони: недостающие поля добираем теми же значениями,
// что подставлял фолбэк раньше.
function normalizeLegacyList(row: LegacyEquipmentListRow): EquipmentList {
  return {
    ...row,
    list_mode: toListMode(row.list_mode),
    equipment_items: toEquipmentListItems(row.equipment_items),
    client_name: null,
    venue: null,
    reservation_status: 'draft',
    reservation_start: null,
    reservation_end: null,
    shortage_snapshot: null,
    advanced_features: false,
  }
}

export function readCachedEquipmentLists() {
  return readCachedQuery<{ rows: EquipmentList[]; total: number }>('equipment-lists:recent')
}

export async function fetchEquipmentLists({ bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery('equipment-lists:recent', 10 * 60 * 1000, async () => {
    const { data, error, count } = await client
      .from('equipment_lists')
      .select(listColumns, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error) return {
      rows: (data ?? []).map((item) => normalizeList(item)),
      total: count ?? 0,
    }

    const legacy = await client
      .from('equipment_lists')
      .select('id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50)
    if (legacy.error) throw error
    return {
      rows: (legacy.data ?? []).map((item) => normalizeLegacyList(item)),
      total: legacy.count ?? 0,
    }
  }, { bypass: bypassCache })
}

function equipmentListCacheKey(listId: string) {
  return `equipment-lists:detail:${listId}`
}

function reservationShortagesCacheKey(listId: string) {
  return `equipment-lists:shortages:${listId}`
}

function reservationHistoryCacheKey(listId: string) {
  return `equipment-lists:history:${listId}`
}

export function readCachedEquipmentList(listId: string) {
  return readCachedQuery<EquipmentList>(equipmentListCacheKey(listId))
}

export function readCachedReservationShortages(listId: string) {
  return readCachedQuery<ReservationShortage[]>(reservationShortagesCacheKey(listId))
}

export function readCachedReservationHistory(listId: string) {
  return readCachedQuery<ReservationHistory[]>(reservationHistoryCacheKey(listId))
}

export async function fetchEquipmentList(listId: string, { bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(equipmentListCacheKey(listId), 10 * 60 * 1000, async () => {
    const modern = await client
      .from('equipment_lists')
      .select(listColumns)
      .eq('id', listId)
      .single()

    if (!modern.error) return normalizeList(modern.data)

    const legacy = await client
      .from('equipment_lists')
      .select('id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived')
      .eq('id', listId)
      .single()

    if (legacy.error) throw modern.error
    return normalizeLegacyList(legacy.data)
  }, { bypass: bypassCache })
}

// Состав сохранённого списка — строки для деталей и для Excel. Ключ кэша
// принадлежит этой фиче, но лежит в листовом cacheKeys.ts: сбрасывать его
// нужно и из equipment/api, а зависимость equipment → lists/api замкнула бы
// граф фич в цикл.
export { invalidateListCompositionCache } from './cacheKeys'

export function readCachedSavedListRows(listId: string) {
  return readCachedQuery<ExportListRow[]>(listCompositionCacheKey(listId))
}

async function loadSavedListRows(list: EquipmentList) {
  const serialized = await fetchEquipmentByIds(list.equipment_ids ?? [])
  const grouped = new Map<string, ExportListRow>()
  const addRow = (row: ExportListRow) => {
    const key = `${row.category}::${row.equipment}::${row.subtype}`.toLocaleLowerCase('ru')
    const current = grouped.get(key)
    if (current) {
      current.count += row.count
      current.serialNumbers.push(...row.serialNumbers)
    } else grouped.set(key, { ...row, serialNumbers: [...row.serialNumbers] })
  }
  for (const item of serialized) addRow({
    category: item.type,
    equipment: `${item.brand} ${item.model}`.trim(),
    subtype: item.subtype,
    count: 1,
    serialNumbers: item.serialnumber ? [item.serialnumber] : [],
  })
  for (const item of list.equipment_items ?? []) addRow({
    category: item.type,
    equipment: `${item.brand} ${item.model}`.trim(),
    subtype: item.subtype,
    count: item.count,
    serialNumbers: [],
  })
  return [...grouped.values()]
}

export function buildSavedListRows(list: EquipmentList, { bypassCache = false } = {}) {
  return cachedQuery(listCompositionCacheKey(list.id), 10 * 60 * 1000, () => loadSavedListRows(list), { bypass: bypassCache })
}

export function prefetchSavedListDetails(list: EquipmentList) {
  return Promise.allSettled([
    buildSavedListRows(list),
    fetchEquipmentList(list.id),
    list.advanced_features ? fetchReservationHistory(list.id) : Promise.resolve([]),
    list.advanced_features && list.reservation_start && list.reservation_end ? fetchReservationShortages(list.id) : Promise.resolve([]),
  ])
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

export async function deleteEquipmentList(listId: string) {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase
    .from('equipment_lists')
    .delete()
    .eq('id', listId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Equipment list cannot be deleted')
  invalidateCachePrefix('equipment-lists:')
  return data.id as string
}

export async function fetchReservationShortages(listId: string, { bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(reservationShortagesCacheKey(listId), 5 * 60 * 1000, async () => {
    const { data, error } = await client.rpc('reservation_shortages', { p_list_id: listId })
    if (error && (error.code === 'PGRST202' || error.code === '42883')) return []
    if (error) throw error
    // Строки RPC уже типизированы схемой — приведение больше не нужно.
    return (data ?? []).filter((item) => item.shortage > 0)
  }, { bypass: bypassCache })
}

export async function transitionEquipmentList(listId: string, targetStatus: ReservationStatus, note = '') {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.rpc('transition_equipment_list_status', {
    p_list_id: listId,
    p_target_status: targetStatus,
    // У p_note в SQL есть default null, поэтому пустую заметку просто не передаём:
    // supabase-js выкидывает undefined из тела запроса, база подставляет свой null.
    p_note: note || undefined,
  })
  if (error) throw error
  invalidateCachePrefix('equipment-lists:')
  invalidateCachePrefix('equipment:')
  return data as { id: string; status: ReservationStatus; shortages: ReservationShortage[] }
}

export async function fetchReservationHistory(listId: string, { bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(reservationHistoryCacheKey(listId), 5 * 60 * 1000, async () => {
    const { data, error } = await client
      .from('reservation_status_history')
      .select('id,from_status,to_status,note,shortage_snapshot,changed_at')
      .eq('list_id', listId)
      .order('changed_at', { ascending: false })
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) return []
    if (error) throw error
    return (data ?? []).map((row) => normalizeHistoryEntry(row))
  }, { bypass: bypassCache })
}
