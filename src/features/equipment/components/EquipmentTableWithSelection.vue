<template>
  <BentoCard title="Выбор оборудования" size="1x1" variant="default">
    <TableV2
      :data="data"
      :columns="tableColumns"
      :loading="loading"
      :error="error"
      :clickable-rows="false"
      :sort-by="sortBy"
      :sort-direction="sortOrder"
      class="w-full"
      @sort="handleSort"
    >
      <!-- Кастомные ячейки -->
      
      <!-- Чекбокс для выбора -->
      <template #cell-selection="{ item }">
        <div class="flex items-center justify-center">
          <div v-if="isConflicted(item.id)" 
               class="w-4 h-4 flex items-center justify-center"
               :title="getConflictTooltip(item.id)">
            <IconV2 name="lock" size="xs" color="error" />
          </div>
          <input 
            v-else
            type="checkbox"
            :checked="isSelected(item.id)"
            @change="toggleSelection(item, $event)"
            class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
          />
        </div>
      </template>
      
      <!-- Бренд + Модель (объединенная колонка) -->
      <template #cell-equipment="{ item }">
        <div :class="{ 'opacity-60': isConflicted(item.id) }">
          <div class="font-semibold text-primary text-sm cursor-help" 
               :title="`${item.brand} ${item.model}`"
               :class="{ 'line-through text-gray-500': isConflicted(item.id) }">
            {{ item.brand || '—' }} {{ item.model || '' }}
          </div>
          <!-- Подробный индикатор конфликта -->
          <div v-if="isConflicted(item.id)" class="mt-1">
            <div class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md border border-red-200">
              <IconV2 name="lock" size="xs" />
              <span class="font-medium">Зарезервировано</span>
            </div>
            <div class="text-xs text-red-600 mt-1 leading-tight">
              Список "{{ getConflictInfo(item.id).listName }}"<br/>
              <span class="text-red-500">{{ getConflictInfo(item.id).mountPointName }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Серийный номер -->
      <template #cell-serialnumber="{ item }">
        <span 
          class="font-mono text-xs text-secondary cursor-help"
          :title="item.serialnumber"
        >
          {{ item.serialnumber || '—' }}
        </span>
      </template>

      <!-- Категория -->
      <template #cell-type="{ item }">
        <span 
          class="text-xs text-secondary cursor-help"
          :title="item.type"
        >
          {{ item.type || '—' }}
        </span>
      </template>

      <!-- Подкатегория -->
      <template #cell-subtype="{ item }">
        <span 
          class="text-xs text-secondary cursor-help"
          :title="item.subtype"
        >
          {{ item.subtype || '—' }}
        </span>
      </template>

      <!-- Локация -->
      <template #cell-location="{ item }">
        <span 
          class="text-xs text-secondary cursor-help"
          :title="item.location"
        >
          {{ item.location || '—' }}
        </span>
      </template>
    </TableV2>

    <!-- Пагинация -->
    <div class="mt-4">
      <PaginationV2
        :current-page="currentPage"
        :total-pages="totalPages"
        :items-per-page="itemsPerPage"
        :total-items="total"
        @update:current-page="handlePageChange"
        @update:items-per-page="handleItemsPerPageChange"
      />
    </div>

    <!-- Информация о выборе и конфликтах -->
    <div class="mt-4 space-y-3">
      <!-- Информация о выборе -->
      <div v-if="selectedCount > 0" class="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div class="flex items-center justify-between">
          <span class="text-sm text-blue-700">
            Выбрано: <strong>{{ selectedCount }}</strong> единиц оборудования
          </span>
          <div class="flex items-center gap-2">
            <ButtonV2 variant="ghost" size="sm" @click="selectAllOnPage">
              Выбрать доступные на странице
            </ButtonV2>
            <ButtonV2 variant="ghost" size="sm" @click="clearSelection">
              Очистить выбор
            </ButtonV2>
          </div>
        </div>
      </div>

      <!-- Информация о конфликтах на текущей странице -->
      <div v-if="conflictedOnPage > 0" class="p-3 bg-red-50 rounded-lg border border-red-200">
        <div class="flex items-center gap-2">
          <IconV2 name="alert-triangle" size="sm" color="error" />
          <span class="text-sm text-red-700">
            На этой странице <strong>{{ conflictedOnPage }}</strong> 
            {{ conflictedOnPage === 1 ? 'единица' : 'единиц' }} оборудования уже зарезервировано
          </span>
        </div>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EquipmentTableWithSelection - EPR System
 * 
 * Компонент таблицы оборудования с возможностью выбора для создания списков
 * Основан на EquipmentTable.vue с добавлением функций выбора и проверки конфликтов
 */

import { computed } from 'vue'

import { 
  BentoCard,
  TableV2,
  ButtonV2,
  PaginationV2,
  IconV2
} from '@/shared/ui-v2'

// ===== PROPS =====
const props = defineProps({
  // Данные таблицы
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  
  // Пагинация
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  },
  itemsPerPage: {
    type: Number,
    default: 20
  },
  total: {
    type: Number,
    default: 0
  },
  
  // Сортировка
  sortBy: {
    type: String,
    default: 'created_at'
  },
  sortOrder: {
    type: String,
    default: 'desc'
  },
  
  // Выбор и конфликты
  selectedIds: {
    type: Array,
    default: () => []
  },
  conflictInfo: {
    type: Object,
    default: () => ({})
  }
})

// ===== EMITS =====
const emit = defineEmits([
  'sort',
  'page-change',
  'items-per-page-change',
  'selection-change'
])

// ===== TABLE COLUMNS =====
const tableColumns = [
  { 
    key: 'selection', 
    label: '', 
    sortable: false,
    width: '50px'
  },
  { 
    key: 'equipment', 
    label: 'Оборудование', 
    sortable: true,
    sortKey: 'brand'
  },
  { 
    key: 'serialnumber', 
    label: 'Серийный номер', 
    sortable: true,
    width: '150px'
  },
  { 
    key: 'type', 
    label: 'Категория', 
    sortable: true,
    width: '120px'
  },
  { 
    key: 'subtype', 
    label: 'Подкатегория', 
    sortable: true,
    width: '130px'
  },
  { 
    key: 'location', 
    label: 'Локация', 
    sortable: true,
    width: '120px'
  }
]

// ===== COMPUTED =====
const selectedCount = computed(() => props.selectedIds.length)

const conflictedOnPage = computed(() => {
  return props.data.filter(item => isConflicted(item.id)).length
})

// ===== ФУНКЦИИ ВЫБОРА =====
const isSelected = (equipmentId) => {
  return props.selectedIds.includes(equipmentId)
}

const isConflicted = (equipmentId) => {
  return !!props.conflictInfo[equipmentId]
}

const getConflictInfo = (equipmentId) => {
  return props.conflictInfo[equipmentId] || null
}

const getConflictTooltip = (equipmentId) => {
  const conflict = getConflictInfo(equipmentId)
  if (!conflict) return ''
  
  return `Оборудование зарезервировано списком "${conflict.listName}" для точки монтажа "${conflict.mountPointName}"`
}

const toggleSelection = (item, event) => {
  event.stopPropagation()
  
  // Не позволяем выбирать конфликтное оборудование
  if (isConflicted(item.id)) {
    return
  }
  
  const newSelectedIds = [...props.selectedIds]
  const index = newSelectedIds.indexOf(item.id)
  
  if (index > -1) {
    // Убираем из выбора
    newSelectedIds.splice(index, 1)
  } else {
    // Добавляем в выбор
    newSelectedIds.push(item.id)
  }
  
  emit('selection-change', newSelectedIds)
}

const selectAllOnPage = () => {
  const availableIds = props.data
    .filter(item => !isConflicted(item.id))
    .map(item => item.id)
  
  const newSelectedIds = [...new Set([...props.selectedIds, ...availableIds])]
  emit('selection-change', newSelectedIds)
}

const clearSelection = () => {
  emit('selection-change', [])
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
const handleSort = (sortEvent) => {
  console.log('🔄 [TableWithSelection] Sort event:', sortEvent)
  
  // Проверяем что sortEvent корректный
  if (!sortEvent || !sortEvent.column) {
    console.error('❌ [TableWithSelection] Invalid sort event:', sortEvent)
    return
  }
  
  // Найдем соответствующую колонку для получения правильного ключа сортировки
  const column = tableColumns.find(col => col.key === sortEvent.column)
  const sortKey = column?.sortKey || sortEvent.column
  
  console.log('🔄 [TableWithSelection] Mapped sort key:', { 
    originalColumn: sortEvent.column, 
    mappedSortKey: sortKey 
  })
  
  // Передаем события с исправленным ключом
  emit('sort', {
    column: sortKey,
    direction: sortEvent.direction
  })
}

const handlePageChange = (page) => {
  emit('page-change', page)
}

const handleItemsPerPageChange = (itemsPerPage) => {
  emit('items-per-page-change', itemsPerPage)
}
</script>

<style scoped>
/* Стили для конфликтных строк */
:deep(.table-row.conflicted) {
  background-color: #fef2f2;
  border-left: 3px solid #ef4444;
}

/* Стили для выбранных строк */
:deep(.table-row.selected) {
  background-color: #dbeafe;
  border-left: 3px solid #3b82f6;
}

/* Отключенные чекбоксы */
input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Стили для зарезервированного оборудования */
.conflicted-equipment {
  position: relative;
}

.conflicted-equipment::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 49%, #ef4444 49%, #ef4444 51%, transparent 51%);
  opacity: 0.1;
  pointer-events: none;
}
</style>