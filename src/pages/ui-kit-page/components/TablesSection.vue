<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🗂️ Table v2 - Enterprise Data Table</h2>
    <BentoGrid columns="1" gap="6">
      <!-- Возможности Table v2 -->
      <BentoCard title="Возможности Table v2">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Сортировка</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Поиск</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Селекция</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Пагинация</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Loading</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Error states</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Responsive</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Slots</span>
          </div>
        </div>
      </BentoCard>

      <!-- Замена старых таблиц -->
      <BentoCard title="Замена старых таблиц">
        <div class="space-y-3">
          <p class="text-sm">
            <strong class="text-primary">EquipmentTable.vue:</strong> 385 строк → Table v2
          </p>
          <p class="text-sm">
            <strong class="text-primary">Универсальность:</strong> Подходит для всех данных
          </p>
          <p class="text-sm">
            <strong class="text-primary">Консистентность:</strong> Единый UX по всей системе
          </p>
          <p class="text-sm">
            <strong class="text-primary">Производительность:</strong> Оптимизированная отрисовка
          </p>
        </div>
      </BentoCard>
    </BentoGrid>

    <!-- Демонстрация простой таблицы -->
    <BentoCard title="Простая таблица оборудования" size="2x1" scrollable>


      <!-- Простая таблица -->
      <TableV2 
        :data="tableData"
        :columns="columns"
        :loading="loading"
        :sort-by="sortBy"
        :sort-direction="sortDirection"
        :clickable-rows="true"
        :sticky-header="true"
        :max-body-height="300"
        @sort="handleSort"
        @row-click="handleRowClick"
      >
        <template #caption>
          Список оборудования (демо), залипание заголовка и внутренний скролл
        </template>
        <!-- Кастомная ячейка для статуса -->
        <template #cell-status="{ value }">
          <StatusBadgeV2 
            :label="getStatusLabel(value)" 
            :variant="getStatusVariant(value)" 
            size="sm" 
          />
        </template>
        
        <!-- Кастомная ячейка для цены -->
        <template #cell-price="{ value }">
          <span class="font-mono text-primary">{{ formatPrice(value) }}</span>
        </template>
        
        <!-- Кастомная ячейка для действий -->
        <template #cell-actions="{ item }">
          <div class="flex gap-2">
            <ButtonV2 variant="ghost" size="sm" @click.stop="editItem(item)">
              <IconV2 name="edit" size="xs" />
            </ButtonV2>
            <ButtonV2 variant="error" size="sm" @click.stop="deleteItem(item)">
              <IconV2 name="trash-2" size="xs" />
            </ButtonV2>
          </div>
        </template>
      </TableV2>
    </BentoCard>

    <!-- Отдельный компонент пагинации -->
    <BentoCard title="Пагинация" size="1x1">
      <PaginationV2
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="totalItems"
        :items-per-page="itemsPerPage"
        :items-per-page-options="itemsPerPageOptions"
        @update:current-page="currentPage = $event"
        @update:items-per-page="itemsPerPage = $event"
      />
    </BentoCard>

    <!-- Кнопки тестирования -->
    <BentoCard title="Тестирование состояний">
      <div class="flex gap-3 flex-wrap">
        <ButtonV2 variant="primary" size="sm" @click="showLoading">Показать Loading</ButtonV2>
        <ButtonV2 variant="warning" size="sm" @click="showError">Показать Error</ButtonV2>
        <ButtonV2 variant="ghost" size="sm" @click="clearData">Очистить данные</ButtonV2>
      </div>
    </BentoCard>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  BentoGrid,
  BentoCard, 
  TableV2, 
  ButtonV2,
  StatusBadgeV2,
  PaginationV2,
  SelectV2,
  IconV2
} from '@/shared/ui-v2'

// Состояние таблицы
const loading = ref(false)
const searchQuery = ref('')
const sortBy = ref('')
const sortDirection = ref('asc')
const currentPage = ref(1)
const itemsPerPage = ref(5)

// Тест пагинации
const testCurrentPage = ref(3)

// Данные для таблицы
const mockData = [
  {
    id: 1,
    name: 'Camera Sony FX6',
    category: 'Видеокамеры',
    location: 'Склад А',
    status: 'available',
    price: 450000
  },
  {
    id: 2,
    name: 'Микрофон Rode NTG4+',
    category: 'Аудио',
    location: 'Склад Б',
    status: 'in-use',
    price: 25000
  },
  {
    id: 3,
    name: 'Штатив Manfrotto',
    category: 'Аксессуары',
    location: 'Цех производства',
    status: 'maintenance',
    price: 15000
  },
  {
    id: 4,
    name: 'LED Panel Aputure 300D',
    category: 'Освещение',
    location: 'Склад А',
    status: 'available',
    price: 85000
  },
  {
    id: 5,
    name: 'Monitor Atomos Ninja V',
    category: 'Мониторы',
    location: 'Офисное здание',
    status: 'retired',
    price: 45000
  }
]

const tableData = ref([...mockData])

// Колонки таблицы
const columns = [
  {
    key: 'name',
    label: 'Название',
    sortable: true
  },
  {
    key: 'category',
    label: 'Категория',
    sortable: true
  },
  {
    key: 'location',
    label: 'Локация'
  },
  {
    key: 'status',
    label: 'Статус'
  },
  {
    key: 'price',
    label: 'Цена',
    sortable: true
  },
  {
    key: 'actions',
    label: 'Действия'
  }
]

// Опции для пагинации
const itemsPerPageOptions = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 }
]

// Computed свойства для пагинации
const totalItems = computed(() => tableData.value.length)
const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value))
const startItem = computed(() => (currentPage.value - 1) * itemsPerPage.value + 1)
const endItem = computed(() => Math.min(currentPage.value * itemsPerPage.value, totalItems.value))

// Обработчики
const handleSort = ({ column, direction }) => {
  sortBy.value = column
  sortDirection.value = direction
  console.log('Sorting by:', column, direction)
}

const handleRowClick = (row) => {
  console.log('Row clicked:', row)
}

// Методы для работы со статусами
const getStatusLabel = (status) => {
  const statusMap = {
    available: 'Доступно',
    'in-use': 'Используется',
    maintenance: 'Обслуживание',
    retired: 'Списано'
  }
  return statusMap[status] || status
}

const getStatusVariant = (status) => {
  const variantMap = {
    available: 'success',
    'in-use': 'warning',
    maintenance: 'warning',
    retired: 'error'
  }
  return variantMap[status] || 'secondary'
}

// Форматирование цены
const formatPrice = (price) => {
  return `${price.toLocaleString('ru-RU')} ₽`
}

// Действия с элементами
const editItem = (item) => {
  console.log('Edit item:', item)
}

const deleteItem = (item) => {
  console.log('Delete item:', item)
}

// Тестирование состояний
const showLoading = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 2000)
}

const showError = () => {
  tableData.value = []
  // Можно добавить error состояние
}

const clearData = () => {
  tableData.value = []
}

// Добавим тест пагинации в конец файла
// Поможет убедиться что иконки отображаются корректно
</script>