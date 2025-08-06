/**
 * useEquipmentReservation - Composable для управления резервированием оборудования
 * 
 * Обеспечивает проверку конфликтов, визуальную индикацию и блокировку
 * зарезервированного оборудования при создании/редактировании списков
 */

import { ref, computed, watch } from 'vue'
import { getEventEquipmentConflicts } from '@/features/equipment/api/equipment-lists-api'

export function useEquipmentReservation() {
  // ===== STATE =====
  const currentEventId = ref(null)
  const currentListId = ref(null) // Для исключения при редактировании
  const conflictInfo = ref({})
  const conflictsLoading = ref(false)
  const conflictsError = ref(null)

  // ===== COMPUTED =====
  const hasConflicts = computed(() => {
    return Object.keys(conflictInfo.value).length > 0
  })

  const conflictedEquipmentCount = computed(() => {
    return Object.keys(conflictInfo.value).length
  })

  const conflictStats = computed(() => {
    const conflicts = conflictInfo.value
    const stats = {}
    
    // Группируем по спискам
    Object.values(conflicts).forEach(conflict => {
      const listKey = `${conflict.listId}`
      if (!stats[listKey]) {
        stats[listKey] = {
          listName: conflict.listName,
          mountPointName: conflict.mountPointName,
          equipmentCount: 0
        }
      }
      stats[listKey].equipmentCount++
    })
    
    return Object.values(stats)
  })

  // ===== METHODS =====

  /**
   * Установить мероприятие для проверки конфликтов
   */
  const setEvent = (eventId, listId = null) => {
    console.log('🎯 [Reservation] Устанавливаем мероприятие:', { eventId, listId })
    currentEventId.value = eventId
    currentListId.value = listId
  }

  /**
   * Загрузить информацию о конфликтах для текущего мероприятия
   */
  const loadConflicts = async () => {
    if (!currentEventId.value) {
      console.log('⚠️ [Reservation] Нет мероприятия для проверки конфликтов')
      conflictInfo.value = {}
      return
    }

    conflictsLoading.value = true
    conflictsError.value = null

    try {
      console.log('🔍 [Reservation] Загружаем конфликты для мероприятия:', currentEventId.value)
      
      const conflicts = await getEventEquipmentConflicts(
        currentEventId.value, 
        currentListId.value
      )
      
      conflictInfo.value = conflicts
      
      console.log('✅ [Reservation] Конфликты загружены:', {
        conflictedEquipment: Object.keys(conflicts).length,
        eventId: currentEventId.value
      })

    } catch (error) {
      console.error('❌ [Reservation] Ошибка загрузки конфликтов:', error)
      conflictsError.value = error.message
      conflictInfo.value = {}
    } finally {
      conflictsLoading.value = false
    }
  }

  /**
   * Проверить конфликты для конкретного оборудования
   */
  const isEquipmentConflicted = (equipmentId) => {
    return !!conflictInfo.value[equipmentId]
  }

  /**
   * Получить информацию о конфликте для оборудования
   */
  const getEquipmentConflictInfo = (equipmentId) => {
    return conflictInfo.value[equipmentId] || null
  }

  /**
   * Отфильтровать список оборудования, убрав конфликтные элементы
   */
  const filterNonConflictedEquipment = (equipmentList) => {
    return equipmentList.filter(equipment => 
      !isEquipmentConflicted(equipment.id)
    )
  }

  /**
   * Получить список доступного для выбора оборудования
   */
  const getAvailableEquipmentIds = (allEquipmentIds) => {
    return allEquipmentIds.filter(id => !isEquipmentConflicted(id))
  }

  /**
   * Проверить можно ли добавить оборудование в список
   */
  const canAddEquipment = (equipmentId) => {
    return !isEquipmentConflicted(equipmentId)
  }

  /**
   * Получить сообщение о конфликте для пользователя
   */
  const getConflictMessage = (equipmentId) => {
    const conflict = getEquipmentConflictInfo(equipmentId)
    if (!conflict) return null

    return `Оборудование зарезервировано списком "${conflict.listName}" для точки монтажа "${conflict.mountPointName}"`
  }

  /**
   * Очистить данные о конфликтах
   */
  const clearConflicts = () => {
    console.log('🧹 [Reservation] Очищаем данные о конфликтах')
    conflictInfo.value = {}
    conflictsError.value = null
    currentEventId.value = null
    currentListId.value = null
  }

  // ===== WATCHERS =====

  // Автоматически загружаем конфликты при изменении мероприятия
  watch(currentEventId, (newEventId) => {
    if (newEventId) {
      loadConflicts()
    } else {
      clearConflicts()
    }
  })

  // ===== RETURN =====
  return {
    // State
    currentEventId,
    currentListId,
    conflictInfo,
    conflictsLoading,
    conflictsError,

    // Computed
    hasConflicts,
    conflictedEquipmentCount,
    conflictStats,

    // Methods
    setEvent,
    loadConflicts,
    isEquipmentConflicted,
    getEquipmentConflictInfo,
    filterNonConflictedEquipment,
    getAvailableEquipmentIds,
    canAddEquipment,
    getConflictMessage,
    clearConflicts
  }
}