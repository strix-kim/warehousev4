<template>
  <BentoCard title="Список оборудования" size="1x1" variant="default">
    <TableV2
      :data="data"
      :columns="tableColumns"
      :loading="loading"
      :error="error"
      :clickable-rows="true"
      :sort-by="sortBy"
      :sort-direction="sortOrder"
      class="w-full"
      @row-click="handleEquipmentClick"
      @sort="handleSort"
    >
      <!-- Кастомные ячейки -->
      
      <!-- Бренд -->
      <template #cell-brand="{ item }">
        <span 
          class="font-semibold text-primary text-sm cursor-help"
          :title="item.brand"
        >
          {{ item.brand || '—' }}
        </span>
      </template>

      <!-- Модель -->
      <template #cell-model="{ item }">
        <span 
          class="text-secondary text-sm cursor-help"
          :title="item.model"
        >
          {{ item.model || '—' }}
        </span>
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

      <!-- Действия - упрощенная версия -->
      <template #cell-actions="{ item }">
        <div class="flex items-center justify-center">
          <ButtonV2 
            variant="ghost" 
            size="sm"
            @click.stop="openViewModal(item)"
            :title="`Посмотреть ${item.brand || 'оборудование'}`"
            
            class="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <template #icon>
              <IconV2 name="eye" size="xs" />
            </template>
          </ButtonV2>
        </div>
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

    <!-- ✅ Модальные окна -->
    <EquipmentFormModal
      v-model="showFormModal"
      :equipment="selectedEquipment"
      @saved="handleFormSaved"
      @deleted="handleFormDeleted"
      @close="handleFormClosed"
    />

    <EquipmentDeleteModal
      v-model="showDeleteModal"
      :equipment="selectedEquipment"
      @deleted="handleDeleted"
      @close="handleDeleteClosed"
    />

    <!-- ✅ Модальное окно просмотра -->
    <EquipmentViewModal
      v-model="showViewModal"
      :equipment="selectedEquipment"
      @edit="handleViewEdit"
      @delete="handleViewDelete"
      @close="handleViewClosed"
    />
  </BentoCard>
</template>

<script setup>
/**
 * EquipmentTable - EPR System
 * 
 * Компонент таблицы оборудования с сортировкой и пагинацией
 * Использует UI Kit v2
 */

import { ref, nextTick } from 'vue'

import { 
  BentoCard,
  TableV2,
  ButtonV2,
  IconV2,
  PaginationV2
} from '@/shared/ui-v2'

// ✅ Модальные компоненты
import EquipmentFormModal from '@/features/equipment/components/EquipmentFormModal.vue'
import EquipmentDeleteModal from '@/features/equipment/components/EquipmentDeleteModal.vue'
import EquipmentViewModal from '@/features/equipment/components/EquipmentViewModal.vue'

// Props
const props = defineProps({
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
  sortBy: {
    type: String,
    default: ''
  },
  sortOrder: {
    type: String,
    default: 'asc'
  },
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
    default: 30
  },
  total: {
    type: Number,
    default: 0
  }
})

// Emits - упрощены, все интерактивность внутри компонента
const emit = defineEmits([
  'sort',
  'page-change',
  'items-per-page-change'
])

// Table columns configuration
const tableColumns = [
  { 
    key: 'brand', 
    label: 'Бренд', 
    sortable: true
  },
  { 
    key: 'model', 
    label: 'Модель', 
    sortable: true
  },
  { 
    key: 'serialnumber', 
    label: 'Серийный номер', 
    sortable: true
  },
  { 
    key: 'type', 
    label: 'Категория', 
    sortable: true
  },
  { 
    key: 'subtype', 
    label: 'Подкатегория', 
    sortable: true
  },
  { 
    key: 'location', 
    label: 'Локация', 
    sortable: true
  },
  { 
    key: 'actions', 
    label: 'Действия', 
    sortable: false
  }
]

// ✅ Состояние модальных окон
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const showViewModal = ref(false)
const selectedEquipment = ref(null)

// ✅ Новые обработчики модалок  
const openAddForm = () => {
  console.log('➕ [Table] Add new equipment')
  // Сначала очищаем выбранное оборудование, потом открываем форму
  selectedEquipment.value = null
  nextTick(() => {
    showFormModal.value = true
  })
}

// ✅ Экспортируем метод для внешнего вызова (ПОСЛЕ объявления)
defineExpose({
  openAddForm
})

const openEditForm = (item) => {
  console.log('📝 [Table] Edit equipment:', item.id)
  // Используем nextTick для корректного обновления
  nextTick(() => {
    selectedEquipment.value = item
    nextTick(() => {
      showFormModal.value = true
    })
  })
}

const openViewModal = (item) => {
  console.log('👁️ [Table] View equipment:', item.id)
  selectedEquipment.value = item
  showViewModal.value = true
}

const openDeleteModal = (item) => {
  selectedEquipment.value = item
  showDeleteModal.value = true
}

const handleFormSaved = () => {
  // Обновление произойдет автоматически через store reactivity
  console.log('✅ Equipment saved!')
}

const handleFormDeleted = (equipment) => {
  // Переходим к модалке удаления из формы
  showFormModal.value = false
  setTimeout(() => {
    selectedEquipment.value = equipment
    showDeleteModal.value = true
  }, 100)
}

const handleFormClosed = () => {
  selectedEquipment.value = null
}

const handleDeleted = () => {
  // Обновление произойдет автоматически через store reactivity
  console.log('🗑️ Equipment deleted!')
}

const handleDeleteClosed = () => {
  selectedEquipment.value = null
}

// ✅ Обработчики модального окна просмотра
const handleViewEdit = (equipment) => {
  console.log('📝 [Table] Edit from view modal:', equipment.id)
  showViewModal.value = false
  
  // Используем nextTick для корректного обновления
  nextTick(() => {
    selectedEquipment.value = equipment
    nextTick(() => {
      showFormModal.value = true
    })
  })
}

const handleViewDelete = (equipment) => {
  console.log('🗑️ [Table] Delete from view modal:', equipment.id)
  selectedEquipment.value = equipment
  showViewModal.value = false
  setTimeout(() => {
    showDeleteModal.value = true
  }, 100)
}

const handleViewClosed = () => {
  selectedEquipment.value = null
}

// ✅ Обработчик клика по строке (особенно важен для мобильных)
const handleEquipmentClick = (item) => {
  console.log('📱 [Table] Row clicked:', item.id)
  // На мобильных устройствах открываем просмотр
  if (window.innerWidth <= 767) {
    openViewModal(item)
  } else {
    // На десктопе можно эмитить событие или тоже открывать просмотр
    openViewModal(item)
  }
}

const handleSort = (sortEvent) => {
  emit('sort', sortEvent)
}

const handlePageChange = (page) => {
  emit('page-change', page)
}

const handleItemsPerPageChange = (items) => {
  emit('items-per-page-change', items)
}

const handleEdit = (item) => {
  emit('edit', item)
}

const handleView = (item) => {
  emit('view', item)
}
</script>

<style scoped>
/* ===============================
   АДАПТИВНАЯ ТАБЛИЦА ДЛЯ ВСЕХ УСТРОЙСТВ
   =============================== */

/* БАЗОВЫЕ СТИЛИ ДЛЯ ТАБЛИЦЫ */
:deep(table) {
  table-layout: fixed !important;
  width: 100% !important;
}

:deep(th),
:deep(td) {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  padding: 8px 12px !important;
}

/* ===============================
   DESKTOP (1024px+): ВСЕ 7 КОЛОНОК
   =============================== */
@media (min-width: 1024px) {
  :deep(.overflow-x-auto) {
    overflow-x: visible !important;
  }

  :deep(th:nth-child(1)), :deep(td:nth-child(1)) { width: 15% !important; } /* Бренд */
  :deep(th:nth-child(2)), :deep(td:nth-child(2)) { width: 20% !important; } /* Модель */
  :deep(th:nth-child(3)), :deep(td:nth-child(3)) { width: 15% !important; } /* Серийный номер */
  :deep(th:nth-child(4)), :deep(td:nth-child(4)) { width: 12% !important; } /* Категория */
  :deep(th:nth-child(5)), :deep(td:nth-child(5)) { width: 13% !important; } /* Подкатегория */
  :deep(th:nth-child(6)), :deep(td:nth-child(6)) { width: 15% !important; } /* Локация */
                :deep(th:nth-child(7)), :deep(td:nth-child(7)) { width: 8% !important; text-align: center !important; } /* Действия - упрощено */
}

/* ===============================
   TABLET (768px-1023px): 5 КОЛОНОК
   =============================== */
@media (min-width: 768px) and (max-width: 1023px) {
  :deep(.overflow-x-auto) {
    overflow-x: visible !important;
  }

  /* Скрываем подкатегорию и локацию на планшетах */
  :deep(th:nth-child(5)), :deep(td:nth-child(5)) { display: none !important; } /* Подкатегория скрыта */
  :deep(th:nth-child(6)), :deep(td:nth-child(6)) { display: none !important; } /* Локация скрыта */

  /* Перераспределяем ширины для 5 колонок */
  :deep(th:nth-child(1)), :deep(td:nth-child(1)) { width: 20% !important; } /* Бренд */
  :deep(th:nth-child(2)), :deep(td:nth-child(2)) { width: 25% !important; } /* Модель */
  :deep(th:nth-child(3)), :deep(td:nth-child(3)) { width: 20% !important; } /* Серийный номер */
  :deep(th:nth-child(4)), :deep(td:nth-child(4)) { width: 20% !important; } /* Категория */
                :deep(th:nth-child(7)), :deep(td:nth-child(7)) { width: 12% !important; text-align: center !important; } /* Действия - упрощено */
}

/* ===============================
   MOBILE (до 767px): 3 КОЛОНКИ БЕЗ ПРОКРУТКИ
   =============================== */
@media (max-width: 767px) {
  :deep(.overflow-x-auto) {
    overflow-x: visible !important; /* Убираем прокрутку */
  }

  :deep(table) {
    width: 100% !important; /* Убираем фиксированную min-width */
    table-layout: fixed !important; /* Принудительное распределение */
  }

  /* Скрываем серийный номер, категорию, подкатегорию, локацию */
  :deep(th:nth-child(3)), :deep(td:nth-child(3)) { display: none !important; } /* Серийный номер скрыт */
  :deep(th:nth-child(4)), :deep(td:nth-child(4)) { display: none !important; } /* Категория скрыта */
  :deep(th:nth-child(5)), :deep(td:nth-child(5)) { display: none !important; } /* Подкатегория скрыта */
  :deep(th:nth-child(6)), :deep(td:nth-child(6)) { display: none !important; } /* Локация скрыта */

  /* ✅ Правильное распределение ширин на мобильных */
  :deep(th:nth-child(1)), :deep(td:nth-child(1)) { 
    width: 30% !important; /* 30% для бренда */
  }
  
  :deep(th:nth-child(2)), :deep(td:nth-child(2)) { 
    width: 50% !important; /* 50% для модели - главная информация */
  }
  
  :deep(th:nth-child(7)), :deep(td:nth-child(7)) { 
    width: 20% !important; /* 20% для действий */
    text-align: center !important;
  }

  /* ✅ Лучшие отступы и сенсорное взаимодействие на мобильных */
  :deep(th),
  :deep(td) {
    padding: 16px 12px !important; /* Больше для удобного тача */
    font-size: 14px !important;
  }

  /* ✅ Кликабельные строки на мобильных */
  :deep(tbody tr) {
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    border-radius: 4px !important;
  }

  :deep(tbody tr:hover) {
    background-color: #f1f5f9 !important; /* Легкий hover эффект */
    transform: scale(1.01) !important; /* Слегка увеличиваем */
    border-left: 3px solid #3b82f6 !important; /* Синяя полоска слева */
  }

  :deep(tbody tr:active) {
    background-color: #e2e8f0 !important; /* Эффект нажатия */
    transform: scale(0.99) !important; /* Слегка уменьшаем при нажатии */
    border-left: 3px solid #1d4ed8 !important; /* Темно-синяя полоска при нажатии */
  }
}

/* ===============================
   МОБИЛЬНЫЕ ХИНТЫ И УЛУЧШЕНИЯ
   =============================== */
@media (max-width: 767px) {
  /* Добавляем скролл-индикаторы для мобильных */
  :deep(.overflow-x-auto):before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 100%;
    background: linear-gradient(to left, rgba(255,255,255,0.8), transparent);
    pointer-events: none;
    z-index: 1;
  }
}
</style>