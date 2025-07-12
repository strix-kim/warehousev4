<script setup>
/**
 * CategorySelect.vue — компонент выбора категории и подкатегории
 * Архитектурная роль: управление зависимыми фильтрами, валидация выбора
 * Обеспечивает: автоматическое обновление подкатегорий, сброс зависимостей, loading состояния
 */
import { computed, watch, onMounted } from 'vue'
import { useEquipmentCategories } from '../composables/useEquipmentCategories'
import Spinner from '@/shared/ui/atoms/Spinner.vue'

const props = defineProps({
  categoryValue: {
    type: String,
    default: ''
  },
  subcategoryValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showLabels: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:category', 'update:subcategory'])

// Используем composable для управления категориями
const {
  categoryOptions,
  subcategoryOptions,
  isLoadingCategories,
  isLoadingSubcategories,
  isSubcategoryEnabled,
  hasSubcategories,
  selectedCategory,
  selectedSubcategory,
  setCategory,
  setSubcategory,
  categoriesError,
  subcategoriesError
} = useEquipmentCategories()

// Синхронизация с внешними значениями
watch(() => props.categoryValue, (newValue) => {
  if (newValue !== selectedCategory.value) {
    setCategory(newValue)
  }
}, { immediate: true })

watch(() => props.subcategoryValue, (newValue) => {
  if (newValue !== selectedSubcategory.value) {
    setSubcategory(newValue)
  }
}, { immediate: true })

// Отправка изменений наружу
watch(selectedCategory, (newValue) => {
  emit('update:category', newValue)
})

watch(selectedSubcategory, (newValue) => {
  emit('update:subcategory', newValue)
})

// Обработчики изменений
const handleCategoryChange = async (event) => {
  const value = event.target.value
  await setCategory(value)
}

const handleSubcategoryChange = (event) => {
  const value = event.target.value
  setSubcategory(value)
}

// Computed классы для стилизации
const categorySelectClasses = computed(() => [
  'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
  'transition-colors duration-200',
  {
    'cursor-not-allowed bg-gray-50 text-gray-400': props.disabled || isLoadingCategories.value,
    'border-red-300 focus:ring-red-500 focus:border-red-500': categoriesError.value
  }
])

const subcategorySelectClasses = computed(() => [
  'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
  'transition-colors duration-200',
  {
    'cursor-not-allowed bg-gray-50 text-gray-400': 
      props.disabled || !isSubcategoryEnabled.value || isLoadingSubcategories.value,
    'border-red-300 focus:ring-red-500 focus:border-red-500': subcategoriesError.value
  }
])

const subcategoryHelperText = computed(() => {
  if (!selectedCategory.value) {
    return 'Сначала выберите категорию'
  }
  if (isLoadingSubcategories.value) {
    return 'Загрузка подкатегорий...'
  }
  if (!hasSubcategories.value && selectedCategory.value) {
    return 'Подкатегории не найдены'
  }
  return ''
})
</script>

<template>
  <!--
    CategorySelect — интеллектуальный выбор категорий с зависимостями
    Автоматически управляет подкатегориями при смене категории
    Поддерживает loading состояния и валидацию
  -->
  <div class="space-y-4">
    <!-- Выбор категории -->
    <div class="space-y-2">
      <label 
        v-if="showLabels"
        for="category-select"
        class="block text-sm font-medium text-gray-700"
      >
        Категория
      </label>
      
      <div class="relative">
        <select
          id="category-select"
          :value="selectedCategory"
          :class="categorySelectClasses"
          :disabled="disabled || isLoadingCategories"
          :aria-describedby="categoriesError ? 'category-error' : undefined"
          @change="handleCategoryChange"
        >
          <option
            v-for="option in categoryOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <!-- Спиннер загрузки категорий -->
        <div 
          v-if="isLoadingCategories"
          class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
        >
          <Spinner class="h-4 w-4 text-blue-500" />
        </div>
      </div>

      <!-- Ошибка загрузки категорий -->
      <div
        v-if="categoriesError"
        id="category-error"
        class="text-sm text-red-600"
        role="alert"
      >
        {{ categoriesError }}
      </div>
    </div>

    <!-- Выбор подкатегории -->
    <div class="space-y-2">
      <label 
        v-if="showLabels"
        for="subcategory-select"
        class="block text-sm font-medium text-gray-700"
        :class="{ 'text-gray-400': !isSubcategoryEnabled }"
      >
        Подкатегория
      </label>
      
      <div class="relative">
        <select
          id="subcategory-select"
          :value="selectedSubcategory"
          :class="subcategorySelectClasses"
          :disabled="disabled || !isSubcategoryEnabled || isLoadingSubcategories"
          :aria-describedby="subcategoriesError ? 'subcategory-error' : 'subcategory-helper'"
          @change="handleSubcategoryChange"
        >
          <option
            v-for="option in subcategoryOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>

        <!-- Спиннер загрузки подкатегорий -->
        <div 
          v-if="isLoadingSubcategories"
          class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
        >
          <Spinner class="h-4 w-4 text-blue-500" />
        </div>
      </div>

      <!-- Вспомогательный текст -->
      <div
        v-if="subcategoryHelperText"
        id="subcategory-helper"
        class="text-sm text-gray-500"
      >
        {{ subcategoryHelperText }}
      </div>

      <!-- Ошибка загрузки подкатегорий -->
      <div
        v-if="subcategoriesError"
        id="subcategory-error"
        class="text-sm text-red-600"
        role="alert"
      >
        {{ subcategoriesError }}
      </div>
    </div>

    <!-- Индикатор выбранных фильтров -->
    <div 
      v-if="selectedCategory || selectedSubcategory"
      class="p-3 bg-blue-50 border border-blue-200 rounded-lg"
    >
      <div class="text-sm text-blue-800">
        <span class="font-medium">Выбрано:</span>
        <span class="ml-1">
          {{ selectedCategory || 'Все категории' }}
          <template v-if="selectedSubcategory">
            → {{ selectedSubcategory }}
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<!--
  Комментарии к компоненту:
  
  1. Зависимости между фильтрами:
     - При выборе категории автоматически загружаются подкатегории
     - При сбросе категории подкатегория также сбрасывается
     - Подкатегория недоступна без выбранной категории
  
  2. UX-оптимизации:
     - Визуальная обратная связь для всех состояний
     - Понятные подсказки для пользователя
     - Индикатор текущего выбора
     - Плавные переходы и анимации
  
  3. Accessibility:
     - Правильные label и aria-describedby
     - Поддержка screen readers
     - Клавиатурная навигация
     - Role="alert" для ошибок
  
  4. Производительность:
     - Кэширование подкатегорий
     - Минимальные перерендеры
     - Ленивая загрузка данных
--> 