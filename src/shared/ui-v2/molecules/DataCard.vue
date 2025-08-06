<template>
  <BentoCard 
    :title="title" 
    :size="size" 
    :variant="variant"
    :interactive="interactive"
    class="data-card"
  >
    <div class="h-full flex flex-col">
      <!-- Основные метрики -->
      <div class="flex-1 flex items-center justify-between">
        <!-- Значение и описание -->
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 mb-1">
            <span :class="valueClass">{{ displayValue }}</span>
            <StatusBadgeV2 
              v-if="status" 
              :label="status.label"
              :variant="status.variant"
              :icon="status.icon"
              size="sm"
            />
          </div>
          <p :class="descriptionClass">{{ description }}</p>
        </div>
        
        <!-- Иконка -->
        <div v-if="icon" class="flex-shrink-0 ml-3">
          <div :class="iconContainerClass">
            <IconV2 :name="icon" :size="iconSize" color="current" />
          </div>
        </div>
      </div>

      <!-- Тренд и изменения -->
      <div v-if="trend || change" class="mt-3 pt-3 border-t border-secondary/10">
        <div class="flex items-center justify-between text-xs">
          <!-- Изменение в процентах -->
          <div v-if="change" class="flex items-center gap-1">
            <IconV2 
              :name="changeIcon" 
              size="xs" 
              :color="changeColor"
            />
            <span :class="changeTextClass">{{ changeText }}</span>
          </div>
          
          <!-- Период или дополнительная информация -->
          <span v-if="period" class="text-secondary">{{ period }}</span>
        </div>
      </div>

      <!-- Слот для дополнительного контента -->
      <div v-if="$slots.default" class="mt-3">
        <slot></slot>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * DataCard v2 - карточка для отображения метрик и статистики
 * Специально для EPR System dashboard: статистика оборудования, событий, пользователей
 */
import { computed } from 'vue'
import BentoCard from '../layouts/BentoCard.vue'
import StatusBadgeV2 from '../atoms/StatusBadge.vue'
import IconV2 from '../atoms/Icon.vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  value: {
    type: [String, Number],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: '1x1',
    validator: (value) => ['1x1', '2x1', '1x2', '2x2'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => [
      'default', 'primary', 'secondary', 'minimal',
      'brand-red', 'brand-deep-red', 'success', 'warning', 'error'
    ].includes(value)
  },
  interactive: {
    type: Boolean,
    default: false
  },
  // Тренд и изменения
  change: {
    type: Number,
    default: null
  },
  period: {
    type: String,
    default: ''
  },
  trend: {
    type: String,
    validator: (value) => ['up', 'down', 'neutral'].includes(value)
  },
  // Статус
  status: {
    type: Object,
    default: null
    // { label: 'Активно', variant: 'success', icon: 'check' }
  },
  // Форматирование
  format: {
    type: String,
    default: 'number',
    validator: (value) => ['number', 'currency', 'percentage', 'custom'].includes(value)
  },
  precision: {
    type: Number,
    default: 0
  }
})

// Форматирование значения
const displayValue = computed(() => {
  const value = Number(props.value)
  
  switch (props.format) {
    case 'currency':
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: props.precision
      }).format(value)
      
    case 'percentage':
      return `${value.toFixed(props.precision)}%`
      
    case 'number':
      return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: props.precision,
        maximumFractionDigits: props.precision
      }).format(value)
      
    default:
      return props.value.toString()
  }
})

// Стили для значения
const valueClass = computed(() => {
  const baseClass = 'font-bold leading-none'
  
  // Цвет в зависимости от варианта карточки
  let colorClass = ''
  const darkVariants = ['primary', 'secondary', 'brand-red', 'brand-deep-red', 'success', 'warning', 'error']
  if (darkVariants.includes(props.variant)) {
    colorClass = 'text-accent' // Светлый текст на темном фоне
  } else {
    colorClass = 'text-primary' // Темный текст на светлом фоне
  }
  
  // Размер зависит от размера карточки и длины значения
  const valueLength = displayValue.value.length
  
  if (props.size === '1x1') {
    return valueLength > 6 
      ? `${baseClass} ${colorClass} text-lg sm:text-xl` 
      : `${baseClass} ${colorClass} text-xl sm:text-2xl`
  } else if (props.size === '2x1') {
    return valueLength > 8
      ? `${baseClass} ${colorClass} text-2xl sm:text-3xl`
      : `${baseClass} ${colorClass} text-3xl sm:text-4xl`
  } else {
    return `${baseClass} ${colorClass} text-2xl sm:text-3xl lg:text-4xl`
  }
})

// Стили для описания
const descriptionClass = computed(() => {
  const baseClass = 'text-xs sm:text-sm leading-tight'
  const darkVariants = ['primary', 'secondary', 'brand-red', 'brand-deep-red', 'success', 'warning', 'error']
  
  if (darkVariants.includes(props.variant)) {
    return `${baseClass} text-accent/80` // Светлый текст с прозрачностью на темном фоне
  } else {
    return `${baseClass} text-secondary` // Обычный серый текст на светлом фоне
  }
})

// Размер иконки
const iconSize = computed(() => {
  return props.size === '1x1' ? 'md' : 'lg'
})

// Контейнер иконки
const iconContainerClass = computed(() => {
  const baseClass = 'rounded-lg flex items-center justify-center'
  
  if (props.variant === 'primary') {
    return `${baseClass} bg-accent/20 text-accent p-2 sm:p-3`
  } else if (props.variant === 'secondary') {
    return `${baseClass} bg-accent/20 text-accent p-2 sm:p-3`
  } else {
    return `${baseClass} bg-primary/10 text-primary p-2 sm:p-3`
  }
})

// Обработка изменений (тренда)
const changeIcon = computed(() => {
  if (!props.change) return ''
  return props.change > 0 ? 'trending-up' : props.change < 0 ? 'trending-down' : 'minus'
})

const changeColor = computed(() => {
  if (!props.change) return 'secondary'
  return props.change > 0 ? 'success' : props.change < 0 ? 'danger' : 'secondary'
})

const changeText = computed(() => {
  if (!props.change) return ''
  const absChange = Math.abs(props.change)
  const sign = props.change > 0 ? '+' : ''
  return `${sign}${absChange}%`
})

const changeTextClass = computed(() => {
  const darkVariants = ['primary', 'secondary', 'brand-red', 'brand-deep-red', 'success', 'warning', 'error']
  
  if (!props.change) {
    return darkVariants.includes(props.variant)
      ? 'text-accent/70' 
      : 'text-secondary'
  }
  
  // Для темных карточек используем светлые версии цветов
  if (darkVariants.includes(props.variant)) {
    return props.change > 0 
      ? 'text-green-300 font-medium' 
      : props.change < 0 
        ? 'text-red-300 font-medium' 
        : 'text-accent/70'
  } else {
    // Для светлых карточек используем семантические цвета
    return props.change > 0 
      ? 'text-[var(--color-success)] font-medium' 
      : props.change < 0 
        ? 'text-[var(--color-error)] font-medium' 
        : 'text-secondary'
  }
})
</script>

<style scoped>
.data-card {
  /* Обеспечиваем минимальную высоту для читаемости */
  min-height: 120px;
}
</style>