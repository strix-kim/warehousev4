/**
 * Equipment Lists Store - управление состоянием списков оборудования для мероприятий
 * Использует Pinia для кэширования данных и централизованного управления
 * Интегрируется с Supabase API для CRUD операций
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchEquipmentListsByEventId,
  fetchEquipmentListById,
  createEquipmentList,
  updateEquipmentList,
  deleteEquipmentList
} from '../api/equipment-lists-api'

export const useEquipmentListsStore = defineStore('equipmentLists', () => {
  // Состояния
  const equipmentLists = ref([])
  const loading = ref(false)
  const error = ref(null)
  const currentList = ref(null)

  // Геттеры
  const getEquipmentListsByEventId = computed(() => {
    return (eventId) => equipmentLists.value.filter(list => String(list.event_id) === String(eventId))
  })

  const getEquipmentListById = computed(() => {
    return (listId) => equipmentLists.value.find(list => list.id === listId)
  })

  const getEquipmentListsCount = computed(() => {
    return (eventId) => getEquipmentListsByEventId.value(eventId).length
  })

  // Действия

  /**
   * Загрузить списки оборудования для определенного мероприятия
   * @param {string} eventId - ID мероприятия
   * @param {boolean} forceReload - принудительная перезагрузка
   */
  async function loadEquipmentListsByEventId(eventId, forceReload = false) {
    // Если данные уже загружены и не требуется перезагрузка
    if (!forceReload && getEquipmentListsByEventId.value(eventId).length > 0) {
      return { data: getEquipmentListsByEventId.value(eventId), error: null }
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await fetchEquipmentListsByEventId(eventId)
      
      if (apiError) {
        throw new Error(apiError)
      }

      // Обновляем store: удаляем старые данные для этого мероприятия и добавляем новые
      equipmentLists.value = equipmentLists.value.filter(list => list.event_id !== eventId)
      if (data && data.length > 0) {
        equipmentLists.value.push(...data)
      }

      console.log('✅ [Store] Списки оборудования загружены для мероприятия:', eventId, data?.length || 0)
      return { data: data || [], error: null }

    } catch (err) {
      error.value = err.message || 'Ошибка загрузки списков оборудования'
      console.error('❌ [Store] Ошибка loadEquipmentListsByEventId:', err)
      return { data: [], error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Загрузить конкретный список оборудования по ID
   * @param {string} listId - ID списка оборудования
   * @param {boolean} forceReload - принудительная перезагрузка
   */
  async function loadEquipmentListById(listId, forceReload = false) {
    // Проверяем кэш
    const cachedList = getEquipmentListById.value(listId)
    if (!forceReload && cachedList) {
      currentList.value = cachedList
      return { data: cachedList, error: null }
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await fetchEquipmentListById(listId)
      
      if (apiError) {
        throw new Error(apiError)
      }

      if (data) {
        // Обновляем кэш
        const existingIndex = equipmentLists.value.findIndex(list => list.id === listId)
        if (existingIndex >= 0) {
          equipmentLists.value[existingIndex] = data
        } else {
          equipmentLists.value.push(data)
        }
        currentList.value = data
      }

      console.log('✅ [Store] Список оборудования загружен:', listId)
      return { data, error: null }

    } catch (err) {
      error.value = err.message || 'Ошибка загрузки списка оборудования'
      console.error('❌ [Store] Ошибка loadEquipmentListById:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Создать новый список оборудования
   * @param {Object} listData - данные списка
   */
  async function createList(listData) {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await createEquipmentList(listData)
      
      if (apiError) {
        throw new Error(apiError)
      }

      if (data) {
        // Добавляем в кэш
        equipmentLists.value.push(data)
      }

      console.log('✅ [Store] Список оборудования создан:', data?.id)
      return { data, error: null }

    } catch (err) {
      error.value = err.message || 'Ошибка создания списка оборудования'
      console.error('❌ [Store] Ошибка createList:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновить список оборудования
   * @param {string} listId - ID списка
   * @param {Object} updateData - данные для обновления
   */
  async function updateList(listId, updateData) {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await updateEquipmentList(listId, updateData)
      
      if (apiError) {
        throw new Error(apiError)
      }

      if (data) {
        // Обновляем кэш
        const existingIndex = equipmentLists.value.findIndex(list => list.id === listId)
        if (existingIndex >= 0) {
          equipmentLists.value[existingIndex] = data
        }
        
        if (currentList.value?.id === listId) {
          currentList.value = data
        }
      }

      console.log('✅ [Store] Список оборудования обновлен:', listId)
      return { data, error: null }

    } catch (err) {
      error.value = err.message || 'Ошибка обновления списка оборудования'
      console.error('❌ [Store] Ошибка updateList:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Удалить список оборудования
   * @param {string} listId - ID списка
   */
  async function deleteList(listId) {
    loading.value = true
    error.value = null

    try {
      const { success, error: apiError } = await deleteEquipmentList(listId)
      
      if (apiError) {
        throw new Error(apiError)
      }

      if (success) {
        // Удаляем из кэша
        equipmentLists.value = equipmentLists.value.filter(list => list.id !== listId)
        
        if (currentList.value?.id === listId) {
          currentList.value = null
        }
      }

      console.log('✅ [Store] Список оборудования удален:', listId)
      return { success, error: null }

    } catch (err) {
      error.value = err.message || 'Ошибка удаления списка оборудования'
      console.error('❌ [Store] Ошибка deleteList:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Очистить кэш
   */
  function clearCache() {
    equipmentLists.value = []
    currentList.value = null
    error.value = null
  }

  return {
    // Состояния
    equipmentLists,
    loading,
    error,
    currentList,
    
    // Геттеры
    getEquipmentListsByEventId,
    getEquipmentListById,
    getEquipmentListsCount,
    
    // Действия
    loadEquipmentListsByEventId,
    loadEquipmentListById,
    createList,
    updateList,
    deleteList,
    clearCache
  }
})
