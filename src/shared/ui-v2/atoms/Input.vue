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
      :class="[inputClass, leftPaddingClass, rightPaddingClass]"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />

    <!-- Prefix Icon -->
    <span v-if="prefixIcon" class="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
      <IconV2 :name="prefixIcon" size="sm" class="text-secondary" />
    </span>

    <!-- Suffix Icon (display only) -->
    <span v-if="suffixIcon" class="absolute inset-y-0 right-3 flex items-center pointer-events-none z-10">
      <IconV2 :name="suffixIcon" size="sm" class="text-secondary" />
    </span>

    <!-- Сообщение об ошибке -->
    <p v-if="error && showError" class="text-danger text-sm mt-1">
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
import IconV2 from './Icon.vue'

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
  },
  showError: {
    type: Boolean,
    default: true
  },
  prefixIcon: {
    type: String,
    default: ''
  },
  suffixIcon: {
    type: String,
    default: ''
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

// Dynamic padding for icons to avoid text overlap
const leftPaddingClass = computed(() => {
  if (!props.prefixIcon) return ''
  const map = { sm: 'pl-8', md: 'pl-10', lg: 'pl-12' }
  return map[props.size] || 'pl-10'
})

const rightPaddingClass = computed(() => {
  if (!props.suffixIcon) return ''
  const map = { sm: 'pr-8', md: 'pr-10', lg: 'pr-12' }
  return map[props.size] || 'pr-10'
})
</script>