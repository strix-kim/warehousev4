<template>
  <!-- Основная иконка -->
  <component 
    v-if="iconComponent"
    :is="iconComponent"
    :class="iconClass"
    v-bind="iconProps"
  />
  
  <!-- Fallback иконка -->
  <div
    v-else
    :class="[
      'inline-flex items-center justify-center',
      'bg-secondary/20 text-secondary rounded text-xs font-mono',
      sizeMap[size] || sizeMap.md
    ]"
    :title="`Иконка '${name}' не найдена`"
  >
    ?
  </div>
</template>

<script setup>
/**
 * Icon v2 - компонент для отображения иконок
 * Использует централизованный справочник иконок.
 */
import { computed } from 'vue';
import { getIcon } from '../lib/icons';

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(value),
  },
  color: {
    type: String,
    default: 'current',
    validator: (value) => ['current', 'primary', 'secondary', 'danger', 'warning', 'accent', 'success', 'error', 'info', 'white'].includes(value),
  },
  library: { // Оставим для совместимости, но пока не используется
    type: String,
    default: 'lucide',
  }
});

// Карта размеров
const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
  '2xl': 'w-10 h-10',
};

// Карта цветов
const colorMap = {
  current: 'text-current',
  primary: 'text-primary',
  secondary: 'text-secondary',
  danger: 'text-danger',
  warning: 'text-warning',
  accent: 'text-accent',
  success: 'text-success',
  error: 'text-error',
  info: 'text-info',
  white: 'text-white',
};

const iconClass = computed(() => [
  sizeMap[props.size] || sizeMap.md,
  colorMap[props.color] || colorMap.current,
  'flex-shrink-0',
].join(' '));

// Получаем компонент иконки из справочника
const iconComponent = computed(() => getIcon(props.name));

const iconProps = computed(() => ({
  'stroke-width': 1.5,
}));
</script>