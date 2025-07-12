<template>
  <!-- Компонент выбора локации: существующие + возможность добавить новую -->
  <div class="space-y-2">
    <!-- Основное поле ввода/выбора -->
    <div class="relative">
      <input
        v-model="inputValue"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'transition-colors duration-200',
          {
            'cursor-not-allowed bg-gray-50 text-gray-400': disabled,
            'border-red-300 focus:border-red-500 focus:ring-red-500': variant === 'error'
          }
        ]"
        @input="handleInput"
        @focus="showSuggestions = true"
        @blur="handleBlur"
        @keydown.down.prevent="highlightNext"
        @keydown.up.prevent="highlightPrevious"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="hideSuggestions"
      />
      
      <!-- Иконка загрузки -->
      <div v-if="loading" class="absolute right-3 top-1/2 transform -translate-y-1/2">
        <svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>

    <!-- Выпадающий список с существующими локациями -->
    <div
      v-if="showSuggestions && filteredLocations.length > 0"
      class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
    >
      <div class="p-2">
        <div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-2">
          Существующие локации
        </div>
        
        <div
          v-for="(location, index) in filteredLocations"
          :key="location"
          :class="[
            'flex items-center px-3 py-2 text-sm cursor-pointer rounded-lg',
            {
              'bg-blue-100 text-blue-900': index === highlightedIndex,
              'text-gray-900 hover:bg-gray-50': index !== highlightedIndex
            }
          ]"
          @mousedown.prevent="selectLocation(location)"
          @mouseenter="highlightedIndex = index"
        >
          <svg class="h-4 w-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          {{ location }}
        </div>
      </div>
      
      <!-- Опция добавления новой локации -->
      <div v-if="canAddNew" class="border-t border-gray-200 p-2">
        <div
          :class="[
            'flex items-center px-3 py-2 text-sm cursor-pointer rounded-lg',
            {
              'bg-green-100 text-green-900': highlightedIndex === filteredLocations.length,
              'text-green-700 hover:bg-green-50': highlightedIndex !== filteredLocations.length
            }
          ]"
          @mousedown.prevent="selectNewLocation"
          @mouseenter="highlightedIndex = filteredLocations.length"
        >
          <svg class="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Добавить новую: "{{ inputValue }}"
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент выбора локации с автодополнением
 * Позволяет выбрать существующую локацию или добавить новую
 * Интегрирован с API для получения списка существующих локаций
 */
import { ref, computed, onMounted, watch } from 'vue'
import { fetchEquipmentLocations } from '../equipmentApi'

// Пропсы
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Выберите локацию или введите новую'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'error'].includes(value)
  }
})

// События
const emit = defineEmits(['update:modelValue'])

// Локальные состояния
const inputValue = ref(props.modelValue)
const showSuggestions = ref(false)
const availableLocations = ref([])
const loading = ref(false)
const highlightedIndex = ref(-1)

// Computed свойства
const filteredLocations = computed(() => {
  if (!inputValue.value) return availableLocations.value

  return availableLocations.value.filter(location =>
    location.toLowerCase().includes(inputValue.value.toLowerCase())
  )
})

const canAddNew = computed(() => {
  return inputValue.value && 
         inputValue.value.trim() && 
         !availableLocations.value.some(loc => 
           loc.toLowerCase() === inputValue.value.toLowerCase()
         )
})

// Методы
const handleInput = (event) => {
  inputValue.value = event.target.value
  emit('update:modelValue', inputValue.value)
  showSuggestions.value = true
  highlightedIndex.value = -1
}

const handleBlur = () => {
  // Задержка, чтобы клик по подсказке успел обработаться
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

const selectLocation = (location) => {
  inputValue.value = location
  emit('update:modelValue', location)
  hideSuggestions()
}

const selectNewLocation = () => {
  // Новая локация уже в inputValue, просто скрываем подсказки
  hideSuggestions()
}

const hideSuggestions = () => {
  showSuggestions.value = false
  highlightedIndex.value = -1
}

const highlightNext = () => {
  const maxIndex = filteredLocations.value.length + (canAddNew.value ? 0 : -1)
  highlightedIndex.value = Math.min(highlightedIndex.value + 1, maxIndex)
}

const highlightPrevious = () => {
  highlightedIndex.value = Math.max(highlightedIndex.value - 1, -1)
}

const selectHighlighted = () => {
  if (highlightedIndex.value === -1) return
  
  if (highlightedIndex.value < filteredLocations.value.length) {
    selectLocation(filteredLocations.value[highlightedIndex.value])
  } else if (canAddNew.value) {
    selectNewLocation()
  }
}

const loadLocations = async () => {
  loading.value = true
  try {
    const { data, error } = await fetchEquipmentLocations()
    if (error) {
      console.error('Ошибка загрузки локаций:', error)
      return
    }
    availableLocations.value = data
  } catch (error) {
    console.error('Ошибка загрузки локаций:', error)
  } finally {
    loading.value = false
  }
}

// Загружаем локации при монтировании
onMounted(() => {
  loadLocations()
})

// Синхронизируем с props.modelValue
watch(() => props.modelValue, (newValue) => {
  inputValue.value = newValue
})
</script> 