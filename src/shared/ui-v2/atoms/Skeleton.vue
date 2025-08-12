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
 * Минималистичный placeholder в стиле UI Kit v2
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

const skeletonClasses = computed(() => {
  const classes = [variantClasses[props.variant]]

  // Нейтральный фон + мягкая анимация
  if (props.animation === 'wave') {
    classes.push('animate-shimmer', 'bg-gray-200')
  } else if (props.animation === 'pulse') {
    classes.push('animate-pulse', 'bg-gray-200')
  } else {
    classes.push('bg-gray-200')
  }

  return classes
})

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
  background: linear-gradient(90deg, rgb(229 231 235) 25%, rgb(243 244 246) 50%, rgb(229 231 235) 75%);
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