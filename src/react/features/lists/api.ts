import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, readCachedQuery } from '../../lib/persistentCache'
import type { Equipment } from '../equipment/types'

export type ReservationStatus = 'draft' | 'confirmed' | 'issued' | 'returned'

export type EquipmentListItem = Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'> & {
  count: number
  equipment_id?: string
  tracking_mode: 'serialized' | 'quantity' | 'planned'
}

export type EquipmentList = {
  id: string
  name: string
  description: string | null
  client_name: string | null
  venue: string | null
  type: string
  list_mode: 'specific' | 'abstract'
  equipment_ids: string[] | null
  equipment_items: EquipmentListItem[] | null
  created_at: string
  is_archived: boolean
  reservation_status: ReservationStatus
  reservation_start: string | null
  reservation_end: string | null
  shortage_snapshot: ReservationShortage[] | null
  advanced_features: boolean
}

export type AbstractListItem = EquipmentListItem

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

export type ReservationHistory = {
  id: string
  from_status: ReservationStatus | null
  to_status: ReservationStatus
  note: string | null
  shortage_snapshot: ReservationShortage[] | null
  changed_at: string
}

const listColumns = 'id,name,description,client_name,venue,type,list_mode,equipment_ids,equipment_items,created_at,is_archived,reservation_status,reservation_start,reservation_end,shortage_snapshot'

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
      rows: (data ?? []).map((item) => ({ ...item, advanced_features: true })) as unknown as EquipmentList[],
      total: count ?? 0,
    }

    const legacy = await client
      .from('equipment_lists')
      .select('id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50)
    if (legacy.error) throw error
    return {
      rows: (legacy.data ?? []).map((item) => ({
        ...item,
        reservation_status: 'draft' as const,
        reservation_start: null,
        reservation_end: null,
        shortage_snapshot: null,
        client_name: null,
        venue: null,
        advanced_features: false,
      })) as unknown as EquipmentList[],
      total: legacy.count ?? 0,
    }
  }, { bypass: bypassCache })
}

export async function fetchEquipmentList(listId: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const modern = await supabase
    .from('equipment_lists')
    .select(listColumns)
    .eq('id', listId)
    .single()

  if (!modern.error) return { ...modern.data, advanced_features: true } as unknown as EquipmentList

  const legacy = await supabase
    .from('equipment_lists')
    .select('id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived')
    .eq('id', listId)
    .single()

  if (legacy.error) throw modern.error
  return {
    ...legacy.data,
    reservation_status: 'draft' as const,
    reservation_start: null,
    reservation_end: null,
    shortage_snapshot: null,
    client_name: null,
    venue: null,
    advanced_features: false,
  } as unknown as EquipmentList
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

export async function fetchReservationShortages(listId: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.rpc('reservation_shortages', { p_list_id: listId })
  if (error && (error.code === 'PGRST202' || error.code === '42883')) return []
  if (error) throw error
  return ((data ?? []) as ReservationShortage[]).filter((item) => item.shortage > 0)
}

export async function transitionEquipmentList(listId: string, targetStatus: ReservationStatus, note = '') {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.rpc('transition_equipment_list_status', {
    p_list_id: listId,
    p_target_status: targetStatus,
    p_note: note || null,
  })
  if (error) throw error
  invalidateCachePrefix('equipment-lists:')
  invalidateCachePrefix('equipment:')
  return data as { id: string; status: ReservationStatus; shortages: ReservationShortage[] }
}

export async function fetchReservationHistory(listId: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('reservation_status_history')
    .select('id,from_status,to_status,note,shortage_snapshot,changed_at')
    .eq('list_id', listId)
    .order('changed_at', { ascending: false })
  if (error && (error.code === 'PGRST205' || error.code === '42P01')) return []
  if (error) throw error
  return (data ?? []) as ReservationHistory[]
}
