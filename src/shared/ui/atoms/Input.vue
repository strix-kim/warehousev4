<template>
  <!-- Универсальное текстовое поле: современный дизайн, Tailwind CSS, accessibility -->
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :class="computedClass"
    @input="$emit('update:modelValue', $event.target.value)"
    v-bind="$attrs"
  />
</template>

<script setup>
/**
 * Атомарное поле ввода для дизайн-системы.
 * Современный дизайн с использованием только Tailwind CSS.
 * Поддержка v-model, различных типов, состояний, accessibility.
 * 
 * Пропсы:
 * - modelValue: значение (v-model)
 * - type: тип поля (text, email, password, number, etc.)
 * - placeholder: текст подсказки
 * - disabled: отключение
 * - ariaLabel: подпись для accessibility
 * - variant: стиль поля (default, error, success)
 * - size: размер (sm, md, lg)
 * 
 * События:
 * - update:modelValue: обновление значения для v-model
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: [String, Number],
  type: { type: String, default: 'text' },
  placeholder: String,
  disabled: Boolean,
  ariaLabel: String,
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'md' }
})

defineEmits(['update:modelValue'])

const computedClass = computed(() => {
  const baseClasses = [
    'block w-full rounded-lg border transition-colors duration-200',
    'bg-white text-gray-900 placeholder-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100'
  ]

  // Размеры
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  // Варианты
  const variantClasses = {
    default: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
    error: 'border-red-300 focus:border-red-500 focus:ring-red-500',
    success: 'border-green-300 focus:border-green-500 focus:ring-green-500'
  }

  return [
    ...baseClasses,
    sizeClasses[props.size] || sizeClasses.md,
    variantClasses[props.variant] || variantClasses.default
  ].join(' ')
})
</script> 