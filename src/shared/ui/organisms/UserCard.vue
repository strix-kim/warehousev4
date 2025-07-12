<template>
  <!-- Организм карточки пользователя: Tailwind, адаптивность, поддержка props, accessibility -->
  <div :class="computedClass" role="region" aria-label="Карточка пользователя">
    <div class="flex items-center gap-4 mb-2">
      <Icon emoji="👤" class="w-10 h-10 text-blue-500" />
      <div>
        <h4 class="text-lg font-bold text-white">{{ name }}</h4>
        <p class="text-sm text-gray-400">{{ role }}</p>
      </div>
    </div>
    <div v-if="email" class="text-xs text-gray-300 mb-2">{{ email }}</div>
    <slot />
    <div v-if="$slots.footer" class="mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
/**
 * Организм UserCard для дизайн-системы.
 * Использует только Tailwind, поддержка props, адаптивность, accessibility.
 * Пропсы:
 * - name: имя пользователя
 * - role: роль пользователя
 * - email: email пользователя
 * - icon: эмодзи или символ (например, '👤')
 */
import Icon from '../atoms/Icon.vue'

defineProps({
  name: { type: String, required: true },
  role: String,
  email: String,
  icon: { type: String, default: 'pi pi-user' }
})

const computedClass = [
  'bg-gray-800 rounded-lg shadow p-4',
  'w-full max-w-md',
  'text-white',
  'transition-shadow',
  'hover:shadow-lg',
  'flex flex-col'
].join(' ')
</script> 