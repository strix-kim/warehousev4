/**
 * 🎯 useLoadingStates - Best Practices для управления состояниями загрузки
 * 
 * ПРИНЦИПЫ:
 * 1. Разделение Initial Loading (первая загрузка) и Refreshing (обновление данных)
 * 2. При обновлении данные НЕ скрываются - показывается тонкий индикатор
 * 3. Оптимистичные обновления - сначала показать, потом обновить
 * 4. Graceful degradation - никогда не оставлять пользователя без контента
 */

import { ref, computed } from 'vue'

export function useLoadingStates() {
  // Состояния
  const isInitialLoading = ref(false)    // Первая загрузка - показывает скелетон
  const isRefreshing = ref(false)        // Обновление - показывает тонкий индикатор
  const isError = ref(false)             // Ошибка
  const errorMessage = ref('')           // Текст ошибки

  // Вычисляемые свойства
  const shouldShowSkeleton = computed(() => isInitialLoading.value)
  const shouldShowContent = computed(() => !isInitialLoading.value)
  const shouldShowRefreshIndicator = computed(() => isRefreshing.value)

  /**
   * Инициализация первой загрузки
   */
  const startInitialLoading = () => {
    isInitialLoading.value = true
    isError.value = false
    errorMessage.value = ''
  }

  /**
   * Завершение первой загрузки
   */
  const finishInitialLoading = () => {
    isInitialLoading.value = false
  }

  /**
   * Начало обновления (НЕ скрывает контент)
   */
  const startRefreshing = () => {
    isRefreshing.value = true
    isError.value = false
    errorMessage.value = ''
  }

  /**
   * Завершение обновления
   */
  const finishRefreshing = () => {
    isRefreshing.value = false
  }

  /**
   * Установка ошибки
   */
  const setError = (message) => {
    isError.value = true
    errorMessage.value = message
    isInitialLoading.value = false
    isRefreshing.value = false
  }

  /**
   * Очистка всех состояний
   */
  const reset = () => {
    isInitialLoading.value = false
    isRefreshing.value = false
    isError.value = false
    errorMessage.value = ''
  }

  /**
   * Wrapper для initial loading операций
   */
  const withInitialLoading = async (operation) => {
    startInitialLoading()
    try {
      const result = await operation()
      finishInitialLoading()
      return result
    } catch (error) {
      setError(error.message || 'Произошла ошибка')
      throw error
    }
  }

  /**
   * Wrapper для refresh операций (НЕ показывает скелетон)
   */
  const withRefreshing = async (operation) => {
    startRefreshing()
    try {
      const result = await operation()
      finishRefreshing()
      return result
    } catch (error) {
      finishRefreshing()
      // При ошибке обновления НЕ показываем глобальную ошибку - данные остаются
      console.warn('🟡 [Refresh Error]:', error.message)
      throw error
    }
  }

  return {
    // Состояния
    isInitialLoading,
    isRefreshing,
    isError,
    errorMessage,

    // Вычисляемые свойства
    shouldShowSkeleton,
    shouldShowContent,
    shouldShowRefreshIndicator,

    // Методы
    startInitialLoading,
    finishInitialLoading,
    startRefreshing,
    finishRefreshing,
    setError,
    reset,

    // Wrappers
    withInitialLoading,
    withRefreshing
  }
}
