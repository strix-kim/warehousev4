<template>
  <!-- Молекулярная строка таблицы: Tailwind, поддержка слотов, адаптивность -->
  <tr :class="computedClass" role="row">
    <slot />
  </tr>
</template>

<script setup>
/**
 * Молекулярный компонент TableRow для дизайн-системы.
 * Использует только Tailwind, поддержка слотов, адаптивность.
 * Пропсы:
 * - selected: выделена ли строка
 */
defineProps({
  selected: Boolean
})

const computedClass = [
  'transition-colors',
  'hover:bg-gray-800',
  'focus-within:bg-gray-800',
  'border-b border-gray-700',
  'last:border-b-0',
  'cursor-pointer',
  'outline-none',
  'focus:outline-none',
  'focus:ring-2 focus:ring-blue-500',
  'bg-gray-900',
  'text-white',
  'aria-selected:bg-blue-900',
  'aria-selected:text-blue-400'
].join(' ')
</script> 