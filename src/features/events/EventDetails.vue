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

const handleMountPointCreate = async (formData) => {
  try {
    const result = await mountPointStore.createMountPoint({ ...formData, event_id: eventId })
    if (result?.error) throw result.error
    showMountPointForm.value = false
    await mountPointStore.loadMountPointsByEventId(eventId)
    if (result?.data?.id) {
      router.push(`/mount-point/${result.data.id}`)
    } else {
      notify.value?.success('Точка монтажа создана')
    }
  } catch (e) {
    notify.value?.error(e.message || 'Ошибка создания точки монтажа')
  }
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
        <BentoGrid columns="3" gap="6" minRowHeight="md">
          <!-- Hero -->
          <BentoCard size="2x1" variant="primary">
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <IconV2 name="calendar" size="sm" />
                  <h2 class="text-xl sm:text-2xl lg:text-3xl font-semibold leading-tight truncate">{{ eventStore.getEventById(eventId)?.name }}</h2>
                </div>
                <StatusBadgeV2 :label="eventStatus.label" :variant="eventStatus.variant" size="sm" />
              </div>
            </template>

            <div class="flex flex-col gap-4">
              <!-- chips: organizer/location -->
              <div class="flex flex-wrap items-center gap-2">
                <span v-if="eventStore.getEventById(eventId)?.organizer" class="px-2 py-1 rounded-full border border-secondary/30 bg-white text-sm text-primary inline-flex items-center gap-1">
                  <IconV2 name="user" size="xs" /> {{ eventStore.getEventById(eventId)?.organizer }}
                </span>
                <span v-if="eventStore.getEventById(eventId)?.location" class="px-2 py-1 rounded-full border border-secondary/30 bg-white text-sm text-primary inline-flex items-center gap-1">
                  <IconV2 name="map-pin" size="xs" /> {{ eventStore.getEventById(eventId)?.location }}
                </span>
              </div>

              <!-- phases -->
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                <div class="px-2 py-1 rounded-lg border border-secondary/20 bg-white text-sm text-primary flex items-center gap-2">
                  <IconV2 name="wrench" size="xs" />
                  <span class="truncate">Монтаж: {{ formatShortDate(eventStore.getEventById(eventId)?.setup_date) }}</span>
                </div>
                <div class="px-2 py-1 rounded-lg border border-secondary/20 bg-white text-sm text-primary flex items-center gap-2">
                  <IconV2 name="calendar" size="xs" />
                  <span class="truncate">Старт: {{ formatShortDate(eventStore.getEventById(eventId)?.start_date) }}</span>
                </div>
                <div class="px-2 py-1 rounded-lg border border-secondary/20 bg-white text-sm text-primary flex items-center gap-2">
                  <IconV2 name="calendar-check" size="xs" />
                  <span class="truncate">Финиш: {{ formatShortDate(eventStore.getEventById(eventId)?.end_date) }}</span>
                </div>
                <div class="px-2 py-1 rounded-lg border border-secondary/20 bg-white text-sm text-primary flex items-center gap-2">
                  <IconV2 name="package" size="xs" />
                  <span class="truncate">Демонтаж: {{ formatShortDate(eventStore.getEventById(eventId)?.teardown_date) }}</span>
                </div>
              </div>

              <!-- KPIs as tiles -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="rounded-lg border border-secondary/20 bg-white p-4 flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconV2 name="map-pin" size="sm" class="text-primary" />
                  </div>
                  <div>
                    <div class="text-sm text-secondary">Точек</div>
                    <div class="text-2xl font-semibold text-primary">{{ mountPointsCount }}</div>
                  </div>
                </div>
                <div class="rounded-lg border border-secondary/20 bg-white p-4 flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconV2 name="users" size="sm" class="text-primary" />
                  </div>
                  <div>
                    <div class="text-sm text-secondary">Инженеров</div>
                    <div class="text-2xl font-semibold text-primary">{{ teamSize }}</div>
                  </div>
                </div>
                <div class="rounded-lg border border-secondary/20 bg-white p-4 flex items-center gap-3" v-if="daysUntilEvent !== null">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconV2 name="calendar" size="sm" class="text-primary" />
                  </div>
                  <div>
                    <div class="text-sm text-secondary">{{ daysUntilEvent > 0 ? 'Дней до старта' : 'Дней с начала' }}</div>
                    <div class="text-2xl font-semibold text-primary">{{ daysUntilEvent > 0 ? daysUntilEvent : 0 }}</div>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          <!-- Equipment Lists (placeholder) -->
          <BentoCard size="1x1" variant="secondary" class="self-start">
            <template #header>
              <div class="flex items-center gap-2"><IconV2 name="list" size="sm" /><h3 class="text-base sm:text-lg font-semibold leading-tight">Списки оборудования</h3></div>
            </template>
            <div class="text-sm text-secondary">Здесь будут карточки списков, связанные с мероприятием.</div>
          </BentoCard>

          <!-- Overview -->
          <BentoCard size="2x1" variant="default">
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

          <!-- Team -->
          <BentoCard v-if="responsibleNames.length" size="3x1" variant="default" class="lg:col-span-3">
            <template #header>
              <div class="flex items-center gap-2"><IconV2 name="users" size="sm" /><h3 class="text-base sm:text-lg font-semibold leading-tight">Команда проекта</h3></div>
            </template>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-for="name in responsibleNames" :key="name" class="flex items-center gap-3 p-3 rounded-xl border border-secondary/20 bg-white">
                <div class="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-sm">{{ name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) }}</div>
                <div>
                  <div class="font-medium text-primary">{{ name }}</div>
                  <div class="text-xs text-secondary">Ответственный инженер</div>
                </div>
              </div>
            </div>
          </BentoCard>

          <!-- Mount Points -->
          <BentoCard size="3x2" variant="default" class="lg:col-span-3">
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <IconV2 name="map-pin" size="sm" />
                  <h3 class="text-base sm:text-lg font-semibold leading-tight">Точки монтажа</h3>
                  <StatusBadgeV2 :label="String(mountPointStats.total)" variant="info" size="xs" />
                </div>
                <div class="text-sm text-secondary flex items-center gap-4">
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success inline-block"></span> Готово: {{ mountPointStats.ready }}</span>
                  <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-warning inline-block"></span> В работе: {{ mountPointStats.pending }}</span>
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
                  <IconV2 name="plus" size="sm" class="mr-2" />
                  Добавить точку монтажа
                </ButtonV2>
              </div>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Create new mount point card -->
                <button type="button" @click="openMountPointForm" class="rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition p-4 flex items-center justify-center gap-3">
                  <IconV2 name="plus" size="sm" class="text-primary" />
                  <span class="text-primary font-medium">Добавить точку монтажа</span>
                </button>
                <!-- Existing mount points -->
                <div v-for="mp in mountPointStore.getMountPointsByEventId(eventId)" :key="mp.id" class="rounded-xl border border-secondary/20 bg-white">
                  <button type="button" class="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-accent/50 rounded-xl transition" @click="toggleMp(mp.id)">
                    <div class="min-w-0">
                      <div class="text-primary font-medium truncate">{{ mp.name || 'Точка без названия' }}</div>
                      <div class="text-xs text-secondary truncate">{{ mp.description || 'Без описания' }}</div>
                    </div>
                    <IconV2 :name="isMpExpanded(mp.id) ? 'chevron-up' : 'chevron-down'" size="sm" class="text-secondary" />
                  </button>
                  <div v-if="isMpExpanded(mp.id)" class="px-4 pb-4">
                    <div class="grid grid-cols-2 gap-3 text-sm">
                      <div class="text-secondary">План: {{ mp.equipment_plan?.length || 0 }}</div>
                      <div class="text-secondary">Факт: {{ mp.equipment_fact?.length || 0 }}</div>
                      <div class="text-secondary col-span-2" v-if="mp.location">Локация: {{ mp.location }}</div>
                    </div>
                    <div class="mt-3 flex items-center gap-2">
                      <ButtonV2 variant="minimal" size="sm" @click="goToMountPoint(mp.id)">Открыть</ButtonV2>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          <!-- Equipment Summary (placeholder) -->
          <BentoCard size="3x1" variant="default" class="lg:col-span-3">
            <template #header>
              <div class="flex items-center gap-2"><IconV2 name="trending-up" size="sm" /><h3 class="text-base sm:text-lg font-semibold leading-tight">Сводка оборудования</h3></div>
            </template>
            <div class="text-sm text-secondary">Здесь будет простая сводка: общий объем, по категориям, по точкам.</div>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
    <!-- Mount Point Create Modal -->
    <MountPointFormModal
      :visible="showMountPointForm"
      @update:visible="showMountPointForm = $event"
      :event-id="eventId"
      :event="eventStore.getEventById(eventId)"
      @close="closeMountPointForm"
      @submit="handleMountPointCreate"
    />
  </div>
</template>

<style scoped>
</style>



