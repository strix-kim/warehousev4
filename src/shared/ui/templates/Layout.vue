<template>
  <!-- Современный Layout: светлая тема, улучшенная структура, адаптивность -->
  <div class="min-h-screen flex flex-col bg-gray-50 text-gray-900">
    <!-- Header слот (сам компонент должен определять теги) -->
    <div v-if="$slots.header">
      <slot name="header" />
    </div>
    
    <!-- Основная область с сайдбаром -->
    <div class="flex flex-1 w-full">
      <!-- Сайдбар для desktop -->
      <aside 
        v-if="$slots.aside" 
        class="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200 flex-shrink-0"
      >
        <div class="flex-1 overflow-y-auto">
          <slot name="aside" />
        </div>
      </aside>
      
      <!-- Основной контент -->
      <main class="flex-1 overflow-x-hidden">
        <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 lg:py-8">
          <slot />
        </div>
      </main>
    </div>
    
    <!-- Footer -->
    <footer 
      v-if="$slots.footer" 
      class="bg-white border-t border-gray-200 mt-auto"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <slot name="footer" />
      </div>
    </footer>
  </div>
</template>

<script setup>
/**
 * Современный шаблон Layout для приложения.
 * Светлая тема, максимальная ширина, оптимизированные отступы, адаптивность.
 * 
 * Особенности:
 * - Светлая тема (bg-gray-50/white)
 * - Sticky header с тенью
 * - Responsive сайдбар (скрыт на mobile/tablet)
 * - Максимальная ширина контента 7xl
 * - Оптимизированные отступы для всех экранов
 * - Overflow handling для предотвращения горизонтального скролла
 * 
 * Слоты:
 * - header: верхняя панель навигации
 * - aside: боковая панель (только desktop lg+)
 * - default: основное содержимое страницы
 * - footer: нижняя панель
 */
</script> 