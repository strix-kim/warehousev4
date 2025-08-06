// userApi.js
// Сервис для CRUD-операций с таблицей пользователей (users) через Supabase.
// Используется во всех компонентах и хуках, связанных с пользователями.

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список пользователей
 */
export async function fetchUsers() {
  return await supabase.from('users').select('*')
}

/**
 * Получить текущего пользователя по id
 * @param {string} id
 */
export async function fetchUserById(id) {
  return await supabase.from('users').select('*').eq('id', id).single()
}

/**
 * Добавить нового пользователя (используется только для тестов/админки)
 * @param {Object} user
 */
export async function addUser(user) {
  return await supabase.from('users').insert([user])
}

/**
 * Обновить пользователя
 * @param {string} id
 * @param {Object} updates
 */
export async function updateUser(id, updates) {
  return await supabase.from('users').update(updates).eq('id', id)
}

/**
 * Удалить пользователя (только для admin)
 * @param {string} id
 */
export async function deleteUser(id) {
  return await supabase.from('users').delete().eq('id', id)
} 