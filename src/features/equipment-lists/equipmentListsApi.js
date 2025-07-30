/**
 * API для работы со списками оборудования
 * CRUD операции для управления списками оборудования
 */
import { supabase } from '@/shared/api/supabase'

/**
 * Получить все списки оборудования
 * @param {Object} filters - фильтры
 * @param {string} filters.type - тип списка
 * @param {string} filters.event_id - ID мероприятия
 * @param {boolean} filters.is_archived - только архивированные
 */
export async function fetchEquipmentLists(filters = {}) {
  let query = supabase
    .from('equipment_lists')
    .select(`
      *,
      events(name),
      mount_points(name)
    `)
    .order('created_at', { ascending: false })

  // Применяем фильтры
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.event_id) {
    query = query.eq('event_id', filters.event_id)
  }
  if (filters.is_archived !== undefined) {
    query = query.eq('is_archived', filters.is_archived)
  }

  const { data, error } = await query
  return { data, error }
}

/**
 * Получить список оборудования по ID
 * @param {string} id - ID списка
 */
export async function fetchEquipmentListById(id) {
  const { data, error } = await supabase
    .from('equipment_lists')
    .select(`
      *,
      events(name),
      mount_points(name)
    `)
    .eq('id', id)
    .single()

  return { data, error }
}

/**
 * Создать новый список оборудования
 * @param {Object} listData - данные списка
 */
export async function createEquipmentList(listData) {
  // Получаем текущего пользователя
  const { data: { user } } = await supabase.auth.getUser()
  
  // Добавляем created_by если пользователь авторизован
  const dataToInsert = {
    ...listData,
    created_by: user?.id || null
  }

  const { data, error } = await supabase
    .from('equipment_lists')
    .insert([dataToInsert])
    .select()
    .single()

  return { data, error }
}

/**
 * Обновить список оборудования
 * @param {string} id - ID списка
 * @param {Object} updates - обновления
 */
export async function updateEquipmentList(id, updates) {
  const { data, error } = await supabase
    .from('equipment_lists')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

/**
 * Удалить список оборудования
 * @param {string} id - ID списка
 */
export async function deleteEquipmentList(id) {
  const { error } = await supabase
    .from('equipment_lists')
    .delete()
    .eq('id', id)

  return { error }
}

/**
 * Архивировать список оборудования
 * @param {string} id - ID списка
 */
export async function archiveEquipmentList(id) {
  return updateEquipmentList(id, { is_archived: true })
}

/**
 * Получить статистику списков для мероприятия
 * @param {string} eventId - ID мероприятия
 */
export async function getEventListsStats(eventId) {
  const { data, error } = await supabase
    .from('equipment_lists')
    .select('type, equipment_ids')
    .eq('event_id', eventId)
    .eq('is_archived', false)

  if (error) return { data: null, error }

  // Подсчитываем статистику
  const stats = {
    total: data.length,
    byType: {
      security: 0,
      report: 0,
      custom: 0
    },
    totalEquipment: 0
  }

  data.forEach(list => {
    stats.byType[list.type]++
    stats.totalEquipment += list.equipment_ids?.length || 0
  })

  return { data: stats, error: null }
}

/**
 * Создать список для охраны на основе мероприятия
 * @param {string} eventId - ID мероприятия
 * @param {string} name - название списка
 */
export async function createSecurityList(eventId, name = null) {
  // Получаем все точки монтажа мероприятия
  const { data: mountPoints, error: mountError } = await supabase
    .from('mount_points')
    .select('equipment_plan')
    .eq('event_id', eventId)

  if (mountError) return { data: null, error: mountError }

  // Собираем все уникальные ID оборудования
  const allEquipmentIds = new Set()
  mountPoints.forEach(mp => {
    if (mp.equipment_plan) {
      mp.equipment_plan.forEach(id => allEquipmentIds.add(id))
    }
  })

  const equipmentIds = Array.from(allEquipmentIds)

  // Создаем список
  const listData = {
    name: name || `Список охраны - ${new Date().toLocaleDateString()}`,
    description: 'Автоматически сформированный список оборудования для охраны',
    type: 'security',
    event_id: eventId,
    equipment_ids: equipmentIds,
    metadata: {
      source: 'auto_generated',
      mount_points_count: mountPoints.length,
      generated_at: new Date().toISOString()
    }
  }

  return createEquipmentList(listData)
} 