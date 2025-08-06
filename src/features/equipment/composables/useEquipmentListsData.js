/**
 * useEquipmentListsData.js
 * САМОДОСТАТОЧНЫЙ composable для управления данными списков оборудования
 * Содержит ВСЕ необходимое для независимой работы equipment модуля
 * 
 * АРХИТЕКТУРНАЯ ЦЕЛЬ: Возможность поставки equipment модуля отдельно от других
 */

import { ref, computed } from 'vue'
import { 
  loadEventsForEquipmentLists, 
  loadMountPointsForEquipmentLists,
  formatEventsForEquipmentSelect,
  formatMountPointsForEquipmentSelect,
  getEventNameForEquipment,
  getMountPointNameForEquipment
} from '@/features/equipment/api/equipment-external-data-api'

export function useEquipmentListsData() {
  // ===== СОСТОЯНИЯ =====
  const events = ref([])
  const mountPoints = ref([])
  
  const eventsLoading = ref(false)
  const mountPointsLoading = ref(false)
  
  const eventsError = ref(null)
  const mountPointsError = ref(null)

  // ===== ОПЦИИ ДЛЯ СЕЛЕКТОВ =====
  const eventOptions = computed(() => {
    return formatEventsForEquipmentSelect(events.value)
  })

  const mountPointOptions = computed(() => {
    return formatMountPointsForEquipmentSelect(mountPoints.value)
  })

  // ===== МЕТОДЫ ЗАГРУЗКИ =====
  
  /**
   * Загрузить список активных мероприятий
   */
  async function loadEvents() {
    eventsLoading.value = true
    eventsError.value = null
    
    try {
      const { data, error } = await loadEventsForEquipmentLists()
      
      if (error) {
        throw new Error(error)
      }
      
      events.value = data
      console.log(`✅ Equipment: Загружено ${events.value.length} мероприятий для списков`)
    } catch (err) {
      console.error('❌ Ошибка загрузки мероприятий:', err)
      eventsError.value = err.message
      events.value = []
    } finally {
      eventsLoading.value = false
    }
  }

  /**
   * Загрузить точки монтажа для выбранного мероприятия
   * @param {string} eventId - ID мероприятия
   */
  async function loadMountPoints(eventId) {
    mountPointsLoading.value = true
    mountPointsError.value = null
    
    try {
      const { data, error } = await loadMountPointsForEquipmentLists(eventId)
      
      if (error) {
        throw new Error(error)
      }
      
      mountPoints.value = data
      console.log(`✅ Equipment: Загружено ${mountPoints.value.length} точек монтажа для события ${eventId}`)
    } catch (err) {
      console.error('❌ Ошибка загрузки точек монтажа:', err)
      mountPointsError.value = err.message
      mountPoints.value = []
    } finally {
      mountPointsLoading.value = false
    }
  }

  /**
   * Очистить точки монтажа (при смене мероприятия)
   */
  function clearMountPoints() {
    mountPoints.value = []
    mountPointsError.value = null
  }

  /**
   * Получить название мероприятия по ID
   * @param {string} eventId - ID мероприятия
   * @returns {string} название мероприятия
   */
  function getEventName(eventId) {
    return getEventNameForEquipment(events.value, eventId)
  }

  /**
   * Получить название точки монтажа по ID
   * @param {string} mountPointId - ID точки монтажа
   * @returns {string} название точки монтажа
   */
  function getMountPointName(mountPointId) {
    return getMountPointNameForEquipment(mountPoints.value, mountPointId)
  }

  // ===== АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ =====
  
  /**
   * Инициализировать загрузку данных
   */
  async function initialize() {
    await loadEvents()
  }

  return {
    // Состояния
    events,
    mountPoints,
    eventsLoading,
    mountPointsLoading,
    eventsError,
    mountPointsError,
    
    // Опции для селектов
    eventOptions,
    mountPointOptions,
    
    // Методы
    loadEvents,
    loadMountPoints,
    clearMountPoints,
    getEventName,
    getMountPointName,
    initialize
  }
}