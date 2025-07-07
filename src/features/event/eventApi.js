// eventApi.js
// Сервис для CRUD-операций с таблицей мероприятий (events) через Supabase.
// Используется во всех компонентах и хуках, связанных с мероприятиями.

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список мероприятий
 */
export async function fetchEvents() {
  return await supabase.from('events').select('*')
}

/**
 * Добавить новое мероприятие
 * @param {Object} event
 */
export async function addEvent(event) {
  return await supabase.from('events').insert([event])
}

/**
 * Обновить мероприятие
 * @param {string} id
 * @param {Object} updates
 */
export async function updateEvent(id, updates) {
  return await supabase.from('events').update(updates).eq('id', id)
}

/**
 * Архивировать мероприятие (is_archived = true)
 * @param {string} id
 */
export async function deleteEvent(id) {
  // Вместо удаления — архивируем мероприятие
  return await supabase.from('events').update({ is_archived: true }).eq('id', id)
}

/**
 * Получить мероприятие по id
 * @param {string} id
 * @returns {Promise<Object>} объект мероприятия или null
 */
export async function fetchEventById(id) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Восстановить мероприятие из архива (is_archived = false)
 * @param {string} id
 */
export async function restoreEvent(id) {
  return await supabase.from('events').update({ is_archived: false }).eq('id', id)
} 