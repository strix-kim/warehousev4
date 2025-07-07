<template>
  <!-- Универсальная кнопка без дефолтных цветовых классов.
  Цвет, фон, border, hover — всегда задаются через кастомные классы снаружи.
  Это исключает конфликт text-white/bg-white и даёт полный контроль над стилями.
  Пример: <Button class="bg-white text-gray-900 border border-gray-300">Светлая кнопка</Button> -->
  <button
    :type="type"
    :disabled="disabled || loading"
    class="bg-gray-200 text-gray-900 border border-gray-300 rounded px-4 py-2 hover:bg-gray-300 transition disabled:opacity-60"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="mr-2"><slot name="loader">...</slot></span>
    <slot />
  </button>
</template>

<script setup>
// Button.vue
// Универсальная кнопка для всего приложения.
// Поддерживает состояния loading, disabled, кастомные классы.
// Используйте <Button :loading="isLoading">Текст</Button>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

defineEmits(['click'])
</script> 