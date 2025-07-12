<template>
  <!-- Секция технической информации и категоризации -->
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
      Категоризация
    </h3>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Категория -->
      <FormField 
        label="Категория" 
        :error="errors.category"
        helper="Основная категория оборудования"
        required
      >
        <select
          v-model="localData.category"
          class="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
          :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': errors.category }"
          @change="handleCategoryChange"
        >
          <option value="">Выберите категорию</option>
          <option 
            v-for="category in categories" 
            :key="category" 
            :value="category"
          >
            {{ category }}
          </option>
        </select>
      </FormField>
      
      <!-- Подкатегория -->
      <FormField 
        label="Подкатегория" 
        :error="errors.subcategory"
        helper="Более детальная классификация"
        required
      >
        <select
          v-model="localData.subcategory"
          :disabled="!localData.category || !availableSubcategories.length"
          class="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': errors.subcategory }"
          @change="validateField('subcategory', localData.subcategory)"
        >
          <option value="">
            {{ localData.category ? 'Выберите подкатегорию' : 'Сначала выберите категорию' }}
          </option>
          <option 
            v-for="subcategory in availableSubcategories" 
            :key="subcategory" 
            :value="subcategory"
          >
            {{ subcategory }}
          </option>
        </select>
      </FormField>
    </div>
    
    <!-- Информационная подсказка -->
    <div v-if="localData.category" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-blue-700">
            <strong>{{ localData.category }}</strong>
            <span v-if="localData.subcategory"> → {{ localData.subcategory }}</span>
          </p>
          <p class="text-xs text-blue-600 mt-1">
            Правильная категоризация поможет быстрее находить оборудование
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент для ввода технической информации и категоризации оборудования
 * Включает: категорию, подкатегорию с зависимостями
 * Интегрирован с дизайн-системой и валидацией
 */
import { computed } from 'vue'
import FormField from '@/shared/ui/molecules/FormField.vue'

// Пропсы
const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  errors: {
    type: Object,
    default: () => ({})
  },
  categories: {
    type: Array,
    default: () => []
  },
  subcategoriesMap: {
    type: Object,
    default: () => ({})
  },
  validateField: {
    type: Function,
    default: () => {}
  },
  onCategoryChange: {
    type: Function,
    default: () => {}
  }
})

// События
const emit = defineEmits(['update:modelValue'])

// Локальная копия данных для v-model
const localData = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Доступные подкатегории для выбранной категории
const availableSubcategories = computed(() => {
  if (!localData.value.category) return []
  return props.subcategoriesMap[localData.value.category] || []
})

// Обработка изменения категории
const handleCategoryChange = () => {
  // Сбрасываем подкатегорию при смене категории
  localData.value.subcategory = ''
  
  // Валидируем категорию
  props.validateField('category', localData.value.category)
  
  // Вызываем callback если передан
  if (props.onCategoryChange) {
    props.onCategoryChange()
  }
}
</script> 