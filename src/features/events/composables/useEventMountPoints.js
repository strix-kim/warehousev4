// useEventMountPoints.js
// Оркестратор для работы с точками монтажа внутри контекста события
// Предоставляет: загрузку, создание, обновление и удаление точек монтажа,
// а также реактивный список и статусы загрузки/ошибок.
// Использует публичный API модуля mount-points, не обращаясь к его внутренностям.

import { ref, watch, onMounted } from 'vue'
import {
  fetchMountPoints,
  addMountPoint,
  updateMountPoint,
  deleteMountPoint
} from '@/features/mount-points'

/**
 * useEventMountPoints — управляет точками монтажа, связанными с конкретным мероприятием
 * @param {import('vue').Ref<string>|string} eventIdRef — ID мероприятия (reactive или примитив)
 */
export function useEventMountPoints(eventIdRef) {
  // Состояние
  const mountPoints = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Внутренняя проверка наличия eventId
   * @returns {string|null}
   */
  const getEventId = () => {
    return typeof eventIdRef === 'object' && 'value' in eventIdRef ? eventIdRef.value : eventIdRef
  }

  /**
   * Загрузка точек монтажа для текущего события
   */
  const loadMountPoints = async () => {
    const eventId = getEventId()
    if (!eventId) return

    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await fetchMountPoints(eventId)
      if (apiError) throw apiError
      mountPoints.value = data
    } catch (err) {
      console.error('❌ useEventMountPoints.loadMountPoints:', err)
      error.value = err.message || 'Ошибка загрузки точек монтажа'
      mountPoints.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Создать точку монтажа и обновить локальный список
   * @param {Object} mpData — данные точки монтажа (без event_id)
   */
  const createMountPoint = async (mpData) => {
    const eventId = getEventId()
    if (!eventId) throw new Error('Event ID отсутствует')

    try {
      const { data, error: apiError } = await addMountPoint({ ...mpData, event_id: eventId })
      if (apiError) throw apiError
      // API возвращает массив с одним объектом
      const created = Array.isArray(data) ? data[0] : data
      mountPoints.value.push(created)
      return created
    } catch (err) {
      console.error('❌ useEventMountPoints.createMountPoint:', err)
      throw err
    }
  }

  /**
   * Обновить точку монтажа локально и в БД
   * @param {string} id — ID точки монтажа
   * @param {Object} updates — обновляемые поля
   */
  const updateMountPointItem = async (id, updates) => {
    try {
      const { data, error: apiError } = await updateMountPoint(id, updates)
      if (apiError) throw apiError
      const updated = Array.isArray(data) ? data[0] : data
      // Обновляем локальный список
      const idx = mountPoints.value.findIndex(mp => mp.id === id)
      if (idx !== -1) mountPoints.value[idx] = updated
      return updated
    } catch (err) {
      console.error('❌ useEventMountPoints.updateMountPointItem:', err)
      throw err
    }
  }

  /**
   * Удалить точку монтажа из БД и из локального списка
   * @param {string} id – ID точки монтажа
   */
  const removeMountPoint = async (id) => {
    try {
      const { error: apiError } = await deleteMountPoint(id)
      if (apiError) throw apiError
      mountPoints.value = mountPoints.value.filter(mp => mp.id !== id)
    } catch (err) {
      console.error('❌ useEventMountPoints.removeMountPoint:', err)
      throw err
    }
  }

  // Автозагрузка при монтировании
  onMounted(() => {
    if (getEventId()) loadMountPoints()
  })

  // Следим за изменениями eventId (если передан as ref)
  watch(
    () => getEventId(),
    (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        loadMountPoints()
      }
    }
  )

  return {
    mountPoints,
    loading,
    error,
    loadMountPoints,
    createMountPoint,
    updateMountPointItem,
    removeMountPoint
  }
}
