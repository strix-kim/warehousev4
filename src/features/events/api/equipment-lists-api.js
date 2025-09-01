/**
 * Equipment Lists API - управление списками оборудования для мероприятий
 * Использует Supabase для работы с базой данных
 */

import { supabase } from '@/shared/api/supabase.js'

/**
 * Получить списки оборудования для мероприятия
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function fetchEquipmentListsByEventId(eventId) {
  try {
    console.log('🔍 [API] Загружаем списки оборудования для мероприятия:', eventId)

    // Загружаем списки оборудования с дополнительной информацией об оборудовании
    const { data: lists, error } = await supabase
      .from('equipment_lists')
      .select(`
        id,
        name,
        type,
        description,
        equipment_ids,
        event_id,
        mount_point_id,
        metadata,
        created_at,
        updated_at,
        created_by,
        is_archived
      `)
      .eq('event_id', eventId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [API] Ошибка загрузки списков оборудования:', error)
      throw error
    }

    // 🚀 ОПТИМИЗАЦИЯ: Batch-запрос для всего оборудования
    let allEquipmentData = []
    
    // Собираем все уникальные equipment_ids из всех списков
    const allEquipmentIds = [
      ...new Set(
        (lists || [])
          .filter(list => list.equipment_ids && list.equipment_ids.length > 0)
          .flatMap(list => list.equipment_ids)
      )
    ]

    // Один запрос для всего оборудования (вместо N запросов)
    if (allEquipmentIds.length > 0) {
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, brand, model, type, subtype, serialnumber, availability')
        .in('id', allEquipmentIds)

      if (equipmentError) {
        console.warn('⚠️ [API] Ошибка batch-загрузки оборудования:', equipmentError)
      } else {
        allEquipmentData = equipment || []
        console.log(`🚀 [API] Batch-загружено ${allEquipmentData.length} единиц оборудования одним запросом`)
      }
    }

    // Создаем Map для быстрого поиска оборудования по ID
    const equipmentMap = new Map()
    allEquipmentData.forEach(item => {
      equipmentMap.set(item.id, item)
    })

    // Распределяем оборудование по спискам
    const listsWithEquipment = (lists || []).map(list => {
      if (!list.equipment_ids || list.equipment_ids.length === 0) {
        return {
          ...list,
          equipment_items: []
        }
      }

      // Ищем оборудование в Map (O(1) вместо O(n) поиска)
      const equipment_items = list.equipment_ids
        .map(id => equipmentMap.get(id))
        .filter(Boolean) // Убираем undefined значения

      return {
        ...list,
        equipment_items
      }
    })

    console.log('✅ [API] Списки оборудования загружены:', listsWithEquipment?.length || 0)
    return { data: listsWithEquipment || [], error: null }

  } catch (error) {
    console.error('❌ [API] Критическая ошибка загрузки списков оборудования:', error)
    return { 
      data: [], 
      error: error.message || 'Ошибка загрузки списков оборудования' 
    }
  }
}

/**
 * Получить конкретный список оборудования по ID
 * @param {string} listId - ID списка оборудования
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function fetchEquipmentListById(listId) {
  try {
    console.log('🔍 [API] Загружаем список оборудования:', listId)

    const { data: list, error } = await supabase
      .from('equipment_lists')
      .select(`
        id,
        name,
        type,
        description,
        equipment_ids,
        event_id,
        mount_point_id,
        metadata,
        created_at,
        updated_at,
        created_by,
        is_archived
      `)
      .eq('id', listId)
      .single()

    if (error) {
      console.error('❌ [API] Ошибка загрузки списка оборудования:', error)
      throw error
    }

    // Получаем детальную информацию об оборудовании
    let equipment_items = []
    if (list.equipment_ids && list.equipment_ids.length > 0) {
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, brand, model, type, subtype, serialnumber, availability')
        .in('id', list.equipment_ids)

      if (equipmentError) {
        console.warn('⚠️ [API] Ошибка загрузки оборудования для списка:', listId, equipmentError)
      } else {
        equipment_items = equipment || []
        console.log(`✅ [API] Загружено ${equipment_items.length} единиц оборудования для списка ${listId}`)
      }
    }

    const result = {
      ...list,
      equipment_items
    }

    console.log('✅ [API] Список оборудования загружен:', result.name)
    return { data: result, error: null }

  } catch (error) {
    console.error('❌ [API] Критическая ошибка загрузки списка оборудования:', error)
    return { 
      data: null, 
      error: error.message || 'Ошибка загрузки списка оборудования' 
    }
  }
}

/**
 * Создать новый список оборудования
 * @param {Object} listData - данные списка
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function createEquipmentList(listData) {
  try {
    console.log('📝 [API] Создаем список оборудования:', listData.name)

    const { data, error } = await supabase
      .from('equipment_lists')
      .insert([{
        name: listData.name,
        type: listData.type || 'custom',
        description: listData.description || '',
        equipment_ids: listData.equipment_ids || [],
        event_id: listData.event_id,
        mount_point_id: listData.mount_point_id || null,
        metadata: listData.metadata || {},
        created_by: listData.created_by,
        is_archived: false
      }])
      .select()
      .single()

    if (error) {
      console.error('❌ [API] Ошибка создания списка оборудования:', error)
      throw error
    }

    console.log('✅ [API] Список оборудования создан:', data.id)
    return { data, error: null }

  } catch (error) {
    console.error('❌ [API] Критическая ошибка создания списка оборудования:', error)
    return { 
      data: null, 
      error: error.message || 'Ошибка создания списка оборудования' 
    }
  }
}

/**
 * Обновить список оборудования
 * @param {string} listId - ID списка
 * @param {Object} updateData - данные для обновления
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function updateEquipmentList(listId, updateData) {
  try {
    console.log('📝 [API] Обновляем список оборудования:', listId)

    const updateFields = {
      updated_at: new Date().toISOString()
    }

    // Добавляем только те поля, которые переданы для обновления
    if (updateData.name !== undefined) updateFields.name = updateData.name
    if (updateData.type !== undefined) updateFields.type = updateData.type
    if (updateData.description !== undefined) updateFields.description = updateData.description
    if (updateData.equipment_ids !== undefined) updateFields.equipment_ids = updateData.equipment_ids
    if (updateData.metadata !== undefined) updateFields.metadata = updateData.metadata
    if (updateData.is_archived !== undefined) updateFields.is_archived = updateData.is_archived

    const { data, error } = await supabase
      .from('equipment_lists')
      .update(updateFields)
      .eq('id', listId)
      .select()
      .single()

    if (error) {
      console.error('❌ [API] Ошибка обновления списка оборудования:', error)
      throw error
    }

    console.log('✅ [API] Список оборудования обновлен:', data.id)
    return { data, error: null }

  } catch (error) {
    console.error('❌ [API] Критическая ошибка обновления списка оборудования:', error)
    return { 
      data: null, 
      error: error.message || 'Ошибка обновления списка оборудования' 
    }
  }
}

/**
 * Удалить список оборудования
 * @param {string} listId - ID списка
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteEquipmentList(listId) {
  try {
    console.log('🗑️ [API] Архивируем список оборудования:', listId)

    // Используем мягкое удаление через флаг is_archived
    const { data, error } = await supabase
      .from('equipment_lists')
      .update({ 
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', listId)
      .select()
      .single()

    if (error) {
      console.error('❌ [API] Ошибка архивирования списка оборудования:', error)
      throw error
    }

    console.log('✅ [API] Список оборудования заархивирован:', listId)
    return { success: true, error: null }

  } catch (error) {
    console.error('❌ [API] Критическая ошибка архивирования списка оборудования:', error)
    return { 
      success: false, 
      error: error.message || 'Ошибка архивирования списка оборудования' 
    }
  }
}
