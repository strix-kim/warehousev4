/**
 * useEquipmentPagination - умная пагинация с виртуальным скроллингом
 * Архитектурная роль: оптимизация работы с большими объёмами данных
 * Поддерживает: infinite scroll, lazy loading, кэширование, поиск по всей БД
 */
import { ref, computed, watch, nextTick } from 'vue'
import { fetchEquipmentsPaged } from '../equipmentApi'
import { debounce } from 'lodash-es'

export function useEquipmentPagination(options = {}) {
  const {
    pageSize = 50,
    maxLoadedItems = 500,
    searchDebounceMs = 300,
    preloadThreshold = 10
  } = options

  // Состояния
  const allEquipment = ref([])
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const error = ref(null)
  const hasMore = ref(true)
  const currentPage = ref(1)
  const total = ref(0)
  
  // Фильтры
  const filters = ref({
    search: '',
    category: '',
    subcategory: '',
    status: ''
  })

  // Кэш для оптимизации
  const cache = new Map()
  const lastSearchQuery = ref('')

  /**
   * Генерация ключа кэша на основе фильтров
   */
  const getCacheKey = (page, currentFilters) => {
    return JSON.stringify({ page, ...currentFilters })
  }

  /**
   * Загрузка страницы данных
   */
  const loadPage = async (page = 1, reset = false) => {
    const cacheKey = getCacheKey(page, filters.value)
    
    // Проверяем кэш
    if (!reset && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)
      if (reset) {
        allEquipment.value = cached.data
      } else {
        allEquipment.value.push(...cached.data)
      }
      total.value = cached.total
      hasMore.value = allEquipment.value.length < cached.total
      return
    }

    const loadingState = page === 1 ? 'isLoading' : 'isLoadingMore'
    ref(loadingState).value = true
    error.value = null

    try {
      const { data, count, error: apiError } = await fetchEquipmentsPaged({
        page,
        limit: pageSize,
        search: filters.value.search,
        category: filters.value.category,
        subcategory: filters.value.subcategory,
        status: filters.value.status
      })

      if (apiError) {
        throw new Error(apiError.message || 'Ошибка загрузки оборудования')
      }

      // Сохраняем в кэш
      cache.set(cacheKey, { data: data || [], total: count || 0 })

      if (reset || page === 1) {
        allEquipment.value = data || []
      } else {
        allEquipment.value.push(...(data || []))
      }

      total.value = count || 0
      hasMore.value = allEquipment.value.length < total.value
      currentPage.value = page

      // Ограничиваем количество загруженных элементов для производительности
      if (allEquipment.value.length > maxLoadedItems) {
        allEquipment.value = allEquipment.value.slice(0, maxLoadedItems)
        hasMore.value = false
      }

    } catch (err) {
      error.value = err.message || 'Ошибка загрузки данных'
      console.error('Ошибка загрузки оборудования:', err)
    } finally {
      isLoading.value = false
      isLoadingMore.value = false
    }
  }

  /**
   * Debounced поиск для оптимизации
   */
  const debouncedSearch = debounce(async (searchQuery) => {
    if (lastSearchQuery.value === searchQuery) return
    
    lastSearchQuery.value = searchQuery
    filters.value.search = searchQuery
    
    // Сбрасываем состояние и загружаем первую страницу
    currentPage.value = 1
    cache.clear() // Очищаем кэш при новом поиске
    await loadPage(1, true)
  }, searchDebounceMs)

  /**
   * Обновление фильтров
   */
  const updateFilter = async (key, value) => {
    if (filters.value[key] === value) return

    filters.value[key] = value
    currentPage.value = 1
    cache.clear() // Очищаем кэш при изменении фильтров
    await loadPage(1, true)
  }

  /**
   * Загрузка следующей страницы (infinite scroll)
   */
  const loadMore = async () => {
    if (!hasMore.value || isLoadingMore.value) return
    
    await loadPage(currentPage.value + 1, false)
  }

  /**
   * Проверка, нужно ли подгружать данные (для intersection observer)
   */
  const shouldLoadMore = (element) => {
    if (!element || !hasMore.value || isLoadingMore.value) return false

    const rect = element.getBoundingClientRect()
    const threshold = window.innerHeight + 100 // Подгружаем за 100px до конца
    
    return rect.top <= threshold
  }

  /**
   * Сброс всех фильтров
   */
  const resetFilters = async () => {
    filters.value = {
      search: '',
      category: '',
      subcategory: '',
      status: ''
    }
    lastSearchQuery.value = ''
    currentPage.value = 1
    cache.clear()
    await loadPage(1, true)
  }

  /**
   * Принудительное обновление данных
   */
  const refresh = async () => {
    cache.clear()
    await loadPage(currentPage.value, true)
  }

  // Computed свойства
  const isAnyLoading = computed(() => isLoading.value || isLoadingMore.value)
  
  const stats = computed(() => ({
    loaded: allEquipment.value.length,
    total: total.value,
    hasMore: hasMore.value,
    progress: total.value > 0 ? Math.round((allEquipment.value.length / total.value) * 100) : 0
  }))

  const hasActiveFilters = computed(() => {
    return Object.values(filters.value).some(value => value !== '')
  })

  // Отслеживание изменений фильтров
  watch(() => filters.value.search, (newValue) => {
    debouncedSearch(newValue)
  })

  return {
    // Данные
    allEquipment,
    total,
    filters,
    
    // Состояния
    isLoading,
    isLoadingMore,
    isAnyLoading,
    error,
    hasMore,
    
    // Computed
    stats,
    hasActiveFilters,
    
    // Методы
    loadPage,
    loadMore,
    updateFilter,
    resetFilters,
    refresh,
    shouldLoadMore,
    debouncedSearch: (query) => debouncedSearch(query),
    
    // Очистка
    cleanup: () => {
      debouncedSearch.cancel()
      cache.clear()
    }
  }
} 