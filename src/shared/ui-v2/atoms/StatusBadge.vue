<template>
  <span 
    :class="[baseClasses, variantClass, sizeClass]"
    :aria-label="ariaLabel"
    role="status"
  >
    <IconV2 
      v-if="icon" 
      :name="icon" 
      :size="iconSize" 
      color="current" 
      class="flex-shrink-0"
    />
    <span class="text-center">{{ label }}</span>
  </span>
</template>

<script setup>
/**
 * StatusBadge v2 - универсальный бейдж для статусов
 * Критически важен для EPR System management: статусы оборудования, роли, состояния
 */
import { computed } from 'vue'
import IconV2 from './Icon.vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => [
      'default', 'primary', 'secondary', 'brand-red', 'brand-deep-red',
      'success', 'warning', 'error', 'info',
      'available', 'in-use', 'maintenance', 'retired', 'active', 'inactive'
    ].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg'].includes(value)
  },
  icon: {
    type: String,
    default: ''
  },
  pulse: {
    type: Boolean,
    default: false
  }
})

const baseClasses = [
  'inline-flex items-center justify-center gap-1 font-medium rounded-full border transition-all duration-200',
  { 'animate-pulse': props.pulse }
]

// Размеры (mobile-first)
const sizeClass = computed(() => {
  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs sm:px-3 sm:py-1 sm:text-sm',
    lg: 'px-3 py-1 text-sm sm:px-4 sm:py-1.5 sm:text-base'
  }
  return sizes[props.size]
})

// Размер иконки в зависимости от размера бейджа
const iconSize = computed(() => {
  const iconSizes = {
    xs: 'xs',
    sm: 'xs',
    md: 'sm', 
    lg: 'md'
  }
  return iconSizes[props.size]
})

// Варианты для EPR System статусов
const variantClass = computed(() => {
  const variants = {
    // Базовые варианты
    default: 'bg-accent text-secondary border-secondary/30',
    primary: 'bg-primary text-accent border-primary',
    secondary: 'bg-secondary text-accent border-secondary',
    
    // Фирменные цвета
    'brand-red': 'bg-[var(--color-brand-red)] text-accent border-[var(--color-brand-red)]',
    'brand-deep-red': 'bg-[var(--color-brand-deep-red)] text-accent border-[var(--color-brand-deep-red)]',
    
    // Семантические цвета
    success: 'bg-[var(--color-success)] text-white border-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)] text-white border-[var(--color-warning)]',
    error: 'bg-[var(--color-error)] text-white border-[var(--color-error)]',
    info: 'bg-[var(--color-info)] text-white border-[var(--color-info)]',
    
    // EPR System-специфичные статусы (используем семантические цвета)
    available: 'bg-green-50 text-green-800 border-green-200',
    'in-use': 'bg-blue-50 text-blue-800 border-blue-200',
    maintenance: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    retired: 'bg-gray-50 text-gray-600 border-gray-200',
    active: 'bg-green-50 text-green-700 border-green-300',
    inactive: 'bg-red-50 text-red-700 border-red-300'
  }
  
  return variants[props.variant] || variants.default
})

// Accessibility
const ariaLabel = computed(() => {
  const statusTranslations = {
    available: 'Доступно',
    'in-use': 'Используется', 
    maintenance: 'На обслуживании',
    retired: 'Выведено из эксплуатации',
    active: 'Активно',
    inactive: 'Неактивно'
  }
  
  const status = statusTranslations[props.variant] || props.variant
  return `Статус: ${status} - ${props.label}`
})
</script>