/**
 * eventApi.js
 * API для работы с мероприятиями через Supabase
 * 
 * Поля записи events:
 * - id, name, organizer, location, description, technical_task
 * - photos, setup_date, start_date, end_date, teardown_date
 * - mount_points_count, responsible_engineers, created_at, is_archived
 * 
 * Поддерживает fallback для случаев когда поле is_archived отсутствует в БД
 */

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список всех мероприятий
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function fetchEvents() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
    
    return { data: data || [], error }
  } catch (error) {
    console.error('Ошибка fetchEvents:', error)
    return { data: [], error }
  }
}

/**
 * Получить только активные мероприятия (is_archived = false)
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function fetchActiveEvents() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    
    // Если поле отсутствует (ошибка), возвращаем все мероприятия как активные
    if (error && error.message?.includes('column "is_archived" does not exist')) {
      console.warn('⚠️ Поле is_archived отсутствует в БД. Возвращаем все мероприятия как активные.')
      return await fetchEvents()
    }
    
    return { data: data || [], error }
  } catch (error) {
    console.error('Ошибка fetchActiveEvents:', error)
    // Fallback: пытаемся получить все мероприятия
    return await fetchEvents()
  }
}

/**
 * Получить только архивные мероприятия (is_archived = true)
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function fetchArchivedEvents() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_archived', true)
      .order('created_at', { ascending: false })
    
    // Если поле отсутствует (ошибка), возвращаем пустой массив
    if (error && error.message?.includes('column "is_archived" does not exist')) {
      console.warn('⚠️ Поле is_archived отсутствует в БД. Архивные мероприятия недоступны.')
      return { data: [], error: null }
    }
    
    return { data: data || [], error }
  } catch (error) {
    console.error('Ошибка fetchArchivedEvents:', error)
    return { data: [], error }
  }
}

/**
 * Получить мероприятие по ID
 * @param {string} id - ID мероприятия
 * @returns {Promise<Object|null>} объект мероприятия или null
 */
export async function fetchEventById(id) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Мероприятие не найдено')
      }
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Ошибка fetchEventById:', error)
    throw error
  }
}

/**
 * Добавить новое мероприятие
 * @param {Object} eventData - данные мероприятия
 * @returns {Promise<{data: Object, error: Object|null}>}
 */
export async function addEvent(eventData) {
  try {
    // Подготавливаем данные с валидацией обязательных полей (согласно схеме БД)
    const newEvent = {
      name: eventData.name || '',
      organizer: eventData.organizer || '',
      location: eventData.location || '',
      description: eventData.description || '',
      technical_task: eventData.technical_task || '',
      photos: eventData.photos || [],
      setup_date: eventData.setup_date || null,
      start_date: eventData.start_date || null,
      end_date: eventData.end_date || null,
      teardown_date: eventData.teardown_date || null,
      mount_points_count: eventData.mount_points_count || 0,
      responsible_engineers: eventData.responsible_engineers || [],
      is_archived: eventData.is_archived ?? false,
      created_at: eventData.created_at || new Date().toISOString()
      // Примечание: поля is_archived и created_at могут отсутствовать в старой схеме БД
    }
    
    // КРИТИЧЕСКИ ВАЖНО: Очищаем пустые строки для полей дат, чтобы избежать ошибки PostgreSQL
    // PostgreSQL не принимает пустые строки для типа date, только null или валидные даты
    const dateFields = ['setup_date', 'start_date', 'end_date', 'teardown_date']
    dateFields.forEach(field => {
      if (newEvent[field] === '') {
        console.log(`🔧 Преобразуем пустую строку в null для поля ${field} при создании`)
        newEvent[field] = null
      }
    })
    
    const { data, error } = await supabase
      .from('events')
      .insert([newEvent])
      .select()
    
    return { data: data?.[0] || null, error }
  } catch (error) {
    console.error('Ошибка addEvent:', error)
    return { data: null, error }
  }
}

/**
 * Обновить мероприятие
 * @param {string} id - ID мероприятия
 * @param {Object} updates - обновляемые данные
 * @returns {Promise<{data: Object, error: Object|null}>}
 */
export async function updateEvent(id, updates) {
  try {
    console.log('🔧 updateEvent вызван с:', { id, updates })
    
    // Фильтруем только допустимые поля для обновления (согласно схеме БД)
    const allowedFields = [
      'name', 'organizer', 'location', 'description', 'technical_task',
      'photos', 'setup_date', 'start_date', 'end_date', 'teardown_date',
      'mount_points_count', 'responsible_engineers', 'is_archived', 'created_at'
      // Примечание: поля is_archived и created_at могут отсутствовать в старой схеме БД
    ]
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {})
    
    // КРИТИЧЕСКИ ВАЖНО: Очищаем пустые строки для полей дат, чтобы избежать ошибки PostgreSQL
    // PostgreSQL не принимает пустые строки для типа date, только null или валидные даты
    const dateFields = ['setup_date', 'start_date', 'end_date', 'teardown_date', 'created_at']
    dateFields.forEach(field => {
      if (filteredUpdates[field] === '') {
        console.log(`🔧 Преобразуем пустую строку в null для поля ${field}`)
        filteredUpdates[field] = null
      }
    })
    
    console.log('🔧 Отфильтрованные данные для обновления:', filteredUpdates)
    
    // Проверяем, что есть данные для обновления
    if (Object.keys(filteredUpdates).length === 0) {
      console.warn('⚠️ Нет данных для обновления')
      return { data: null, error: new Error('Нет данных для обновления') }
    }
    
    const { data, error } = await supabase
      .from('events')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
    
    if (error) {
      console.error('❌ Ошибка Supabase при обновлении:', error)
      console.error('❌ Детали ошибки:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
    } else {
      console.log('✅ Мероприятие успешно обновлено:', data?.[0])
    }
    
    return { data: data?.[0] || null, error }
  } catch (error) {
    console.error('❌ Исключение в updateEvent:', error)
    return { data: null, error }
  }
}

/**
 * Архивировать мероприятие (is_archived = true) или удалить совсем
 * @param {string} id - ID мероприятия
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function deleteEvent(id) {
  try {
    // Пытаемся архивировать через is_archived
    const { data, error } = await supabase
      .from('events')
      .update({ is_archived: true })
      .eq('id', id)
      .select()
    
    // Если поле отсутствует, используем реальное удаление (временно)
    if (error && error.message?.includes('column "is_archived" does not exist')) {
      console.warn('⚠️ Поле is_archived отсутствует. Используем реальное удаление.')
      const deleteResult = await supabase
        .from('events')
        .delete()
        .eq('id', id)
      
      return { data: null, error: deleteResult.error }
    }
    
    return { data: data?.[0] || null, error }
  } catch (error) {
    console.error('Ошибка deleteEvent:', error)
    return { data: null, error }
  }
}

/**
 * Восстановить мероприятие из архива (is_archived = false)
 * @param {string} id - ID мероприятия
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function restoreEvent(id) {
  try {
    const { data, error } = await supabase
      .from('events')
      .update({ is_archived: false })
      .eq('id', id)
      .select()
    
    return { data: data?.[0] || null, error }
  } catch (error) {
    console.error('Ошибка restoreEvent:', error)
    return { data: null, error }
  }
}

/**
 * Проверить поддержку архивирования в текущей схеме БД
 * @returns {Promise<boolean>} true если поле is_archived существует
 */
export async function checkArchivingSupport() {
  try {
    // Пытаемся выполнить запрос с is_archived
    const { error } = await supabase
      .from('events')
      .select('is_archived')
      .limit(1)
    
    return !error
  } catch (error) {
    console.error('Ошибка checkArchivingSupport:', error)
    return false
  }
}

/**
 * Поиск мероприятий по тексту
 * @param {string} query - поисковый запрос
 * @param {Array} fields - поля для поиска (по умолчанию name, organizer, location)
 * @param {boolean} includeArchived - включать архивные мероприятия
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function searchEvents(query, fields = ['name', 'organizer', 'location'], includeArchived = true) {
  try {
    if (!query || query.trim() === '') {
      return includeArchived ? await fetchEvents() : await fetchActiveEvents()
    }
    
    let queryBuilder = supabase.from('events').select('*')
    
    // Добавляем условия поиска для каждого поля
    const searchConditions = fields.map(field => `${field}.ilike.%${query}%`)
    queryBuilder = queryBuilder.or(searchConditions.join(','))
    
    // Фильтруем архивные, если нужно
    if (!includeArchived) {
      const archivingSupported = await checkArchivingSupport()
      if (archivingSupported) {
        queryBuilder = queryBuilder.eq('is_archived', false)
      }
    }
    
    queryBuilder = queryBuilder.order('created_at', { ascending: false })
    
    const { data, error } = await queryBuilder
    
    return { data: data || [], error }
  } catch (error) {
    console.error('Ошибка searchEvents:', error)
    return { data: [], error }
  }
}

/**
 * Получить статистику по мероприятиям
 * @returns {Promise<{data: Object, error: Object|null}>}
 */
export async function getEventsStats() {
  try {
    const archivingSupported = await checkArchivingSupport()
    
    if (archivingSupported) {
      // Получаем статистику с разделением на активные/архивные
      const [activeResult, archivedResult] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact' }).eq('is_archived', false),
        supabase.from('events').select('id', { count: 'exact' }).eq('is_archived', true)
      ])
      
      const stats = {
        total: (activeResult.count || 0) + (archivedResult.count || 0),
        active: activeResult.count || 0,
        archived: archivedResult.count || 0,
        archivingSupported: true
      }
      
      return { data: stats, error: null }
    } else {
      // Получаем общую статистику без архивирования
      const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact' })
      
      const stats = {
        total: count || 0,
        active: count || 0,
        archived: 0,
        archivingSupported: false
      }
      
      return { data: stats, error }
    }
  } catch (error) {
    console.error('Ошибка getEventsStats:', error)
    return { data: null, error }
  }
} 