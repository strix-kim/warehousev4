import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, readCachedQuery } from '../../lib/persistentCache'
import type { EquipmentPageResult } from './types'
import type { Equipment } from './types'

export const EQUIPMENT_PAGE_SIZE = 50

const quantityPlaceholders = new Set(['', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-'])

function normalizeEquipment(row: Omit<Equipment, 'tracking_mode' | 'inventory_code'>): Equipment {
  const storedIdentifier = row.serialnumber?.trim() ?? ''
  const normalizedIdentifier = storedIdentifier.toLowerCase()
  const generatedQuantityCode = storedIdentifier.startsWith('QTY::')
  const isQuantity = row.count > 1
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
  pageSize?: number
  bypassCache?: boolean
}

function safeSearch(value: string) {
  return value.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ')
}

function equipmentPageCacheKey({ page, search, availability, pageSize = EQUIPMENT_PAGE_SIZE }: Omit<EquipmentQuery, 'bypassCache'>) {
  return `equipment:${JSON.stringify({ page, search: safeSearch(search), availability, pageSize })}`
}

export function readCachedEquipment(query: Omit<EquipmentQuery, 'bypassCache'>) {
  return readCachedQuery<EquipmentPageResult>(equipmentPageCacheKey(query))
}

export function readCachedAllEquipment() {
  return readCachedQuery<Equipment[]>('equipment:all')
}

export async function fetchEquipment({ page, search, availability, pageSize = EQUIPMENT_PAGE_SIZE, bypassCache = false }: EquipmentQuery): Promise<EquipmentPageResult> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase

  const cacheKey = equipmentPageCacheKey({ page, search, availability, pageSize })
  return cachedQuery(cacheKey, 10 * 60 * 1000, async () => {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    let query = client
      .from('equipment')
      .select('*', { count: 'exact' })
      .order('type', { ascending: true })
      .order('brand', { ascending: true })
      .order('model', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    const normalizedSearch = safeSearch(search)
    if (normalizedSearch) {
      const searchTerms = normalizedSearch.split(/\s+/).slice(0, 6)
      for (const term of searchTerms) {
        const pattern = `%${term}%`
        query = query.or(
          `model.ilike.${pattern},brand.ilike.${pattern},serialnumber.ilike.${pattern},type.ilike.${pattern},subtype.ilike.${pattern}`,
        )
      }
    }

    if (availability === '__available__') {
      query = query.eq('availability', 'available')
    } else if (availability) {
      query = query.eq('availability', availability)
    }

    const { data, count, error } = await query
    if (error) throw error

    return { rows: (data ?? []).map((row) => normalizeEquipment(row)), total: count ?? 0 }
  }, { bypass: bypassCache })
}

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
  }, { bypass: bypassCache })
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

export type EquipmentTaxonomy = {
  types: string[]
  subtypes: string[]
}

export async function fetchEquipmentTaxonomy(): Promise<EquipmentTaxonomy> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery('equipment-taxonomy', 24 * 60 * 60 * 1000, async () => {
    const { data, error } = await client
      .from('equipment')
      .select('type,subtype')
      .range(0, 1999)

    if (error) throw error
    return {
      types: [...new Set((data ?? []).map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')),
      subtypes: [...new Set((data ?? []).map((item) => item.subtype).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')),
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
  availability: string
  location: string
  technicalspecification?: string
  lengthinmeters?: string
  description?: string
}

export async function createEquipment(input: CreateEquipmentInput) {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      brand: input.brand.trim(),
      model: input.model.trim(),
      serialnumber: input.trackingMode === 'serialized'
        ? input.serialnumber?.trim()
        : storedQuantityIdentifier(input.inventoryCode),
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

export async function serialNumberExists(serialNumber: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const { count, error } = await supabase
    .from('equipment')
    .select('id', { count: 'exact', head: true })
    .ilike('serialnumber', serialNumber.trim())

  if (error) throw error
  return (count ?? 0) > 0
}

export async function countEquipmentModelUnits(brand: string, model: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const cacheKey = `equipment:model-count:${brand.trim().toLocaleLowerCase('ru')}::${model.trim().toLocaleLowerCase('ru')}`
  return cachedQuery(cacheKey, 10 * 60 * 1000, async () => {
    const { count, error } = await client
      .from('equipment')
      .select('id', { count: 'exact', head: true })
      .eq('brand', brand)
      .eq('model', model)

    if (error) throw error
    return count ?? 0
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
  count: number
}

export type UpdateEquipmentResult = {
  item: Equipment
  // Сколько строк реально задел серверный update. null — ответ без счётчика, число называть нельзя.
  updatedModelUnits: number | null
}

export async function updateEquipmentModelAndUnit(input: UpdateEquipmentInput): Promise<UpdateEquipmentResult> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const { data: rpcResult, error } = await client.rpc('update_equipment_model_and_unit', {
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
    p_count: input.count,
  })
  if (error) throw error

  const reportedUnits = (rpcResult as { updated_model_units?: unknown } | null)?.updated_model_units
  const updatedModelUnits = typeof reportedUnits === 'number' && Number.isFinite(reportedUnits) ? reportedUnits : null

  const { data, error: fetchError } = await client
    .from('equipment')
    .select('*')
    .eq('id', input.id)
    .single()
  if (fetchError) throw fetchError

  invalidateCachePrefix('equipment:')
  invalidateCachePrefix('equipment-taxonomy')
  invalidateCachePrefix('equipment-lists:composition:')
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
