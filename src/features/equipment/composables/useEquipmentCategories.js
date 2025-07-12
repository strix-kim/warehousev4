/**
 * useEquipmentCategories.js
 * Composable для управления категориями и подкатегориями оборудования
 * Архитектурная роль: управление зависимостями между фильтрами, загрузка справочников
 * Обеспечивает: динамическую загрузку подкатегорий, валидацию зависимостей, кэширование
 */
import { ref, computed, watch, onMounted } from 'vue'
import { fetchEquipmentCategories, fetchEquipmentSubcategories } from '../equipmentApi'

export function useEquipmentCategories() {
  // Состояния категорий
  const categories = ref([])
  const subcategories = ref([])
  const isLoadingCategories = ref(false)
  const isLoadingSubcategories = ref(false)
  const categoriesError = ref(null)
  const subcategoriesError = ref(null)

  // Выбранные значения
  const selectedCategory = ref('')
  const selectedSubcategory = ref('')

  // Кэш подкатегорий для оптимизации
  const subcategoriesCache = new Map()

  // Предопределенные категории из константы проекта (fallback)
  const defaultCategories = [
    'Аудиооборудование',
    'Видеотехника',
    'Кабельная продукция и коммутация',
    'Компьютерное и сетевое оборудование',
    'Электропитание',
    'Транспортировочные и кейс-системы',
    'Разное / Служебное',
    'Системы синхронного перевода'
  ]

  /**
   * Загрузить список категорий из базы данных
   */
  const loadCategories = async () => {
    isLoadingCategories.value = true
    categoriesError.value = null

    try {
      const { data, error } = await fetchEquipmentCategories()

      if (error) {
        throw new Error(error.message || 'Ошибка загрузки категорий')
      }

      // Если в БД нет категорий, используем предопределенные
      categories.value = data && data.length > 0 ? data : defaultCategories

    } catch (error) {
      console.error('Ошибка загрузки категорий:', error)
      categoriesError.value = error.message
      // Fallback к предопределенным категориям
      categories.value = defaultCategories
    } finally {
      isLoadingCategories.value = false
    }
  }

  /**
   * Загрузить подкатегории для выбранной категории
   */
  const loadSubcategories = async (category) => {
    if (!category) {
      subcategories.value = []
      selectedSubcategory.value = ''
      return
    }

    // Проверяем кэш
    if (subcategoriesCache.has(category)) {
      subcategories.value = subcategoriesCache.get(category)
      return
    }

    isLoadingSubcategories.value = true
    subcategoriesError.value = null

    try {
      const { data, error } = await fetchEquipmentSubcategories(category)

      if (error) {
        throw new Error(error.message || 'Ошибка загрузки подкатегорий')
      }

      subcategories.value = data || []
      
      // Сохраняем в кэш
      subcategoriesCache.set(category, subcategories.value)

    } catch (error) {
      console.error('Ошибка загрузки подкатегорий:', error)
      subcategoriesError.value = error.message
      subcategories.value = []
    } finally {
      isLoadingSubcategories.value = false
    }
  }

  /**
   * Установить выбранную категорию
   */
  const setCategory = async (category) => {
    const previousCategory = selectedCategory.value
    selectedCategory.value = category

    // Сбрасываем подкатегорию при смене категории
    if (previousCategory !== category) {
      selectedSubcategory.value = ''
      await loadSubcategories(category)
    }
  }

  /**
   * Установить выбранную подкатегорию
   */
  const setSubcategory = (subcategory) => {
    if (!selectedCategory.value) {
      console.warn('Нельзя выбрать подкатегорию без категории')
      return false
    }

    // Проверяем, что подкатегория доступна для выбранной категории
    if (subcategory && !subcategories.value.includes(subcategory)) {
      console.warn(`Подкатегория "${subcategory}" недоступна для категории "${selectedCategory.value}"`)
      return false
    }

    selectedSubcategory.value = subcategory
    return true
  }

  /**
   * Сбросить выбор категории и подкатегории
   */
  const resetSelection = () => {
    selectedCategory.value = ''
    selectedSubcategory.value = ''
    subcategories.value = []
  }

  /**
   * Получить отформатированные опции для селекта категорий
   */
  const categoryOptions = computed(() => {
    return [
      { value: '', label: 'Все категории' },
      ...categories.value.map(category => ({
        value: category,
        label: category
      }))
    ]
  })

  /**
   * Получить отформатированные опции для селекта подкатегорий
   */
  const subcategoryOptions = computed(() => {
    const options = [{ value: '', label: 'Все подкатегории' }]
    
    if (selectedCategory.value && subcategories.value.length > 0) {
      options.push(...subcategories.value.map(subcategory => ({
        value: subcategory,
        label: subcategory
      })))
    }

    return options
  })

  /**
   * Проверка, доступен ли выбор подкатегории
   */
  const isSubcategoryEnabled = computed(() => {
    return Boolean(selectedCategory.value) && !isLoadingSubcategories.value
  })

  /**
   * Проверка, есть ли подкатегории для выбранной категории
   */
  const hasSubcategories = computed(() => {
    return subcategories.value.length > 0
  })

  /**
   * Текстовое описание выбранных фильтров
   */
  const selectionDescription = computed(() => {
    if (!selectedCategory.value) {
      return 'Категория не выбрана'
    }

    if (selectedSubcategory.value) {
      return `${selectedCategory.value} → ${selectedSubcategory.value}`
    }

    return selectedCategory.value
  })

  /**
   * Валидация текущего выбора
   */
  const isSelectionValid = computed(() => {
    // Если выбрана подкатегория, должна быть выбрана категория
    if (selectedSubcategory.value && !selectedCategory.value) {
      return false
    }

    // Если выбрана подкатегория, она должна быть в списке доступных
    if (selectedSubcategory.value && !subcategories.value.includes(selectedSubcategory.value)) {
      return false
    }

    return true
  })

  // Наблюдатель за изменением категории для автоматической загрузки подкатегорий
  watch(selectedCategory, (newCategory, oldCategory) => {
    if (newCategory !== oldCategory) {
      loadSubcategories(newCategory)
    }
  })

  // Загружаем категории при инициализации
  onMounted(() => {
    loadCategories()
  })

  return {
    // Состояния
    categories,
    subcategories,
    isLoadingCategories,
    isLoadingSubcategories,
    categoriesError,
    subcategoriesError,
    selectedCategory,
    selectedSubcategory,

    // Computed
    categoryOptions,
    subcategoryOptions,
    isSubcategoryEnabled,
    hasSubcategories,
    selectionDescription,
    isSelectionValid,

    // Методы
    loadCategories,
    loadSubcategories,
    setCategory,
    setSubcategory,
    resetSelection
  }
} 