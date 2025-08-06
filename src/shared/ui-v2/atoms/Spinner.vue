<template>
  <div :class="spinnerClass" role="status" :aria-label="label">
    <svg 
      class="animate-spin" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        stroke-width="4" 
        class="opacity-25"
      />
      <path 
        fill="currentColor" 
        d="m12,2a10,10 0 0 1 10,10h-4a6,6 0 0 0 -6,-6v-4z" 
        class="opacity-75"
      />
    </svg>
    <span v-if="showLabel" class="ml-2 text-sm">{{ label }}</span>
  </div>
</template>

<script setup>
/**
 * Spinner v2 - индикатор загрузки для новой UI-системы
 * Минималистичный дизайн с поддержкой разных размеров и цветов
 */
import { computed } from 'vue'

const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(value)
  },
  color: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger', 'warning', 'accent', 'current'].includes(value)
  },
  label: {
    type: String,
    default: 'Загрузка...'
  },
  showLabel: {
    type: Boolean,
    default: false
  },
  centered: {
    type: Boolean,
    default: false
  }
})

// Размеры спиннера
const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
}

// Цвета спиннера
const colorMap = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  danger: 'text-danger', 
  warning: 'text-warning',
  accent: 'text-accent',
  current: 'text-current'
}

const spinnerClass = computed(() => {
  const baseClasses = [
    'inline-flex items-center',
    sizeMap[props.size] || sizeMap.md,
    colorMap[props.color] || colorMap.primary
  ]

  if (props.centered) {
    baseClasses.push('justify-center w-full')
  }

  return baseClasses.join(' ')
})
</script>

<style scoped>
/* Кастомная анимация для более плавного вращения */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>