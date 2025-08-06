<template>
  <div 
    class="rounded-xl shadow-sm border p-4 sm:p-6 flex flex-col transition-all duration-300 min-h-0"
    :class="[sizeClass, variantClass, { 'hover:shadow-lg hover:-translate-y-1 cursor-pointer': interactive }]"
    role="region"
    :aria-label="title || 'Bento карточка'"
  >
    <!-- Заголовок -->
    <header v-if="$slots.header || title" class="mb-3 sm:mb-4 flex-shrink-0">
      <slot name="header">
        <h3 class="text-base sm:text-lg font-semibold text-primary leading-tight">{{ title }}</h3>
      </slot>
    </header>

    <!-- Основной контент - ИСПРАВЛЕНО: убран overflow-hidden -->
    <div class="flex-1 text-sm sm:text-base min-h-0" :class="contentClass">
      <slot></slot>
    </div>

    <!-- Действия (кнопки, ссылки) -->
    <footer v-if="$slots.actions" class="mt-4 pt-4 border-t border-secondary/10 flex-shrink-0">
      <slot name="actions"></slot>
    </footer>
  </div>
</template>

<script setup>
/**
 * BentoCard v2 - mobile-first карточка для Bento-сетки
 * ИСПРАВЛЕНО: убран overflow-hidden, улучшен flex layout, добавлена поддержка scrollable контента
 */
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: '1x1',
    validator: (value) => ['1x1', '2x1', '1x2', '2x2', '3x1', '1x3', '3x2', '2x3'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => [
      'default', 'primary', 'secondary', 'minimal',
      'brand-red', 'brand-deep-red', 'success', 'warning', 'error', 'danger'
    ].includes(value)
  },
  interactive: {
    type: Boolean,
    default: false
  },
  scrollable: {
    type: Boolean,
    default: false
  }
})

// Mobile-first размеры для CSS Grid
const sizeMap = {
  // На мобильных все карточки занимают 1 колонку
  // На планшетах и больше - используем заданные размеры
  '1x1': 'col-span-1 row-span-1',
  '2x1': 'col-span-1 sm:col-span-2 row-span-1',
  '1x2': 'col-span-1 row-span-1 sm:row-span-2',
  '2x2': 'col-span-1 sm:col-span-2 row-span-1 sm:row-span-2',
  '3x1': 'col-span-1 sm:col-span-2 lg:col-span-3 row-span-1',
  '1x3': 'col-span-1 row-span-1 sm:row-span-2 lg:row-span-3',
  '3x2': 'col-span-1 sm:col-span-2 lg:col-span-3 row-span-1 sm:row-span-2',
  '2x3': 'col-span-1 sm:col-span-2 row-span-1 sm:row-span-2 lg:row-span-3'
}

const sizeClass = computed(() => sizeMap[props.size])

// Варианты стилей с градиентами
const variantClass = computed(() => {
  const variants = {
    // Базовые варианты с легкими градиентами
    default: 'bg-gradient-to-br from-white via-accent to-accent/80 border-secondary/20 text-primary',
    primary: 'bg-gradient-to-br from-primary via-primary to-primary/90 border-primary/50 bento-card--dark',
    secondary: 'bg-gradient-to-br from-secondary via-secondary to-secondary/90 border-secondary/50 bento-card--dark',
    minimal: 'bg-gradient-to-br from-white/70 via-transparent to-accent/30 border-secondary/30 backdrop-blur-sm text-primary',
    
    // Фирменные цвета с градиентами
    'brand-red': 'bg-gradient-to-br from-[var(--color-brand-red)] via-[var(--color-brand-red)] to-[var(--color-brand-deep-red)] border-[var(--color-brand-red)]/50 bento-card--dark',
    'brand-deep-red': 'bg-gradient-to-br from-[var(--color-brand-deep-red)] via-[var(--color-brand-deep-red)] to-[var(--color-brand-red)] border-[var(--color-brand-deep-red)]/50 bento-card--dark',
    
    // Семантические цвета с градиентами
    success: 'bg-gradient-to-br from-[var(--color-success)] via-[var(--color-success)] to-[var(--color-success)]/80 border-[var(--color-success)]/50 bento-card--dark',
    warning: 'bg-gradient-to-br from-[var(--color-warning)] via-[var(--color-warning)] to-[var(--color-warning)]/80 border-[var(--color-warning)]/50 bento-card--dark',
    error: 'bg-gradient-to-br from-[var(--color-error)] via-[var(--color-error)] to-[var(--color-error)]/80 border-[var(--color-error)]/50 bento-card--dark',
    danger: 'bg-gradient-to-br from-[var(--color-error)] via-[var(--color-error)] to-[var(--color-error)]/80 border-[var(--color-error)]/50 bento-card--dark'
  }
  return variants[props.variant] || variants.default
})

// Классы для контентной области
const contentClass = computed(() => {
  const baseClasses = []
  
  // Если контент должен быть скроллируемым
  if (props.scrollable) {
    baseClasses.push('overflow-y-auto', 'scrollbar-thin', 'scrollbar-thumb-secondary/30')
  }
  
  return baseClasses.join(' ')
})
</script>

<style scoped>
/* Кастомные скроллбары для webkit браузеров */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--color-secondary);
  opacity: 0.3;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  opacity: 0.5;
}

/* Обеспечиваем правильную работу flex в grid */
.min-h-0 {
  /* Позволяет flex элементам сжиматься меньше их содержимого */
  min-height: 0;
}

/* Темные карточки - светлый текст */
.bento-card--dark {
  color: var(--color-accent);
}

.bento-card--dark h1,
.bento-card--dark h2, 
.bento-card--dark h3,
.bento-card--dark h4,
.bento-card--dark h5,
.bento-card--dark h6 {
  color: var(--color-accent);
}

.bento-card--dark p {
  color: rgba(237, 242, 244, 0.9); /* accent с прозрачностью */
}

.bento-card--dark .text-primary {
  color: var(--color-accent) !important;
}

.bento-card--dark .text-secondary {
  color: rgba(237, 242, 244, 0.7) !important;
}
</style>