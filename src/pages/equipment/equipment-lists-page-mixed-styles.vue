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
        />
        
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-3xl font-bold text-primary">Списки оборудования</h1>
            <p class="text-base text-secondary mt-2">
              Управление коллекциями техники для мероприятий и проектов
            </p>
          </div>
          
          <ButtonV2 
            variant="primary" 
            size="md"
            @click="navigateToCreate"
            class="bg-gray-900 hover:bg-gray-800 text-white rounded-xl border-0 font-medium"
          >
            <template #icon>
              <IconV2 name="plus" size="sm" />
            </template>
            Создать список
          </ButtonV2>
        </div>
      </div>
    </div>

    <!-- Main Content в Bento Grid -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      
      <!-- ═══ STATISTICS CARDS в Bento Grid ═══ -->
      <BentoGrid columns="auto" gap="6" class="mb-16">
        
        <!-- Total Lists -->
        <BentoCard 
          size="1x1" 
          variant="default"
          class="stat-card group cursor-pointer"
          :interactive="true"
        >
          <div class="text-center space-y-3">
            <div class="text-4xl font-light text-gray-900 group-hover:scale-110 transition-transform duration-300">{{ totalListsCount }}</div>
            <div class="text-sm text-gray-500 uppercase tracking-wider font-medium group-hover:text-gray-700 transition-colors">Всего списков</div>
          </div>
        </BentoCard>

        <!-- Custom Lists -->
        <BentoCard 
          size="1x1" 
          variant="default"
          class="stat-card group cursor-pointer"
          :interactive="true"
        >
          <div class="text-center space-y-3">
            <div class="text-4xl font-light text-emerald-600 group-hover:scale-110 transition-transform duration-300">{{ customListsCount }}</div>
            <div class="text-sm text-gray-500 uppercase tracking-wider font-medium group-hover:text-emerald-700 transition-colors">Кастомные</div>
          </div>
        </BentoCard>

        <!-- Security Lists -->
        <BentoCard 
          size="1x1" 
          variant="default"
          class="stat-card group cursor-pointer"
          :interactive="true"
        >
          <div class="text-center space-y-3">
            <div class="text-4xl font-light text-amber-600 group-hover:scale-110 transition-transform duration-300">{{ securityListsCount }}</div>
            <div class="text-sm text-gray-500 uppercase tracking-wider font-medium group-hover:text-amber-700 transition-colors">Охрана</div>
          </div>
        </BentoCard>

        <!-- Total Equipment -->
        <BentoCard 
          size="1x1" 
          variant="default"
          class="stat-card group cursor-pointer"
          :interactive="true"
        >
          <div class="text-center space-y-3">
            <div class="text-4xl font-light text-blue-600 group-hover:scale-110 transition-transform duration-300">{{ totalEquipmentCount }}</div>
            <div class="text-sm text-gray-500 uppercase tracking-wider font-medium group-hover:text-blue-700 transition-colors">Единиц техники</div>
          </div>
        </BentoCard>
        
      </BentoGrid>

      <!-- ═══ ACTIONS BAR в Bento Card ═══ -->
      <BentoCard 
        title="Поиск и фильтры" 
        size="2x1" 
        variant="minimal"
        class="mb-8"
      >
        <div class="flex items-center gap-6">
          <!-- Search & Filter -->
          <div class="flex items-center gap-4 flex-1">
            <div class="relative flex-1 max-w-md">
              <SearchInputV2
                v-model="searchQuery"
                placeholder="Поиск списков..."
                class="w-full"
                variant="minimal"
              />
            </div>
            
            <SelectV2 
              v-model="selectedType"
              :options="typeOptions"
              placeholder="Все типы"
              class="w-48"
              variant="minimal"
            />
          </div>
        </div>
      </BentoCard>

      <!-- ═══ LISTS SECTION в Bento Card ═══ -->
      <BentoCard 
        title="Списки оборудования" 
        size="2x2" 
        variant="default"
        :scrollable="true"
      >
        <!-- Loading State -->
        <div v-if="loadingLists" class="flex items-center justify-center py-16">
          <div class="text-center space-y-3">
            <SpinnerV2 size="lg" />
            <p class="text-secondary">Загрузка списков...</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredLists.length === 0" class="text-center py-16">
          <div class="space-y-4 max-w-md mx-auto">
            <div class="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <IconV2 name="inbox" size="xl" color="gray-400" />
            </div>
            <div class="space-y-2">
              <h3 class="text-xl font-semibold text-primary">
                {{ searchQuery ? 'Списки не найдены' : 'Нет списков оборудования' }}
              </h3>
              <p class="text-secondary">
                {{ searchQuery 
                  ? 'Попробуйте изменить критерии поиска или очистить фильтры' 
                  : 'Создайте первый список оборудования для начала работы' 
                }}
              </p>
            </div>
            <ButtonV2 
              variant="primary" 
              @click="navigateToCreate"
            >
              <template #icon>
                <IconV2 name="plus" size="sm" />
              </template>
              Создать первый список
            </ButtonV2>
          </div>
        </div>

        <!-- Lists Grid -->
        <div v-else class="space-y-4">
          <div 
            v-for="list in paginatedLists" 
            :key="list.id"
            class="list-card group bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-300 hover:shadow-xl transition-all duration-500 cursor-pointer hover:-translate-y-1 active:scale-98"
            @click="openList(list)"
          >
            <div class="flex items-center justify-between">
              
              <!-- Main Content -->
              <div class="flex items-center gap-6 flex-1">
                <!-- Type Badge -->
                <div class="flex-shrink-0">
                  <StatusBadgeV2 
                    :variant="getListTypeVariant(list.type)" 
                    :label="getListTypeIcon(list.type)"
                    size="lg"
                    class="text-base px-3 py-1 rounded-lg font-medium"
                  />
                </div>
                
                <!-- List Info -->
                <div class="flex-1 space-y-2">
                  <h3 class="text-xl font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                    {{ list.name }}
                  </h3>
                  <p v-if="list.description" class="text-gray-500 text-base leading-relaxed line-clamp-1">
                    {{ list.description }}
                  </p>
                  
                  <!-- Meta Information -->
                  <div class="flex items-center gap-6 text-sm text-gray-400">
                    <span class="flex items-center gap-1">
                      <IconV2 name="package" size="xs" />
                      {{ list.equipment_ids?.length || 0 }} единиц
                    </span>
                    <span class="flex items-center gap-1">
                      <IconV2 name="calendar" size="xs" />
                      {{ formatRelativeDate(list.created_at) }}
                    </span>
                    <span v-if="list.event_id" class="flex items-center gap-1">
                      <IconV2 name="calendar-check" size="xs" />
                      Мероприятие
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Equipment Count -->
              <div class="flex-shrink-0 text-right space-y-1">
                <div class="text-3xl font-light text-gray-900">{{ list.equipment_ids?.length || 0 }}</div>
                <div class="text-xs text-gray-400 uppercase tracking-wider">единиц</div>
              </div>
              
              <!-- Actions -->
              <div class="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ml-6 transform translate-x-4 group-hover:translate-x-0">
                <ButtonV2 
                  variant="ghost" 
                  size="sm"
                  @click.stop="editList(list)"
                  class="action-btn w-9 h-9 rounded-lg border-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                >
                  <IconV2 name="edit" size="sm" />
                </ButtonV2>
                <ButtonV2 
                  variant="ghost" 
                  size="sm"
                  @click.stop="duplicateList(list)"
                  class="action-btn w-9 h-9 rounded-lg border-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                >
                  <IconV2 name="copy" size="sm" />
                </ButtonV2>
                <ButtonV2 
                  variant="ghost" 
                  size="sm"
                  @click.stop="showListMenu(list)"
                  class="action-btn w-9 h-9 rounded-lg border-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                >
                  <IconV2 name="more-horizontal" size="sm" />
                </ButtonV2>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pt-8">
            <PaginationV2
              :current-page="currentPage"
              :total-pages="totalPages"
              :items-per-page="itemsPerPage"
              :total-items="filteredLists.length"
              @update:current-page="currentPage = $event"
              @update:items-per-page="itemsPerPage = $event"
              variant="minimal"
              class="justify-center"
            />
          </div>
        </div>
      </BentoCard>

    </div>

    <!-- ═══ NOTIFICATIONS ═══ -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
/**
 * Equipment Lists Page - REDESIGNED
 * 
 * Минималистичный Bento дизайн для управления списками оборудования
 * Принципы: простота, функциональность, много воздуха, чистая типографика
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// UI Kit v2
import { 
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
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

// API
import { getEquipmentLists } from '@/features/equipment/api/equipment-lists-api'

const router = useRouter()

// ═══ NAVIGATION ═══
const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Оборудование', href: '/equipment' },
  { label: 'Списки', disabled: true }
]

// ═══ STATE ═══
const loading = ref(false)
const searchQuery = ref('')
const selectedType = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(12)

// ═══ DATA ═══
const equipmentLists = ref([])
const loadingLists = ref(false)

// ═══ OPTIONS ═══
const typeOptions = [
  { value: 'custom', label: 'Кастомные списки' },
  { value: 'security', label: 'Списки для охраны' },
  { value: 'report', label: 'Отчетные списки' }
]

// ═══ COMPUTED ═══
const filteredLists = computed(() => {
  let filtered = equipmentLists.value

  // Поиск по названию
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(list => 
      list.name.toLowerCase().includes(query) ||
      (list.description && list.description.toLowerCase().includes(query))
    )
  }

  // Фильтр по типу
  if (selectedType.value) {
    filtered = filtered.filter(list => list.type === selectedType.value)
  }

  return filtered
})

const totalPages = computed(() => Math.ceil(filteredLists.value.length / itemsPerPage.value))

const paginatedLists = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredLists.value.slice(start, end)
})

// Statistics
const totalListsCount = computed(() => equipmentLists.value.length)

const customListsCount = computed(() => 
  equipmentLists.value.filter(list => list.type === 'custom').length
)

const securityListsCount = computed(() => 
  equipmentLists.value.filter(list => list.type === 'security').length
)

const totalEquipmentCount = computed(() => 
  equipmentLists.value.reduce((total, list) => 
    total + (list.equipment_ids?.length || 0), 0
  )
)

// ═══ METHODS ═══
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

const navigateToCreate = () => {
  router.push('/equipment/lists/create')
}

const openList = (list) => {
  router.push(`/equipment/lists/${list.id}`)
}

const editList = (list) => {
  router.push(`/equipment/lists/${list.id}/edit`)
}

const duplicateList = async (list) => {
  try {
    const duplicatedData = {
      name: `${list.name} (копия)`,
      description: list.description,
      type: list.type,
      equipment_ids: [...(list.equipment_ids || [])],
      event_id: null,
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

const showListMenu = (list) => {
  console.log('📋 Показать меню для списка:', list.name)
  // TODO: Реализовать контекстное меню
}

const getListTypeVariant = (type) => {
  switch (type) {
    case 'security': return 'warning'
    case 'report': return 'info'
    case 'custom': return 'success'
    default: return 'secondary'
  }
}

const getListTypeIcon = (type) => {
  switch (type) {
    case 'security': return '🔒'
    case 'report': return '📊'
    case 'custom': return '🆓'
    default: return '📋'
  }
}

const formatRelativeDate = (dateString) => {
  if (!dateString) return 'Неизвестно'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = now - date
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
  return `${Math.floor(diffDays / 30)} мес. назад`
}

const handleBreadcrumbClick = (data) => {
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
}

// ═══ LIFECYCLE ═══
onMounted(async () => {
  await loadLists()
})
</script>

<style scoped>
/* ═══ МИНИМАЛИСТИЧНЫЙ BENTO СТИЛЬ ═══ */

/* Базовые цвета */
.bg-white {
  background-color: #ffffff;
}

/* Улучшенные переходы */
* {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Кастомные цвета для минимализма */
:deep(.text-primary) {
  color: #111827;
}

:deep(.text-secondary) {
  color: #6b7280;
}

/* ═══ АНИМАЦИИ И МИКРОВЗАИМОДЕЙСТВИЯ ═══ */

/* Статистические карточки - улучшенные эффекты поверх BentoCard */
.stat-card {
  will-change: transform;
}

.stat-card:hover {
  transform: translateY(-2px);
  transition: transform 300ms ease;
}

/* Карточки списков внутри BentoCard */
.list-card {
  will-change: transform;
  animation: fadeInUp 0.6s ease-out forwards;
}

.list-card:active {
  transition-duration: 75ms;
}

/* Кнопки действий */
.action-btn {
  will-change: transform;
}

.action-btn:hover {
  backdrop-filter: blur(8px);
}

/* ═══ АНИМАЦИИ ПОЯВЛЕНИЯ ═══ */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Задержки для каскадного появления */
.stat-card:nth-child(1) { animation-delay: 0.1s; }
.stat-card:nth-child(2) { animation-delay: 0.2s; }
.stat-card:nth-child(3) { animation-delay: 0.3s; }
.stat-card:nth-child(4) { animation-delay: 0.4s; }

.list-card:nth-child(1) { animation-delay: 0.5s; }
.list-card:nth-child(2) { animation-delay: 0.6s; }
.list-card:nth-child(3) { animation-delay: 0.7s; }
.list-card:nth-child(4) { animation-delay: 0.8s; }
.list-card:nth-child(5) { animation-delay: 0.9s; }

/* ═══ УТИЛИТЫ ═══ */

/* Active состояние */
.active\:scale-98:active {
  transform: scale(0.98);
}

/* line-clamp утилита */
.line-clamp-1 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

/* ═══ АДАПТИВНОСТЬ ═══ */
@media (max-width: 768px) {
  .text-5xl {
    font-size: 2.5rem;
    line-height: 1;
  }
  
  .text-xl {
    font-size: 1.125rem;
    line-height: 1.75rem;
  }
  
  /* Упрощенные анимации на мобильных */
  .stat-card:hover,
  .list-card:hover {
    transform: none;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  /* Быстрые переходы на touch устройствах */
  .stat-card,
  .list-card,
  .action-btn {
    transition-duration: 150ms;
  }
}

/* ═══ FOCUS СОСТОЯНИЯ ДЛЯ ДОСТУПНОСТИ ═══ */
.stat-card:focus,
.list-card:focus,
.action-btn:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* ═══ PREFERS REDUCED MOTION ═══ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .stat-card:hover,
  .list-card:hover {
    transform: none;
  }
}

/* ═══ ПОДДЕРЖКА ACCESSIBILITY ═══ */
.stat-card,
.list-card {
  position: relative;
}

.stat-card::after,
.list-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity 200ms ease;
  opacity: 0;
}

.stat-card:focus-visible::after,
.list-card:focus-visible::after {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--color-primary);
}
</style>