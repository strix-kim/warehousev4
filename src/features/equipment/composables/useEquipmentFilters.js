/**
 * useEquipmentFilters.js
 * Composable для управления фильтрами оборудования
 * Архитектурная роль: централизованная логика фильтрации с debounce, реактивность, автообновление
 * Обеспечивает: debounce для поиска, зависимости между фильтрами, оптимизацию запросов
 */
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { debounce } from 'lodash-es'
import { useEquipmentStore } from '@/stores/equipment-store'

export function useEquipmentFilters() {
  const equipmentStore = useEquipmentStore()

  // Локальные состояния фильтров (для мгновенной реактивности UI)
  const localFilters = reactive({
    search: '',
    category: '',
    subcategory: '',
    status: '',
    brand: ''
  })

  // Состояния загрузки для отдельных операций
  const isSearching = ref(false)
  const isLoadingCategories = ref(false)
  const isLoadingSubcategories = ref(false)

  // Флаг для предотвращения лишних запросов при программном изменении фильтров
  const isUpdatingFilters = ref(false)

  /**
   * Debounced функция для поискового запроса
   * Минимизирует количество запросов при вводе текста
   */
  const debouncedSearch = debounce(async (searchTerm) => {
    if (isUpdatingFilters.value) return
    
    isSearching.value = true
    try {
      await equipmentStore.setFilter('search', searchTerm)
    } finally {
      isSearching.value = false
    }
  }, 300) // 300ms задержка для баланса между отзывчивостью и производительностью

  /**
   * Debounced функция для остальных фильтров
   * Более короткая задержка для селектов
   */
  const debouncedFilterUpdate = debounce(async (filterKey, value) => {
    if (isUpdatingFilters.value) return
    
    try {
      await equipmentStore.setFilter(filterKey, value)
    } catch (error) {
      console.error(`Ошибка обновления фильтра ${filterKey}:`, error)
    }
  }, 150)

  /**
   * Установить значение поискового запроса
   * Использует debounce для оптимизации
   */
  const setSearch = (value) => {
    localFilters.search = value
    debouncedSearch(value)
  }

  /**
   * Установить категорию и сбросить подкатегорию
   * При смене категории подкатегория должна сбрасываться
   */
  const setCategory = async (value) => {
    isUpdatingFilters.value = true
    
    localFilters.category = value
    localFilters.subcategory = '' // Сброс подкатегории при смене категории
    
    try {
      // Обновляем оба фильтра одновременно
      await Promise.all([
        equipmentStore.setFilter('category', value),
        equipmentStore.setFilter('subcategory', '')
      ])
    } finally {
      isUpdatingFilters.value = false
    }
  }

  /**
   * Установить подкатегорию
   * Доступно только если выбрана категория
   */
  const setSubcategory = (value) => {
    if (!localFilters.category) {
      console.warn('Нельзя выбрать подкатегорию без категории')
      return
    }
    
    localFilters.subcategory = value
    debouncedFilterUpdate('subcategory', value)
  }

  /**
   * Установить статус оборудования
   */
  const setStatus = (value) => {
    localFilters.status = value
    debouncedFilterUpdate('status', value)
  }

  /**
   * Установить бренд
   */
  const setBrand = (value) => {
    localFilters.brand = value
    debouncedFilterUpdate('brand', value)
  }

  /**
   * Сбросить все фильтры
   */
  const resetFilters = async () => {
    isUpdatingFilters.value = true
    
    // Сбрасываем локальные состояния
    Object.keys(localFilters).forEach(key => {
      localFilters[key] = ''
    })

    try {
      // Сбрасываем фильтры в store
      await Promise.all([
        equipmentStore.setFilter('search', ''),
        equipmentStore.setFilter('category', ''),
        equipmentStore.setFilter('subcategory', ''),
        equipmentStore.setFilter('status', ''),
        equipmentStore.setFilter('brand', '')
      ])
    } finally {
      isUpdatingFilters.value = false
    }
  }

  /**
   * Проверка, активны ли какие-либо фильтры
   */
  const hasActiveFilters = computed(() => {
    return Object.values(localFilters).some(value => value !== '')
  })

  /**
   * Получить текстовое описание активных фильтров
   */
  const activeFiltersDescription = computed(() => {
    const active = []
    
    if (localFilters.search) active.push(`Поиск: "${localFilters.search}"`)
    if (localFilters.category) active.push(`Категория: ${localFilters.category}`)
    if (localFilters.subcategory) active.push(`Подкатегория: ${localFilters.subcategory}`)
    if (localFilters.status) active.push(`Статус: ${localFilters.status}`)
    if (localFilters.brand) active.push(`Бренд: ${localFilters.brand}`)
    
    return active.length > 0 ? active.join(', ') : 'Фильтры не применены'
  })

  /**
   * Проверка, доступна ли подкатегория
   */
  const isSubcategoryEnabled = computed(() => {
    return Boolean(localFilters.category)
  })

  // Синхронизация с store при инициализации
  const syncWithStore = () => {
    const storeFilters = equipmentStore.filters
    Object.keys(localFilters).forEach(key => {
      if (storeFilters[key] !== undefined) {
        localFilters[key] = storeFilters[key]
      }
    })
  }

  // Отменяем pending debounced вызовы при размонтировании
  const cleanup = () => {
    debouncedSearch.cancel()
    debouncedFilterUpdate.cancel()
  }

  // Инициализация
  syncWithStore()

  return {
    // Состояния
    localFilters,
    isSearching,
    isLoadingCategories,
    isLoadingSubcategories,
    
    // Computed
    hasActiveFilters,
    activeFiltersDescription,
    isSubcategoryEnabled,
    
    // Методы
    setSearch,
    setCategory,
    setSubcategory,
    setStatus,
    setBrand,
    resetFilters,
    syncWithStore,
    cleanup
  }
} 