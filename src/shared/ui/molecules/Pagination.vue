<template>
  <!-- Компонент пагинации: современный дизайн, accessibility, серая цветовая схема -->
  <div v-if="showPagination" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <!-- Информация о результатах -->
    <div class="text-sm text-gray-700">
      Показано <span class="font-semibold">{{ itemsOnPage }}</span> из 
      <span class="font-semibold">{{ total }}</span> записей
    </div>
    
    <!-- Навигация по страницам -->
    <div class="flex items-center space-x-2">
      <!-- Кнопка "Назад" -->
      <button
        type="button"
        :disabled="currentPage === 1"
        @click="$emit('page-change', currentPage - 1)"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100 disabled:hover:text-gray-700 transition-colors duration-200"
        :aria-label="`Перейти на страницу ${currentPage - 1}`"
      >
        ← Назад
      </button>
      
      <!-- Индикатор текущей страницы -->
      <div class="flex items-center space-x-1">
        <span class="px-4 py-2 text-sm font-semibold text-gray-900 bg-gray-200 border border-gray-300 rounded-lg">
          {{ currentPage }}
        </span>
        <span class="text-sm text-gray-500">из</span>
        <span class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg">
          {{ totalPages }}
        </span>
      </div>
      
      <!-- Кнопка "Вперёд" -->
      <button
        type="button"
        :disabled="currentPage === totalPages"
        @click="$emit('page-change', currentPage + 1)"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100 disabled:hover:text-gray-700 transition-colors duration-200"
        :aria-label="`Перейти на страницу ${currentPage + 1}`"
      >
        Вперёд →
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент пагинации для дизайн-системы.
 * Современная серая цветовая схема, accessibility, адаптивный дизайн.
 * 
 * Особенности:
 * - Серая цветовая схема (bg-gray-100/200 вместо white)
 * - Полная поддержка accessibility (ARIA, keyboard navigation)
 * - Адаптивный дизайн (mobile-first)
 * - Состояния disabled с правильными цветами
 * - Smooth transitions и hover эффекты
 * 
 * Пропсы:
 * - currentPage: текущая страница (number)
 * - totalPages: общее количество страниц (number)
 * - total: общее количество записей (number)
 * - itemsOnPage: количество записей на текущей странице (number)
 * 
 * События:
 * - page-change: смена страницы (новый номер страницы)
 */
import { computed } from 'vue'

const props = defineProps({
  currentPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, required: true },
  itemsOnPage: { type: Number, required: true }
})

const emit = defineEmits(['page-change'])

// Показывать пагинацию только если есть больше одной страницы
const showPagination = computed(() => props.totalPages > 1)
</script> 