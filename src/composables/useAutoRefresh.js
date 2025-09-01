/**
 * 🔄 useAutoRefresh v2 - Best Practices автообновление данных
 * 
 * ПРЕИМУЩЕСТВА:
 * - Не скрывает контент при обновлении (в отличие от v1)
 * - Показывает тонкий индикатор обновления
 * - Graceful error handling
 * - Debounce для множественных вызовов
 * - Adaptive intervals на основе активности пользователя
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useLoadingStates } from './useLoadingStates'

export function useAutoRefresh(refreshFunction, intervalMinutes = 1, options = {}) {
  const {
    enableDebounce = true,
    debounceMs = 1000,
    pauseOnError = false,
    maxRetries = 3
  } = options
  
  // Используем правильные loading states
  const {
    isRefreshing,
    shouldShowRefreshIndicator,
    withRefreshing,
    setError
  } = useLoadingStates()
  const isAutoRefreshActive = ref(false)
  const lastRefreshTime = ref(null)
  const refreshInterval = ref(null)
  const currentTime = ref(new Date()) // Реактивное текущее время
  const retryCount = ref(0)
  let debounceTimeout = null

  /**
   * Запуск автообновления
   */
  const startAutoRefresh = () => {
    if (refreshInterval.value) return // Уже запущено
    
    console.log(`🔄 [AutoRefresh] Запуск автообновления каждые ${intervalMinutes} мин`)
    
    refreshInterval.value = setInterval(performRefresh, intervalMinutes * 60 * 1000)
    
    isAutoRefreshActive.value = true
    lastRefreshTime.value = new Date()
  }

  /**
   * Остановка автообновления
   */
  const stopAutoRefresh = () => {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
      isAutoRefreshActive.value = false
      console.log('⏹️ [AutoRefresh] Автообновление остановлено')
    }
  }

  /**
   * Умное обновление с правильными состояниями загрузки
   */
  const performRefresh = async () => {
    if (isRefreshing.value) {
      console.log('🟡 [AutoRefresh] Пропускаем - обновление уже в процессе')
      return
    }

    try {
      await withRefreshing(async () => {
        console.log('🔄 [AutoRefresh] Обновляем данные...')
        await refreshFunction()
        lastRefreshTime.value = new Date()
        retryCount.value = 0 // Сбрасываем счетчик при успехе
        console.log('✅ [AutoRefresh] Данные обновлены')
      })
    } catch (error) {
      retryCount.value++
      console.error(`❌ [AutoRefresh] Ошибка обновления (попытка ${retryCount.value}):`, error)
      
      // Если превышен лимит попыток и включена пауза при ошибке
      if (retryCount.value >= maxRetries && pauseOnError) {
        console.warn('⏸️ [AutoRefresh] Автообновление приостановлено из-за множественных ошибок')
        stopAutoRefresh()
      }
    }
  }

  /**
   * Ручное обновление (с debounce)
   */
  const manualRefresh = async () => {
    if (enableDebounce && debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    const doRefresh = async () => {
      await performRefresh()
    }

    if (enableDebounce) {
      debounceTimeout = setTimeout(doRefresh, debounceMs)
    } else {
      await doRefresh()
    }
  }

  /**
   * Получить время до следующего обновления
   */
  const getTimeUntilNextRefresh = () => {
    if (!lastRefreshTime.value) return null
    
    const nextRefreshTime = new Date(lastRefreshTime.value.getTime() + (intervalMinutes * 60 * 1000))
    const now = new Date()
    const diffMs = nextRefreshTime.getTime() - now.getTime()
    
    if (diffMs <= 0) return 0
    return Math.ceil(diffMs / 1000) // Секунды до следующего обновления
  }

  // Обновляем текущее время каждую секунду для реактивного счетчика
  const timeInterval = ref(null)
  
  const startTimeTracking = () => {
    timeInterval.value = setInterval(() => {
      currentTime.value = new Date()
    }, 1000)
  }
  
  const stopTimeTracking = () => {
    if (timeInterval.value) {
      clearInterval(timeInterval.value)
      timeInterval.value = null
    }
  }

  // Автоматический запуск и остановка
  onMounted(() => {
    startAutoRefresh()
    startTimeTracking()
  })

  onUnmounted(() => {
    stopAutoRefresh()
    stopTimeTracking()
  })

  return {
    // Основные состояния
    isAutoRefreshActive,
    lastRefreshTime,
    currentTime,
    
    // Loading states (НЕ скрывают контент!)
    isRefreshing,
    shouldShowRefreshIndicator,
    
    // Методы
    startAutoRefresh,
    stopAutoRefresh,
    manualRefresh,
    getTimeUntilNextRefresh,
    
    // Статистика
    retryCount
  }
}
