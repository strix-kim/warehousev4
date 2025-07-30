<template>
  <!-- Шаблон состояния "оффлайн": иконка, сообщение, Tailwind, адаптивность, accessibility -->
  <div class="flex flex-col items-center justify-center py-6 px-4 text-center">
    <div class="text-4xl mb-4 text-gray-500">{{ icon }}</div>
    <p class="text-lg font-medium text-gray-300 mb-2">{{ message }}</p>
    <p v-if="description" class="text-sm text-gray-400 mb-4">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup>
/**
 * Шаблон OfflineState для отображения отсутствия соединения.
 * Использует только Tailwind, поддержка props, адаптивность, accessibility.
 * Пропсы:
 * - message: основное сообщение
 * - description: дополнительное описание
 * - icon: эмодзи или текстовая иконка (например, '📡')
 */

defineProps({
  message: { type: String, required: true },
  description: String,
  icon: { type: String, default: '📡' }
})
</script> 