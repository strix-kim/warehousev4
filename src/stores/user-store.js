// user-store.js
// Pinia store для управления состоянием пользователей (users)
// Архитектурная роль: feature-sliced store, централизует CRUD-логику и состояние для пользователей
// Используется на страницах и в компонентах, где требуется доступ к списку и операциям с пользователями

import { defineStore } from 'pinia'
import {
  fetchUsers,
  fetchUserById,
  addUser,
  updateUser,
  deleteUser
} from '@/features/users/userApi'

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