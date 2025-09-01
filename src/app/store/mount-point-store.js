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
} from '@/features/mount-points/api/mountPointApi'

export const useMountPointStore = defineStore('mountPoint', () => {
  // Состояния
  const mountPoints = ref([])
  const initialLoading = ref(false)    // Первичная загрузка - показывает скелетон
  const refreshing = ref(false)        // Обновление - показывает индикатор, НЕ скрывает данные
  const error = ref(null)
  const currentMountPoint = ref(null)
  
  // Computed для обратной совместимости (deprecated, но оставляем на время миграции)
  const loading = computed(() => initialLoading.value)

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
   * 🚀 BEST PRACTICES: Загрузить точки монтажа для определенного события
   * @param {string} eventId - ID события
   * @param {boolean} forceReload - принудительная перезагрузка (для автообновления)
   */
  async function loadMountPointsByEventId(eventId, forceReload = false) {
    const existingData = getMountPointsByEventId.value(eventId)
    
    // Если данные уже загружены и не требуется перезагрузка
    if (!forceReload && existingData.length > 0) {
      return { data: existingData, error: null }
    }

    // 🎯 ПРАВИЛЬНО: Разделяем initial loading от refreshing
    const isInitial = existingData.length === 0
    const loadingState = isInitial ? initialLoading : refreshing
    
    loadingState.value = true
    error.value = null

    try {
      console.log(isInitial ? '🆕 [Store] Первичная загрузка точек монтажа' : '🔄 [Store] Обновление точек монтажа')
      
      const { data, error: apiError } = await fetchMountPoints(eventId)
      
      if (apiError) {
        throw new Error(apiError.message || 'Ошибка загрузки точек монтажа')
      }

      // Обновляем store: удаляем старые данные для этого события и добавляем новые
      mountPoints.value = mountPoints.value.filter(mp => mp.event_id !== eventId)
      if (data && data.length > 0) {
        mountPoints.value.push(...data)
      }

      console.log(`✅ [Store] Загружено ${data?.length || 0} точек монтажа ${isInitial ? '(первичная)' : '(обновление)'}`)
      return { data: data || [], error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки точек монтажа'
      console.error(`❌ [Store] Ошибка загрузки точек монтажа:`, err)
      return { data: [], error: err.message }
    } finally {
      loadingState.value = false
    }
  }

  /**
   * 🚀 BEST PRACTICES: Загрузить конкретную точку монтажа по ID
   * @param {string} mountPointId - ID точки монтажа
   * @param {boolean} forceReload - принудительная перезагрузка (для автообновления)
   */
  async function loadMountPointById(mountPointId, forceReload = false) {
    const existingData = getMountPointById.value(mountPointId)
    
    // Проверяем кэш
    if (!forceReload && existingData) {
      currentMountPoint.value = existingData
      return { data: existingData, error: null }
    }

    // 🎯 ПРАВИЛЬНО: Разделяем initial loading от refreshing
    const isInitial = !existingData
    const loadingState = isInitial ? initialLoading : refreshing
    
    loadingState.value = true
    error.value = null

    try {
      console.log(isInitial ? '🆕 [Store] Первичная загрузка точки монтажа' : '🔄 [Store] Обновление точки монтажа')
      
      const data = await fetchMountPointById(mountPointId)
      
      // Обновляем кэш
      const existingIndex = mountPoints.value.findIndex(mp => mp.id === mountPointId)
      if (existingIndex >= 0) {
        mountPoints.value[existingIndex] = data
      } else {
        mountPoints.value.push(data)
      }

      currentMountPoint.value = data
      console.log(`✅ [Store] Точка монтажа загружена ${isInitial ? '(первичная)' : '(обновление)'}`)
      return { data, error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка загрузки точки монтажа'
      console.error('❌ [Store] Ошибка loadMountPointById:', err)
      return { data: null, error: err.message }
    } finally {
      loadingState.value = false
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
    // НЕ устанавливаем loading.value = true для избежания перерисовки всей страницы
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
      // Синхронизируем store - обновляем только technical_duties для минимизации реактивности
      const index = mountPoints.value.findIndex(mp => mp.id === mountPointId)
      if (index >= 0 && data && data[0]) {
        // Обновляем только technical_duties, а не весь объект
        mountPoints.value[index].technical_duties = data[0].technical_duties
        if (currentMountPoint.value?.id === mountPointId) {
          currentMountPoint.value.technical_duties = data[0].technical_duties
        }
      }
      return { data: data?.[0] || null, error: null }
    } catch (err) {
      error.value = err.message || 'Ошибка обновления статуса задания'
      console.error('❌ Ошибка updateTechnicalDutyStatus:', err)
      return { data: null, error: err.message }
    } finally {
      // НЕ сбрасываем loading.value, так как мы его не устанавливали
    }
  }

  /**
   * Добавить техническое задание к точке монтажа
   * @param {string} mountPointId
   * @param {{id?: string, title: string, description?: string, status?: 'в работе'|'выполнено'|'проблема'}} duty
   */
  async function addTechnicalDuty(mountPointId, duty) {
    loading.value = true
    error.value = null
    try {
      const mp = getMountPointById.value(mountPointId)
      if (!mp) throw new Error('Точка монтажа не найдена')
      const duties = Array.isArray(mp.technical_duties) ? [...mp.technical_duties] : []
      const newDuty = {
        id: duty?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        title: String(duty?.title || '').trim(),
        description: String(duty?.description || ''),
        status: duty?.status || 'в работе'
      }
      if (!newDuty.title) throw new Error('Название задания обязательно')
      duties.push(newDuty)
      const { data, error: apiError } = await updateMountPoint(mountPointId, { technical_duties: duties })
      if (apiError) throw new Error(apiError.message || 'Ошибка добавления задания')
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
      error.value = err.message || 'Ошибка добавления задания'
      console.error('❌ Ошибка addTechnicalDuty:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновить техническое задание
   * @param {string} mountPointId
   * @param {string} dutyId
   * @param {{title?: string, description?: string, status?: string}} updates
   */
  async function updateTechnicalDuty(mountPointId, dutyId, updates) {
    loading.value = true
    error.value = null
    try {
      const mp = getMountPointById.value(mountPointId)
      if (!mp) throw new Error('Точка монтажа не найдена')
      
      const duties = Array.isArray(mp.technical_duties) ? [...mp.technical_duties] : []
      const dutyIndex = duties.findIndex(d => d.id === dutyId)
      if (dutyIndex === -1) throw new Error('Техническое задание не найдено')
      
      // Обновляем задание
      duties[dutyIndex] = {
        ...duties[dutyIndex],
        ...updates,
        title: String(updates.title || duties[dutyIndex].title || '').trim(),
        description: String(updates.description || duties[dutyIndex].description || '').trim()
      }
      
      if (!duties[dutyIndex].title) throw new Error('Название задания обязательно')
      
      const { data, error: apiError } = await updateMountPoint(mountPointId, { technical_duties: duties })
      if (apiError) throw new Error(apiError.message || 'Ошибка обновления задания')
      
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
      error.value = err.message || 'Ошибка обновления задания'
      console.error('❌ Ошибка updateTechnicalDuty:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Удалить техническое задание
   * @param {string} mountPointId
   * @param {string} dutyId
   */
  async function deleteTechnicalDuty(mountPointId, dutyId) {
    loading.value = true
    error.value = null
    try {
      const mp = getMountPointById.value(mountPointId)
      if (!mp) throw new Error('Точка монтажа не найдена')
      
      const duties = Array.isArray(mp.technical_duties) ? [...mp.technical_duties] : []
      const dutyIndex = duties.findIndex(d => d.id === dutyId)
      if (dutyIndex === -1) throw new Error('Техническое задание не найдено')
      
      // Удаляем задание из массива
      duties.splice(dutyIndex, 1)
      
      const { data, error: apiError } = await updateMountPoint(mountPointId, { technical_duties: duties })
      if (apiError) throw new Error(apiError.message || 'Ошибка удаления задания')
      
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
      error.value = err.message || 'Ошибка удаления задания'
      console.error('❌ Ошибка deleteTechnicalDuty:', err)
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

    return {
    // Состояния (новые - правильные)
    mountPoints,
    initialLoading,
    refreshing,
    error,
    currentMountPoint,
    
    // Deprecated состояния (для обратной совместимости)
    loading, // computed: initialLoading

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
    updateTechnicalDutyStatus,
    addTechnicalDuty,
    updateTechnicalDuty,
    deleteTechnicalDuty
  }
}) 