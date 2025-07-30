/**
 * Store для управления списками оборудования
 * Централизованное управление состоянием списков
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchEquipmentLists,
  fetchEquipmentListById,
  createEquipmentList,
  updateEquipmentList,
  deleteEquipmentList,
  archiveEquipmentList,
  getEventListsStats,
  createSecurityList
} from '@/features/equipment-lists/equipmentListsApi'

export const useEquipmentListsStore = defineStore('equipmentLists', () => {
  // Состояние
  const lists = ref([])
  const currentList = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const stats = ref(null)

  // Геттеры
  const getListsByType = computed(() => (type) => {
    return lists.value.filter(list => list.type === type)
  })

  const getListsByEvent = computed(() => (eventId) => {
    return lists.value.filter(list => list.event_id === eventId)
  })

  const getActiveLists = computed(() => {
    return lists.value.filter(list => !list.is_archived)
  })

  const getArchivedLists = computed(() => {
    return lists.value.filter(list => list.is_archived)
  })

  const getListById = computed(() => (id) => {
    return lists.value.find(list => list.id === id)
  })

  // Действия
  const loadLists = async (filters = {}) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await fetchEquipmentLists(filters)
      if (apiError) throw apiError
      
      lists.value = data || []
    } catch (err) {
      error.value = err.message
      console.error('Ошибка загрузки списков:', err)
    } finally {
      loading.value = false
    }
  }

  const loadListById = async (id) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await fetchEquipmentListById(id)
      if (apiError) throw apiError
      
      currentList.value = data
      return data
    } catch (err) {
      error.value = err.message
      console.error('Ошибка загрузки списка:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const createList = async (listData) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await createEquipmentList(listData)
      if (apiError) throw apiError
      
      lists.value.unshift(data)
      return data
    } catch (err) {
      error.value = err.message
      console.error('Ошибка создания списка:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const updateList = async (id, updates) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await updateEquipmentList(id, updates)
      if (apiError) throw apiError
      
      // Обновляем в локальном состоянии
      const index = lists.value.findIndex(list => list.id === id)
      if (index !== -1) {
        lists.value[index] = data
      }
      
      if (currentList.value?.id === id) {
        currentList.value = data
      }
      
      return data
    } catch (err) {
      error.value = err.message
      console.error('Ошибка обновления списка:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const deleteList = async (id) => {
    loading.value = true
    error.value = null

    try {
      const { error: apiError } = await deleteEquipmentList(id)
      if (apiError) throw apiError
      
      // Удаляем из локального состояния
      lists.value = lists.value.filter(list => list.id !== id)
      
      if (currentList.value?.id === id) {
        currentList.value = null
      }
      
      return true
    } catch (err) {
      error.value = err.message
      console.error('Ошибка удаления списка:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  const archiveList = async (id) => {
    return updateList(id, { is_archived: true })
  }

  const loadEventStats = async (eventId) => {
    try {
      const { data, error: apiError } = await getEventListsStats(eventId)
      if (apiError) throw apiError
      
      stats.value = data
      return data
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err)
      return null
    }
  }

  const generateSecurityList = async (eventId, name = null) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await createSecurityList(eventId, name)
      if (apiError) {
        console.error('API Error:', apiError)
        throw new Error(apiError.message || 'Ошибка создания списка охраны')
      }
      
      if (data) {
        lists.value.unshift(data)
        return data
      } else {
        throw new Error('Не удалось создать список охраны')
      }
    } catch (err) {
      error.value = err.message
      console.error('Ошибка создания списка охраны:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const clearCurrentList = () => {
    currentList.value = null
  }

  return {
    // Состояние
    lists,
    currentList,
    loading,
    error,
    stats,
    
    // Геттеры
    getListsByType,
    getListsByEvent,
    getActiveLists,
    getArchivedLists,
    getListById,
    
    // Действия
    loadLists,
    loadListById,
    createList,
    updateList,
    deleteList,
    archiveList,
    loadEventStats,
    generateSecurityList,
    clearError,
    clearCurrentList
  }
}) 