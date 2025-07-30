<!-- 
  EquipmentSearchInput.vue — УСОВЕРШЕНСТВОВАННЫЙ компонент поиска с отказоустойчивым фокусом
  Архитектурная роль: UI поиска с автодополнением, интеграция с новой системой фокуса
  КРИТИЧЕСКИЕ УЛУЧШЕНИЯ:
  - Интеграция с новой системой приоритетов защиты фокуса
  - Поддержка снимков состояния курсора
  - Мониторинг и диагностика фокуса
  - Устранение всех выявленных багов
-->
<template>
  <div class="relative w-full">
    <!-- Основное поле поиска -->
    <div class="relative">
      <input
        ref="searchInputRef"
        :value="props.modelValue || searchQuery"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
        type="text"
        :placeholder="props.placeholder"
        class="w-full px-4 py-3 pl-12 pr-10 text-gray-900 bg-white border border-gray-300 rounded-lg 
               focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none
               transition-colors duration-200 placeholder-gray-500"
        autocomplete="off"
        spellcheck="false"
      />
      
      <!-- Иконка поиска -->
      <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
        <svg 
          class="w-5 h-5 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <!-- Кнопка очистки или индикатор загрузки -->
      <div class="absolute inset-y-0 right-0 flex items-center pr-3">
        <!-- Спиннер загрузки -->
        <div
          v-if="isSearching"
          class="w-5 h-5 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"
          aria-label="Поиск..."
        />
        
        <!-- Кнопка очистки -->
        <button
          v-else-if="searchQuery"
          @click="handleClear"
          @mousedown.prevent
          type="button"
          class="w-5 h-5 text-gray-400 hover:text-gray-600 focus:outline-none 
                 focus:text-gray-600 transition-colors duration-200"
          aria-label="Очистить поиск"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Выпадающий список подсказок -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="shouldShowSuggestions"
        class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg 
               max-h-80 overflow-y-auto"
      >
        <!-- Состояние загрузки -->
        <div
          v-if="isSearching && !hasSuggestions"
          class="px-4 py-3 text-sm text-gray-500 text-center"
        >
          <div class="flex items-center justify-center space-x-2">
            <div class="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
            <span>Поиск...</span>
          </div>
        </div>

        <!-- Ошибка -->
        <div
          v-else-if="suggestionError"
          class="px-4 py-3 text-sm text-red-600 text-center"
        >
          Ошибка поиска: {{ suggestionError }}
        </div>

        <!-- Список подсказок -->
        <ul v-else-if="hasSuggestions" class="py-1">
          <li
            v-for="(suggestion, index) in suggestions"
            :key="suggestion.id || index"
            @click="handleSuggestionClick(suggestion)"
            @mouseenter="handleSuggestionHover(index)"
            :class="[
              'px-4 py-2 cursor-pointer transition-colors duration-150',
              index === selectedSuggestionIndex
                ? 'bg-red-50 text-red-900'
                : 'text-gray-900 hover:bg-gray-50'
            ]"
          >
            <!-- Подсвеченный текст подсказки -->
            <div class="flex items-center space-x-3">
              <!-- Иконка типа оборудования -->
              <div class="flex-shrink-0">
                <div class="w-2 h-2 bg-red-500 rounded-full" />
              </div>
              
              <!-- Текст с выделением -->
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">
                  <template v-if="typeof getHighlightedSuggestion(suggestion) === 'object'">
                    <span>{{ getHighlightedSuggestion(suggestion).before }}</span>
                    <mark class="bg-yellow-200 text-gray-900 font-semibold">
                      {{ getHighlightedSuggestion(suggestion).match }}
                    </mark>
                    <span>{{ getHighlightedSuggestion(suggestion).after }}</span>
                  </template>
                  <template v-else>
                    {{ getHighlightedSuggestion(suggestion) }}
                  </template>
                </div>
                
                <!-- Дополнительная информация -->
                <div v-if="suggestion.category" class="text-xs text-gray-500 truncate">
                  {{ suggestion.category }}
                </div>
              </div>
            </div>
          </li>
        </ul>

        <!-- Пустой результат -->
        <div
          v-else
          class="px-4 py-3 text-sm text-gray-500 text-center"
        >
          Ничего не найдено
        </div>
      </div>
    </Transition>

    <!-- УЛУЧШЕНИЕ: Диагностическая панель (только в dev режиме) -->
    <div
      v-if="showDiagnostics && isDevelopment"
      class="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 font-mono"
    >
      <div>Защита: {{ focusState.isProtected ? focusState.protectionLevel : 'нет' }}</div>
      <div>Приоритет: {{ focusState.currentPriority }}</div>
      <div>Операция: {{ focusState.lastOperation || 'нет' }}</div>
      <div>Снимок: {{ focusState.snapshot ? 'есть' : 'нет' }}</div>
      <div>Pending: {{ pendingOperationsCount }}</div>
    </div>
  </div>
</template>

<script setup>
/**
 * EquipmentSearchInput.vue — Компонент поиска с усовершенствованным управлением фокусом
 * Интегрирован с новой системой защиты фокуса с приоритетами и снимками состояния
 */
import { computed, nextTick } from 'vue'
import { useEquipmentSearch } from '../composables/useEquipmentSearch'

// Props
const props = defineProps({
  /** Показывать ли диагностическую информацию */
  showDiagnostics: {
    type: Boolean,
    default: false
  },
  /** Значение для внешнего управления */
  modelValue: {
    type: String,
    default: ''
  },
  /** Placeholder для поля ввода */
  placeholder: {
    type: String,
    default: 'Поиск оборудования...'
  }
})

// Events
const emit = defineEmits(['search', 'select', 'update:modelValue'])

// Композабл с усовершенствованной системой фокуса
const {
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
  
  // Новые методы управления фокусом
  preserveFocus,
  restoreFocus,
  robustRestoreFocus,
  protectFocus,
  createFocusSnapshot,
  
  // Диагностика
  focusState,
  getFocusReport
} = useEquipmentSearch()

// Вспомогательные computed
const isDevelopment = computed(() => process.env.NODE_ENV === 'development')
const pendingOperationsCount = computed(() => {
  // Подсчитываем количество активных операций через focusState
  return focusState.value.lastOperation === 'restore_success' ? 0 : 1
})

/**
 * ИСПРАВЛЕННЫЙ обработчик ввода с корректной логикой поиска
 */
const handleInput = (event) => {
  const newValue = event.target.value
  const oldValue = searchQuery.value
  
  // Сбрасываем состояние выбора при ручном вводе
  if (focusState.value.lastOperation === 'suggestion_selected') {
    focusState.value.lastOperation = 'manual_input'
  }
  
  // ИСПРАВЛЕНИЕ: Специальная защита при полном удалении
  if (newValue === '' && oldValue !== '') {
    const snapshot = preserveFocus(500, 'critical') // Критическая защита
    setSearchQuery(newValue)
    
    // Дополнительная защита через nextTick
    nextTick(() => {
      if (document.activeElement !== searchInputRef.value) {
        robustRestoreFocus(snapshot)
      }
    })
  } else {
    // Обычная обработка с нормальной защитой
    const snapshot = preserveFocus(200, 'normal')
    setSearchQuery(newValue)
  }
  
  emit('search', newValue)
  emit('update:modelValue', newValue)
}

/**
 * ИСПРАВЛЕННЫЙ обработчик получения фокуса
 */
const handleFocus = () => {
  // Защищаем фокус при получении
  protectFocus(100, 'normal')
  
  // Показываем подсказки только если не находимся в процессе выбора
  if (focusState.value.lastOperation !== 'suggestion_selected') {
    showSuggestionsIfAvailable()
  }
}

/**
 * УЛУЧШЕНИЕ: Обработчик потери фокуса с проверкой защиты
 */
const handleBlur = (event) => {
  // Не обрабатываем blur, если фокус защищён
  if (focusState.value.isProtected) {
    event.preventDefault()
    return
  }
  
  // Небольшая задержка для обработки кликов по подсказкам
  setTimeout(() => {
    if (!focusState.value.isProtected) {
      hideSuggestions()
    }
  }, 150)
}

/**
 * Обработчик нажатий клавиш
 */
const handleKeydown = (event) => {
  const result = handleKeyNavigation(event)
  
  if (result && typeof result === 'string') {
    emit('select', result)
  }
}

/**
 * УЛУЧШЕНИЕ: Обработчик клика по подсказке с защитой фокуса
 */
const handleSuggestionClick = (suggestion) => {
  const snapshot = preserveFocus(300, 'high')
  const result = selectSuggestion(suggestion)
  
  emit('select', result)
  
  // Восстанавливаем фокус после выбора
  nextTick(() => {
    restoreFocus(snapshot)
  })
}

/**
 * Обработчик наведения на подсказку
 */
const handleSuggestionHover = (index) => {
  selectedSuggestionIndex.value = index
}

/**
 * УЛУЧШЕНИЕ: Обработчик очистки с критической защитой фокуса
 */
const handleClear = () => {
  const snapshot = preserveFocus(500, 'critical')
  clearSearch()
  emit('search', '')
  
  // Дополнительная проверка восстановления фокуса
  nextTick(() => {
    if (document.activeElement !== searchInputRef.value) {
      robustRestoreFocus(snapshot)
    }
  })
}

// Expose для тестирования и отладки
defineExpose({
  searchInputRef,
  focusState,
  getFocusReport,
  robustRestoreFocus
})
</script>

<style scoped>
/* Стили для выделения в подсказках */
mark {
  background-color: #fef3c7;
  color: #92400e;
  padding: 1px 2px;
  border-radius: 2px;
}

/* Анимации для smooth transitions */
.transition {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Скрытие скроллбара в подсказках для чистого вида */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style> 