<template>
  <div
    :class="skeletonClasses"
    :style="customStyles"
    role="status"
    aria-label="Загрузка..."
  >
    <span class="sr-only">Загрузка...</span>
  </div>
</template>

<script setup>
/**
 * SkeletonV2 - компонент для loading states
 * Создает красивые placeholder'ы во время загрузки
 */
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'circular', 'rectangular', 'rounded'].includes(value)
  },
  width: {
    type: [String, Number],
    default: '100%'
  },
  height: {
    type: [String, Number],
    default: null
  },
  animation: {
    type: String,
    default: 'pulse',
    validator: (value) => ['pulse', 'wave', 'none'].includes(value)
  }
})

// Базовые стили для разных вариантов
const variantClasses = {
  text: 'h-4 rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-none',
  rounded: 'rounded-lg'
}

// Анимации
const animationClasses = {
  pulse: 'animate-pulse',
  wave: 'animate-shimmer',
  none: ''
}

const skeletonClasses = computed(() => [
  'bg-gradient-to-r from-accent via-secondary/20 to-accent',
  'bg-secondary/20',
  variantClasses[props.variant],
  animationClasses[props.animation]
])

const customStyles = computed(() => {
  const styles = {}
  
  // Ширина
  if (props.width) {
    styles.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  
  // Высота
  if (props.height) {
    styles.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  } else if (props.variant === 'circular') {
    // Для круглых - делаем квадратными по умолчанию
    styles.height = styles.width || '2rem'
    styles.width = styles.height
  }
  
  return styles
})
</script>

<style scoped>
/* Кастомная shimmer анимация */
@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.animate-shimmer {
  background: linear-gradient(90deg, var(--color-secondary-20) 25%, var(--color-accent) 50%, var(--color-secondary-20) 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}

/* Screen reader only text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>