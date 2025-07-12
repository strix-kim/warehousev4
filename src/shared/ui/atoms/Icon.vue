<template>
  <!-- Атомарная иконка: SVG из Heroicons/Lucide, Tailwind, accessibility -->
  <component
    v-if="iconComponent"
    :is="iconComponent"
    :class="computedClass"
    aria-hidden="true"
  />
  <span v-else-if="emoji" :class="computedClass" aria-hidden="true">{{ emoji }}</span>
  <svg v-else-if="svg" :class="computedClass" aria-hidden="true" v-html="svg" />
  <span v-else :class="computedClass" aria-hidden="true">{{ name || '?' }}</span>
</template>

<script setup>
/**
 * Атом Icon для отображения SVG-иконок из Heroicons/Lucide.
 * Поддержка: heroicons, lucide, emoji (устаревшее), кастомный SVG (устаревшее).
 * Все стили — только через Tailwind. Поддержка accessibility.
 * 
 * Пропсы:
 * - name: имя иконки (например, 'Camera', 'User')
 * - set: набор ('hero' | 'lucide'), по умолчанию 'hero'
 * - size: размер иконки (sm, md, lg)
 * - emoji/svg: устаревшие режимы для обратной совместимости
 */
import { computed } from 'vue'
import * as Heroicons from '@heroicons/vue/24/outline'
import * as LucideIcons from 'lucide-vue-next'

const props = defineProps({
  name: String, // Имя иконки (PascalCase)
  set: { type: String, default: 'hero' }, // 'hero' | 'lucide'
  emoji: String, // Устаревшее
  svg: String,   // Устаревшее
  size: { type: String, default: 'md' }
})

// Выбор компонента SVG-иконки по имени и набору
const iconComponent = computed(() => {
  if (!props.name) return null
  if (props.set === 'lucide') {
    return LucideIcons[props.name]
  }
  // По умолчанию heroicons
  return Heroicons[props.name + 'Icon']
})

const computedClass = computed(() => {
  const baseClasses = ['inline-block align-middle text-current']
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }
  return [
    ...baseClasses,
    sizeClasses[props.size] || sizeClasses.md
  ].join(' ')
})
</script> 