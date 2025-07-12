<template>
  <!-- Организм таблицы: современный светлый дизайн, адаптивность, accessibility -->
  <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
    <table class="w-full divide-y divide-gray-200">
      <!-- Заголовок таблицы -->
      <thead class="bg-gray-50">
        <slot name="thead" />
      </thead>
      
      <!-- Тело таблицы -->
      <tbody class="bg-white divide-y divide-gray-200">
        <slot />
      </tbody>
      
      <!-- Подвал таблицы (если нужен) -->
      <tfoot v-if="$slots.tfoot" class="bg-gray-50">
        <slot name="tfoot" />
      </tfoot>
    </table>
    
    <!-- Дополнительный футер (для пагинации и т.д.) -->
    <div v-if="$slots.footer" class="bg-gray-50 px-4 py-3 border-t border-gray-200">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
/**
 * Организм Table для дизайн-системы.
 * Современный светлый дизайн с использованием только Tailwind CSS.
 * Поддержка слотов для thead/tbody/tfoot/footer, адаптивность, accessibility.
 * 
 * Особенности:
 * - Светлая тема (белый фон, серые границы)
 * - Отзывчивый дизайн с горизонтальным скроллом на мобильных
 * - Разделители между строками для лучшей читаемости
 * - Закруглённые углы и тень для современного вида
 * - Поддержка accessibility
 * 
 * Слоты:
 * - thead: заголовки колонок
 * - default: строки данных (tbody)
 * - tfoot: подвал таблицы
 * - footer: дополнительный контент под таблицей
 * 
 * Пропсы:
 * - items: массив данных (для совместимости, но не используется напрямую)
 */

defineProps({
  items: { 
    type: Array, 
    default: () => [],
    description: 'Массив данных для таблицы (для совместимости с API)'
  }
})
</script> 