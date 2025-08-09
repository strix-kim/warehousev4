<template>
  <div class="grid gap-2 p-2 sm:gap-4 sm:p-4" :class="gridClass">
    <slot></slot>
  </div>
</template>

<script setup>
/**
 * BentoGrid v2 - mobile-first адаптивная основа для Bento-дизайна
 * ИСПРАВЛЕНО: динамическая высота строк, предотвращение обрезания контента
 */
import { computed } from 'vue'

const props = defineProps({
  columns: {
    type: [Number, String],
    default: 'auto',
    validator: (value) => value === 'auto' || (Number(value) >= 1 && Number(value) <= 12)
  },
  gap: {
    type: String,
    default: '4',
    validator: (value) => ['2', '4', '6', '8'].includes(value)
  },
  minRowHeight: {
    type: String,
    default: 'auto',
    validator: (value) => ['auto', 'sm', 'md', 'lg'].includes(value)
  }
})

const gridClass = computed(() => {
  // Mobile-first подход к колонкам
  let cols
  if (props.columns === 'auto') {
    // На мобильных: 1 колонка, на планшетах: 2, на десктопах: auto-fit
    cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]'
  } else {
    // Адаптивные фиксированные колонки — без динамических классов
    const colNum = Math.min(Math.max(Number(props.columns), 1), 6)
    const colsMap = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    }
    cols = colsMap[colNum]
  }
  
  // ИСПРАВЛЕНО: Динамическая высота строк с минимумом
  let rows
  switch (props.minRowHeight) {
    case 'sm':
      rows = 'auto-rows-[minmax(100px,auto)] sm:auto-rows-[minmax(120px,auto)]'
      break
    case 'md':
      rows = 'auto-rows-[minmax(120px,auto)] sm:auto-rows-[minmax(140px,auto)]'
      break
    case 'lg':
      rows = 'auto-rows-[minmax(160px,auto)] sm:auto-rows-[minmax(180px,auto)]'
      break
    default:
      // Полностью автоматическая высота - контент определяет размер
      rows = 'auto-rows-max'
  }
  
  // Адаптивные отступы между элементами
  const gapMap = { '2': 'gap-2 sm:gap-2', '4': 'gap-2 sm:gap-4', '6': 'gap-2 sm:gap-6', '8': 'gap-2 sm:gap-8' }
  const gapClass = gapMap[props.gap] || 'gap-2 sm:gap-4'
  
  return [cols, rows, gapClass]
})
</script>

<style scoped>
/* Обеспечиваем правильное поведение grid с динамическим контентом */
.grid {
  /* Автоматическое размещение с оптимальным заполнением */
  grid-auto-flow: row dense;
}

/* Для мобильных устройств - более компактная сетка */
@media (max-width: 640px) {
  .grid {
    grid-auto-rows: minmax(auto, max-content);
  }
}

/* Для больших экранов - обеспечиваем минимальную высоту но позволяем расширение */
@media (min-width: 1024px) {
  .grid {
    grid-auto-rows: minmax(120px, max-content);
  }
}
</style>