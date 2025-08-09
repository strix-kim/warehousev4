<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 :items="breadcrumbs" variant="minimal" size="sm" />
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">Модуль мероприятий</h1>
            <p class="text-sm text-secondary mt-2">Управление мероприятиями и создание новых событий</p>
          </div>
          <ButtonV2 variant="primary" @click="showCreateModal = true">Создать мероприятие</ButtonV2>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      <BentoGrid columns="auto" gap="6">
        <!-- Статистика мероприятий -->
        <BentoCard title="Всего мероприятий" size="1x1" variant="primary">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="calendar-check" size="sm" />
              <h3 class="text-base sm:text-lg font-semibold leading-tight">Всего мероприятий</h3>
            </div>
          </template>
          <div class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold">{{ totalCount }}</span>
            <span class="text-sm opacity-80">Всего</span>
          </div>
        </BentoCard>
        <BentoCard title="Активные мероприятия" size="1x1" variant="danger">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="calendar" size="sm" />
              <h3 class="text-base sm:text-lg font-semibold leading-tight">Активные мероприятия</h3>
            </div>
          </template>
          <div class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold">{{ activeCount }}</span>
            <span class="text-sm opacity-80">Активные</span>
          </div>
        </BentoCard>
        <BentoCard title="Архивные мероприятия" size="1x1" variant="secondary">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="inbox" size="sm" />
              <h3 class="text-base sm:text-lg font-semibold leading-tight">Архивные мероприятия</h3>
            </div>
          </template>
          <div class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold">{{ archivedCount }}</span>
            <span class="text-sm opacity-80">Архивные</span>
          </div>
        </BentoCard>

        <!-- Календарь мероприятий -->
        <BentoCard title="Календарь" size="2x2" variant="default">
          <EventsCalendar :events="displayEvents" v-model="calendarMonth" @event-click="goToEvent" />
        </BentoCard>

        <!-- Список мероприятий -->
        <BentoCard title="Список мероприятий" size="2x2" variant="default">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <IconV2 name="list" size="sm" class="text-primary" />
                <h3 class="text-base sm:text-lg font-semibold leading-tight text-primary">Список мероприятий</h3>
              </div>
              <TabsV2 v-model="activeTab" :tabs="tabsConfig" />
            </div>
          </template>
          <div v-if="loading" class="text-secondary">Загрузка...</div>
          <div v-else-if="error" class="text-error">{{ error }}</div>
          <div v-else>
            <div v-if="displayEvents.length === 0" class="flex items-center justify-center h-40">
              <div class="text-center">
                <IconV2 name="calendar" size="lg" class="mx-auto mb-2 text-secondary/60" />
                <div class="font-medium text-primary">
                  {{ activeTab === 'archived' ? 'Нет архивных мероприятий' : 'Нет активных мероприятий' }}
                </div>
                <div class="text-sm text-secondary">
                  {{ activeTab === 'archived' ? 'Переключитесь на вкладку «Активные» для просмотра' : 'Переключитесь на вкладку «Архивные» для просмотра' }}
                </div>
              </div>
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                <EventDataCardV2
                  v-for="ev in displayEvents.slice(0, 6)"
                  :key="ev.id"
                  :event="ev"
                  variant="primary"
                  :interactive="true"
                  @click="goToEvent(ev)"
                />
              </div>
            <div class="flex justify-end mt-4">
              <ButtonV2 variant="ghost" @click="navigateToList">Перейти ко всем</ButtonV2>
            </div>
          </div>
        </BentoCard>

        
      </BentoGrid>
    </div>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />

    <!-- Create Modal -->
    <EventFormModalV2
      v-model:show="showCreateModal"
      @success="handleCreateSuccess"
      @error="handleCreateError"
      @close="showCreateModal = false"
    />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventStore } from '@/features/events/store/event-store'
import {
  BreadcrumbsV2,
  BentoGrid,
  BentoCard,
  NotificationV2,
  IconV2,
  TabsV2,
  ButtonV2
} from '@/shared/ui-v2'
import EventsCalendar from '@/features/events/components/EventsCalendar.vue'
import { EventDataCardV2 } from '@/shared/ui-v2'
import EventFormModalV2 from '@/features/events/components/EventFormModalV2.vue'

const router = useRouter()
const eventStore = useEventStore()
const { events, loading, error } = storeToRefs(eventStore)

// Метрики мероприятий
const totalCount = computed(() => eventStore.eventsStats.total)
const activeCount = computed(() => eventStore.eventsStats.active)
const archivedCount = computed(() => eventStore.eventsStats.archived)

// UI state
const activeTab = ref('active')
const showCreateModal = ref(false)
const calendarMonth = ref('')

const tabsConfig = computed(() => [
  { value: 'active', label: `Активные (${events.value.filter(e => !e.is_archived).length})` },
  { value: 'archived', label: `Архивные (${events.value.filter(e => e.is_archived).length})` }
])

const displayEvents = computed(() =>
  activeTab.value === 'archived'
    ? events.value.filter(e => e.is_archived)
    : events.value.filter(e => !e.is_archived)
)

// Загружаем мероприятия
onMounted(() => {
  eventStore.loadEvents()
})

const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Мероприятия', disabled: true }
]

const navigateToList = () => router.push('/events/list')
const goToEvent = (ev) => router.push(`/events/${ev.id}`)

const handleCreateSuccess = () => {
  eventStore.loadEvents()
}
const handleCreateError = () => {}
</script>