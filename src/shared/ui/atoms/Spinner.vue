<template>
  <!-- Атомарный спиннер: SVG-анимация, Tailwind, поддержка accessibility -->
  <span class="inline-block animate-spin text-blue-500" role="status" aria-label="Загрузка">
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  </span>
</template>

<script setup>
/**
 * Атомарный компонент Spinner для индикации загрузки.
 * Использует только Tailwind и SVG, поддержка accessibility.
 */
</script> 