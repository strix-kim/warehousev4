/**
 * Mount Point Store - управление состоянием точек монтажа
 * Использует Pinia для кэширования данных и централизованного управления
 * Интегрируется с Supabase API для CRUD операций
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  fetchMountPoints, 
  addMountPoint, 
  updateMountPoint, 
  deleteMountPoint,
  fetchMountPointById 
} from '@/features/mount-point/mountPointApi'

export const useMountPointStore = defineStore('mountPoint', () => {
  // Состояния
  const mountPoints = ref([])
  const loading = ref(false)
  const error = ref(null)
  const currentMountPoint = ref(null)

  // Геттеры
  const getMountPointsByEventId = computed(() => {
    return (eventId) => mountPoints.value.filter(mp => String(mp.event_id) === String(eventId))
  })

  const getMountPointById = computed(() => {
    return (id) => mountPoints.value.find(mp => mp.id === id)
  })

  const getMountPointsCount = computed(() => {
    return (eventId) => getMountPointsByEventId.value(eventId).length
  })

  // Действия
  
  /**
   * Загрузить точки монтажа для определенного события
   * @param {string} eventId - ID события
   * @param {boolean} forceReload - принудительная перезагрузка
   */
  async function loadMountPointsByEventId(eventId, forceReload = false) {
    // Если данные уже загружены и не требуется перезагрузка
    if (!forceReload && getMountPointsByEventId.value(eventId).length > 0) {
      return { data: getMountPointsByEventId.value(eventId), error: null }
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await fetchMountPoints(eventId)
      
      if (apiError) {
        throw new Error(apiError.message || 'Ошибка загрузки точек монтажа')
      }

      // Обновляем store: удаляем старые данные для этого события и добавляем новые
      mountPoints.value = mountPoints.value.filter(mp => mp.event_id !== eventId)
      if (data && data.length > 0) {
        mountPoints.value.push(...data)
      }

      return { data: data || [], error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки точек монтажа'
      console.error('❌ Ошибка loadMountPointsByEventId:', err)
      return { data: [], error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Загрузить конкретную точку монтажа по ID
   * @param {string} mountPointId - ID точки монтажа
   * @param {boolean} forceReload - принудительная перезагрузка
   */
  async function loadMountPointById(mountPointId, forceReload = false) {
    // Проверяем кэш
    if (!forceReload) {
      const cached = getMountPointById.value(mountPointId)
      if (cached) {
        currentMountPoint.value = cached
        return { data: cached, error: null }
      }
    }

    loading.value = true
    error.value = null

    try {
      const data = await fetchMountPointById(mountPointId)
      
      // Обновляем кэш
      const existingIndex = mountPoints.value.findIndex(mp => mp.id === mountPointId)
      if (existingIndex >= 0) {
        mountPoints.value[existingIndex] = data
      } else {
        mountPoints.value.push(data)
      }

      currentMountPoint.value = data
      return { data, error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки точки монтажа'
      console.error('❌ Ошибка loadMountPointById:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Создать новую точку монтажа
   * @param {Object} mountPointData - данные точки монтажа
   */
  async function createMountPoint(mountPointData) {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await addMountPoint(mountPointData)
      
      if (apiError) {
        throw new Error(apiError.message || 'Ошибка создания точки монтажа')
      }

      // Добавляем в store
      if (data && data[0]) {
        mountPoints.value.push(data[0])
        currentMountPoint.value = data[0]
      }

      return { data: data?.[0] || null, error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка создания точки монтажа'
      console.error('❌ Ошибка createMountPoint:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновить точку монтажа
   * @param {string} mountPointId - ID точки монтажа
   * @param {Object} updates - обновляемые данные
   */
  async function editMountPoint(mountPointId, updates) {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await updateMountPoint(mountPointId, updates)
      
      if (apiError) {
        throw new Error(apiError.message || 'Ошибка обновления точки монтажа')
      }

      // Обновляем в store
      const index = mountPoints.value.findIndex(mp => mp.id === mountPointId)
      if (index >= 0 && data && data[0]) {
        mountPoints.value[index] = data[0]
        if (currentMountPoint.value?.id === mountPointId) {
          currentMountPoint.value = data[0]
        }
      }

      return { data: data?.[0] || null, error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка обновления точки монтажа'
      console.error('❌ Ошибка editMountPoint:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Удалить точку монтажа
   * @param {string} mountPointId - ID точки монтажа
   */
  async function removeMountPoint(mountPointId) {
    loading.value = true
    error.value = null

    try {
      const { error: apiError } = await deleteMountPoint(mountPointId)
      
      if (apiError) {
        throw new Error(apiError.message || 'Ошибка удаления точки монтажа')
      }

      // Удаляем из store
      mountPoints.value = mountPoints.value.filter(mp => mp.id !== mountPointId)
      if (currentMountPoint.value?.id === mountPointId) {
        currentMountPoint.value = null
      }

      return { error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка удаления точки монтажа'
      console.error('❌ Ошибка removeMountPoint:', err)
      return { error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Очистить store (например, при выходе пользователя)
   */
  function clearStore() {
    mountPoints.value = []
    currentMountPoint.value = null
    error.value = null
    loading.value = false
  }

  /**
   * Очистить ошибки
   */
  function clearError() {
    error.value = null
  }

  /**
   * Обновить статус технического задания
   * @param {string} mountPointId - ID точки монтажа
   * @param {string} dutyId - ID технического задания
   * @param {string} newStatus - Новый статус ('в работе', 'выполнено', 'проблема')
   */
  async function updateTechnicalDutyStatus(mountPointId, dutyId, newStatus) {
    loading.value = true
    error.value = null
    try {
      // Находим точку монтажа
      const mountPoint = getMountPointById.value(mountPointId)
      if (!mountPoint) throw new Error('Точка монтажа не найдена')
      // Копируем массив заданий
      const duties = Array.isArray(mountPoint.technical_duties)
        ? [...mountPoint.technical_duties]
        : []
      const idx = duties.findIndex(d => d.id === dutyId)
      if (idx === -1) throw new Error('Задание не найдено')
      duties[idx] = { ...duties[idx], status: newStatus }
      // Обновляем через API
      const { data, error: apiError } = await updateMountPoint(mountPointId, { technical_duties: duties })
      if (apiError) throw new Error(apiError.message || 'Ошибка обновления статуса задания')
      // Синхронизируем store
      const index = mountPoints.value.findIndex(mp => mp.id === mountPointId)
      if (index >= 0 && data && data[0]) {
        mountPoints.value[index] = data[0]
        if (currentMountPoint.value?.id === mountPointId) {
          currentMountPoint.value = data[0]
        }
      }
      return { data: data?.[0] || null, error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка обновления статуса задания'
      console.error('❌ Ошибка updateTechnicalDutyStatus:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  return {
    // Состояния
    mountPoints,
    loading,
    error,
    currentMountPoint,
    
    // Геттеры
    getMountPointsByEventId,
    getMountPointById,
    getMountPointsCount,
    
    // Действия
    loadMountPointsByEventId,
    loadMountPointById,
    createMountPoint,
    editMountPoint,
    removeMountPoint,
    clearStore,
    clearError,
    updateTechnicalDutyStatus
  }
}) 