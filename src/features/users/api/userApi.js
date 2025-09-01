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
 * 🚀 ОПТИМИЗАЦИЯ: Получить только определенных пользователей по ID
 * Используется для загрузки только ответственных инженеров конкретного мероприятия
 * @param {Array<string>} userIds - массив ID пользователей
 * @returns {Promise<{data: Array, error: Object|null}>}
 */
export async function fetchUsersByIds(userIds) {
  try {
    if (!userIds || userIds.length === 0) {
      console.log('🔍 [API] Нет ID пользователей для загрузки')
      return { data: [], error: null }
    }

    console.log(`🔍 [API] Загружаем ${userIds.length} пользователей по ID:`, userIds)

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds)

    if (error) {
      console.error('❌ [API] Ошибка загрузки пользователей по ID:', error)
      return { data: [], error }
    }

    console.log(`✅ [API] Загружено ${data?.length || 0} пользователей по ID`)
    return { data: data || [], error: null }

  } catch (err) {
    console.error('❌ [API] Исключение в fetchUsersByIds:', err)
    return { data: [], error: err }
  }
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