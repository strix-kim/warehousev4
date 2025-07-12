<template>
  <!-- Современное поле формы: светлая тема, улучшенная типографика, accessibility -->
  <div class="space-y-1">
    <label 
      v-if="label" 
      :for="id" 
      class="block text-sm font-medium text-gray-700"
      :class="{ 'text-red-700': error }"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </label>
    
    <div class="relative">
      <slot />
      
      <!-- Иконка ошибки -->
      <div v-if="error" class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        <span class="text-red-500 text-sm">⚠️</span>
      </div>
    </div>
    
    <!-- Вспомогательный текст -->
    <p v-if="helper && !error" class="text-xs text-gray-600">
      {{ helper }}
    </p>
    
    <!-- Текст ошибки -->
    <p v-if="error" class="text-xs text-red-600 flex items-center gap-1">
      <span>⚠️</span>
      {{ error }}
    </p>
  </div>
</template>

<script setup>
/**
 * Современный компонент FormField для дизайн-системы.
 * Светлая тема, улучшенная типографика, состояния ошибок, accessibility.
 * 
 * Особенности:
 * - Светлая тема с правильными контрастами
 * - Визуальные индикаторы обязательных полей
 * - Состояния ошибок с иконками
 * - Вспомогательный текст
 * - Полная accessibility поддержка
 * 
 * Пропсы:
 * - label: подпись поля
 * - id: идентификатор для связи с input элементом
 * - error: текст ошибки валидации
 * - helper: вспомогательный текст
 * - required: обязательное поле (показывает *)
 */
defineProps({
  label: String,
  id: String,
  error: String,
  helper: String,
  required: Boolean
})
</script> 