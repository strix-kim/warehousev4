// user-store.js
// Pinia store для управления состоянием пользователей (users)
// Архитектурная роль: feature-sliced store, централизует CRUD-логику и состояние для пользователей
// Используется на страницах и в компонентах, где требуется доступ к списку и операциям с пользователями

import { defineStore } from 'pinia'
import {
  fetchUsers,
  fetchUserById,
  fetchUsersByIds,
  addUser,
  updateUser,
  deleteUser
} from '@/features/users/api/userApi'

export const useUserStore = defineStore('user', {
  state: () => ({
    users: [],        // Список пользователей
    loading: false,   // Флаг загрузки
    error: null       // Текст ошибки (если есть)
  }),

  actions: {
    /**
     * Загрузить список пользователей
     */
    async loadUsers() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchUsers()
        if (error) throw error
        this.users = data
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки пользователей'
        this.users = []
      } finally {
        this.loading = false
      }
    },

    /**
     * 🚀 ОПТИМИЗАЦИЯ: Загрузить только определенных пользователей по ID
     * Используется для загрузки только нужных пользователей (например, ответственных инженеров)
     * @param {Array<string>} userIds - массив ID пользователей
     * @param {boolean} mergeWithExisting - добавить к существующим или заменить
     */
    async loadUsersByIds(userIds, mergeWithExisting = true) {
      if (!userIds || userIds.length === 0) return

      // Проверяем, какие пользователи уже загружены
      const existingIds = new Set(this.users.map(u => u.id))
      const missingIds = userIds.filter(id => !existingIds.has(id))
      
      if (missingIds.length === 0) {
        console.log('🎯 [Store] Все необходимые пользователи уже загружены')
        return
      }

      this.loading = true
      this.error = null
      try {
        console.log(`🎯 [Store] Загружаем ${missingIds.length} недостающих пользователей`)
        const { data, error } = await fetchUsersByIds(missingIds)
        if (error) throw error

        if (mergeWithExisting) {
          // Добавляем к существующим пользователям (избегаем дубликатов)
          const newUsers = data.filter(user => !existingIds.has(user.id))
          this.users.push(...newUsers)
          console.log(`✅ [Store] Добавлено ${newUsers.length} новых пользователей`)
        } else {
          // Заменяем весь список
          this.users = data
          console.log(`✅ [Store] Загружено ${data.length} пользователей`)
        }
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки пользователей по ID'
        console.error('❌ [Store] Ошибка loadUsersByIds:', e)
      } finally {
        this.loading = false
      }
    },

    /**
     * Получить пользователя по id
     * @param {string} id
     */
    async getUserById(id) {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchUserById(id)
        if (error) throw error
        return data
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки пользователя'
        return null
      } finally {
        this.loading = false
      }
    },

    /**
     * Добавить нового пользователя
     * @param {Object} user
     */
    async createUser(user) {
      this.loading = true
      this.error = null
      try {
        const { error } = await addUser(user)
        if (error) throw error
        await this.loadUsers()
      } catch (e) {
        this.error = e.message || 'Ошибка добавления пользователя'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Обновить пользователя
     * @param {string} id
     * @param {Object} updates
     */
    async updateUserById(id, updates) {
      this.loading = true
      this.error = null
      try {
        const { error } = await updateUser(id, updates)
        if (error) throw error
        await this.loadUsers()
      } catch (e) {
        this.error = e.message || 'Ошибка обновления пользователя'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Удалить пользователя
     * @param {string} id
     */
    async deleteUserById(id) {
      this.loading = true
      this.error = null
      try {
        const { error } = await deleteUser(id)
        if (error) throw error
        await this.loadUsers()
      } catch (e) {
        this.error = e.message || 'Ошибка удаления пользователя'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Сбросить ошибку
     */
    clearError() {
      this.error = null
    },
  },
}) 