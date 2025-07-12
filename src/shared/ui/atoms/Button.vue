<template>
  <!-- Универсальная кнопка: современный дизайн, Tailwind CSS, accessibility -->
  <button
    :type="type"
    :disabled="disabled"
    :class="computedClass"
    v-bind="$attrs"
  >
    <span v-if="icon" class="mr-2">{{ icon }}</span>
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup>
/**
 * Атомарная кнопка для дизайн-системы.
 * Современный дизайн с использованием только Tailwind CSS.
 * Поддержка различных вариантов, состояний, accessibility.
 * 
 * Пропсы:
 * - label: текст кнопки
 * - icon: эмодзи или текстовая иконка (например, '✓')
 * - type: тип кнопки (button, submit, reset)
 * - disabled: отключение
 * - variant: стиль кнопки (primary, secondary, danger, ghost)
 * - size: размер (sm, md, lg)
 */
import { computed } from 'vue'

const props = defineProps({
  label: String,
  icon: String,
  type: { type: String, default: 'button' },
  disabled: Boolean,
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' }
})

const computedClass = computed(() => {
  const baseClasses = [
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50'
  ]

  // Размеры
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  // Варианты
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
  }

  return [
    ...baseClasses,
    sizeClasses[props.size] || sizeClasses.md,
    variantClasses[props.variant] || variantClasses.primary
  ].join(' ')
})
</script> 