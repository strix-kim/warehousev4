<template>
  <BentoCard 
    v-if="showDebug"
    title="🔍 Отладочная информация" 
    size="1x1" 
    variant="minimal"
  >
    <div class="grid grid-cols-2 gap-4 text-xs">
      <!-- Поиск и фильтры -->
      <div class="space-y-2">
        <div class="font-semibold text-primary">Поиск и фильтры:</div>
        <div class="text-secondary space-y-1">
          <div><strong>Поиск:</strong> "{{ searchQuery || 'нет поиска' }}"</div>
          <div><strong>Категория:</strong> {{ selectedCategory || 'не выбрана' }}</div>
          <div><strong>Подкатегория:</strong> {{ selectedSubcategory || 'не выбрана' }}</div>
          <div><strong>Активные фильтры:</strong> {{ activeFiltersCount }}</div>
        </div>
      </div>
      
      <!-- Пагинация -->
      <div class="space-y-2">
        <div class="font-semibold text-primary">Пагинация (серверная):</div>
        <div class="text-secondary space-y-1">
          <div><strong>Текущая страница:</strong> {{ currentPage }}</div>
          <div><strong>Элементов на странице:</strong> {{ itemsPerPage }}</div>
          <div><strong>Всего страниц:</strong> {{ totalPages }}</div>
          <div><strong>Всего элементов:</strong> {{ total }}</div>
          <div><strong>Есть еще данные:</strong> {{ hasMore ? 'Да' : 'Нет' }}</div>
        </div>
      </div>
      
      <!-- Сортировка -->
      <div class="space-y-2">
        <div class="font-semibold text-primary">Сортировка (серверная):</div>
        <div class="text-secondary space-y-1">
          <div><strong>Поле:</strong> {{ sortBy }}</div>
          <div><strong>Порядок:</strong> {{ sortOrder === 'asc' ? 'По возрастанию ↑' : 'По убыванию ↓' }}</div>
          <div><strong>Интерактивная:</strong> Клик по заголовкам ✅</div>
        </div>
      </div>
      
      <!-- Состояние загрузки -->
      <div class="space-y-2">
        <div class="font-semibold text-primary">Состояние:</div>
        <div class="text-secondary space-y-1">
          <div><strong>Загрузка:</strong> {{ loading ? 'Да ⏳' : 'Нет ✅' }}</div>
          <div><strong>Ошибка:</strong> {{ error || 'Нет ✅' }}</div>
          <div><strong>Архитектура:</strong> 100% серверная ⚡</div>
          <div><strong>Автокомплит:</strong> {{ searchSuggestions.length }} предложений</div>
        </div>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EquipmentDebugInfo - EPR System
 * 
 * Компонент отладочной информации для разработки
 * Показывается только в dev режиме
 */

import { computed } from 'vue'
import { BentoCard } from '@/shared/ui-v2'

// Props
const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  selectedCategory: {
    type: String,
    default: ''
  },
  selectedSubcategory: {
    type: String,
    default: ''
  },
  currentPage: {
    type: Number,
    default: 1
  },
  itemsPerPage: {
    type: Number,
    default: 30
  },
  totalPages: {
    type: Number,
    default: 1
  },
  total: {
    type: Number,
    default: 0
  },
  hasMore: {
    type: Boolean,
    default: false
  },
  sortBy: {
    type: String,
    default: ''
  },
  sortOrder: {
    type: String,
    default: 'asc'
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  searchSuggestions: {
    type: Array,
    default: () => []
  },
  showDebug: {
    type: Boolean,
    default: true // Можно управлять через environment variable
  }
})

// Computed
const activeFiltersCount = computed(() => {
  let count = 0
  if (props.searchQuery) count++
  if (props.selectedCategory) count++
  if (props.selectedSubcategory) count++
  return count
})
</script>