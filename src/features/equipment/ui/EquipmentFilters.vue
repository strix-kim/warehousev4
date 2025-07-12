<script setup>
/**
 * EquipmentFilters.vue — панель фильтров для оборудования
 * Архитектурная роль: объединяет все фильтры в единую панель, управляет состоянием
 * Обеспечивает: удобный интерфейс фильтрации, сброс фильтров, адаптивность
 */
import { ref, computed, onUnmounted } from 'vue'
import { useEquipmentFilters } from '../composables/useEquipmentFilters'
import EquipmentSearchInput from './EquipmentSearchInput.vue'
import CategorySelect from './CategorySelect.vue'
import Button from '@/shared/ui/atoms/Button.vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  resultsCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['search'])

// Используем composable для управления фильтрами
const {
  localFilters,
  isSearching,
  hasActiveFilters,
  activeFiltersDescription,
  isSubcategoryEnabled,
  setSearch,
  setCategory,
  setSubcategory,
  setStatus,
  setBrand,
  resetFilters,
  cleanup
} = useEquipmentFilters()

// Локальные состояния компонента
const isExpanded = ref(false)
const isMobile = ref(window.innerWidth < 768)

// Опции для селектов
const statusOptions = [
  { value: '', label: 'Любой статус' },
  { value: 'operational', label: 'Работает' },
  { value: 'broken', label: 'Сломано' },
  { value: 'in_repair', label: 'В ремонте' }
]

// Обработчики событий
const handleSearchInput = (value) => {
  setSearch(value)
  emit('search', value)
}

const handleCategoryUpdate = (value) => {
  setCategory(value)
}

const handleSubcategoryUpdate = (value) => {
  setSubcategory(value)
}

const handleStatusChange = (event) => {
  setStatus(event.target.value)
}

const handleResetFilters = async () => {
  await resetFilters()
  emit('search', '')
}

const toggleFilters = () => {
  isExpanded.value = !isExpanded.value
}

// Обработка изменения размера экрана
const handleResize = () => {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) {
    isExpanded.value = false
  }
}

// Computed свойства
const filtersContentClasses = computed(() => [
  'transition-all duration-300 ease-in-out overflow-hidden',
  {
    'max-h-0': isMobile.value && !isExpanded.value,
    'max-h-screen': !isMobile.value || isExpanded.value
  }
])

const resetButtonText = computed(() => {
  return hasActiveFilters.value ? 'Сбросить фильтры' : 'Фильтры не применены'
})

const resultsText = computed(() => {
  if (props.loading) return 'Поиск...'
  if (props.resultsCount === 0) return 'Ничего не найдено'
  if (props.resultsCount === 1) return '1 единица оборудования'
  if (props.resultsCount < 5) return `${props.resultsCount} единицы оборудования`
  return `${props.resultsCount} единиц оборудования`
})

// Слушатели событий
window.addEventListener('resize', handleResize)

// Очистка при размонтировании
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cleanup()
})
</script>

<template>
  <!--
    EquipmentFilters — комплексная панель фильтрации
    Объединяет поиск, категории, статусы в единый интерфейс
    Адаптивна, с возможностью сворачивания на мобильных устройствах
  -->
  <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
    <!-- Заголовок панели фильтров -->
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Фильтры</h3>
          <p class="text-sm text-gray-600 mt-1">{{ resultsText }}</p>
        </div>
        
        <!-- Кнопка сворачивания на мобильных -->
        <button
          v-if="isMobile"
          type="button"
          class="p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md transition-colors"
          :aria-label="isExpanded ? 'Скрыть фильтры' : 'Показать фильтры'"
          @click="toggleFilters"
        >
          <svg
            class="h-5 w-5 transform transition-transform duration-200"
            :class="{ 'rotate-180': isExpanded }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <!-- Индикатор активных фильтров -->
      <div
        v-if="hasActiveFilters"
        class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
      >
        <div class="flex items-start justify-between">
          <div class="text-sm text-blue-800">
            <span class="font-medium">Активные фильтры:</span>
            <div class="mt-1">{{ activeFiltersDescription }}</div>
          </div>
          <Button
            label="Сбросить"
            size="sm"
            variant="outline"
            class="ml-3 text-blue-600 border-blue-300 hover:bg-blue-100"
            @click="handleResetFilters"
          />
        </div>
      </div>
    </div>

    <!-- Содержимое фильтров -->
    <div :class="filtersContentClasses">
      <div class="p-6 space-y-6">
        <!-- Поиск -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">
            Поиск оборудования
          </label>
          <EquipmentSearchInput
            :model-value="localFilters.search"
            :disabled="loading"
            placeholder="Введите название, бренд или серийный номер..."
            @update:model-value="handleSearchInput"
            @search="handleSearchInput"
          />
          <div class="text-xs text-gray-500">
            Поиск работает по названию модели, бренду и серийному номеру
          </div>
        </div>

        <!-- Сетка фильтров -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Категории -->
          <div>
            <CategorySelect
              :category-value="localFilters.category"
              :subcategory-value="localFilters.subcategory"
              :disabled="loading"
              @update:category="handleCategoryUpdate"
              @update:subcategory="handleSubcategoryUpdate"
            />
          </div>

          <!-- Дополнительные фильтры -->
          <div class="space-y-4">
            <!-- Статус -->
            <div class="space-y-2">
              <label for="status-select" class="block text-sm font-medium text-gray-700">
                Статус оборудования
              </label>
              <select
                id="status-select"
                :value="localFilters.status"
                class="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                :class="{
                  'cursor-not-allowed bg-gray-50 text-gray-400': loading
                }"
                :disabled="loading"
                @change="handleStatusChange"
              >
                <option
                  v-for="option in statusOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- Бренд (пока скрыт, можно добавить позже) -->
            <!-- 
            <div class="space-y-2">
              <label for="brand-input" class="block text-sm font-medium text-gray-700">
                Бренд
              </label>
              <input
                id="brand-input"
                v-model="localFilters.brand"
                type="text"
                class="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="Введите бренд..."
                :disabled="loading"
                @input="setBrand($event.target.value)"
              />
            </div>
            -->
          </div>
        </div>

        <!-- Действия с фильтрами -->
        <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <Button
            :label="resetButtonText"
            variant="outline"
            :disabled="!hasActiveFilters || loading"
            class="flex-1 sm:flex-none"
            @click="handleResetFilters"
          />
          
          <div class="flex-1 sm:flex-none text-sm text-gray-500 flex items-center">
            <template v-if="isSearching">
              <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Поиск...
            </template>
            <template v-else-if="hasActiveFilters">
              Фильтры применены
            </template>
            <template v-else>
              Все фильтры сброшены
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<!--
  Комментарии к компоненту:
  
  1. Архитектура:
     - Объединяет все фильтры в единую панель
     - Использует composables для логики
     - Разделение на переиспользуемые компоненты
  
  2. Адаптивность:
     - Сворачивание на мобильных устройствах
     - Responsive grid для фильтров
     - Адаптивные размеры и отступы
  
  3. UX-оптимизации:
     - Визуальная обратная связь для всех состояний
     - Счетчик результатов
     - Индикатор активных фильтров
     - Быстрый сброс фильтров
  
  4. Performance:
     - Debounce через composables
     - Минимальные перерендеры
     - Эффективное управление состоянием
--> 