// mountPointApi.js
// Сервис для CRUD-операций с таблицей точек монтажа (mount_points) через Supabase.
// Используется во всех компонентах и хуках, связанных с точками монтажа.

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список точек монтажа по event_id
 * @param {string} eventId
 */
export async function fetchMountPoints(eventId) {
  return await supabase.from('mount_points').select('*').eq('event_id', eventId)
}

/**
 * Добавить новую точку монтажа
 * @param {Object} mountPoint
 */
export async function addMountPoint(mountPoint) {
  return await supabase.from('mount_points').insert([mountPoint])
}

/**
 * Обновить точку монтажа
 * @param {string} id
 * @param {Object} updates
 */
export async function updateMountPoint(id, updates) {
  return await supabase.from('mount_points').update(updates).eq('id', id)
}

/**
 * Удалить точку монтажа
 * @param {string} id
 */
export async function deleteMountPoint(id) {
  return await supabase.from('mount_points').delete().eq('id', id)
}

/**
 * Получить точку монтажа по id
 * @param {string} id
 * @returns {Promise<Object>} объект точки монтажа или null
 */
export async function fetchMountPointById(id) {
  const { data, error } = await supabase.from('mount_points').select('*').eq('id', id).single()
  if (error) throw error
  return data
} 