<template>
  <div class="min-h-screen bg-accent">
    <!-- Notification System -->
    <NotificationV2 ref="notify" position="top-right" />

    <!-- 🎯 ПРАВИЛЬНО: Initial Loading State (только при первой загрузке) -->
    <div v-if="isInitialLoading" class="max-w-7xl mx-auto px-4 py-6">
      <div class="space-y-6">
        <!-- Header Skeleton -->
        <div class="bg-white rounded-xl p-6 animate-pulse">
          <div class="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="grid grid-cols-3 gap-4">
            <div class="h-16 bg-gray-200 rounded"></div>
            <div class="h-16 bg-gray-200 rounded"></div>
            <div class="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
        
        <!-- Content Skeleton -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="h-96 bg-white rounded-xl animate-pulse"></div>
          </div>
          <div class="space-y-6">
            <div class="h-48 bg-white rounded-xl animate-pulse"></div>
            <div class="h-48 bg-white rounded-xl animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State (только если нет данных) -->
    <div v-else-if="error && !mountPointData" class="max-w-7xl mx-auto px-4 py-6">
      <BentoCard size="2x1" variant="error">
        <div class="text-center py-8">
          <IconV2 name="alert-circle" size="lg" class="text-error mb-4" />
          <h2 class="text-xl font-semibold text-primary mb-2">Ошибка загрузки</h2>
          <p class="text-secondary mb-4">{{ error }}</p>
          <ButtonV2 variant="primary" @click="loadMountPoint">
            Попробовать снова
          </ButtonV2>
        </div>
      </BentoCard>
    </div>

    <!-- Header с Breadcrumbs -->
    <div v-if="mountPointData" class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 
          :items="breadcrumbs" 
          variant="minimal" 
          size="sm" 
          @item-click="handleBreadcrumbClick"
          @navigate="handleBreadcrumbNavigate"
        />

        <!-- Mobile-first адаптивный хедер -->
        <div class="mt-4 space-y-4">
          <!-- Заголовок и информация -->
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-primary leading-tight mb-3">
              {{ mountPointData?.name || 'Точка монтажа' }}
            </h1>
            
            <!-- Информация: вертикально на мобильных -->
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-secondary">
              <div class="flex items-center gap-1 min-w-0">
                <IconV2 name="map-pin" size="xs" class="flex-shrink-0" />
                <span class="truncate">{{ mountPointData.location || 'Локация не указана' }}</span>
              </div>
              <div class="flex items-center gap-1 min-w-0">
                <IconV2 name="calendar" size="xs" class="flex-shrink-0" />
                <span class="truncate">{{ formatDate(mountPointData.start_date) || 'Дата не указана' }}</span>
              </div>
            </div>
          </div>
          
          <!-- Кнопки: вертикально на мобильных, горизонтально на десктопе -->
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <!-- Кнопка ручного обновления -->
            <ButtonV2 
              v-if="lastRefreshTime" 
              variant="ghost"
              size="sm"
              class="w-full sm:w-auto justify-center sm:justify-start"
              @click="manualRefresh"
              :title="`Последнее обновление: ${formatRefreshTime}`"
            >
              <template #icon><IconV2 name="refresh-cw" size="xs" /></template>
              <span class="sm:hidden">Обновлено {{ formatRefreshTime }}</span>
              <span class="hidden sm:inline">{{ formatRefreshTime }}</span>
            </ButtonV2>
            
            <ButtonV2 
              variant="secondary" 
              size="sm"
              class="w-full sm:w-auto"
              @click="goToEvent"
            >
              <template #icon><IconV2 name="arrow-left" size="sm" /></template>
              К мероприятию
            </ButtonV2>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content (всегда показывается если есть данные) -->
    <div v-if="mountPointData" class="max-w-7xl mx-auto px-4 py-6 relative">
      <!-- 🔄 Тонкий индикатор обновления (НЕ скрывает контент) -->
      <div 
        v-if="isRefreshing || shouldShowRefreshIndicator" 
        class="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 z-50"
      >
        <div class="h-full bg-primary/80 animate-pulse"></div>
      </div>

      <!-- Статистика точки монтажа -->
      <BentoCard size="2x1" variant="primary" class="mb-6">
        <template #header>
          <div class="flex items-center gap-2">
            <IconV2 name="trending-up" size="sm" class="text-white" />
            <h3 class="text-lg font-semibold text-white">Статистика работ</h3>
          </div>
        </template>

        <!-- Status Overview -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Technical Duties Progress -->
          <div class="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-white/80 text-sm">Техзадания</span>
              <StatusBadgeV2 
                :label="dutiesStatus.label" 
                :variant="dutiesStatus.variant" 
                size="xs" 
              />
            </div>
            <div class="text-2xl font-bold text-white mb-1">
              {{ dutiesStats.completed }}/{{ dutiesStats.total }}
            </div>
            <div class="w-full bg-white/20 rounded-full h-2">
              <div 
                class="h-2 rounded-full transition-all duration-300"
                :class="dutiesStatus.progressClass"
                :style="{ width: dutiesStats.progress + '%' }"
              ></div>
            </div>
          </div>

          <!-- Completed Tasks -->
          <div class="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <IconV2 name="check-circle" size="sm" class="text-green-300" />
              <span class="text-white/80 text-sm">Выполнено</span>
            </div>
            <div class="text-2xl font-bold text-green-300 mb-1">
              {{ dutiesStats.completed }}
            </div>
            <div class="text-xs text-white/60">заданий</div>
          </div>

          <!-- In Progress Tasks -->
          <div class="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <IconV2 name="refresh-cw" size="sm" class="text-yellow-300" />
              <span class="text-white/80 text-sm">В работе</span>
            </div>
            <div class="text-2xl font-bold text-yellow-300 mb-1">
              {{ dutiesStats.inProgress }}
            </div>
            <div class="text-xs text-white/60">заданий</div>
          </div>

          <!-- Team -->
          <div class="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <IconV2 name="users" size="sm" class="text-blue-300" />
              <span class="text-white/80 text-sm">Команда</span>
            </div>
            <div class="text-2xl font-bold text-blue-300 mb-1">
              {{ responsibleEngineers.length }}
            </div>
            <div class="text-xs text-white/60">инженеров</div>
          </div>
        </div>
      </BentoCard>

      <!-- Main Content Grid -->
      <BentoGrid columns="3" gap="6">
        <!-- Technical Duties - Main Focus (2 columns) -->
        <BentoCard size="2x1" variant="default">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <IconV2 name="clipboard-list" size="sm" />
                <h2 class="text-xl font-semibold text-primary">Технические задания</h2>
                <StatusBadgeV2 :label="String(dutiesStats.total)" variant="info" size="xs" />
              </div>
              <ButtonV2 
                v-if="canAddTask(mountPointData)"
                variant="primary" 
                size="sm" 
                @click="showAddDutyModal = true"
              >
                <template #icon><IconV2 name="plus" size="sm" /></template>
                Добавить задание
              </ButtonV2>
              <TooltipV2 
                v-else-if="!canAddTask(mountPointData) && getPermissionMessage(mountPointData)"
                :content="getPermissionMessage(mountPointData)"
                position="top"
              >
                <ButtonV2 variant="secondary" size="sm" disabled>
                  <template #icon><IconV2 name="lock" size="sm" /></template>
                  Нет доступа
                </ButtonV2>
              </TooltipV2>
            </div>
          </template>

          <!-- Technical Duties List -->
          <div v-if="technicalDuties.length > 0" class="space-y-4">
            <TechnicalDutyCard
              v-for="duty in technicalDuties"
              :key="duty.id"
              :duty="duty"
              :loading="loadingDutyId === duty.id"
              :can-edit="canEditTaskStatus(mountPointData)"
              :can-delete="canDeleteTask(mountPointData)"
              @status-change="handleDutyStatusChange"
              @edit="handleEditDuty"
              @delete="handleDeleteDuty"
            />
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12">
            <IconV2 name="clipboard-list" size="lg" class="text-secondary/50 mb-4" />
            <h3 class="text-lg font-medium text-primary mb-2">Нет технических заданий</h3>
            <p class="text-secondary mb-4">Добавьте первое техническое задание для этой точки монтажа</p>
            <ButtonV2 
              v-if="canAddTask(mountPointData)"
              variant="primary" 
              @click="showAddDutyModal = true"
            >
              <template #icon><IconV2 name="plus" size="sm" /></template>
              Добавить задание
            </ButtonV2>
            <p v-else class="text-secondary text-sm">
              {{ getPermissionMessage(mountPointData) }}
            </p>
          </div>
        </BentoCard>

        <!-- Team Info -->
        <BentoCard size="1x1" variant="default">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="users" size="sm" />
              <h3 class="text-lg font-semibold text-primary">Команда</h3>
            </div>
          </template>

          <div v-if="responsibleEngineers.length > 0" class="space-y-3">
            <div 
              v-for="engineer in responsibleEngineers"
              :key="engineer.id"
              class="flex items-center gap-3 p-3 bg-accent/50 rounded-lg"
            >
              <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span class="text-primary font-semibold text-sm">
                  {{ getInitials(engineer.name) }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-primary truncate">{{ engineer.name }}</div>
                <div class="text-sm text-secondary">{{ engineer.role || 'Инженер' }}</div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8">
            <IconV2 name="user-x" size="lg" class="text-secondary/50 mb-3" />
            <p class="text-secondary">Инженеры не назначены</p>
          </div>
        </BentoCard>

        <!-- Equipment Lists -->
        <BentoCard size="1x1" variant="default">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="package" size="sm" />
              <h3 class="text-lg font-semibold text-primary">Списки оборудования</h3>
            </div>
          </template>

          <div v-if="equipmentLists.length > 0" class="space-y-3">
            <div 
              v-for="list in equipmentLists"
              :key="list.id"
              class="p-3 bg-accent/50 rounded-lg hover:bg-accent/70 transition-colors cursor-pointer"
              @click="goToEquipmentList(list.id)"
            >
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium text-primary text-sm truncate">{{ list.name }}</h4>
                <StatusBadgeV2 
                  :label="String(list.equipment_items?.length || list.equipment_ids?.length || 0)" 
                  variant="info" 
                  size="xs" 
                />
              </div>
              <div class="text-xs text-secondary">
                {{ list.type || 'Общий список' }}
              </div>
              <div v-if="list.description" class="text-xs text-secondary mt-1 line-clamp-2">
                {{ list.description }}
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8">
            <IconV2 name="package-x" size="lg" class="text-secondary/50 mb-3" />
            <p class="text-secondary text-sm">Списки оборудования не найдены</p>
          </div>


        </BentoCard>

        <!-- Quick Info -->
        <BentoCard size="1x1" variant="minimal">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="info" size="sm" />
              <h3 class="text-lg font-semibold text-primary">Информация</h3>
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-secondary">Мероприятие</label>
              <div class="text-primary font-medium">{{ eventData?.name || 'Не указано' }}</div>
            </div>

            <div>
              <label class="text-sm font-medium text-secondary">Локация</label>
              <div class="text-primary">{{ mountPointData.location || 'Не указана' }}</div>
            </div>

            <div>
              <label class="text-sm font-medium text-secondary">Дата начала</label>
              <div class="text-primary">{{ formatDate(mountPointData.start_date) || 'Не указана' }}</div>
            </div>

            <div v-if="mountPointData.description">
              <label class="text-sm font-medium text-secondary">Описание</label>
              <div class="text-primary text-sm">{{ mountPointData.description }}</div>
            </div>

            <!-- Actions -->
            <div class="pt-4 border-t border-secondary/10 space-y-2">
              <ButtonV2 variant="ghost" size="sm" class="w-full" @click="showEditModal = true">
                <template #icon><IconV2 name="edit" size="sm" /></template>
                Редактировать
              </ButtonV2>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </div>

    <!-- Modals -->
    <AddTechnicalDutyModal
      v-if="mountPointData"
      v-model:show="showAddDutyModal"
      :mount-point="mountPointData"
      @success="handleDutyAdded"
      @error="(msg) => notify?.error?.(msg)"
    />

    <AddTechnicalDutyModal
      v-if="mountPointData && editingDuty"
      v-model:show="showEditDutyModal"
      :mount-point="mountPointData"
      :editing-duty="editingDuty"
      @success="handleDutyEdited"
      @error="(msg) => notify?.error?.(msg)"
    />

    <MountPointFormModal
      v-if="mountPointData"
      v-model:show="showEditModal"
      :mount-point="mountPointData"
      :event-id="String(mountPointData.event_id)"
      :event="eventData"
      @success="handleMountPointUpdated"
      @error="(msg) => notify?.error?.(msg)"
    />

    <!-- Confirmation Modals -->
    <ConfirmationModalV2
      v-model:show="showEditConfirmModal"
      type="warning"
      title="Редактировать техническое задание?"
      :message="`Вы хотите отредактировать задание «${dutyToEdit?.title}»?`"
      details="Откроется форма редактирования с текущими данными задания."
      confirm-text="Редактировать"
      cancel-text="Отмена"
      @confirm="confirmEditDuty"
      @cancel="cancelEditDuty"
    />

    <ConfirmationModalV2
      v-model:show="showDeleteConfirmModal"
      type="danger"
      title="Удалить техническое задание?"
      :message="`Вы действительно хотите удалить задание «${dutyToDelete?.title}»?`"
      details="Это действие необратимо. Задание будет удалено навсегда."
      confirm-text="Удалить"
      cancel-text="Отмена"
      :loading="isDeleting"
      @confirm="confirmDeleteDuty"
      @cancel="cancelDeleteDuty"
    />
  </div>
</template>

<script setup>
/**
 * MountPointDetailsPage - новая страница деталей точки монтажа
 * Фокус на технических заданиях для инженеров
 * Использует UI Kit v2 и Bento дизайн
 */
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

// UI Kit v2
import {
  BreadcrumbsV2,
  BentoGrid,
  BentoCard,
  ButtonV2,
  StatusBadgeV2,
  IconV2,
  NotificationV2,
  ConfirmationModalV2,
  TooltipV2
} from '@/shared/ui-v2'

// Stores
import { useMountPointStore } from '@/app/store/mount-point-store'
import { useUserStore } from '@/app/store/user-store'
import { useEventStore } from '@/features/events/store/event-store'
import { useEquipmentListsStore } from '@/features/events/store/equipment-lists-store'

// Components
import TechnicalDutyCard from '@/features/mount-points/components/TechnicalDutyCard.vue'
import AddTechnicalDutyModal from '@/features/mount-points/components/AddTechnicalDutyModal.vue'
import { MountPointFormModal } from '@/features/mount-points'

// 🔄 Простое автообновление данных
import { useAutoRefresh } from '@/composables/useAutoRefresh'

// 🔐 Система разрешений
import { usePermissions } from '@/shared/composables/usePermissions'

const route = useRoute()
const router = useRouter()
const mountPointId = route.params.id

// 🔄 Автообновление данных точки монтажа каждую минуту  
const refreshMountPointData = async () => {
  try {
    await mountPointStore.loadMountPointById(mountPointId, true) // force reload
    console.log('✅ [AutoRefresh] Данные точки монтажа обновлены')
  } catch (error) {
    console.error('❌ [AutoRefresh] Ошибка обновления точки:', error)
  }
}

const { 
  isAutoRefreshActive, 
  lastRefreshTime, 
  currentTime,
  shouldShowRefreshIndicator,
  manualRefresh 
} = useAutoRefresh(refreshMountPointData, 1) // каждую минуту

// 🔐 Система разрешений
const { 
  canEditTaskStatus, 
  canAddTask, 
  canDeleteTask, 
  canEditMountPoint,
  getPermissionMessage,
  getUserRoleDisplay,
  isAdmin,
  currentUser
} = usePermissions()

// Форматирование времени последнего обновления (реактивное)
const formatRefreshTime = computed(() => {
  if (!lastRefreshTime.value) return 'Обновить'
  
  // Используем реактивное время для автообновления счетчика
  const diff = Math.floor((currentTime.value - lastRefreshTime.value) / 1000) // секунды
  
  if (diff < 60) return `${diff}с назад`
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `${minutes}м назад`
  const hours = Math.floor(minutes / 60)
  return `${hours}ч назад`
})

// Stores
const mountPointStore = useMountPointStore()
const { 
  initialLoading: isInitialLoading, 
  refreshing: isRefreshing,
  error 
} = storeToRefs(mountPointStore)
const userStore = useUserStore()
const { users } = storeToRefs(userStore)
const eventStore = useEventStore()
const equipmentListsStore = useEquipmentListsStore()

// Local state
const notify = ref(null)
const showAddDutyModal = ref(false)
const showEditModal = ref(false)
const showEditDutyModal = ref(false)
const loadingDutyId = ref(null)
const editingDuty = ref(null)

// Confirmation modals
const showDeleteConfirmModal = ref(false)
const showEditConfirmModal = ref(false)
const dutyToDelete = ref(null)
const dutyToEdit = ref(null)
const isDeleting = ref(false)

// Data
const mountPointData = computed(() => {
  return mountPointStore.getMountPointById(mountPointId)
})

const eventData = computed(() => {
  if (!mountPointData.value?.event_id) return null
  return eventStore.getEventById(mountPointData.value.event_id)
})

const responsibleEngineers = computed(() => {
  if (!mountPointData.value?.responsible_engineers) return []
  return mountPointData.value.responsible_engineers
    .map(id => users.value.find(u => u.id === id))
    .filter(Boolean)
})

const technicalDuties = computed(() => {
  return mountPointData.value?.technical_duties || []
})

// Equipment lists for this mount point
const equipmentLists = computed(() => {
  if (!mountPointData.value?.event_id) return []
  return equipmentListsStore.getEquipmentListsByEventId(mountPointData.value.event_id)
    .filter(list => list.mount_point_id === mountPointId)
})

// Technical duties statistics
const dutiesStats = computed(() => {
  const duties = technicalDuties.value
  const total = duties.length
  const completed = duties.filter(d => d.status === 'выполнено').length
  const inProgress = duties.filter(d => d.status === 'в работе').length
  const problems = duties.filter(d => d.status === 'проблема').length
  
  return {
    total,
    completed,
    inProgress,
    problems,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0
  }
})

const completedTasksCount = computed(() => dutiesStats.value.completed)
const pendingTasksCount = computed(() => dutiesStats.value.inProgress + dutiesStats.value.problems)

const dutiesStatus = computed(() => {
  const stats = dutiesStats.value
  
  if (stats.total === 0) {
    return { 
      label: 'Нет заданий', 
      variant: 'info', 
      progressClass: 'bg-secondary/40' 
    }
  }
  
  if (stats.problems > 0) {
    return { 
      label: 'Есть проблемы', 
      variant: 'error', 
      progressClass: 'bg-error' 
    }
  }
  
  if (stats.completed === stats.total) {
    return { 
      label: 'Готово', 
      variant: 'success', 
      progressClass: 'bg-success' 
    }
  }
  
  if (stats.inProgress > 0) {
    return { 
      label: 'В работе', 
      variant: 'warning', 
      progressClass: 'bg-warning' 
    }
  }
  
  return { 
    label: 'Не начато', 
    variant: 'info', 
    progressClass: 'bg-secondary/40' 
  }
})



// Breadcrumbs
const breadcrumbs = computed(() => {
  console.log('🍞 [Breadcrumbs] Computing breadcrumbs:', {
    mountPointData: mountPointData.value?.name,
    eventData: eventData.value?.name,
    eventId: mountPointData.value?.event_id
  })
  
  const items = [
    { label: 'Главная', href: '/', icon: 'home' },
    { label: 'Мероприятия', href: '/events' }
  ]
  
  if (eventData.value) {
    items.push({
      label: eventData.value.name,
      href: `/events/${eventData.value.id}`
    })
  } else if (mountPointData.value?.event_id) {
    // Fallback если eventData еще не загружен
    items.push({
      label: 'Мероприятие',
      href: `/events/${mountPointData.value.event_id}`
    })
  }
  
  items.push({
    label: mountPointData.value?.name || 'Точка монтажа',
    disabled: true
  })
  
  console.log('🍞 [Breadcrumbs] Final items:', items)
  return items
})

// Methods
const formatDate = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { 
    day: '2-digit', 
    month: 'short',
    year: 'numeric'
  }).format(date)
}

const getInitials = (name) => {
  if (!name) return '??'
  return name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const goToEvent = () => {
  if (mountPointData.value?.event_id) {
    router.push(`/events/${mountPointData.value.event_id}`)
  }
}

const goToEquipmentList = (listId) => {
  router.push(`/equipment/lists/${listId}`)
}

const handleBreadcrumbClick = (data) => {
  if (data.isSubmenu) {
    if (data.item.href) {
      router.push(data.item.href)
    }
    return
  }
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
}

const handleBreadcrumbNavigate = (data) => {
  if (data.href) {
    router.push(data.href)
  }
}

// Technical duties handlers
const handleDutyStatusChange = async (duty, newStatus) => {
  console.log('🔄 [MountPointDetailsPage] handleDutyStatusChange called:', {
    dutyId: duty.id,
    oldStatus: duty.status,
    newStatus,
    mountPointId
  })

  // 🔐 Проверка разрешений
  if (!canEditTaskStatus(mountPointData.value)) {
    const message = getPermissionMessage(mountPointData.value)
    console.log('❌ [Permissions] Доступ запрещен:', message)
    notify.value?.error(message || 'У вас нет прав на изменение статуса задания')
    return
  }
  
  loadingDutyId.value = duty.id
  
  try {
    console.log('🔄 [MountPointDetailsPage] Calling store.updateTechnicalDutyStatus...')
    await mountPointStore.updateTechnicalDutyStatus(mountPointId, duty.id, newStatus)
    console.log('✅ [MountPointDetailsPage] Status updated successfully')
    notify.value?.success('Статус задания обновлен')
  } catch (error) {
    console.error('❌ [MountPointDetailsPage] Error updating duty status:', error)
    notify.value?.error('Не удалось обновить статус задания')
  } finally {
    loadingDutyId.value = null
    console.log('🔄 [MountPointDetailsPage] handleDutyStatusChange finished')
  }
}

const handleEditDuty = (duty) => {
  console.log('🔍 [DEBUG] updateTechnicalDuty exists:', typeof mountPointStore.updateTechnicalDuty)
  // Показываем модальное окно подтверждения редактирования
  dutyToEdit.value = duty
  showEditConfirmModal.value = true
}

const handleDeleteDuty = (duty) => {
  // Показываем модальное окно подтверждения удаления
  dutyToDelete.value = duty
  showDeleteConfirmModal.value = true
}

// Подтверждение редактирования
const confirmEditDuty = () => {
  if (dutyToEdit.value) {
    editingDuty.value = dutyToEdit.value
    showEditDutyModal.value = true
    showEditConfirmModal.value = false
    dutyToEdit.value = null
  }
}

// Подтверждение удаления
const confirmDeleteDuty = async () => {
  if (!dutyToDelete.value) return
  
  isDeleting.value = true
  try {
    console.log('🔍 [DEBUG] Available store methods:', Object.keys(mountPointStore))
    console.log('🔍 [DEBUG] deleteTechnicalDuty exists:', typeof mountPointStore.deleteTechnicalDuty)
    
    if (typeof mountPointStore.deleteTechnicalDuty !== 'function') {
      throw new Error('Метод deleteTechnicalDuty не найден в store')
    }
    
    await mountPointStore.deleteTechnicalDuty(mountPointId, dutyToDelete.value.id)
    await loadMountPoint()
    notify.value?.success('Техническое задание удалено')
    
    // Закрываем модальное окно
    showDeleteConfirmModal.value = false
    dutyToDelete.value = null
  } catch (error) {
    notify.value?.error('Не удалось удалить техническое задание')
    console.error('Error deleting duty:', error)
  } finally {
    isDeleting.value = false
  }
}

// Отмена действий
const cancelEditDuty = () => {
  showEditConfirmModal.value = false
  dutyToEdit.value = null
}

const cancelDeleteDuty = () => {
  showDeleteConfirmModal.value = false
  dutyToDelete.value = null
}

const handleDutyAdded = async () => {
  showAddDutyModal.value = false
  await loadMountPoint()
  notify.value?.success('Техническое задание добавлено')
}

const handleDutyEdited = async () => {
  showEditDutyModal.value = false
  editingDuty.value = null
  await loadMountPoint()
  notify.value?.success('Техническое задание обновлено')
}

const handleMountPointUpdated = async () => {
  showEditModal.value = false
  await loadMountPoint()
  notify.value?.success('Точка монтажа обновлена')
}

// Load data
const loadMountPoint = async () => {
  try {
    await mountPointStore.loadMountPointById(mountPointId)
  } catch (error) {
    console.error('Error loading mount point:', error)
  }
}

onMounted(async () => {
  // Load users if not loaded
  if (!users.value.length) {
    await userStore.loadUsers()
  }
  
  // Load mount point first
  await loadMountPoint()
  
  // Load specific event for this mount point
  if (mountPointData.value?.event_id) {
    console.log('🔄 [MountPointDetailsPage] Loading event:', mountPointData.value.event_id)
    await eventStore.loadEventById(mountPointData.value.event_id)
    
    // Load equipment lists
    await equipmentListsStore.loadEquipmentListsByEventId(mountPointData.value.event_id)
  }
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
