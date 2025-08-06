<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs - стандартный стиль модуля -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 
          :items="breadcrumbs" 
          variant="minimal" 
          size="sm"
          @item-click="handleBreadcrumbClick"
        />
        
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mt-4">
          <div class="flex-1">
            <h1 class="text-2xl sm:text-3xl font-bold text-primary">Списки оборудования</h1>
            <p class="text-sm sm:text-base text-secondary mt-1 sm:mt-2">
              Управление коллекциями техники для мероприятий и проектов
            </p>
          </div>
          
          <div class="flex-shrink-0 flex gap-2">
            <ButtonV2 
              variant="ghost" 
              size="sm"
              @click="testNotifications"
              class="text-xs opacity-60 hover:opacity-100"
              title="Протестировать уведомления"
            >
              🧪
            </ButtonV2>
            <ButtonV2 
              variant="primary" 
              size="md"
              @click="navigateToCreate"
              class="w-full sm:w-auto"
            >
              <template #icon>
                <IconV2 name="plus" size="sm" />
              </template>
              Создать список
            </ButtonV2>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content в Bento Grid -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      
      <!-- ═══ СТАТИСТИКА в Pure Warehouse Style ═══ -->
      <BentoGrid columns="auto" gap="6" class="mb-8">
        
        <!-- Всего списков -->
        <BentoCard 
          size="1x1" 
          variant="minimal"
        >
          <div class="text-center">
            <div class="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2">{{ totalListsCount }}</div>
            <div class="text-xs sm:text-sm text-secondary uppercase tracking-wider font-medium">Всего списков</div>
          </div>
        </BentoCard>

        <!-- Кастомные списки -->
        <BentoCard 
          size="1x1" 
          variant="minimal"
        >
          <div class="text-center">
            <div class="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2">{{ customListsCount }}</div>
            <div class="text-xs sm:text-sm text-secondary uppercase tracking-wider font-medium">Кастомные</div>
          </div>
        </BentoCard>

        <!-- Списки охраны -->
        <BentoCard 
          size="1x1" 
          variant="minimal"
        >
          <div class="text-center">
            <div class="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2">{{ securityListsCount }}</div>
            <div class="text-xs sm:text-sm text-secondary uppercase tracking-wider font-medium">Охрана</div>
          </div>
        </BentoCard>

        <!-- Единиц техники -->
        <BentoCard 
          size="1x1" 
          variant="minimal"
        >
          <div class="text-center">
            <div class="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2">{{ totalEquipmentCount }}</div>
            <div class="text-xs sm:text-sm text-secondary uppercase tracking-wider font-medium">Единиц техники</div>
          </div>
        </BentoCard>
        
      </BentoGrid>

      <!-- ═══ ПОИСК И ФИЛЬТРЫ ═══ -->
      <BentoCard 
        title="Поиск и фильтры" 
        size="2x1" 
        variant="minimal"
        class="mb-8"
      >
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div class="flex-1">
            <SearchInputV2
              v-model="searchQuery"
              placeholder="Поиск списков по названию или описанию..."
              variant="minimal"
            />
          </div>
          
          <div class="w-full sm:w-48">
            <SelectV2 
              v-model="selectedType"
              :options="typeOptions"
              placeholder="Все типы"
              variant="minimal"
            />
          </div>
        </div>
      </BentoCard>

      <!-- ═══ СПИСКИ ОБОРУДОВАНИЯ ═══ -->
      <BentoCard 
        title="Списки оборудования" 
        size="2x2" 
        variant="default"
        :scrollable="true"
      >
        
        <!-- Loading State -->
        <div v-if="loadingLists" class="flex items-center justify-center py-12">
          <div class="text-center space-y-3">
            <SpinnerV2 size="lg" />
            <p class="text-secondary">Загрузка списков...</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredLists.length === 0" class="text-center py-12">
          <div class="space-y-4 max-w-md mx-auto">
            <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <IconV2 name="inbox" size="lg" color="secondary" />
            </div>
            <div class="space-y-2">
              <h3 class="text-lg font-semibold text-primary">
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

        <!-- Lists -->
        <div v-else class="space-y-3">
          <div 
            v-for="list in paginatedLists" 
            :key="list.id"
            class="group bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.99]"
            @click="openList(list)"
          >
            <div class="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              
              <!-- Основная информация -->
              <div class="flex items-start gap-3 flex-1 min-w-0">
                <!-- Тип списка -->
                <div class="flex-shrink-0 mt-1">
                  <StatusBadgeV2 
                    :variant="getListTypeVariant(list.type)" 
                    :label="getListTypeLabel(list.type)"
                    size="sm"
                  />
                </div>
                
                <!-- Детали списка -->
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-primary mb-1 break-words">
                    {{ list.name }}
                  </h3>
                  <p v-if="list.description" class="text-secondary text-sm mb-2 line-clamp-2">
                    {{ list.description }}
                  </p>
                  
                  <!-- Метаинформация -->
                  <div class="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-secondary">
                    <span class="flex items-center gap-1">
                      <IconV2 name="package" size="xs" />
                      {{ list.equipment_ids?.length || 0 }} единиц
                    </span>
                    <span class="flex items-center gap-1">
                      <IconV2 name="calendar" size="xs" />
                      {{ formatRelativeDate(list.created_at) }}
                    </span>
                    <span v-if="list.metadata?.created_by_name" class="flex items-center gap-1">
                      <IconV2 name="user" size="xs" />
                      {{ list.metadata.created_by_name }}
                    </span>
                    <span v-if="list.event_id" class="flex items-center gap-1">
                      <IconV2 name="calendar-check" size="xs" />
                      Мероприятие
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Счетчик и действия -->
              <div class="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-3 flex-shrink-0">
                <!-- Количество оборудования -->
                <div class="text-left sm:text-right">
                  <div class="text-xl sm:text-2xl font-bold text-primary">{{ list.equipment_ids?.length || 0 }}</div>
                  <div class="text-xs text-secondary uppercase tracking-wider">единиц</div>
                </div>
                
                <!-- Действия - всегда видимы на мобильных -->
                <div class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <ButtonV2 
                    variant="ghost" 
                    size="md"
                    @click.stop="editList(list)"
                    class="touch-manipulation min-h-[44px] min-w-[44px]"
                  >
                    <IconV2 name="edit" size="sm" />
                  </ButtonV2>
                  <ButtonV2 
                    variant="ghost" 
                    size="md"
                    @click.stop="deleteList(list)"
                    class="touch-manipulation min-h-[44px] min-w-[44px] text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <IconV2 name="trash-2" size="sm" />
                  </ButtonV2>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pt-6 border-t border-gray-100">
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

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" size="lg" />
    
    <!-- Delete Confirmation Modal -->
    <ModalV2
      v-model="showDeleteModal"
      title="Удалить список оборудования"
      :description="`Вы уверены, что хотите удалить список '${listToDelete?.name}'? Это действие нельзя отменить.`"
      size="md"
      variant="danger"
      :loading="deleteLoading"
      :persistent="false"
      :show-default-actions="true"
      confirm-text="Удалить"
      cancel-text="Отмена"
      confirm-variant="danger"
      @close="handleDeleteCancel"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    >
      <!-- Детали удаляемого списка -->
      <div v-if="listToDelete" class="space-y-4">
        <div class="bg-red-50 rounded-lg p-4 border border-red-200">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <IconV2 name="list" size="md" color="error" />
              </div>
            </div>
            
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-primary">
                {{ listToDelete.name }}
              </h3>
              <p v-if="listToDelete.description" class="text-sm text-secondary mt-1">
                {{ listToDelete.description }}
              </p>
              
              <div class="flex items-center gap-3 mt-2 text-xs text-secondary">
                <span class="flex items-center gap-1">
                  <IconV2 name="package" size="xs" />
                  {{ listToDelete.equipment_ids?.length || 0 }} единиц оборудования
                </span>
                <span class="flex items-center gap-1">
                  <IconV2 name="calendar" size="xs" />
                  {{ formatRelativeDate(listToDelete.created_at) }}
                </span>
              </div>
              
              <div class="mt-3">
                <StatusBadgeV2 
                  :variant="getListTypeVariant(listToDelete.type)" 
                  :label="getListTypeLabel(listToDelete.type)"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div class="flex gap-2">
            <IconV2 name="alert-triangle" size="sm" color="warning" />
            <div class="text-sm text-amber-800">
              <p class="font-medium">Внимание!</p>
              <p>Список будет архивирован и станет недоступен для использования. Это действие можно отменить только через администратора.</p>
            </div>
          </div>
        </div>
      </div>
    </ModalV2>
  </div>
</template>

<script setup>
/**
 * Equipment Lists Page - PURE WAREHOUSE STYLE
 * 
 * Философия дизайна:
 * - Строго фирменная цветовая палитра (primary, secondary, accent)
 * - Только UI Kit v2 компоненты без кастомных стилей
 * - BentoCard с правильными вариантами (minimal для статистики, default для контента)
 * - Минимализм через цвет и типографику
 * - Консистентность с модулем оборудования
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// UI Kit v2 - только официальные компоненты
import { 
  BreadcrumbsV2, 
  ButtonV2, 
  IconV2,
  ModalV2,
  NotificationV2,
  SearchInputV2,
  SelectV2,
  StatusBadgeV2,
  SpinnerV2,
  PaginationV2
} from '@/shared/ui-v2'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

// API
import { getEquipmentLists, deleteEquipmentList } from '@/features/equipment/api/equipment-lists-api'

const router = useRouter()

// ═══ NAVIGATION ═══
const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Оборудование', href: '/equipment' },
  { label: 'Списки', disabled: true }
]

// ═══ STATE ═══
const searchQuery = ref('')
const selectedType = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(12)
const equipmentLists = ref([])
const loadingLists = ref(false)
const notificationSystem = ref(null)

// ═══ DELETE CONFIRMATION ═══
const showDeleteModal = ref(false)
const listToDelete = ref(null)
const deleteLoading = ref(false)

// ═══ OPTIONS ═══
const typeOptions = [
  { value: 'custom', label: 'Кастомные списки' },
  { value: 'security', label: 'Списки для охраны' },
  { value: 'report', label: 'Отчетные списки' }
]

// ═══ COMPUTED ═══
const filteredLists = computed(() => {
  let filtered = equipmentLists.value

  // Поиск
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

// Статистика - фирменные цвета
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

// ТЕСТИРОВАНИЕ УВЕДОМЛЕНИЙ (временно)
const testNotifications = () => {
  const tests = [
    { type: 'success', title: 'Успех!', message: 'Операция выполнена успешно' },
    { type: 'error', title: 'Ошибка!', message: 'Что-то пошло не так' },
    { type: 'warning', title: 'Внимание!', message: 'Требуется ваше внимание' },
    { type: 'info', title: 'Информация', message: 'Полезная информация для вас' }
  ]
  
  tests.forEach((test, index) => {
    setTimeout(() => {
      notificationSystem.value?.[test.type](test.message, {
        title: test.title,
        duration: 3000
      })
    }, index * 1000)
  })
}

const openList = (list) => {
  router.push(`/equipment/lists/${list.id}`)
}

const editList = (list) => {
  console.log('✏️ Редактирование списка:', list)
  // Переходим на страницу редактирования с ID списка
  router.push(`/equipment/lists/edit/${list.id}`)
}

const deleteList = (list) => {
  listToDelete.value = list
  showDeleteModal.value = true
}

const handleDeleteCancel = () => {
  showDeleteModal.value = false
  listToDelete.value = null
  deleteLoading.value = false
}

const handleDeleteConfirm = async () => {
  if (!listToDelete.value) return
  
  deleteLoading.value = true
  
  try {
    // Вызываем API для удаления (архивирования)
    await deleteEquipmentList(listToDelete.value.id)
    
    // Обновляем список после удаления
    await loadLists()
    
    // Показываем уведомление об успехе
    notificationSystem.value?.success(`Список "${listToDelete.value.name}" успешно удален`, {
      title: 'Удаление завершено',
      duration: 3000
    })
    
    // Закрываем модалку
    handleDeleteCancel()
  } catch (error) {
    console.error('❌ Ошибка удаления списка:', error)
    
    // Показываем уведомление об ошибке
    notificationSystem.value?.error(`Не удалось удалить список: ${error.message}`, {
      title: 'Ошибка удаления'
    })
    
    deleteLoading.value = false
  }
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
    default: return 'Список'
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
/* 
  PURE WAREHOUSE STYLE - MOBILE-FIRST АДАПТИВНОСТЬ
  Все стили идут из UI Kit v2 и CSS переменных проекта
  
  Дополнительные стили только для mobile-first адаптивности
*/

.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* Hover эффект для строк списков - только на desktop */
@media (hover: hover) {
  .group:hover .group-hover\:opacity-100 {
    opacity: 1;
  }
}

/* Touch-friendly интерактивность */
@media (hover: none) {
  /* На touch устройствах действия всегда видимы */
  .sm\:opacity-0 {
    opacity: 1 !important;
  }
}

/* Улучшенный active эффект для touch */
.active\:scale-\[0\.99\]:active {
  transform: scale(0.99);
  transition-duration: 75ms;
}
</style>