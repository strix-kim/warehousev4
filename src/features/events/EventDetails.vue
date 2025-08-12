<script setup>
import { ref, onMounted, computed } from 'vue'
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
  NotificationV2
} from '@/shared/ui-v2'

import { useEventStore } from '@/features/events/store/event-store'
import { useMountPointStore } from '@/app/store/mount-point-store'
import { useUserStore } from '@/app/store/user-store'
import EventEquipmentList from './components/EventEquipmentList.vue'
import { MountPointFormModal } from '@/features/mount-points'
import EventFormModalV2 from '@/features/events/components/EventFormModalV2.vue'
import MountPointCardV2 from '@/features/mount-points/ui/MountPointCardV2.vue'
import AddTechnicalDutyModal from '@/features/mount-points/components/AddTechnicalDutyModal.vue'

const route = useRoute()
const router = useRouter()
const eventId = String(route.params.id)

const eventStore = useEventStore()
const { loading: isLoading, error: loadError } = storeToRefs(eventStore)

const mountPointStore = useMountPointStore()
const { loading: isMountPointsLoading, error: mountPointsError } = storeToRefs(mountPointStore)

const userStore = useUserStore()
const { users } = storeToRefs(userStore)

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

const responsibleNames = computed(() => {
  const e = eventStore.getEventById(eventId)
  if (!e || !Array.isArray(e.responsible_engineers)) return []
  return e.responsible_engineers
    .map(id => users.value.find(u => u.id === id)?.name)
    .filter(Boolean)
})

const teamSize = computed(() => responsibleNames.value.length)
const mountPointsCount = computed(() => mountPointStore.getMountPointsByEventId(eventId).length)

const eventStatus = computed(() => {
  const e = eventStore.getEventById(eventId)
  if (!e) return { label: 'Неизвестно', variant: 'info' }
  if (e.is_archived) return { label: 'Архив', variant: 'info' }
  const now = new Date()
  const start = e.start_date ? new Date(e.start_date) : null
  const end = e.end_date ? new Date(e.end_date) : null
  if (start && end && now >= start && now <= end) return { label: 'Идёт сейчас', variant: 'success' }
  if (start && now < start) return { label: 'Запланировано', variant: 'info' }
  if (end && now > end) return { label: 'Завершено', variant: 'warning' }
  return { label: 'Активно', variant: 'info' }
})

const daysUntilEvent = computed(() => {
  const e = eventStore.getEventById(eventId)
  if (!e?.start_date) return null
  const now = new Date()
  const startDate = new Date(e.start_date)
  const diffDays = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24))
  return diffDays
})
  const timeline = computed(() => {
    const e = eventStore.getEventById(eventId)
    const fmt = (d) => (d ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(new Date(d)) : '—')
    const now = new Date()
    const toDate = (d) => (d ? new Date(d) : null)
    const setup = toDate(e?.setup_date)
    const start = toDate(e?.start_date)
    const end = toDate(e?.end_date)
    const teardown = toDate(e?.teardown_date)

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
      setup: { label: fmt(e?.setup_date), active: setupActive },
      start: { label: fmt(e?.start_date), active: startActive },
      end: { label: fmt(e?.end_date), active: endActive },
      teardown: { label: fmt(e?.teardown_date), active: teardownActive },
      bars
    }
  })

const mountPointStats = computed(() => {
  const points = mountPointStore.getMountPointsByEventId(eventId)
  const total = points.length
  const ready = points.filter(mp => mp.equipment_fact?.length > 0).length
  return { total, ready, pending: total - ready }
})

const formatShortDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
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

onMounted(async () => {
  try {
    const usersPromise = users.value.length ? Promise.resolve() : userStore.loadUsers()
    const eventPromise = eventStore.loadEventById(eventId, false, false)
    const mpPromise = mountPointStore.getMountPointsByEventId(eventId).length
      ? Promise.resolve()
      : mountPointStore.loadMountPointsByEventId(eventId)
    await Promise.all([usersPromise, eventPromise, mpPromise])
  } catch (e) {
    // Ошибки уже отражаются в store, уведомление — мягкое
    notify.value?.error(e.message || 'Ошибка загрузки данных')
  }
})
</script>

<template>
  <div class="min-h-screen bg-accent">
    <NotificationV2 ref="notify" position="top-right" />

    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <SpinnerV2 size="lg" />
    </div>

      <div v-else class="max-w-7xl mx-auto">
      <!-- Header / Breadcrumbs -->
      <div class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <BreadcrumbsV2 :items="[
            { label: 'Главная', href: '/', icon: 'home' },
            { label: 'Мероприятия', href: '/events' },
            { label: eventStore.getEventById(eventId)?.name || 'Мероприятие', disabled: true }
          ]" variant="minimal" size="sm" />
        </div>
      </div>

        <!-- Main -->
        <div class="px-4 py-6">
          <BentoGrid columns="2" gap="6" minRowHeight="md">
            <!-- Hero: full width -->
            <BentoCard size="2x1" variant="primary">
            <template #header>
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-start sm:items-center gap-2 min-w-0">
                  <IconV2 name="calendar" size="sm" />
                  <h2 class="text-accent text-xl sm:text-2xl lg:text-3xl font-semibold leading-tight break-words">{{ eventStore.getEventById(eventId)?.name }}</h2>
                </div>
                <div class="flex items-center gap-2">
                  <StatusBadgeV2 :label="eventStatus.label" :variant="eventStatus.variant" size="sm" />
                  <ButtonV2 variant="minimal" size="sm" @click="showEditEventModal = true">
                    <IconV2 name="edit" size="sm" class="mr-1" /> Редактировать
                  </ButtonV2>
                </div>
              </div>
            </template>

              <!-- Timeline -->
              <div class="space-y-4">
                <!-- Mobile vertical progression -->
                <div class="sm:hidden">
                  <div class="grid grid-cols-[20px_1fr] gap-x-3">
                    <template
                      v-for="(step, idx) in [
                        { key: 'setup', title: 'Монтаж', label: timeline.setup.label, active: timeline.setup.active },
                        { key: 'start', title: 'Старт', label: timeline.start.label, active: timeline.start.active },
                        { key: 'end', title: 'Финиш', label: timeline.end.label, active: timeline.end.active },
                        { key: 'teardown', title: 'Демонтаж', label: timeline.teardown.label, active: timeline.teardown.active }
                      ]"
                      :key="step.key"
                    >
                      <div class="flex flex-col items-center">
                        <span
                          :class="[
                            'inline-block shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/80',
                            step.active
                              ? (step.key === 'setup'
                                  ? 'bg-[var(--color-info)]'
                                  : step.key === 'teardown'
                                    ? 'bg-[var(--color-warning)]'
                                    : 'bg-[var(--color-success)]')
                              : 'bg-white/30'
                          ]"
                        ></span>
                        <div v-if="idx < 3" :class="['w-px flex-1 mt-1', timeline.bars[idx]]"></div>
                      </div>
                      <div class="pb-4">
                        <div class="text-xs text-accent/80">{{ step.title }}</div>
                        <div class="text-sm text-accent">{{ step.label }}</div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Desktop/Tablet timeline with lines -->
                <div class="hidden sm:flex items-center gap-2 text-accent">
                  <!-- Setup Node -->
                  <div class="flex items-center gap-2 w-16 sm:w-24 md:w-28 flex-shrink-0">
                    <span :class="['inline-block shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/80', timeline.setup.active ? 'bg-[var(--color-info)]' : 'bg-white/30']"></span>
                    <span class="text-xs text-accent/80 whitespace-nowrap">
                      <span class="hidden md:inline">Монтаж: </span>
                      <span class="text-accent">{{ timeline.setup.label }}</span>
                    </span>
                  </div>
                  <!-- connector -->
                  <div :class="['w-8 sm:w-12 md:w-16 lg:w-20 xl:w-24 h-[2px] flex-shrink-0', timeline.bars[0]]"></div>
                  <!-- Start Node -->
                  <div class="flex items-center gap-2 w-16 sm:w-24 md:w-28 flex-shrink-0">
                    <span :class="['inline-block shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/80', timeline.start.active ? 'bg-[var(--color-success)]' : 'bg-white/30']"></span>
                    <span class="text-xs text-accent/80 whitespace-nowrap">
                      <span class="hidden md:inline">Старт: </span>
                      <span class="text-accent">{{ timeline.start.label }}</span>
                    </span>
                  </div>
                  <div :class="['w-8 sm:w-12 md:w-16 lg:w-20 xl:w-24 h-[2px] flex-shrink-0', timeline.bars[1]]"></div>
                  <!-- End Node -->
                  <div class="flex items-center gap-2 w-16 sm:w-24 md:w-28 flex-shrink-0">
                    <span :class="['inline-block shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/80', timeline.end.active ? 'bg-[var(--color-success)]' : 'bg-white/30']"></span>
                    <span class="text-xs text-accent/80 whitespace-nowrap">
                      <span class="hidden md:inline">Финиш: </span>
                      <span class="text-accent">{{ timeline.end.label }}</span>
                    </span>
                  </div>
                  <div :class="['w-8 sm:w-12 md:w-16 lg:w-20 xl:w-24 h-[2px] flex-shrink-0', timeline.bars[2]]"></div>
                  <!-- Teardown Node -->
                  <div class="flex items-center gap-2 w-16 sm:w-24 md:w-28 flex-shrink-0">
                    <span :class="['inline-block shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/80', timeline.teardown.active ? 'bg-[var(--color-warning)]' : 'bg-white/30']"></span>
                    <span class="text-xs text-accent/80 whitespace-nowrap">
                      <span class="hidden md:inline">Демонтаж: </span>
                      <span class="text-accent">{{ timeline.teardown.label }}</span>
                    </span>
                  </div>
                </div>

                <!-- Bottom row: chips + KPIs -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span v-if="eventStore.getEventById(eventId)?.organizer" class="px-2 py-1 rounded-full border border-secondary/30 bg-white text-sm text-primary inline-flex items-center gap-1">
                      <IconV2 name="user" size="xs" /> {{ eventStore.getEventById(eventId)?.organizer }}
                    </span>
                    <span v-if="eventStore.getEventById(eventId)?.location" class="px-2 py-1 rounded-full border border-secondary/30 bg-white text-sm text-primary inline-flex items-center gap-1">
                      <IconV2 name="map-pin" size="xs" /> {{ eventStore.getEventById(eventId)?.location }}
                    </span>
                  </div>
                  <div class="rounded-xl border border-secondary/20 bg-white p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <IconV2 name="map-pin" size="sm" class="text-primary" />
                      </div>
                      <div class="text-sm text-secondary">Точек</div>
                    </div>
                    <div class="text-2xl font-semibold text-primary">{{ mountPointsCount }}</div>
                  </div>
                  <div class="rounded-xl border border-secondary/20 bg-white p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <IconV2 name="users" size="sm" class="text-primary" />
                      </div>
                      <div class="text-sm text-secondary">Инженеров</div>
                    </div>
                    <div class="text-2xl font-semibold text-primary">{{ teamSize }}</div>
                  </div>
                </div>

                <!-- Accent bar -->
                <div class="h-1 rounded-full bg-gradient-to-r from-[var(--color-brand-red)] to-[var(--color-brand-deep-red)]"></div>
              </div>
          </BentoCard>

            <!-- Overview and Tech Task: side by side -->
            <BentoCard size="1x1" variant="default">
            <template #header>
              <div class="flex items-center gap-2">
                <IconV2 name="file-text" size="sm" />
                <h3 class="text-base sm:text-lg font-semibold leading-tight">Обзор</h3>
              </div>
            </template>
            <div v-if="eventStore.getEventById(eventId)?.description" class="text-sm text-primary whitespace-pre-line leading-relaxed">
              {{ eventStore.getEventById(eventId)?.description }}
            </div>
            <div v-else class="flex items-center gap-3 text-secondary text-sm">
              <IconV2 name="info" size="sm" class="text-secondary/70" />
              <span>Описание не указано</span>
            </div>
          </BentoCard>

          <!-- Tech Task -->
            <BentoCard size="1x1" variant="minimal" class="self-start">
            <template #header>
              <div class="flex items-center justify-between gap-2 w-full">
                <div class="flex items-center gap-2">
                  <IconV2 name="file-text" size="sm" />
                  <h3 class="text-base sm:text-lg font-semibold leading-tight">Техзадание</h3>
                </div>
                <ButtonV2
                  v-if="eventStore.getEventById(eventId)?.technical_task"
                  variant="minimal"
                  size="sm"
                  @click="navigator.clipboard.writeText(String(eventStore.getEventById(eventId)?.technical_task || ''))"
                >
                  <IconV2 name="copy" size="sm" class="mr-2" />
                  Копировать
                </ButtonV2>
              </div>
            </template>
            <div v-if="eventStore.getEventById(eventId)?.technical_task" class="bg-accent/50 border border-secondary/20 rounded-lg p-3 max-h-56 overflow-auto">
              <pre class="whitespace-pre-wrap font-mono text-xs text-primary">{{ eventStore.getEventById(eventId)?.technical_task }}</pre>
            </div>
            <div v-else class="flex items-center gap-3 text-secondary text-sm">
              <IconV2 name="info" size="sm" class="text-secondary/70" />
              <span>Техническое задание не указано</span>
            </div>
          </BentoCard>

            <!-- Mount Points: full width -->
            <BentoCard size="2x2" variant="default">
            <template #header>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <IconV2 name="map-pin" size="sm" />
                    <h3 class="text-base sm:text-lg font-semibold leading-tight">Точки монтажа</h3>
                    <StatusBadgeV2 :label="String(mountPointStats.total)" variant="info" size="xs" />
                  </div>
                  <!-- Compact stats for mobile -->
                  <div class="flex sm:hidden items-center gap-4 text-xs text-secondary mt-1">
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success inline-block"></span> Готово: {{ mountPointStats.ready }}</span>
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-warning inline-block"></span> В работе: {{ mountPointStats.pending }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <div class="text-sm text-secondary hidden sm:flex items-center gap-4">
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success inline-block"></span> Готово: {{ mountPointStats.ready }}</span>
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-warning inline-block"></span> В работе: {{ mountPointStats.pending }}</span>
                  </div>
                  <ButtonV2 class="w-full sm:w-auto" variant="primary" size="sm" @click="openMountPointForm">
                    <template #icon><IconV2 name="plus" size="sm" /></template>
                    Добавить точку монтажа
                  </ButtonV2>
                </div>
              </div>
            </template>
            <div v-if="isMountPointsLoading" class="text-secondary">Загрузка точек...</div>
            <div v-else-if="mountPointsError" class="text-error">{{ mountPointsError }}</div>
            <div v-else>
              <div v-if="mountPointStore.getMountPointsByEventId(eventId).length === 0" class="text-center py-10">
                <IconV2 name="map-pin" size="lg" class="text-secondary/50 mb-3" />
                <div class="text-primary font-medium mb-2">Точек монтажа пока нет</div>
                <div class="text-secondary text-sm mb-4">Создайте первую точку для этого мероприятия</div>
                <ButtonV2 variant="primary" size="sm" @click="openMountPointForm">
                  <template #icon><IconV2 name="plus" size="sm" /></template>
                  Добавить точку монтажа
                </ButtonV2>
              </div>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MountPointCardV2
                  v-for="mp in mountPointStore.getMountPointsByEventId(eventId)"
                  :key="mp.id"
                  :mount-point="mp"
                  @click="goToMountPoint(mp.id)"
                  @edit="openEditMountPoint(mp)"
                  @add-duty="openAddDutyForMountPoint(mp)"
                />
              </div>
            </div>
          </BentoCard>

            <!-- Team and Equipment Lists: side by side -->
            <BentoCard v-if="responsibleNames.length" size="1x1" variant="default">
              <template #header>
                <div class="flex items-center gap-2"><IconV2 name="users" size="sm" /><h3 class="text-base sm:text-lg font-semibold leading-tight">Команда проекта</h3></div>
              </template>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div v-for="name in responsibleNames" :key="name" class="flex items-center gap-3 p-3 rounded-xl border border-secondary/20 bg-white">
                  <div class="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-sm">{{ name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) }}</div>
                  <div>
                    <div class="font-medium text-primary">{{ name }}</div>
                    <div class="text-xs text-secondary">Ответственный инженер</div>
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard size="1x1" variant="secondary" class="self-start">
              <template #header>
                <div class="flex items-center gap-2"><IconV2 name="list" size="sm" /><h3 class="text-base sm:text-lg font-semibold leading-tight">Списки оборудования</h3></div>
              </template>
              <div class="text-sm text-secondary">Здесь будут карточки списков, связанные с мероприятием.</div>
            </BentoCard>
        </BentoGrid>
      </div>
    </div>
    <!-- Mount Point Create Modal -->
    <MountPointFormModal
      v-model:show="showMountPointForm"
      :event-id="eventId"
      :event="eventStore.getEventById(eventId)"
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
      :event="eventStore.getEventById(eventId)"
      @success="handleEditSuccess"
      @error="handleEditError"
      @close="showEditEventModal = false"
    />
  </div>
</template>

<style scoped>
</style>



