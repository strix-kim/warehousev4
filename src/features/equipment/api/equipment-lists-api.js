/**
 * API для работы со списками оборудования
 * Включает проверку конфликтов и CRUD операции
 */

import { supabase } from '@/shared/api/supabase'

// ===== СОЗДАНИЕ СПИСКА =====
export const createEquipmentList = async (listData) => {
  try {
    const insertData = {
      name: listData.name,
      description: listData.description || null,
      type: listData.type,
      list_mode: listData.list_mode || 'specific', // 'specific' | 'abstract'
      event_id: listData.event_id || null,
      mount_point_id: listData.mount_point_id || null,
      metadata: listData.metadata || {},
      created_by: listData.created_by || null,
      is_archived: false
    }
    
    // В зависимости от режима добавляем разные поля
    if (listData.list_mode === 'abstract') {
      // Абстрактный режим - массив объектов с типами оборудования
      insertData.equipment_items = listData.equipment_items || []
      insertData.equipment_ids = [] // Пустой массив для совместимости
    } else {
      // Конкретный режим - массив ID конкретных единиц
      insertData.equipment_ids = listData.equipment_ids || []
      insertData.equipment_items = [] // Пустой массив для совместимости
    }
    
    const { data, error } = await supabase
      .from('equipment_lists')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Ошибка создания списка оборудования:', error)
    throw error
  }
}

// ===== ПОЛУЧЕНИЕ СПИСКОВ =====
export const getEquipmentLists = async (filters = {}) => {
  try {
    let query = supabase
      .from('equipment_lists')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    // Фильтр по типу
    if (filters.type) {
      query = query.eq('type', filters.type)
    }

    // Фильтр по мероприятию
    if (filters.event_id) {
      query = query.eq('event_id', filters.event_id)
    }

    // Поиск по названию
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    // Пагинация
    if (filters.page && filters.limit) {
      const offset = (filters.page - 1) * filters.limit
      query = query.range(offset, offset + filters.limit - 1)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data || [],
      total: count || 0
    }
  } catch (error) {
    console.error('Ошибка получения списков оборудования:', error)
    throw error
  }
}

// ===== ПОЛУЧЕНИЕ СПИСКА ПО ID =====
export const getEquipmentListById = async (listId) => {
  try {
    const { data, error } = await supabase
      .from('equipment_lists')
      .select('*')
      .eq('id', listId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Ошибка получения списка оборудования:', error)
    throw error
  }
}

// ===== ОБНОВЛЕНИЕ СПИСКА =====
export const updateEquipmentList = async (listId, updates) => {
  try {
    const { data, error } = await supabase
      .from('equipment_lists')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Ошибка обновления списка оборудования:', error)
    throw error
  }
}

// ===== УДАЛЕНИЕ СПИСКА (архивирование) =====
export const deleteEquipmentList = async (listId) => {
  try {
    const { data, error } = await supabase
      .from('equipment_lists')
      .update({ 
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Ошибка удаления списка оборудования:', error)
    throw error
  }
}

// ===== ПРОВЕРКА КОНФЛИКТОВ ДЛЯ КОНКРЕТНОГО НАБОРА ОБОРУДОВАНИЯ =====
export const checkEquipmentConflicts = async (eventId, equipmentIds, excludeListId = null) => {
  if (!eventId || !equipmentIds || equipmentIds.length === 0) {
    return {}
  }

  try {
    console.log('🔍 [API] Проверка конфликтов для оборудования:', { 
      eventId, 
      equipmentCount: equipmentIds.length,
      excludeListId 
    })

    // Получаем все конфликты для мероприятия
    const allConflicts = await getEventEquipmentConflicts(eventId, excludeListId)

    // Фильтруем только конфликты для запрашиваемого оборудования
    const relevantConflicts = {}
    for (const equipmentId of equipmentIds) {
      if (allConflicts[equipmentId]) {
        relevantConflicts[equipmentId] = allConflicts[equipmentId]
      }
    }

    console.log('⚠️ [API] Найдено релевантных конфликтов:', Object.keys(relevantConflicts).length)

    return relevantConflicts
  } catch (error) {
    console.error('Ошибка проверки конфликтов оборудования:', error)
    throw error
  }
}

// ===== ПОЛУЧЕНИЕ ПОЛНОЙ ИНФОРМАЦИИ О КОНФЛИКТАХ ДЛЯ МЕРОПРИЯТИЯ =====
export const getEventEquipmentConflicts = async (eventId, excludeListId = null) => {
  if (!eventId) return {}

  try {
    console.log('🔍 [API] Получение конфликтов для мероприятия:', { eventId, excludeListId })
    
    // Получаем все активные linked списки для данного мероприятия
    let query = supabase
      .from('equipment_lists')
      .select(`
        id,
        name,
        equipment_ids,
        mount_point_id,
        mount_points (
          name
        )
      `)
      .eq('event_id', eventId)
      .eq('type', 'security')
      .eq('is_archived', false)

    // Исключаем текущий список при редактировании
    if (excludeListId) {
      query = query.neq('id', excludeListId)
    }

    const { data: existingLists, error } = await query

    if (error) throw error

    const conflicts = {}
    let totalConflictedEquipment = 0

    console.log('📋 [API] Найдено списков для проверки:', existingLists?.length || 0)

    // Собираем информацию о всем зарезервированном оборудовании
    for (const list of existingLists || []) {
      if (!list.equipment_ids || list.equipment_ids.length === 0) continue

      for (const equipmentId of list.equipment_ids) {
        conflicts[equipmentId] = {
          listId: list.id,
          listName: list.name,
          mountPointId: list.mount_point_id,
          mountPointName: list.mount_points?.name || 'Неизвестная точка'
        }
        totalConflictedEquipment++
      }
    }

    console.log('⚠️ [API] Найдено конфликтов:', {
      totalEquipmentConflicted: totalConflictedEquipment,
      uniqueEquipmentConflicted: Object.keys(conflicts).length,
      listsCount: existingLists?.length || 0
    })

    return conflicts
  } catch (error) {
    console.error('❌ Ошибка получения конфликтов для мероприятия:', error)
    throw error
  }
}

// ===== ПОЛУЧЕНИЕ ЗАНЯТОГО ОБОРУДОВАНИЯ ДЛЯ МЕРОПРИЯТИЯ =====
export const getUsedEquipmentForEvent = async (eventId) => {
  if (!eventId) return []

  try {
    const { data: lists, error } = await supabase
      .from('equipment_lists')
      .select('equipment_ids')
      .eq('event_id', eventId)
      .eq('type', 'security')
      .eq('is_archived', false)

    if (error) throw error

    // Объединяем все ID оборудования из всех списков
    const usedIds = new Set()
    for (const list of lists || []) {
      if (list.equipment_ids) {
        list.equipment_ids.forEach(id => usedIds.add(id))
      }
    }

    return Array.from(usedIds)
  } catch (error) {
    console.error('Ошибка получения занятого оборудования:', error)
    throw error
  }
}

// ===== ПОЛУЧЕНИЕ МЕРОПРИЯТИЙ =====
export const getEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('uuid, name, description, start_date, end_date')
      .order('start_date', { ascending: false })

    if (error) throw error

    return (data || []).map(event => ({
      label: event.name,
      value: event.uuid,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date
    }))
  } catch (error) {
    console.error('Ошибка получения мероприятий:', error)
    throw error
  }
}

// ===== ПОЛУЧЕНИЕ ТОЧЕК МОНТАЖА ДЛЯ МЕРОПРИЯТИЯ =====
export const getMountPointsForEvent = async (eventId) => {
  if (!eventId) return []

  try {
    const { data, error } = await supabase
      .from('mount_points')
      .select('uuid, name, description, location')
      .eq('event_id', eventId)
      .order('name')

    if (error) throw error

    return (data || []).map(mountPoint => ({
      label: mountPoint.name,
      value: mountPoint.uuid,
      description: mountPoint.description,
      location: mountPoint.location
    }))
  } catch (error) {
    console.error('Ошибка получения точек монтажа:', error)
    throw error
  }
}

// ===== СТАТИСТИКА СПИСКОВ =====
export const getEquipmentListsStats = async () => {
  try {
    const [totalResult, linkedResult, freeResult] = await Promise.all([
      // Общее количество
      supabase
        .from('equipment_lists')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false),
      
      // Связанные списки
      supabase
        .from('equipment_lists')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'security')
        .eq('is_archived', false),
      
      // Свободные списки
      supabase
        .from('equipment_lists')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'free')
        .eq('is_archived', false)
    ])

    return {
      total: totalResult.count || 0,
      linked: linkedResult.count || 0,
      free: freeResult.count || 0
    }
  } catch (error) {
    console.error('Ошибка получения статистики списков:', error)
    throw error
  }
}