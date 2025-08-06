<template>
  <div class="relative w-full" v-bind="$attrs">
    <!-- Лейбл -->
    <label v-if="label" :for="selectId" class="block text-sm font-medium text-primary mb-2">
      {{ label }}
      <span v-if="required" class="text-[var(--color-error)] ml-1">*</span>
    </label>

    <!-- Кнопка селектора -->
    <button
      :id="selectId"
      ref="triggerButton"
      type="button"
      :class="buttonClasses"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <!-- Отображаемое значение -->
      <span class="flex-1 text-left truncate text-primary">
        {{ displayText }}
      </span>
      
      <!-- Иконка -->
      <IconV2 
        :name="isOpen ? 'chevron-up' : 'chevron-down'" 
        size="sm" 
        color="secondary" 
        class="flex-shrink-0 transition-transform duration-200"
      />
    </button>

    <!-- Подсказка -->
    <p v-if="hint && !error" class="mt-1 text-xs text-secondary">
      {{ hint }}
    </p>

    <!-- Ошибка -->
    <p v-if="error" class="mt-1 text-xs text-[var(--color-error)]">
      {{ error }}
    </p>
  </div>

  <!-- Выпадающий список (телепортируется в body) -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="dropdown"
      :style="dropdownStyles"
      class="fixed z-50 bg-white rounded-lg shadow-lg border border-secondary/20 py-1 max-h-60 overflow-auto min-w-48"
      role="listbox"
      :aria-labelledby="selectId"
    >
      <!-- Опции -->
      <div
        v-for="option in options"
        :key="getOptionValue(option)"
        :class="optionClasses(option)"
        role="option"
        :aria-selected="isSelected(option)"
        @click="selectOption(option)"
      >
        <span class="flex-1">{{ getOptionLabel(option) }}</span>
        
        <!-- Чекмарк для выбранной опции -->
        <IconV2
          v-if="isSelected(option)"
          name="check"
          size="sm"
          color="primary"
          class="ml-2 flex-shrink-0"
        />
      </div>

      <!-- Сообщение о пустых опциях -->
      <div
        v-if="options.length === 0"
        class="px-3 py-6 text-center text-secondary text-sm"
      >
        Нет доступных опций
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * SelectV2 - упрощенный селект для UI Kit v2
 * УПРОЩЕНО: убран поиск, мульти-селект, сложная логика
 * ФОКУС: надежность, простота, производительность
 */
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import IconV2 from './Icon.vue'

// Генерация уникального ID
let selectIdCounter = 0
const generateId = () => `select-v2-${++selectIdCounter}`

const props = defineProps({
  modelValue: {
    type: [String, Number, Object],
    default: null
  },
  options: {
    type: Array,
    default: () => []
  },
  optionValue: {
    type: String,
    default: 'value'
  },
  optionLabel: {
    type: String,
    default: 'label'
  },
  placeholder: {
    type: String,
    default: 'Выберите опцию...'
  },
  label: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur'])

// Локальное состояние
const isOpen = ref(false)
const triggerButton = ref(null)
const dropdown = ref(null)
const selectId = ref(generateId())

// Размеры
const sizeClasses = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-sm', 
  lg: 'h-12 text-base'
}

// Computed стили
const buttonClasses = computed(() => [
  'w-full flex items-center justify-between px-3 py-2 bg-white border rounded-lg',
  'transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20',
  'focus-visible:ring-2 focus-visible:ring-primary/30',
  {
    'border-[var(--color-error)] ring-1 ring-[var(--color-error)]/20': props.error,
    'border-secondary/30 hover:border-secondary/50': !props.error && !props.disabled && !isOpen.value,
    'border-primary ring-2 ring-primary/20': isOpen.value && !props.error,
    'border-secondary/20 bg-accent text-secondary cursor-not-allowed': props.disabled
  },
  sizeClasses[props.size]
])

const optionClasses = (option) => [
  'px-3 py-2 cursor-pointer hover:bg-accent flex items-center justify-between transition-colors duration-150',
  {
    'bg-primary/10 text-primary font-medium': isSelected(option),
    'text-primary': !isSelected(option)
  }
]

// Позиционирование dropdown
const dropdownStyles = ref({})

const updateDropdownPosition = () => {
  if (!triggerButton.value || !isOpen.value) return

  const rect = triggerButton.value.getBoundingClientRect()
  const dropdownHeight = 240 // max-h-60 = 240px
  const spaceBelow = window.innerHeight - rect.bottom - 10
  const spaceAbove = rect.top - 10

  const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

  dropdownStyles.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 50,
    ...(shouldOpenUpward 
      ? { bottom: `${window.innerHeight - rect.top}px` }
      : { top: `${rect.bottom}px` }
    )
  }
}

// Утилиты для работы с опциями
const getOptionValue = (option) => {
  if (typeof option === 'object' && option !== null) {
    return option[props.optionValue]
  }
  return option
}

const getOptionLabel = (option) => {
  if (typeof option === 'object' && option !== null) {
    return option[props.optionLabel] || option[props.optionValue] || String(option)
  }
  return String(option)
}

const isSelected = (option) => {
  const optionVal = getOptionValue(option)
  const modelVal = props.modelValue
  
  if (typeof modelVal === 'object' && modelVal !== null) {
    return getOptionValue(modelVal) === optionVal
  }
  
  return modelVal === optionVal
}

// Отображаемый текст
const displayText = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }
  
  const selectedOption = props.options.find(option => isSelected(option))
  if (selectedOption) {
    return getOptionLabel(selectedOption)
  }
  
  // Fallback если modelValue не найден в опциях
  return String(props.modelValue)
})

// Методы
const toggle = () => {
  if (props.disabled) return
  
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

const open = () => {
  isOpen.value = true
  emit('focus')
  nextTick(() => {
    updateDropdownPosition()
  })
}

const close = () => {
  isOpen.value = false
  emit('blur')
}

const selectOption = (option) => {
  const value = getOptionValue(option)
  emit('update:modelValue', value)
  emit('change', value)
  close()
}

// Keyboard navigation
const handleKeydown = (event) => {
  if (props.disabled) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      toggle()
      break
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault()
        close()
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) {
        open()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) {
        open()
      }
      break
  }
}

// Click outside handler
const handleClickOutside = (event) => {
  if (!isOpen.value) return
  
  const triggerEl = triggerButton.value
  const dropdownEl = dropdown.value
  
  if (
    triggerEl && !triggerEl.contains(event.target) &&
    dropdownEl && !dropdownEl.contains(event.target)
  ) {
    close()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  window.addEventListener('resize', updateDropdownPosition)
  window.addEventListener('scroll', updateDropdownPosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})

// Expose for template refs
defineOptions({
  inheritAttrs: false
})

defineExpose({
  open,
  close,
  toggle,
  focus: () => triggerButton.value?.focus()
})
</script>

<style scoped>
/* Кастомные стили для accessibility */
.focus-visible\:ring-2:focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
}
</style>