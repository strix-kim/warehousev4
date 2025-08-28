<script setup>
import { ref, onMounted, onUnmounted, computed, shallowRef, watchEffect, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import {
  BreadcrumbsV2,
  BentoGrid,
  BentoCard,
  ButtonV2,
  StatusBadgeV2,
  IconV2,
  SpinnerV2,
  SkeletonV2,
  TooltipV2,
  NotificationV2
} from '@/shared/ui-v2'

import { useEventStore } from '@/features/events/store/event-store'
import { useMountPointStore } from '@/app/store/mount-point-store'
import { useUserStore } from '@/app/store/user-store'
import { useEquipmentListsStore } from '@/features/events/store/equipment-lists-store'

// Ленивая загрузка компонентов для улучшения производительности
import { MountPointFormModal } from '@/features/mount-points'
import EventFormModalV2 from '@/features/events/components/EventFormModalV2.vue'

import AddTechnicalDutyModal from '@/features/mount-points/components/AddTechnicalDutyModal.vue'

// Асинхронная загрузка только для тяжелых компонентов
const EventEquipmentList = defineAsyncComponent(() => import('./components/EventEquipmentList.vue'))

// Новые компоненты
import EventTimeline from './components/EventTimeline.vue'
import EventMountPointsSection from './components/EventMountPointsSection.vue'
import EventDetailsHeader from './components/EventDetailsHeader.vue'
import EventDetailsSkeleton from './components/EventDetailsSkeleton.vue'
import EventOverviewCard from './components/EventOverviewCard.vue'
import EventTechnicalTaskCard from './components/EventTechnicalTaskCard.vue'
import EventTeamCard from './components/EventTeamCard.vue'
import EventEquipmentListsSection from './components/EventEquipmentListsSection.vue'

const route = useRoute()
const router = useRouter()
const eventId = String(route.params.id)

const eventStore = useEventStore()
const { error: loadError } = storeToRefs(eventStore)

// Собственное состояние загрузки для корректного отображения скелетона
const isLoading = ref(true)

const mountPointStore = useMountPointStore()
const { loading: isMountPointsLoading, error: mountPointsError } = storeToRefs(mountPointStore)

const userStore = useUserStore()
const { users } = storeToRefs(userStore)

const equipmentListsStore = useEquipmentListsStore()
const { loading: isEquipmentListsLoading, error: equipmentListsError } = storeToRefs(equipmentListsStore)

// Получаем списки оборудования из store
const equipmentLists = computed(() => equipmentListsStore.getEquipmentListsByEventId(eventId))

const notify = ref(null)
const expandedMountPoints = ref({})
const showMountPointForm = ref(false)
const selectedMountPoint = ref(null)
const showEditEventModal = ref(false)
const showAddDutyModal = ref(false)

const isMpExpanded = (id) => !!expandedMountPoints.value[id]
const toggleMp = (id) => {
  expandedMountPoints.value = { ...expandedMountPoints.value, [id]: !expandedMountPoints.value[id] }
}

// Оптимизированные вычисляемые свойства с мемоизацией
const currentEvent = computed(() => eventStore.getEventById(eventId))

// Кэшируем пользователей для быстрого поиска
const usersMap = computed(() => {
  const map = new Map()
  users.value.forEach(user => {
    if (user.id && user.name) {
      map.set(user.id, user.name)
    }
  })
  return map
})

const responsibleNames = computed(() => {
  const e = currentEvent.value
  if (!e || !Array.isArray(e.responsible_engineers)) return []
  return e.responsible_engineers
    .map(id => usersMap.value.get(id))
    .filter(Boolean)
})

const teamSize = computed(() => responsibleNames.value.length)

// Кэшируем точки монтажа
const mountPoints = computed(() => mountPointStore.getMountPointsByEventId(eventId))
const mountPointsCount = computed(() => mountPoints.value.length)

// Кэшируем текущее время (обновляется каждую минуту)
const currentTime = ref(new Date())
let timeInterval = null

const eventStatus = computed(() => {
  const e = currentEvent.value
  if (!e) return { label: 'Неизвестно', variant: 'info' }
  if (e.is_archived) return { label: 'Архив', variant: 'info' }
  
  const now = currentTime.value
  const start = e.start_date ? new Date(e.start_date) : null
  const end = e.end_date ? new Date(e.end_date) : null
  
  if (start && end && now >= start && now <= end) return { label: 'Идёт сейчас', variant: 'success' }
  if (start && now < start) return { label: 'Запланировано', variant: 'info' }
  if (end && now > end) return { label: 'Завершено', variant: 'warning' }
  return { label: 'Активно', variant: 'info' }
})

const daysUntilEvent = computed(() => {
  const e = currentEvent.value
  if (!e?.start_date) return null
  const now = currentTime.value
  const startDate = new Date(e.start_date)
  const diffDays = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24))
  return diffDays
})
// Кэшируем форматтер дат
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' })

  const timeline = computed(() => {
    const e = currentEvent.value
    if (!e) return { setup: { label: '—', active: false }, start: { label: '—', active: false }, end: { label: '—', active: false }, teardown: { label: '—', active: false }, bars: ['bg-secondary/30', 'bg-secondary/30', 'bg-secondary/30'] }
    
    const fmt = (d) => (d ? dateFormatter.format(new Date(d)) : '—')
    const now = currentTime.value
    const toDate = (d) => (d ? new Date(d) : null)
    const setup = toDate(e.setup_date)
    const start = toDate(e.start_date)
    const end = toDate(e.end_date)
    const teardown = toDate(e.teardown_date)

    const isPast = (d) => (d ? now >= d : false)

    // bars indicate segment states between nodes
    const bars = [
      isPast(start) ? 'bg-[var(--color-success)]' : 'bg-secondary/30',
      // Active during the event (from start until end inclusive)
      (start && now >= start && (!end || now <= end)) ? 'bg-[var(--color-success)]' : (isPast(end) ? 'bg-[var(--color-success)]' : 'bg-secondary/30'),
      isPast(teardown) ? 'bg-[var(--color-warning)]' : 'bg-secondary/30'
    ]

    const setupActive = setup ? isPast(setup) : (start ? isPast(start) : false)
    const startActive = start ? isPast(start) : false
    const endActive = end ? isPast(end) : false
    const teardownActive = teardown ? isPast(teardown) : false

    return {
      setup: { label: fmt(e.setup_date), active: setupActive },
      start: { label: fmt(e.start_date), active: startActive },
      end: { label: fmt(e.end_date), active: endActive },
      teardown: { label: fmt(e.teardown_date), active: teardownActive },
      bars
    }
  })

const mountPointStats = computed(() => {
  const points = mountPoints.value
  const total = points.length
  
  let ready = 0
  let pending = 0
  let problems = 0
  
  points.forEach(mp => {
    const duties = Array.isArray(mp.technical_duties) ? mp.technical_duties : []
    
    if (duties.length === 0) {
      // Нет заданий = в работе (требует внимания)
      pending++
      return
    }
    
    const problemsCount = duties.filter(d => d.status === 'проблема').length
    const completedCount = duties.filter(d => d.status === 'выполнено').length
    const inProgressCount = duties.filter(d => d.status === 'в работе').length
    
    if (problemsCount > 0) {
      // Есть проблемы
      problems++
    } else if (completedCount === duties.length) {
      // Все задания выполнены
      ready++
    } else {
      // Есть задания в работе или не начатые
      pending++
    }
  })
  
  return { 
    total, 
    ready, 
    pending, 
    problems,
    // Для совместимости со старым API
    inProgress: pending
  }
})

const formatShortDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}

// UX улучшения: быстрые действия
const copyEventLink = async () => {
  try {
    const url = `${window.location.origin}/events/${eventId}`
    await navigator.clipboard.writeText(url)
    notify.value?.success('Ссылка скопирована в буфер обмена')
  } catch (e) {
    notify.value?.error('Не удалось скопировать ссылку')
  }
}

const copyEventInfo = async () => {
  try {
    const event = eventStore.getEventById(eventId)
    if (!event) return
    
    const info = [
      `📅 ${event.name}`,
      `📍 ${event.location || 'Место не указано'}`,
      `👤 ${event.organizer || 'Организатор не указан'}`,
      `📊 Точек монтажа: ${mountPointsCount.value}`,
      `👥 Инженеров: ${teamSize.value}`,
      `🔗 ${window.location.origin}/events/${eventId}`
    ].join('\n')
    
    await navigator.clipboard.writeText(info)
    notify.value?.success('Информация о мероприятии скопирована')
  } catch (e) {
    notify.value?.error('Не удалось скопировать информацию')
  }
}

// Hover состояния для timeline
const hoveredTimelineStep = ref(null)
const setHoveredStep = (step) => {
  hoveredTimelineStep.value = step
}
const clearHoveredStep = () => {
  hoveredTimelineStep.value = null
}

const goToMountPoint = (id) => router.push(`/mount-point/${id}`)

const openMountPointForm = () => {
  showMountPointForm.value = true
}

const closeMountPointForm = () => {
  showMountPointForm.value = false
}

const openEditMountPoint = (mp) => {
  selectedMountPoint.value = mp
  showMountPointForm.value = true
}
const openAddDutyForMountPoint = (mp) => {
  selectedMountPoint.value = mp
  showAddDutyModal.value = true
}

const handleMountPointCreateSuccess = async (created) => {
  try {
    await mountPointStore.loadMountPointsByEventId(eventId, true)
    if (created?.id) {
      router.push(`/mount-point/${created.id}`)
    } else {
      notify.value?.success('Точка монтажа создана')
    }
  } catch (e) {
    notify.value?.error(e?.message || 'Ошибка обновления списка точек')
  }
}


const handleEditSuccess = async () => {
  try {
    await eventStore.loadEventById(eventId, false, false)
    showEditEventModal.value = false
    notify.value?.success('Мероприятие обновлено')
  } catch (e) {
    notify.value?.error(e?.message || 'Ошибка обновления мероприятия')
  }
}

const handleMountPointEditSuccess = async () => {
  try {
    await mountPointStore.loadMountPointsByEventId(eventId, true)
    notify.value?.success('Точка монтажа обновлена')
  } catch (e) {
    notify.value?.error(e?.message || 'Ошибка обновления точек монтажа')
  } finally {
    selectedMountPoint.value = null
  }
}

const handleEditError = (message) => {
  notify.value?.error(message || 'Ошибка сохранения')
}

// Методы для работы со списками оборудования
const handleEquipmentListClick = (listId) => {
  // Переходим к странице списка оборудования в модуле оборудования
  router.push(`/equipment/lists/${listId}`)
}

// Оптимизированная загрузка данных
onMounted(async () => {
  // Запускаем интервал обновления времени (каждую минуту)
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 60000) // 1 минута

  try {
    // Всегда показываем скелетон в начале
    isLoading.value = true
    
    // Параллельная загрузка всех необходимых данных
    const loadPromises = []
    
    // Загружаем пользователей только если их нет
    if (!users.value.length) {
      loadPromises.push(userStore.loadUsers())
    }
    
    // Всегда загружаем событие для обеспечения актуальности
    loadPromises.push(eventStore.loadEventById(eventId, false, false))
    
    // Загружаем точки монтажа только если их нет
    if (!mountPointStore.getMountPointsByEventId(eventId).length) {
      loadPromises.push(mountPointStore.loadMountPointsByEventId(eventId))
    }
    
    // Загружаем списки оборудования для мероприятия
    loadPromises.push(equipmentListsStore.loadEquipmentListsByEventId(eventId))
    
    // Выполняем загрузки
    await Promise.all(loadPromises)
    
    // Минимальная задержка для плавного UX (показываем скелетон хотя бы 500мс)
    await new Promise(resolve => setTimeout(resolve, 500))
    
  } catch (e) {
    // Ошибки уже отражаются в store, уведомление — мягкое
    notify.value?.error(e.message || 'Ошибка загрузки данных')
  } finally {
    // Скрываем скелетон после завершения загрузки
    isLoading.value = false
  }
})

// Очистка ресурсов при размонтировании
onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }
})
</script>

<template>
  <div class="min-h-screen bg-accent">
    <NotificationV2 ref="notify" position="top-right" />

    <!-- Skeleton Loading State -->
    <EventDetailsSkeleton v-if="isLoading" />

      <div v-else class="max-w-7xl mx-auto">
      <!-- Header / Breadcrumbs -->
      <div class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <BreadcrumbsV2 :items="[
            { label: 'Главная', href: '/', icon: 'home' },
            { label: 'Мероприятия', href: '/events' },
            { label: currentEvent?.name || 'Мероприятие', disabled: true }
          ]" variant="minimal" size="sm" />
        </div>
      </div>

        <!-- Main -->
        <div class="px-4 py-6">
          <BentoGrid columns="2" gap="6" minRowHeight="md">
            <!-- Hero: full width -->
            <BentoCard size="2x1" variant="primary">
            <template #header>
              <EventDetailsHeader
                :event-name="currentEvent?.name || ''"
                :event-status="eventStatus"
                @copy-link="copyEventLink"
                @copy-info="copyEventInfo"
                @edit="showEditEventModal = true"
              />
            </template>

              <!-- Timeline -->
              <EventTimeline
                :timeline="timeline"
                :event="currentEvent"
                :mount-points-count="mountPointsCount"
                :team-size="teamSize"
                :hovered-step="hoveredTimelineStep"
                @step-hover="setHoveredStep"
                @step-leave="clearHoveredStep"
                @notify="(data) => notify?.value?.[data.type]?.(data.message)"
              />
          </BentoCard>

            <!-- Overview and Tech Task: side by side -->
            <EventOverviewCard :description="currentEvent?.description" />

            <!-- Tech Task -->
            <EventTechnicalTaskCard 
              :technical-task="currentEvent?.technical_task"
              @copy-success="(msg) => notify?.value?.success?.(msg)"
              @copy-error="(msg) => notify?.value?.error?.(msg)"
            />

            <!-- Mount Points: full width -->
            <EventMountPointsSection
              :mount-points="mountPoints"
              :stats="mountPointStats"
              :is-loading="isMountPointsLoading"
              :error="mountPointsError"
              @add-mount-point="openMountPointForm"
              @mount-point-click="goToMountPoint"
              @edit-mount-point="openEditMountPoint"
              @add-duty="openAddDutyForMountPoint"
            />

            <!-- Team and Equipment Lists: vertical stack -->
            <EventTeamCard :team-members="responsibleNames" />

            <EventEquipmentListsSection
              :equipment-lists="equipmentLists"
              :is-loading="isEquipmentListsLoading"
              :error="equipmentListsError"
              @list-click="handleEquipmentListClick"
            />
        </BentoGrid>
      </div>
    </div>
    <!-- Mount Point Create Modal -->
    <MountPointFormModal
      v-model:show="showMountPointForm"
      :event-id="eventId"
      :event="currentEvent"
      :mount-point="selectedMountPoint"
      @close="closeMountPointForm"
      @success="selectedMountPoint ? handleMountPointEditSuccess() : handleMountPointCreateSuccess($event)"
      @error="(msg) => notify?.error?.(msg)"
    />

    <!-- Add Technical Duty Modal -->
    <AddTechnicalDutyModal
      v-if="selectedMountPoint"
      v-model:show="showAddDutyModal"
      :mount-point="selectedMountPoint"
      @success="async () => { await mountPointStore.loadMountPointsByEventId(eventId, true); notify?.value?.success?.('Задание добавлено') }"
      @error="(msg) => notify?.value?.error?.(msg)"
    />

    <!-- Edit Event Modal -->
    <EventFormModalV2
      v-model:show="showEditEventModal"
      :event="currentEvent"
      @success="handleEditSuccess"
      @error="handleEditError"
      @close="showEditEventModal = false"
    />
  </div>
</template>

<style scoped>
</style>



