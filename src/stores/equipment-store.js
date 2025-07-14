// equipment-store.js
// Pinia store для управления состоянием оборудования (equipments)
// Архитектурная роль: feature-sliced store, централизует CRUD-логику, фильтры, пагинацию и состояние для оборудования
// Используется на страницах и в компонентах, где требуется доступ к списку и операциям с оборудованием

import { defineStore } from 'pinia'
import { fetchEquipmentsPaged, addEquipment, updateEquipment, deleteEquipment } from '@/features/equipment/equipmentApi'
import { useAuthStore } from '@/stores/auth-store'

export const useEquipmentStore = defineStore('equipment', {
  state: () => ({
    equipments: [],      // Список оборудования
    loading: false,      // Флаг загрузки
    error: null,         // Текст ошибки (если есть)
    filters: {
      search: '',
      status: '',
      brand: '',
      category: '',
      subcategory: '',
      location: ''
    },
    page: 1,
    limit: 30,
    total: 0,
  }),

  getters: {
    // Пример: получить только активное оборудование
    activeEquipments(state) {
      return state.equipments.filter(e => e.status === 'active')
    },
  },

  actions: {
    /**
     * Загрузить список оборудования с учётом фильтров и пагинации
     */
    async loadEquipments() {
      this.loading = true
      this.error = null
      try {
        const { data, count, error } = await fetchEquipmentsPaged({
          page: this.page,
          limit: this.limit,
          search: this.filters.search,
          status: this.filters.status,
          brand: this.filters.brand,
          category: this.filters.category,
          subcategory: this.filters.subcategory,
          location: this.filters.location
        })
        if (error) throw error
        this.equipments = data
        this.total = count || 0
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки оборудования'
        this.equipments = []
      } finally {
        this.loading = false
      }
    },

    /**
     * Установить фильтр и перезагрузить список
     */
    setFilter(key, value) {
      this.filters[key] = value
      this.page = 1
      this.loadEquipments()
    },

    /**
     * Сменить страницу
     */
    setPage(newPage) {
      this.page = newPage
      this.loadEquipments()
    },

    /**
     * Установить лимит и перезагрузить список
     */
    setLimit(newLimit) {
      this.limit = newLimit
      this.page = 1
      this.loadEquipments()
    },

    /**
     * Добавить новое оборудование
     */
    async createEquipment(data) {
      this.loading = true
      this.error = null
      try {
        const result = await addEquipment(data)
        
        if (result.error) {
          this.error = result.error
          return { success: false, error: result.error }
        }
        
        // Перезагружаем список оборудования
        await this.loadEquipments()
        
        return { success: true, data: result.data }
      } catch (e) {
        const errorMessage = e.message || 'Ошибка добавления оборудования'
        this.error = errorMessage
        return { success: false, error: errorMessage }
      } finally {
        this.loading = false
      }
    },

    /**
     * Обновить оборудование
     */
    async updateEquipmentById(id, updates) {
      this.loading = true
      this.error = null
      try {
        const result = await updateEquipment(id, updates)
        if (result.error) {
          this.error = result.error
          return { success: false, error: result.error }
        }
        
        // Перезагружаем список оборудования
        await this.loadEquipments()
        
        return { success: true, data: result.data }
      } catch (e) {
        const errorMessage = e.message || 'Ошибка обновления оборудования'
        this.error = errorMessage
        return { success: false, error: errorMessage }
      } finally {
        this.loading = false
      }
    },

    /**
     * Удалить оборудование
     */
    async deleteEquipmentById(id) {
      this.loading = true
      this.error = null
      try {
        const { error } = await deleteEquipment(id)
        if (error) throw error
        await this.loadEquipments()
      } catch (e) {
        this.error = e.message || 'Ошибка удаления оборудования'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Проверка прав на редактирование/удаление (RBAC)
     */
    canEdit() {
      const authStore = useAuthStore()
      return ['video_engineer', 'technician', 'manager', 'admin'].includes(authStore.role)
    },
    canDelete() {
      const authStore = useAuthStore()
      return ['manager', 'admin'].includes(authStore.role)
    },

    /**
     * Сбросить ошибку
     */
    clearError() {
      this.error = null
    },
  },
}) 