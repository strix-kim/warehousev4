<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClass"
    @click="handleClick"
  >
    <!-- Иконка загрузки -->
    <SpinnerV2 v-if="loading" :size="spinnerSize" color="current" :class="{ 'mr-2': hasText }" />
    
    <!-- Иконка слева -->
    <span v-else-if="$slots.icon" :class="{ 'mr-2': hasText }">
      <slot name="icon"></slot>
    </span>

    <!-- Текст кнопки -->
    <span v-if="hasText">
      <slot></slot>
    </span>
  </button>
</template>

<script setup>
/**
 * Button v2 - минималистичная кнопка для новой UI-системы
 * Использует новую цветовую палитру и Bento-принципы
 */
import { computed, useSlots } from 'vue'
import SpinnerV2 from './Spinner.vue'

const slots = useSlots()

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => [
      'primary', 'secondary', 'ghost', 'minimal',
      'brand-red', 'brand-deep-red', 'success', 'warning', 'error',
      'danger', 'info'
    ].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
  },
  type: {
    type: String,
    default: 'button',
    validator: (value) => ['button', 'submit', 'reset'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  fullWidth: {
    type: Boolean,
    default: false
  },

})

const emit = defineEmits(['click'])

const handleClick = (event) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}

// Простая проверка: есть ли контент в default слоте
const hasText = computed(() => {
  return !!(slots.default && slots.default().length > 0)
})

const buttonClass = computed(() => {
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-xl',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ]

  // Варианты
  const variantClasses = {
    // Фирменные цвета
    primary: [
      'bg-primary text-accent',
      'hover:bg-primary/90',
      'focus:ring-primary/50'
    ],
    secondary: [
      'bg-secondary text-accent',
      'hover:bg-secondary/90',
      'focus:ring-secondary/50'
    ],
    'brand-red': [
      'bg-[var(--color-brand-red)] text-accent',
      'hover:bg-[color-mix(in_oklab,var(--color-brand-red),#000_10%)]',
      'focus:ring-[color-mix(in_oklab,var(--color-brand-red),#000_30%)]'
    ],
    'brand-deep-red': [
      'bg-[var(--color-brand-deep-red)] text-accent',
      'hover:bg-[color-mix(in_oklab,var(--color-brand-deep-red),#000_10%)]',
      'focus:ring-[color-mix(in_oklab,var(--color-brand-deep-red),#000_30%)]'
    ],
    
    // Семантические цвета
    success: [
      'bg-success text-white',
      'hover:bg-success/90',
      'focus:ring-success/50'
    ],
    warning: [
      'bg-warning text-white',
      'hover:bg-warning/90',
      'focus:ring-warning/50'
    ],
    error: [
      'bg-error text-white',
      'hover:bg-error/90',
      'focus:ring-error/50'
    ],
    danger: [
      'bg-error text-white',
      'hover:bg-error/90',
      'focus:ring-error/50'
    ],
    info: [
      'bg-info text-white',
      'hover:bg-info/90',
      'focus:ring-info/50'
    ],
    
    // Специальные варианты
    ghost: [
      'bg-transparent text-primary border border-primary/20',
      'hover:bg-primary/5',
      'focus:ring-primary/30'
    ],
    minimal: [
      'bg-transparent text-secondary',
      'hover:text-primary hover:bg-accent/50',
      'focus:ring-secondary/30'
    ]
  }

  // Размеры (mobile-first)
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm',
    md: 'px-3 py-1.5 text-sm sm:px-4 sm:py-2',
    lg: 'px-4 py-2 text-sm sm:px-6 sm:py-3 sm:text-base',
    xl: 'px-6 py-3 text-base sm:px-8 sm:py-4 sm:text-lg'
  }

  // Полная ширина
  const widthClass = props.fullWidth ? 'w-full' : ''

  return [
    ...baseClasses,
    ...(variantClasses[props.variant] || variantClasses.primary),
    sizeClasses[props.size] || sizeClasses.md,
    widthClass
  ].filter(Boolean).join(' ')
})

// Размер спиннера в зависимости от размера кнопки
const spinnerSize = computed(() => {
  const sizes = {
    sm: 'sm',
    md: 'sm', 
    lg: 'md',
    xl: 'lg'
  }
  return sizes[props.size] || 'sm'
})
</script>