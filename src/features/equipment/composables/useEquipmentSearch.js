/**
 * useEquipmentSearch.js — УСОВЕРШЕНСТВОВАННЫЙ поиск с отказоустойчивой системой фокуса
 * Архитектурная роль: управление подсказками поиска, умный debounce, кэширование результатов
 * КРИТИЧЕСКИЕ УЛУЧШЕНИЯ:
 * - Унифицированная система защиты фокуса с константами
 * - Отказоустойчивое восстановление с fallback-механизмами
 * - Система состояний фокуса с сохранением позиции курсора
 * - Мониторинг и диагностика проблем с фокусом
 * - Устранение всех выявленных багов
 */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { debounce } from 'lodash-es'
import { fetchEquipmentSuggestions } from '../equipmentApi'

// УНИФИКАЦИЯ: Централизованные константы защиты фокуса
const FOCUS_PROTECTION = {
  INSTANT: 50,      // Мгновенные операции
  FAST: 100,        // Быстрые операции  
  NORMAL: 200,      // Стандартные операции
  SLOW: 300,        // Медленные операции
  CRITICAL: 500     // Критические операции
}

const PRIORITY_LEVELS = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4
}

export function useEquipmentSearch() {
  // Состояния автодополнения
  const searchQuery = ref('')
  const suggestions = ref([])
  const isLoadingSuggestions = ref(false)
  const showSuggestions = ref(false)
  const selectedSuggestionIndex = ref(-1)
  const searchInputRef = ref(null)

  // УЛУЧШЕНИЕ: Расширенная система состояний фокуса
  const focusState = ref({
    isProtected: false,
    protectionLevel: 'none',
    currentPriority: 0,
    lastOperation: null,
    snapshot: null
  })
  
  const focusProtectionTimer = ref(null)
  const pendingOperations = ref(new Set())

  // Кэш для подсказок
  const suggestionsCache = new Map()
  const maxCacheSize = 100

  // Состояние ошибок
  const suggestionError = ref(null)

  // УЛУЧШЕНИЕ: Мониторинг состояния фокуса
  const focusMonitor = {
    events: [],
    
    log(event, details = {}) {
      this.events.push({
        timestamp: Date.now(),
        event,
        details,
        activeElement: document.activeElement?.tagName,
        isProtected: focusState.value.isProtected,
        protectionLevel: focusState.value.protectionLevel
      })
      
      // Ограничиваем размер лога
      if (this.events.length > 50) {
        this.events.shift()
      }
    },
    
    getReport() {
      return {
        totalEvents: this.events.length,
        focusLossCount: this.events.filter(e => e.event === 'focus_lost').length,
        protectionCount: this.events.filter(e => e.event === 'protection_activated').length,
        lastEvents: this.events.slice(-5)
      }
    }
  }

  /**
   * УЛУЧШЕНИЕ: Создание снимка состояния фокуса
   */
  const createFocusSnapshot = () => {
    if (searchInputRef.value && document.activeElement === searchInputRef.value) {
      const snapshot = {
        selectionStart: searchInputRef.value.selectionStart,
        selectionEnd: searchInputRef.value.selectionEnd,
        scrollTop: searchInputRef.value.scrollTop,
        value: searchInputRef.value.value
      }
      focusState.value.snapshot = snapshot
      return snapshot
    }
    return null
  }

  /**
   * ИСПРАВЛЕНИЕ БАГА #1: Унифицированная защита фокуса с приоритетами
   */
  const protectFocus = (duration = FOCUS_PROTECTION.NORMAL, priority = 'normal') => {
    const priorityLevel = PRIORITY_LEVELS[priority] || PRIORITY_LEVELS.normal
    
    // Проверяем, нужно ли перезаписать текущую защиту
    const shouldOverride = !focusState.value.isProtected || 
      priorityLevel >= focusState.value.currentPriority
    
    if (shouldOverride) {
      // Очищаем предыдущий таймер
      if (focusProtectionTimer.value) {
        clearTimeout(focusProtectionTimer.value)
      }
      
      focusState.value.isProtected = true
      focusState.value.protectionLevel = priority
      focusState.value.currentPriority = priorityLevel
      
      focusProtectionTimer.value = setTimeout(() => {
        focusState.value.isProtected = false
        focusState.value.protectionLevel = 'none'
        focusState.value.currentPriority = 0
        focusProtectionTimer.value = null
      }, duration)
      
      focusMonitor.log('protection_activated', { duration, priority, priorityLevel })
    }
  }

  /**
   * УЛУЧШЕНИЕ: Принудительное снятие защиты
   */
  const forceUnprotectFocus = () => {
    if (focusProtectionTimer.value) {
      clearTimeout(focusProtectionTimer.value)
      focusProtectionTimer.value = null
    }
    focusState.value.isProtected = false
    focusState.value.protectionLevel = 'none'
    focusState.value.currentPriority = 0
    
    focusMonitor.log('protection_forced_off')
  }

  /**
   * УЛУЧШЕНИЕ: Проактивное сохранение с созданием снимка
   */
  const preserveFocus = (duration = FOCUS_PROTECTION.SLOW, priority = 'normal') => {
    if (searchInputRef.value && document.activeElement === searchInputRef.value) {
      const snapshot = createFocusSnapshot()
      protectFocus(duration, priority)
      focusState.value.lastOperation = 'preserve'
      
      focusMonitor.log('focus_preserved', { snapshot: !!snapshot })
      return snapshot
    }
    return null
  }

  /**
   * ИСПРАВЛЕНИЕ БАГА #3: Отказоустойчивое восстановление с fallback
   */
  const robustRestoreFocus = async (snapshot = null, maxRetries = 3) => {
    const operationId = `restore_${Date.now()}`
    pendingOperations.value.add(operationId)
    
    try {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (!searchInputRef.value) {
            focusMonitor.log('restore_failed', { reason: 'no_input_ref', attempt })
            break
          }
          
          // Попытка восстановления фокуса
          searchInputRef.value.focus()
          
          // Восстановление позиции курсора
          if (snapshot && searchInputRef.value.setSelectionRange) {
            searchInputRef.value.setSelectionRange(
              snapshot.selectionStart, 
              snapshot.selectionEnd
            )
          } else {
            // По умолчанию - в конец
            const length = searchInputRef.value.value.length
            if (searchInputRef.value.setSelectionRange) {
              searchInputRef.value.setSelectionRange(length, length)
            }
          }
          
          // Проверяем успешность
          if (document.activeElement === searchInputRef.value) {
            protectFocus(FOCUS_PROTECTION.NORMAL, 'normal')
            focusState.value.lastOperation = 'restore_success'
            
            focusMonitor.log('focus_restored', { 
              attempt: attempt + 1, 
              withSnapshot: !!snapshot 
            })
            return true
          }
        } catch (error) {
          focusMonitor.log('restore_attempt_failed', { 
            attempt: attempt + 1, 
            error: error.message 
          })
        }
        
        // Задержка перед повтором
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)))
        }
      }
      
      // Все попытки неудачны
      focusMonitor.log('focus_lost', { reason: 'all_attempts_failed' })
      console.error('Критическая ошибка: не удалось восстановить фокус')
      return false
      
    } finally {
      pendingOperations.value.delete(operationId)
    }
  }

  /**
   * УЛУЧШЕНИЕ: Обёртка для обратной совместимости
   */
  const restoreFocus = (snapshot = null) => {
    // ИСПРАВЛЕНИЕ БАГА #3: Предотвращение двойного восстановления
    if (focusState.value.lastOperation === 'restore_success' && 
        document.activeElement === searchInputRef.value) {
      return Promise.resolve(true)
    }
    
    return robustRestoreFocus(snapshot || focusState.value.snapshot)
  }

  /**
   * УЛУЧШЕНИЕ: Безопасное обновление с улучшенной защитой
   */
  const updateSuggestionsSafely = (newSuggestions) => {
    const snapshot = preserveFocus(FOCUS_PROTECTION.SLOW, 'high')
    
    // Обновляем состояние
    suggestions.value = newSuggestions
    showSuggestions.value = newSuggestions.length > 0
    
    // Восстанавливаем фокус после обновления
    nextTick(() => {
      restoreFocus(snapshot)
    })
  }

  /**
   * УМНЫЙ debounced запрос подсказок с улучшенной защитой фокуса
   */
  const debouncedFetchSuggestions = debounce(async (query, cacheKey) => {
    // Проверяем актуальность запроса
    if (searchQuery.value.toLowerCase().trim() !== cacheKey) {
      return
    }

    // Защищаем фокус перед началом загрузки
    const snapshot = preserveFocus(FOCUS_PROTECTION.CRITICAL, 'high')
    isLoadingSuggestions.value = true
    suggestionError.value = null

    try {
      const { data, error } = await fetchEquipmentSuggestions(query, 10)
      
      // Проверяем актуальность после получения ответа
      if (searchQuery.value.toLowerCase().trim() !== cacheKey) {
        return
      }
      
      if (error) {
        throw new Error(error.message || 'Ошибка получения подсказок')
      }

      const newSuggestions = data || []
      
      // Безопасное обновление с сохранением фокуса
      updateSuggestionsSafely(newSuggestions)
      
      // Обновляем состояние операции
      focusState.value.lastOperation = 'search_completed'

      // Сохраняем в кэш
      if (suggestionsCache.size >= maxCacheSize) {
        const firstKey = suggestionsCache.keys().next().value
        suggestionsCache.delete(firstKey)
      }
      suggestionsCache.set(cacheKey, newSuggestions)

    } catch (error) {
      console.error('Ошибка автодополнения:', error)
      suggestionError.value = error.message
      
      // Безопасная очистка при ошибке
      updateSuggestionsSafely([])
    } finally {
      isLoadingSuggestions.value = false
      
      // Финальное восстановление фокуса
      nextTick(() => {
        restoreFocus(snapshot)
      })
    }
  }, 150)

  /**
   * ИСПРАВЛЕНИЕ БАГА #3: Устранение двойного восстановления
   */
  const setSearchQuery = (query) => {
    // Защищаем фокус перед любыми изменениями
    const snapshot = preserveFocus(FOCUS_PROTECTION.NORMAL, 'normal')
    
    // Обновляем запрос
    searchQuery.value = query
    selectedSuggestionIndex.value = -1
    
    const trimmedQuery = query.trim()
    const cacheKey = trimmedQuery.toLowerCase()
    
    if (trimmedQuery.length < 2) {
      // Синхронная очистка с немедленным восстановлением фокуса
      suggestions.value = []
      showSuggestions.value = false
      debouncedFetchSuggestions.cancel()
      
      // ИСПРАВЛЕНИЕ: Одиночное восстановление фокуса
      restoreFocus(snapshot)
      return
    }

    // Проверяем кэш
    if (suggestionsCache.has(cacheKey)) {
      const cachedSuggestions = suggestionsCache.get(cacheKey)
      updateSuggestionsSafely(cachedSuggestions)
      return
    }

    // Запускаем debounced запрос
    debouncedFetchSuggestions(trimmedQuery, cacheKey)
  }

  /**
   * ИСПРАВЛЕННАЯ функция выбора подсказки с автоматическим поиском
   */
  const selectSuggestion = (suggestion) => {
    const snapshot = preserveFocus(FOCUS_PROTECTION.NORMAL, 'normal')
    
    // МАРКЕР: Отмечаем, что находимся в процессе выбора подсказки
    focusState.value.lastOperation = 'suggestion_selected'
    
    // Обновляем запрос
    searchQuery.value = suggestion.value
    showSuggestions.value = false
    selectedSuggestionIndex.value = -1
    
    // ИСПРАВЛЕНИЕ: Отменяем старый поиск
    debouncedFetchSuggestions.cancel()
    
    // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Запускаем новый поиск по выбранному значению
    const trimmedQuery = suggestion.value.trim()
    if (trimmedQuery.length >= 2) {
      const cacheKey = trimmedQuery.toLowerCase()
      
      // Очищаем старые подсказки перед новым поиском
      suggestions.value = []
      
      // Проверяем кэш для нового запроса
      if (suggestionsCache.has(cacheKey)) {
        const cachedSuggestions = suggestionsCache.get(cacheKey)
        // Показываем кэшированные результаты только если они отличаются от текущего значения
        const filteredSuggestions = cachedSuggestions.filter(s => 
          s.value.toLowerCase() !== trimmedQuery.toLowerCase()
        )
        if (filteredSuggestions.length > 0) {
          // Задержка перед показом новых подсказок
          setTimeout(() => {
            updateSuggestionsSafely(filteredSuggestions)
            focusState.value.lastOperation = 'search_completed'
          }, 300) // Даём время пользователю увидеть выбранное значение
        } else {
          // Сбрасываем маркер, если нет подсказок
          setTimeout(() => {
            focusState.value.lastOperation = 'search_completed'
          }, 300)
        }
      } else {
        // Запускаем новый поиск с задержкой
        setTimeout(() => {
          debouncedFetchSuggestions(trimmedQuery, cacheKey)
          focusState.value.lastOperation = 'search_started'
        }, 300)
      }
    } else {
      // Сбрасываем маркер для коротких запросов
      setTimeout(() => {
        focusState.value.lastOperation = 'search_completed'
      }, 300)
    }
    
    // Восстанавливаем фокус
    nextTick(() => {
      restoreFocus(snapshot)
    })
    
    return suggestion.value
  }

  /**
   * Безопасная навигация по подсказкам
   */
  const handleKeyNavigation = (event) => {
    if (!showSuggestions.value || suggestions.value.length === 0) {
      return false
    }

    // Защищаем фокус при навигации
    const snapshot = preserveFocus(FOCUS_PROTECTION.FAST, 'normal')

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        selectedSuggestionIndex.value = Math.min(
          selectedSuggestionIndex.value + 1,
          suggestions.value.length - 1
        )
        restoreFocus(snapshot)
        return true

      case 'ArrowUp':
        event.preventDefault()
        selectedSuggestionIndex.value = Math.max(
          selectedSuggestionIndex.value - 1,
          -1
        )
        restoreFocus(snapshot)
        return true

      case 'Enter':
        event.preventDefault()
        if (selectedSuggestionIndex.value >= 0) {
          const selected = suggestions.value[selectedSuggestionIndex.value]
          return selectSuggestion(selected)
        }
        restoreFocus(snapshot)
        return searchQuery.value

      case 'Escape':
        event.preventDefault()
        showSuggestions.value = false
        selectedSuggestionIndex.value = -1
        debouncedFetchSuggestions.cancel()
        restoreFocus(snapshot)
        return true

      default:
        restoreFocus(snapshot)
        return false
    }
  }

  /**
   * Безопасная функция скрытия подсказок
   */
  const hideSuggestions = () => {
    // Не скрываем, если фокус защищён
    if (!focusState.value.isProtected) {
      showSuggestions.value = false
      selectedSuggestionIndex.value = -1
    }
  }

  /**
   * ИСПРАВЛЕННАЯ функция показа подсказок с умной логикой
   */
  const showSuggestionsIfAvailable = (forceShow = false) => {
    // Показываем подсказки только если:
    // 1. Есть подсказки И запрос >= 2 символов
    // 2. ИЛИ принудительный показ (forceShow = true)
    // 3. И НЕ находимся в процессе выбора подсказки
    const shouldShow = (suggestions.value.length > 0 && searchQuery.value.length >= 2) || forceShow
    const isNotSelecting = focusState.value.lastOperation !== 'suggestion_selected'
    
    if (shouldShow && isNotSelecting) {
      showSuggestions.value = true
      restoreFocus()
    }
  }

  /**
   * Усовершенствованная функция очистки поиска
   */
  const clearSearch = () => {
    const snapshot = preserveFocus(FOCUS_PROTECTION.CRITICAL, 'high')
    
    // Синхронная очистка всех состояний
    searchQuery.value = ''
    suggestions.value = []
    showSuggestions.value = false
    selectedSuggestionIndex.value = -1
    suggestionError.value = null
    
    debouncedFetchSuggestions.cancel()
    
    // Немедленное восстановление фокуса
    restoreFocus(snapshot)
    
    // Дополнительная защита через nextTick для надёжности
    nextTick(() => {
      if (document.activeElement !== searchInputRef.value) {
        robustRestoreFocus(snapshot)
      }
    })
  }

  /**
   * Получить отформатированный текст подсказки с выделением
   */
  const getHighlightedSuggestion = (suggestion) => {
    const query = searchQuery.value.toLowerCase()
    const value = suggestion.value
    const index = value.toLowerCase().indexOf(query)
    
    if (index === -1) return value

    return {
      before: value.substring(0, index),
      match: value.substring(index, index + query.length),
      after: value.substring(index + query.length)
    }
  }

  /**
   * Computed свойства
   */
  const hasSuggestions = computed(() => suggestions.value.length > 0)
  const isSearching = computed(() => isLoadingSuggestions.value)
  const shouldShowSuggestions = computed(() => 
    showSuggestions.value && (hasSuggestions.value || isLoadingSuggestions.value)
  )

  // ИСПРАВЛЕНИЕ БАГА #4: Умное отслеживание изменений без гонки состояний
  watch(searchQuery, (newValue, oldValue) => {
    // Защищаем фокус только если текущая защита слабее
    if (document.activeElement === searchInputRef.value) {
      const currentPriority = focusState.value.currentPriority
      if (currentPriority < PRIORITY_LEVELS.normal) {
        protectFocus(FOCUS_PROTECTION.NORMAL, 'normal')
      }
    }
    
    // Дополнительная защита при полном удалении символов
    if (newValue === '' && oldValue !== '' && searchInputRef.value) {
      nextTick(() => {
        if (document.activeElement !== searchInputRef.value) {
          robustRestoreFocus()
        }
      })
    }
  })

  // ИСПРАВЛЕНИЕ БАГА #2: Полная очистка при размонтировании
  const cleanup = () => {
    // Отменяем debounced запросы
    debouncedFetchSuggestions.cancel()
    
    // Очищаем кэш
    suggestionsCache.clear()
    
    // Принудительно снимаем защиту фокуса
    forceUnprotectFocus()
    
    // Отменяем все pending операции
    pendingOperations.value.clear()
    
    // Очищаем состояние фокуса
    focusState.value = {
      isProtected: false,
      protectionLevel: 'none',
      currentPriority: 0,
      lastOperation: null,
      snapshot: null
    }
    
    // Очищаем монитор
    focusMonitor.events = []
    
    focusMonitor.log('cleanup_completed')
  }

  onUnmounted(cleanup)

  return {
    // Состояния
    searchQuery,
    suggestions,
    isLoadingSuggestions,
    showSuggestions,
    selectedSuggestionIndex,
    searchInputRef,
    suggestionError,

    // Computed
    hasSuggestions,
    isSearching,
    shouldShowSuggestions,

    // Методы
    setSearchQuery,
    selectSuggestion,
    handleKeyNavigation,
    hideSuggestions,
    showSuggestionsIfAvailable,
    clearSearch,
    getHighlightedSuggestion,
    
    // Улучшенные методы управления фокусом
    preserveFocus,
    restoreFocus,
    robustRestoreFocus,
    protectFocus,
    forceUnprotectFocus,
    createFocusSnapshot,
    
    // Диагностика и мониторинг
    focusState: computed(() => focusState.value),
    getFocusReport: () => focusMonitor.getReport(),
    
    // Очистка
    cleanup
  }
} 