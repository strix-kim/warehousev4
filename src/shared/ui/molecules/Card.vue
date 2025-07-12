<template>
  <!-- Современная карточка: светлая тема, тени, варианты, адаптивность -->
  <div :class="computedClass" role="region" :aria-label="ariaLabel" v-bind="$attrs">
    <!-- Header слот с оптимизированными отступами -->
    <div v-if="$slots.header" class="mb-4">
      <slot name="header" />
    </div>
    
    <!-- Основной контент -->
    <div class="flex-1">
      <slot />
    </div>
    
    <!-- Footer слот -->
    <div v-if="$slots.footer" class="mt-6 pt-4 border-t border-gray-100">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
/**
 * Современный компонент Card для дизайн-системы.
 * Светлая тема, множественные варианты, адаптивность, accessibility.
 * 
 * Особенности:
 * - Светлая тема с тонкими тенями
 * - Варианты: default, elevated, outlined, interactive
 * - Размеры: sm, md, lg, xl
 * - Hover-эффекты для интерактивных карточек
 * - Полная адаптивность
 * - Accessibility поддержка
 * 
 * Пропсы:
 * - variant: стиль карточки (default, elevated, outlined, interactive)
 * - size: размер (sm, md, lg, xl)
 * - ariaLabel: подпись для accessibility
 * - interactive: интерактивная карточка (hover эффекты)
 */
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'md' },
  ariaLabel: { type: String, default: 'Карточка' },
  interactive: { type: Boolean, default: false }
})

const computedClass = computed(() => {
  const baseClasses = [
    'bg-white rounded-xl border border-gray-200',
    'flex flex-col transition-all duration-200',
    'w-full'
  ]

  // Варианты
  const variantClasses = {
    default: 'shadow-sm',
    elevated: 'shadow-lg',
    outlined: 'border-2 border-gray-300 shadow-none',
    interactive: 'shadow-sm hover:shadow-md cursor-pointer'
  }

  // Размеры (отступы)
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  }

  // Интерактивность
  const interactiveClasses = props.interactive ? [
    'hover:shadow-lg hover:-translate-y-0.5',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    'cursor-pointer'
  ] : []

  return [
    ...baseClasses,
    variantClasses[props.variant] || variantClasses.default,
    sizeClasses[props.size] || sizeClasses.md,
    ...interactiveClasses
  ].join(' ')
})
</script> 