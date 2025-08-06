/**
 * Equipment Store - EPR System
 * 
 * Управление состоянием оборудования
 * Использует Pinia и UI Kit v2 принципы
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { equipmentApi } from '../api/equipment-api.js'
import { getCategoryOptions, getSubcategoryOptions } from '../constants/categories.js'

export const useEquipmentStore = defineStore('equipment', () => {
  // State
  const equipments = ref([])
  const loading = ref(false)
  const error = ref(null)
  const total = ref(0)
  const currentPage = ref(1)
  const itemsPerPage = ref(30)
  const totalPages = ref(0)
  const hasMore = ref(false)
  const searchQuery = ref('')
  const filters = ref({
    type: null,        // Категория
    subtype: null,     // Подкатегория  
    status: null,      // Статус
    location: null     // Локация
  })
  
  // Состояние сортировки
  const sortBy = ref('created_at')
  const sortOrder = ref('desc')

  // Getters
  const hasData = computed(() => equipments.value.length > 0)
  const isEmpty = computed(() => !loading.value && !error.value && !hasData.value)
  
  // Категории и подкатегории
  const categoryOptions = computed(() => getCategoryOptions())
  const getSubcategoryOptionsMethod = (selectedCategory) => getSubcategoryOptions(selectedCategory)
  
  // ✅ Серверная пагинация, поиск и фильтры - данные приходят готовыми с сервера
  // equipments.value содержит уже отфильтрованные, найденные и пагинированные данные
  
  // Для обратной совместимости с компонентом (все операции теперь серверные)
  const filteredEquipments = computed(() => equipments.value)
  const paginatedEquipments = computed(() => equipments.value)

  // Helper Methods - убираем дублирование
  const resetPageAndReload = async () => {
    currentPage.value = 1
    await loadEquipments()
  }

  const reloadData = async () => {
    await loadEquipments()
  }

  // Actions
  const loadEquipments = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await equipmentApi.getEquipments({
        search: searchQuery.value,
        filters: filters.value,
        page: currentPage.value,
        limit: itemsPerPage.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      })
      
      equipments.value = response.data || []
      total.value = response.total || 0
      totalPages.value = response.pages || 0
      hasMore.value = response.hasMore || false
      
      console.log('✅ [Store] Серверный поиск + фильтры + сортировка + пагинация:', {
        search: response.search || 'нет поиска',
        filters: Object.keys(response.filters).length > 0 ? response.filters : 'нет фильтров',
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        page: response.page,
        total: response.total,
        pages: response.pages,
        loaded: response.data?.length
      })
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки оборудования'
      console.error('Equipment load error:', err)
    } finally {
      loading.value = false
    }
  }

  const createEquipment = async (equipmentData) => {
    loading.value = true
    error.value = null

    try {
      const response = await equipmentApi.createEquipment(equipmentData)
      equipments.value.push(response.data)
      total.value++
      return response.data
    } catch (err) {
      error.value = err.message || 'Ошибка создания оборудования'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateEquipment = async (id, equipmentData) => {
    loading.value = true
    error.value = null

    try {
      const response = await equipmentApi.updateEquipment(id, equipmentData)
      const index = equipments.value.findIndex(e => e.id === id)
      if (index !== -1) {
        equipments.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.message || 'Ошибка обновления оборудования'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteEquipment = async (id) => {
    loading.value = true
    error.value = null

    try {
      await equipmentApi.deleteEquipment(id)
      equipments.value = equipments.value.filter(e => e.id !== id)
      total.value--
    } catch (err) {
      error.value = err.message || 'Ошибка удаления оборудования'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setSearchQuery = async (query) => {
    searchQuery.value = query
    await resetPageAndReload() // ✅ Используем helper
  }

  const setFilters = async (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
    await resetPageAndReload() // ✅ Используем helper
  }

  const setPage = async (page) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
      await reloadData() // ✅ Используем helper (без сброса страницы)
    }
  }

  const setItemsPerPage = async (items) => {
    itemsPerPage.value = items
    await resetPageAndReload() // ✅ Используем helper
  }

  const clearError = () => {
    error.value = null
  }

  const clearFilters = async () => {
    filters.value = {}
    await resetPageAndReload() // ✅ Используем helper
  }

  const setSorting = async (field, order = null) => {
    console.log('🔄 [Store] setSorting called:', { field, order, currentSort: sortBy.value, currentOrder: sortOrder.value })
    
    // Если order не указан, используем циклическую логику переключения
    if (order === null) {
      if (sortBy.value === field) {
        // Если сортируем по тому же полю, циклически переключаем: asc -> desc -> none -> asc
        if (sortOrder.value === 'asc') {
          sortOrder.value = 'desc'
        } else if (sortOrder.value === 'desc') {
          // Сбрасываем сортировку
          sortBy.value = 'created_at'
          sortOrder.value = 'desc'
        } else {
          sortOrder.value = 'asc'
        }
      } else {
        // Если новое поле, начинаем с ascending
        sortBy.value = field
        sortOrder.value = 'asc'
      }
    } else {
      sortBy.value = field
      sortOrder.value = order
    }
    
    await resetPageAndReload() // ✅ Используем helper
    
    console.log('🔄 [Store] Серверная сортировка:', {
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    })
  }

  // Получение предложений для автокомплита
  const getSearchSuggestions = async (query) => {
    if (!query || query.length < 2) return []
    
    try {
      // Получаем уникальные значения брендов, моделей и серийных номеров
      const suggestions = await equipmentApi.getSearchSuggestions(query)
      
      // Форматируем для SearchInputV2 (убираем дублирующиеся описания)
      return suggestions.map(item => ({
        label: item.text,
        value: item.text,
        // Убираем description чтобы избежать дублирования
        description: item.type === 'brand' ? 'Бренд' : 
                    item.type === 'model' ? 'Модель' : 'Серийный номер',
        icon: item.type === 'brand' ? 'check-circle' : 
              item.type === 'model' ? 'package' : 'edit',
        // Убираем meta чтобы не дублировать информацию справа
        meta: ''
      }))
    } catch (error) {
      console.error('Ошибка получения автокомплита:', error)
      return []
    }
  }

  return {
    // State
    equipments,
    loading,
    error,
    total,
    currentPage,
    itemsPerPage,
    totalPages,
    hasMore,
    searchQuery,
    filters,
    sortBy,
    sortOrder,

    // Getters
    hasData,
    isEmpty,
    filteredEquipments,
    paginatedEquipments,
    categoryOptions,
    getSubcategoryOptions: getSubcategoryOptionsMethod,

    // Helper Methods
    resetPageAndReload,
    reloadData,

    // Actions
    loadEquipments,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    getSearchSuggestions,
    setSearchQuery,
    setFilters,
    setPage,
    setItemsPerPage,
    clearError,
    clearFilters,
    setSorting
  }
})