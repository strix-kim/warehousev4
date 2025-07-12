/**
 * Mount Point API - современный сервис для CRUD-операций с точками монтажа
 * Используется во всех компонентах и хуках, связанных с точками монтажа
 * Включает валидацию, обработку ошибок и подробное логирование
 */

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список точек монтажа по event_id с сортировкой
 * @param {string} eventId - ID события
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function fetchMountPoints(eventId) {
  try {
    console.log('🔧 fetchMountPoints вызван для eventId:', eventId)
    
    if (!eventId) {
      throw new Error('Event ID обязателен')
    }

    const { data, error } = await supabase
      .from('mount_points')
      .select('*')
      .eq('event_id', eventId)
      .order('name', { ascending: true })
    
    if (error) {
      console.error('❌ Ошибка Supabase в fetchMountPoints:', error)
      return { data: [], error }
    }

    console.log(`✅ Загружено ${data?.length || 0} точек монтажа для события ${eventId}`)
    return { data: data || [], error: null }
  } catch (err) {
    console.error('❌ Исключение в fetchMountPoints:', err)
    return { data: [], error: err }
  }
}

/**
 * Добавить новую точку монтажа с валидацией
 * @param {Object} mountPointData - данные точки монтажа
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function addMountPoint(mountPointData) {
  try {
    console.log('🔧 addMountPoint вызван с данными:', mountPointData)
    
    // Валидация обязательных полей
    const validation = validateMountPointData(mountPointData)
    if (validation.error) {
      throw new Error(validation.error)
    }

    // Подготовка данных с значениями по умолчанию
    const preparedData = {
      event_id: mountPointData.event_id,
      name: mountPointData.name?.trim(),
      location: mountPointData.location?.trim() || null,
      start_date: mountPointData.start_date || null,
      technical_duties: mountPointData.technical_duties || [],
      responsible_engineers: mountPointData.responsible_engineers || [],
      equipment_plan: mountPointData.equipment_plan || [],
      equipment_final: mountPointData.equipment_final || [],
      equipment_fact: mountPointData.equipment_fact || []
    }

    const { data, error } = await supabase
      .from('mount_points')
      .insert([preparedData])
      .select()
    
    if (error) {
      console.error('❌ Ошибка Supabase в addMountPoint:', error)
      return { data: null, error }
    }

    console.log('✅ Точка монтажа успешно создана:', data?.[0])
    return { data, error: null }
  } catch (err) {
    console.error('❌ Исключение в addMountPoint:', err)
    return { data: null, error: err }
  }
}

/**
 * Обновить точку монтажа с валидацией
 * @param {string} id - ID точки монтажа
 * @param {Object} updates - обновляемые данные
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function updateMountPoint(id, updates) {
  try {
    console.log('🔧 updateMountPoint вызван для ID:', id, 'с обновлениями:', updates)
    
    if (!id) {
      throw new Error('ID точки монтажа обязателен')
    }

    // Фильтруем только допустимые поля для обновления
    const allowedFields = [
      'name', 'location', 'start_date', 'technical_duties', 'responsible_engineers', 
      'equipment_plan', 'equipment_final', 'equipment_fact'
    ]
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {})

    // Проверяем, что есть данные для обновления
    if (Object.keys(filteredUpdates).length === 0) {
      console.warn('⚠️ Нет данных для обновления')
      return { data: null, error: new Error('Нет данных для обновления') }
    }

    // Валидация обновляемых данных
    if (filteredUpdates.name !== undefined) {
      if (!filteredUpdates.name?.trim()) {
        throw new Error('Название точки монтажа не может быть пустым')
      }
      filteredUpdates.name = filteredUpdates.name.trim()
    }

    console.log('🔧 Отфильтрованные данные для обновления:', filteredUpdates)

    const { data, error } = await supabase
      .from('mount_points')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
    
    if (error) {
      console.error('❌ Ошибка Supabase в updateMountPoint:', error)
      return { data: null, error }
    }

    console.log('✅ Точка монтажа успешно обновлена:', data?.[0])
    return { data, error: null }
  } catch (err) {
    console.error('❌ Исключение в updateMountPoint:', err)
    return { data: null, error: err }
  }
}

/**
 * Удалить точку монтажа
 * @param {string} id - ID точки монтажа
 * @returns {Promise<{error: Object|null}>}
 */
export async function deleteMountPoint(id) {
  try {
    console.log('🔧 deleteMountPoint вызван для ID:', id)
    
    if (!id) {
      throw new Error('ID точки монтажа обязателен')
    }

    const { error } = await supabase
      .from('mount_points')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('❌ Ошибка Supabase в deleteMountPoint:', error)
      return { error }
    }

    console.log('✅ Точка монтажа успешно удалена:', id)
    return { error: null }
  } catch (err) {
    console.error('❌ Исключение в deleteMountPoint:', err)
    return { error: err }
  }
}

/**
 * Получить точку монтажа по ID
 * @param {string} id - ID точки монтажа
 * @returns {Promise<Object>} объект точки монтажа
 * @throws {Error} если точка не найдена или произошла ошибка
 */
export async function fetchMountPointById(id) {
  try {
    console.log('🔧 fetchMountPointById вызван для ID:', id)
    
    if (!id) {
      throw new Error('ID точки монтажа обязателен')
    }

    const { data, error } = await supabase
      .from('mount_points')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('❌ Ошибка Supabase в fetchMountPointById:', error)
      throw error
    }

    if (!data) {
      throw new Error('Точка монтажа не найдена')
    }

    console.log('✅ Точка монтажа загружена:', data)
    return data
  } catch (err) {
    console.error('❌ Исключение в fetchMountPointById:', err)
    throw err
  }
}

/**
 * Валидация данных точки монтажа
 * @param {Object} data - данные для валидации
 * @returns {Object} результат валидации {valid: boolean, error: string|null}
 */
function validateMountPointData(data) {
  if (!data) {
    return { valid: false, error: 'Данные точки монтажа обязательны' }
  }

  if (!data.event_id) {
    return { valid: false, error: 'Event ID обязателен' }
  }

  if (!data.name || !data.name.trim()) {
    return { valid: false, error: 'Название точки монтажа обязательно' }
  }

  if (data.name.trim().length > 120) {
    return { valid: false, error: 'Название не должно превышать 120 символов' }
  }

  return { valid: true, error: null }
} 