<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 
          :items="breadcrumbs" 
          variant="minimal" 
          size="sm"
          @item-click="handleBreadcrumbClick"
          @navigate="handleBreadcrumbNavigate"
        />
        
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-3xl font-bold text-primary">Списки оборудования</h1>
            <p class="text-base text-secondary mt-2">
              Управление существующими списками оборудования для мероприятий
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content в Bento Grid -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <BentoGrid columns="4" gap="6">
        
        <!-- Toolbar: Поиск, фильтры и действия -->
        <BentoCard 
          title="Управление списками" 
          size="3x1" 
          variant="minimal"
        >
          <div class="flex items-center justify-between gap-6">
            <!-- Поиск и фильтры -->
            <div class="flex items-center gap-4 flex-1">
              <SearchInputV2
                v-model="searchQuery"
                placeholder="Поиск списков по названию..."
                class="flex-1 max-w-md"
              />
              
              <SelectV2 
                v-model="selectedType"
                :options="typeOptions"
                placeholder="Все типы"
                size="sm"
                class="min-w-48"
              />
              
              <ButtonV2 
                variant="ghost" 
                size="sm"
                @click="clearFilters"
                :disabled="!searchQuery && !selectedType"
              >
                <template #icon>
                  <IconV2 name="x" size="xs" />
                </template>
                Очистить
              </ButtonV2>
            </div>
            
            <!-- Действия -->
            <div class="flex items-center gap-3">
              <span class="text-sm text-secondary">
                {{ filteredLists.length }} из {{ totalListsCount }}
              </span>
              
              <ButtonV2 
                variant="ghost" 
                size="sm"
                @click="loadLists"
                :loading="loadingLists"
              >
                <template #icon>
                  <IconV2 name="refresh-cw" size="xs" />
                </template>
              </ButtonV2>
              
              <ButtonV2 
                variant="ghost" 
                size="sm"
                @click="exportLists"
              >
                <template #icon>
                  <IconV2 name="download" size="xs" />
                </template>
                Экспорт
              </ButtonV2>
              
              <ButtonV2 
                variant="primary" 
                size="sm"
                @click="navigateToCreate"
              >
                <template #icon>
                  <IconV2 name="plus" size="xs" />
                </template>
                Создать список
              </ButtonV2>
            </div>
          </div>
        </BentoCard>
        
        <!-- Sidebar: Компактная аналитика -->
        <BentoCard 
          title="Статистика" 
          size="1x1" 
          variant="secondary"
        >
          <div class="space-y-4">
            <div class="text-center">
              <div class="text-3xl font-bold text-primary">{{ totalListsCount }}</div>
              <div class="text-sm text-secondary">Всего списков</div>
            </div>
            
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-secondary">🆓 Кастомные</span>
                <span class="font-semibold text-success">{{ customListsCount }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-secondary">🔒 Охрана</span>
                <span class="font-semibold text-warning">{{ securityListsCount }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-secondary">📊 Отчеты</span>
                <span class="font-semibold text-info">{{ reportListsCount }}</span>
              </div>
            </div>
            
            <div class="border-t border-gray-200 pt-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-secondary">Всего техники</span>
                <span class="font-bold text-brand-red">{{ totalEquipmentCount }}</span>
              </div>
            </div>
          </div>
        </BentoCard>

        <!-- Main Content: Списки оборудования -->
        <BentoCard 
          title="Списки оборудования" 
          size="4x2" 
          variant="default"
        >
          <!-- Loading состояние -->
          <div v-if="loadingLists" class="flex items-center justify-center h-96">
            <div class="text-center">
              <SpinnerV2 size="lg" />
              <p class="text-secondary text-sm mt-3">Загрузка списков...</p>
            </div>
          </div>

          <!-- Пустое состояние -->
          <div v-else-if="filteredLists.length === 0" class="flex items-center justify-center h-96">
            <div class="text-center max-w-md">
              <IconV2 name="inbox" size="3xl" color="secondary" class="mb-6" />
              <h3 class="text-xl font-semibold text-primary mb-3">
                {{ searchQuery ? 'Списки не найдены' : 'Нет списков оборудования' }}
              </h3>
              <p class="text-secondary mb-6">
                {{ searchQuery 
                  ? 'Попробуйте изменить критерии поиска или очистить фильтры' 
                  : 'Создайте первый список оборудования для начала работы' 
                }}
              </p>
              <ButtonV2 variant="primary" @click="navigateToCreate">
                <template #icon>
                  <IconV2 name="plus" size="xs" />
                </template>
                Создать первый список
              </ButtonV2>
            </div>
          </div>

          <!-- Списки в виде таблицы -->
          <div v-else class="space-y-0">
            <div 
              v-for="list in paginatedLists" 
              :key="list.id"
              class="group border-b border-gray-100 last:border-b-0 py-4 px-2 hover:bg-gray-50 transition-colors cursor-pointer"
              @click="openList(list)"
            >
              <div class="flex items-center justify-between">
                <!-- Основная информация -->
                <div class="flex items-center gap-4 flex-1">
                  <StatusBadgeV2 
                    :variant="getListTypeVariant(list.type)" 
                    :label="getListTypeLabel(list.type)" 
                    size="sm" 
                  />
                  
                  <div class="flex-1">
                    <h4 class="font-semibold text-primary group-hover:text-brand-red transition-colors">
                      {{ list.name }}
                    </h4>
                    <p v-if="list.description" class="text-sm text-secondary mt-1 line-clamp-1">
                      {{ list.description }}
                    </p>
                  </div>
                </div>
                
                <!-- Метаданные -->
                <div class="flex items-center gap-6 text-sm text-secondary">
                  <div class="flex items-center gap-1">
                    <IconV2 name="package" size="xs" />
                    <span>{{ list.equipment_ids?.length || 0 }}</span>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <IconV2 name="calendar" size="xs" />
                    <span>{{ formatRelativeDate(list.created_at) }}</span>
                  </div>
                  
                  <div v-if="list.event_id" class="flex items-center gap-1">
                    <IconV2 name="calendar-check" size="xs" />
                    <span>Мероприятие</span>
                  </div>
                  
                  <div v-if="list.mount_point_id" class="flex items-center gap-1">
                    <IconV2 name="map-pin" size="xs" />
                    <span>Точка монтажа</span>
                  </div>
                </div>
                
                <!-- Действия -->
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                  <ButtonV2 
                    variant="ghost" 
                    size="sm"
                    @click.stop="openList(list)"
                  >
                    <template #icon>
                      <IconV2 name="eye" size="xs" />
                    </template>
                  </ButtonV2>
                  <ButtonV2 
                    variant="ghost" 
                    size="sm"
                    @click.stop="editList(list)"
                  >
                    <template #icon>
                      <IconV2 name="edit" size="xs" />
                    </template>
                  </ButtonV2>
                  <ButtonV2 
                    variant="ghost" 
                    size="sm"
                    @click.stop="duplicateList(list)"
                  >
                    <template #icon>
                      <IconV2 name="copy" size="xs" />
                    </template>
                  </ButtonV2>
                </div>
              </div>
            </div>

            <!-- Пагинация -->
            <div v-if="totalPages > 1" class="pt-6 border-t border-gray-200">
              <PaginationV2
                :current-page="currentPage"
                :total-pages="totalPages"
                :items-per-page="itemsPerPage"
                :total-items="filteredLists.length"
                @update:current-page="currentPage = $event"
                @update:items-per-page="itemsPerPage = $event"
              />
            </div>
          </div>
        </BentoCard>

      </BentoGrid>
    </div>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
/**
 * Equipment Lists Page - страница просмотра списков оборудования
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// UI Kit v2
import { 
  BentoGrid, 
  BentoCard, 
  BreadcrumbsV2, 
  ButtonV2, 
  IconV2,
  SearchInputV2,
  SelectV2,
  StatusBadgeV2,
  SpinnerV2,
  PaginationV2,
  NotificationV2
} from '@/shared/ui-v2'

// API
import { getEquipmentLists } from '@/features/equipment/api/equipment-lists-api'

const router = useRouter()

// === BREADCRUMBS ===
const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { 
    label: 'Модуль оборудования', 
    href: '/equipment',
    submenu: [
      { label: '🔧 Управление оборудованием', href: '/equipment/items', icon: 'settings' },
      { label: '📋 Списки оборудования', href: '/equipment/lists', icon: 'list' },
      { label: '➕ Создать список', href: '/equipment/lists/create', icon: 'plus' }
    ]
  },
  { label: 'Списки оборудования', disabled: true }
]

// === СОСТОЯНИЕ ===
const loading = ref(false)
const searchQuery = ref('')
const selectedType = ref('')
const selectedStatus = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// === СОСТОЯНИЕ ДАННЫХ ===
const equipmentLists = ref([])
const loadingLists = ref(false)

// === ЗАГРУЗКА ДАННЫХ ===
const loadLists = async () => {
  loadingLists.value = true
  try {
    const { data, error } = await getEquipmentLists()
    if (error) throw error
    equipmentLists.value = data || []
  } catch (error) {
    console.error('❌ Ошибка загрузки списков:', error)
    equipmentLists.value = []
  } finally {
    loadingLists.value = false
  }
}

// === ОПЦИИ ===
const typeOptions = [
  { value: 'custom', label: '🆓 Кастомные списки' },
  { value: 'security', label: '🔒 Списки для охраны' },
  { value: 'report', label: '📊 Отчетные списки' }
]

const statusOptions = [
  { value: 'active', label: 'Активные' },
  { value: 'archived', label: 'Архивные' }
]

// === COMPUTED ===
const filteredLists = computed(() => {
  let result = equipmentLists.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(list => 
      list.name.toLowerCase().includes(query) ||
      list.description.toLowerCase().includes(query)
    )
  }

  if (selectedType.value) {
    result = result.filter(list => list.type === selectedType.value)
  }

  return result
})

const totalPages = computed(() => {
  return Math.ceil(filteredLists.value.length / itemsPerPage.value)
})

const paginatedLists = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredLists.value.slice(start, end)
})

// === СТАТИСТИКА ===
const totalListsCount = computed(() => equipmentLists.value.length)

const customListsCount = computed(() => 
  equipmentLists.value.filter(list => list.type === 'custom').length
)

const securityListsCount = computed(() => 
  equipmentLists.value.filter(list => list.type === 'security').length
)

const reportListsCount = computed(() => 
  equipmentLists.value.filter(list => list.type === 'report').length
)

const totalEquipmentCount = computed(() => 
  equipmentLists.value.reduce((total, list) => 
    total + (list.equipment_ids?.length || 0), 0
  )
)

// === МЕТОДЫ ===
const navigateToCreate = () => {
  router.push('/equipment/lists/create')
}

const openList = (list) => {
  console.log('🔍 Открытие списка:', list.name)
  router.push(`/equipment/lists/${list.id}`)
}

const editList = (list) => {
  console.log('✏️ Редактирование списка:', list.name)
  router.push(`/equipment/lists/${list.id}/edit`)
}

const duplicateList = async (list) => {
  console.log('📋 Дублирование списка:', list.name)
  try {
    const duplicatedData = {
      name: `${list.name} (копия)`,
      description: list.description,
      type: list.type,
      equipment_ids: [...(list.equipment_ids || [])],
      event_id: null, // Копии не привязываем к мероприятию
      mount_point_id: null,
      metadata: { ...list.metadata, source: 'duplicated', original_id: list.id }
    }
    
    router.push({
      path: '/equipment/lists/create',
      query: { duplicate: list.id, data: JSON.stringify(duplicatedData) }
    })
  } catch (error) {
    console.error('❌ Ошибка дублирования:', error)
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedType.value = ''
  selectedStatus.value = ''
}

const getListTypeVariant = (type) => {
  switch (type) {
    case 'security': return 'warning'
    case 'report': return 'info'
    case 'custom': return 'success'
    default: return 'secondary'
  }
}

const getListTypeLabel = (type) => {
  switch (type) {
    case 'security': return 'Охрана'
    case 'report': return 'Отчет'
    case 'custom': return 'Кастомный'
    default: return 'Неизвестный'
  }
}



const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU')
}

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now - date)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} нед. назад`
  return formatDate(dateString)
}

const showListMenu = (list) => {
  console.log('📋 Меню списка:', list.name)
  // TODO: Реализовать контекстное меню
}

const exportLists = () => {
  console.log('📤 Экспорт списков...')
  // TODO: Реализовать экспорт списков в CSV/Excel
}

// === LIFECYCLE ===
// === BREADCRUMBS НАВИГАЦИЯ ===
const handleBreadcrumbClick = (data) => {
  console.log('🧭 [Lists] Клик по breadcrumb:', data.item.label)
  
  // Обрабатываем клики по submenu
  if (data.isSubmenu) {
    console.log('🧭 [Lists] Переход по submenu:', data.item.href)
    if (data.item.href) {
      router.push(data.item.href)
    }
    return
  }
  
  // Обычные breadcrumbs
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
}

const handleBreadcrumbNavigate = (data) => {
  console.log('🧭 [Lists] Навигация по breadcrumb:', data.href)
  if (data.href) {
    router.push(data.href)
  }
}

onMounted(async () => {
  console.log('📋 Загрузка списков оборудования...')
  await loadLists()
})
</script>