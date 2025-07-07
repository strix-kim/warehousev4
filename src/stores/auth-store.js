// src/stores/auth-store.js
// Pinia store для авторизации, пользователя и ролей.
// Назначение: централизованно хранить сессию, пользователя, роль и управлять авторизацией во всём приложении.
// Используйте только именованные экспорты. Не изменяйте state напрямую вне actions!

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, fetchUsers } from '@/shared/api/supabase'

/**
 * Структура state:
 * - session: текущая сессия Supabase (null, если не авторизован)
 * - user: объект пользователя (null, если не загружен)
 * - role: строка с ролью пользователя (например, 'admin', 'manager', ...)
 * - isLoading: состояние загрузки (true во время async-операций)
 * - hasError: текст ошибки (null, если всё ок)
 */
export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const session = ref(null)
  const user = ref(null)
  const role = ref(null)
  const isLoading = ref(false)
  const hasError = ref(null)

  // --- Getters ---
  // Авторизован ли пользователь
  const isAuthenticated = computed(() => !!session.value && !!user.value)
  // Является ли пользователь админом
  const isAdmin = computed(() => role.value === 'admin')

  // --- Actions ---

  /**
   * Инициализация: получает текущую сессию и пользователя
   * Вызывать при старте приложения
   */
  async function init() {
    isLoading.value = true
    hasError.value = null
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      session.value = s
      if (s && s.user) {
        await fetchUser()
      } else {
        user.value = null
        role.value = null
      }
    } catch (e) {
      hasError.value = e.message || 'Ошибка инициализации авторизации'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Логин через email+password (или другой метод Supabase)
   * @param {string} email
   * @param {string} password
   */
  async function login(email, password) {
    isLoading.value = true
    hasError.value = null
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      session.value = data.session
      await fetchUser()
    } catch (e) {
      hasError.value = e.message || 'Ошибка входа'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Логаут пользователя
   */
  async function logout() {
    isLoading.value = true
    hasError.value = null
    try {
      await supabase.auth.signOut()
      session.value = null
      user.value = null
      role.value = null
    } catch (e) {
      hasError.value = e.message || 'Ошибка выхода'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Получить пользователя и его роль из таблицы users по id из сессии
   */
  async function fetchUser() {
    isLoading.value = true
    hasError.value = null
    try {
      const id = session.value?.user?.id
      if (!id) throw new Error('Нет id пользователя в сессии')
      // Предполагается, что fetchUsers возвращает массив пользователей
      const users = await fetchUsers()
      const u = users.find(u => u.id === id)
      if (!u) throw new Error('Пользователь не найден')
      user.value = u
      role.value = u.role || null
    } catch (e) {
      hasError.value = e.message || 'Ошибка загрузки пользователя'
      user.value = null
      role.value = null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Принудительно установить роль (например, для тестов или смены прав)
   * @param {string} newRole
   */
  function setRole(newRole) {
    role.value = newRole
  }

  // --- Side-effects ---
  // Подписка на изменения сессии Supabase
  supabase.auth.onAuthStateChange((event, s) => {
    session.value = s
    if (s && s.user) {
      fetchUser()
    } else {
      user.value = null
      role.value = null
    }
  })

  // --- Возвращаемые значения ---
  return {
    session,
    user,
    role,
    isLoading,
    hasError,
    isAuthenticated,
    isAdmin,
    init,
    login,
    logout,
    fetchUser,
    setRole
  }
}) 