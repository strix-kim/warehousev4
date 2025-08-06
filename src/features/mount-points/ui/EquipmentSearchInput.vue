<!-- 
  EquipmentSearchInput.vue — Простой компонент поиска для модального окна
  Архитектурная роль: UI поиска оборудования в модальном окне
  Особенности: упрощенный дизайн, быстрая фильтрация, адаптивность
-->
<template>
  <div class="relative w-full">
    <!-- Поле поиска -->
    <div class="relative">
      <input
        ref="searchInputRef"
        :value="modelValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        type="text"
        :placeholder="placeholder"
        class="w-full px-4 py-3 pl-12 pr-10 text-gray-900 bg-white border border-gray-300 rounded-lg 
               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none
               transition-colors duration-200 placeholder-gray-500"
        autocomplete="off"
        spellcheck="false"
      />
      
      <!-- Иконка поиска -->
      <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
        <Icon name="Search" set="lucide" size="sm" class="text-gray-400" />
      </div>

      <!-- Кнопка очистки -->
      <button
        v-if="modelValue"
        @click="handleClear"
        @mousedown.prevent
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 
               focus:outline-none focus:text-gray-600 transition-colors duration-200"
        aria-label="Очистить поиск"
      >
        <Icon name="X" set="lucide" size="sm" />
      </button>
    </div>

    <!-- Подсказка по поиску -->
    <div v-if="modelValue && showSuggestions" class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-start gap-2">
        <Icon name="Info" set="lucide" size="sm" class="text-blue-600 mt-0.5 flex-shrink-0" />
        <div class="text-xs text-blue-700">
          <p class="font-medium mb-1">Поиск по:</p>
          <ul class="space-y-1 text-blue-600">
            <li>• <strong>Бренду</strong> оборудования</li>
            <li>• <strong>Модели</strong> оборудования</li>
            <li>• <strong>Полному названию</strong> (бренд + модель)</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Поиск оборудования...'
  }
})

const emit = defineEmits(['update:modelValue', 'search'])

// Локальные состояния
const searchInputRef = ref(null)
const showSuggestions = ref(false)

// Обработчики событий
const handleInput = (event) => {
  const value = event.target.value
  emit('update:modelValue', value)
  emit('search', value)
  
  // Показываем подсказку при вводе
  if (value.length > 0) {
    showSuggestions.value = true
  } else {
    showSuggestions.value = false
  }
}

const handleFocus = () => {
  if (props.modelValue && props.modelValue.length > 0) {
    showSuggestions.value = true
  }
}

const handleBlur = () => {
  // Скрываем подсказку с небольшой задержкой для возможности клика
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('search', '')
  showSuggestions.value = false
  
  // Фокусируемся на поле ввода после очистки
  nextTick(() => {
    if (searchInputRef.value) {
      searchInputRef.value.focus()
    }
  })
}

// Экспортируем методы для внешнего использования
defineExpose({
  focus: () => searchInputRef.value?.focus(),
  blur: () => searchInputRef.value?.blur(),
  clear: handleClear
})
</script> 