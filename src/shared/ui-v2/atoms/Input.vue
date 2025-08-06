<template>
  <div class="relative">
    <!-- Лейбл -->
    <label 
      v-if="label" 
      :for="inputId"
      class="block text-sm font-medium text-primary mb-2"
    >
      {{ label }}
      <span v-if="required" class="text-danger ml-1">*</span>
    </label>

    <!-- Поле ввода -->
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :class="inputClass"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />

    <!-- Сообщение об ошибке -->
    <p v-if="error" class="text-danger text-sm mt-1">
      {{ error }}
    </p>

    <!-- Подсказка -->
    <p v-else-if="hint" class="text-secondary text-sm mt-1">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
/**
 * Input v2 - поле ввода для новой UI-системы
 * Минималистичный дизайн с фокусом на UX
 */
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date'].includes(value)
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  hint: {
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

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const inputId = ref(`input-${Math.random().toString(36).substr(2, 9)}`)
const isFocused = ref(false)

const handleInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const handleFocus = (event) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event) => {
  isFocused.value = false
  emit('blur', event)
}

const inputClass = computed(() => {
  const baseClasses = [
    'w-full rounded-xl border transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'placeholder:text-secondary/60'
  ]

  // Состояния
  const stateClasses = props.error
    ? [
        'border-danger text-danger',
        'focus:border-danger focus:ring-danger/30'
      ]
    : [
        'border-secondary/30 text-primary',
        'focus:border-primary focus:ring-primary/30',
        'hover:border-secondary/50'
      ]

  // Размеры (mobile-first)
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-sm sm:px-3 sm:py-2',
    md: 'px-3 py-2 text-sm sm:px-4 sm:py-3 sm:text-base',
    lg: 'px-4 py-3 text-base sm:px-6 sm:py-4 sm:text-lg'
  }

  // Фон
  const bgClass = 'bg-accent/50 backdrop-blur-sm'

  return [
    ...baseClasses,
    ...stateClasses,
    sizeClasses[props.size] || sizeClasses.md,
    bgClass
  ].filter(Boolean).join(' ')
})
</script>