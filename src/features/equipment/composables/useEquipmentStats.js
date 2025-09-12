/**
 * useEquipmentStats - EPR System
 * 
 * Composable для управления статистикой оборудования
 * Единый источник истины для всей статистики модуля
 * Использует UI Kit v2 принципы и error handling
 */

import { ref, computed } from 'vue'
import { equipmentApi } from '../api/equipment-api.js'
import { getEquipmentListsStats } from '../api/equipment-lists-api.js'

export function useEquipmentStats() {
  // ===== СОСТОЯНИЕ =====
  const stats = ref({
    equipment: {
      total: 0,
      categories: 8 // Статическое значение из констант
    },
    lists: {
      total: 0,
      linked: 0,
      free: 0
    }
  })

  const loading = ref(false)
  const error = ref(null)
  
  // Кеширование результатов
  const lastUpdated = ref(null)
  const cacheTimeout = 5 * 60 * 1000 // 5 минут

  // ===== ВЫЧИСЛЯЕМЫЕ СВОЙСТВА =====
  const isStale = computed(() => {
    if (!lastUpdated.value) return true
    return Date.now() - lastUpdated.value.getTime() > cacheTimeout
  })

  const hasData = computed(() => {
    return stats.value.equipment.total > 0 || stats.value.lists.total > 0
  })

  const equipmentStats = computed(() => stats.value.equipment)
  const listsStats = computed(() => stats.value.lists)

  // ===== МЕТОДЫ =====

  /**
   * Загрузить статистику оборудования
   */
  async function loadEquipmentStats() {
    try {
      console.log('📊 [Stats] Загрузка статистики оборудования...')
      
      const response = await equipmentApi.getEquipmentStats()
      
      stats.value.equipment = {
        total: response.total || 0,
        categories: 8 // Получаем из констант категорий
      }
      
      console.log('✅ [Stats] Статистика оборудования загружена:', stats.value.equipment)
      
    } catch (err) {
      console.error('❌ [Stats] Ошибка загрузки статистики оборудования:', err)
      throw new Error(`Ошибка загрузки статистики оборудования: ${err.message}`)
    }
  }

  /**
   * Загрузить статистику списков
   */
  async function loadListsStats() {
    try {
      console.log('📊 [Stats] Загрузка статистики списков...')
      
      const listsData = await getEquipmentListsStats()
      
      stats.value.lists = {
        total: listsData.total || 0,
        linked: listsData.linked || 0,
        free: listsData.free || 0
      }
      
      console.log('✅ [Stats] Статистика списков загружена:', stats.value.lists)
      
    } catch (err) {
      console.error('❌ [Stats] Ошибка загрузки статистики списков:', err)
      throw new Error(`Ошибка загрузки статистики списков: ${err.message}`)
    }
  }

  /**
   * Загрузить всю статистику
   * @param {boolean} force - Принудительно обновить кеш
   */
  async function loadStats(force = false) {
    // Проверяем кеш
    if (!force && !isStale.value && hasData.value) {
      console.log('📊 [Stats] Используем кешированные данные')
      return
    }

    loading.value = true
    error.value = null

    try {
      console.log('📊 [Stats] Загрузка полной статистики...')
      
      // Загружаем параллельно для оптимизации
      await Promise.all([
        loadEquipmentStats(),
        loadListsStats()
      ])

      lastUpdated.value = new Date()
      
      console.log('✅ [Stats] Вся статистика загружена:', {
        equipment: stats.value.equipment,
        lists: stats.value.lists,
        cached: lastUpdated.value
      })

    } catch (err) {
      error.value = err.message || 'Ошибка загрузки статистики'
      console.error('❌ [Stats] Критическая ошибка:', err)
      
      // Не очищаем существующие данные при ошибке
      // Пользователь увидит последние корректные данные
      
    } finally {
      loading.value = false
    }
  }

  /**
   * Сбросить кеш и перезагрузить
   */
  async function refreshStats() {
    console.log('🔄 [Stats] Принудительное обновление статистики')
    await loadStats(true)
  }

  /**
   * Очистить ошибки
   */
  function clearError() {
    error.value = null
  }

  /**
   * Сбросить все данные
   */
  function resetStats() {
    stats.value = {
      equipment: { total: 0, categories: 8 },
      lists: { total: 0, linked: 0, free: 0 }
    }
    lastUpdated.value = null
    error.value = null
  }

  // ===== ВОЗВРАЩАЕМОЕ API =====
  return {
    // Состояние
    stats,
    loading,
    error,
    lastUpdated,

    // Вычисляемые свойства
    isStale,
    hasData,
    equipmentStats,
    listsStats,

    // Методы
    loadStats,
    refreshStats,
    clearError,
    resetStats,

    // Частные методы для тестирования
    loadEquipmentStats,
    loadListsStats
  }
}
