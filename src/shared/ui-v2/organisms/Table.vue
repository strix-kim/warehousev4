<template>
  <div class="w-full">
    <!-- Table Container -->
    <div class="bg-accent rounded-xl border border-secondary/20 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <SpinnerV2 size="lg" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!data || data.length === 0" class="flex flex-col items-center justify-center py-12 px-6">
        <div class="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
          <IconV2 name="package-x" size="lg" color="secondary" />
        </div>
        <h3 class="text-lg font-semibold text-primary mb-2">Нет данных</h3>
        <p class="text-secondary text-center">Данные для отображения отсутствуют</p>
      </div>

      <!-- Table Content -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <!-- Table Header -->
          <thead class="bg-secondary/5 border-b border-secondary/10">
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                :class="[
                  'px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider',
                  { 'cursor-pointer hover:bg-secondary/10 transition-colors': column.sortable }
                ]"
                @click="column.sortable && handleSort(column.key)"
              >
                <div class="flex items-center gap-2">
                  <span>{{ column.label || column.title }}</span>
                  <div v-if="column.sortable" class="flex flex-col">
                    <IconV2 
                      name="chevron-up" 
                      size="xs" 
                      :color="sortBy === column.key && sortDirection === 'asc' ? 'primary' : 'secondary'" 
                    />
                    <IconV2 
                      name="chevron-down" 
                      size="xs" 
                      :color="sortBy === column.key && sortDirection === 'desc' ? 'primary' : 'secondary'" 
                      class="-mt-1"
                    />
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          
          <!-- Table Body -->
          <tbody class="divide-y divide-secondary/10">
            <tr
              v-for="(item, index) in data"
              :key="getRowKey(item, index)"
              :class="[
                'hover:bg-secondary/5 transition-colors',
                { 'cursor-pointer': clickableRows }
              ]"
              @click="clickableRows && handleRowClick(item, index)"
            >
              <td
                v-for="column in columns"
                :key="column.key"
                class="px-4 py-3 text-sm"
              >
                <slot 
                  :name="`cell-${column.key}`" 
                  :item="item" 
                  :value="getColumnValue(item, column.key)"
                  :index="index"
                >
                  <span class="text-primary">
                    {{ getColumnValue(item, column.key) }}
                  </span>
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div v-if="showPagination && data && data.length > 0" class="border-t border-secondary/10 p-4">
        <PaginationV2
          :current-page="currentPage"
          :total-items="totalItems"
          :items-per-page="itemsPerPage"
          :items-per-page-options="itemsPerPageOptions"
          @update:current-page="handlePageChange"
          @update:items-per-page="handleItemsPerPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * TableV2 - Простая универсальная таблица
 * Замена сложного Table компонента на простую версию
 */
import { ref } from 'vue'
import SpinnerV2 from '../atoms/Spinner.vue'
import IconV2 from '../atoms/Icon.vue'
import PaginationV2 from '../molecules/Pagination.vue'

const props = defineProps({
  // Данные
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
    // [{ key: 'name', label: 'Название', sortable: true }]
  },
  
  // Состояния
  loading: {
    type: Boolean,
    default: false
  },
  
  // Функциональность
  clickableRows: {
    type: Boolean,
    default: false
  },
  sortBy: {
    type: String,
    default: ''
  },
  sortDirection: {
    type: String,
    default: 'asc',
    validator: (value) => ['asc', 'desc'].includes(value)
  },
  
  // Ключ строки
  rowKey: {
    type: String,
    default: 'id'
  },
  
  // Пагинация
  showPagination: {
    type: Boolean,
    default: false
  },
  currentPage: {
    type: Number,
    default: 1
  },
  totalItems: {
    type: Number,
    default: 0
  },
  itemsPerPage: {
    type: Number,
    default: 20
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [10, 20, 50, 100]
  }
})

const emit = defineEmits([
  'sort', 
  'row-click',
  'update:currentPage',
  'update:itemsPerPage'
])

// Методы
const getRowKey = (item, index) => {
  return item[props.rowKey] || index
}

const getColumnValue = (item, key) => {
  return key.split('.').reduce((obj, prop) => obj?.[prop], item) || ''
}

const handleSort = (key) => {
  const direction = props.sortBy === key && props.sortDirection === 'asc' ? 'desc' : 'asc'
  emit('sort', { column: key, direction })
}

const handleRowClick = (item, index) => {
  emit('row-click', item, index)
}

// Обработчики пагинации
const handlePageChange = (page) => {
  emit('update:currentPage', page)
}

const handleItemsPerPageChange = (items) => {
  emit('update:itemsPerPage', items)
}
</script>