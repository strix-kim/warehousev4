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
        <BentoCard title="Всего мероприятий" size="1x1" variant="primary" :aria-busy="loading">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="calendar-check" size="sm" />
              <h3 class="text-base sm:text-lg font-semibold leading-tight">Всего мероприятий</h3>
            </div>
          </template>
          <div v-if="loading" class="flex flex-col items-center justify-center h-full gap-2">
            <SkeletonV2 variant="text" width="48px" height="28px" animation="pulse" />
            <SkeletonV2 variant="text" width="40%" height="12px" animation="pulse" />
          </div>
          <div v-else class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold">{{ totalCount }}</span>
            <span class="text-sm opacity-80">Всего</span>
          </div>
        </BentoCard>
        <BentoCard title="Активные мероприятия" size="1x1" variant="danger" :aria-busy="loading">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="calendar" size="sm" />
              <h3 class="text-base sm:text-lg font-semibold leading-tight">Активные мероприятия</h3>
            </div>
          </template>
          <div v-if="loading" class="flex flex-col items-center justify-center h-full gap-2">
            <SkeletonV2 variant="text" width="48px" height="28px" animation="pulse" />
            <SkeletonV2 variant="text" width="50%" height="12px" animation="pulse" />
          </div>
          <div v-else class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold">{{ activeCount }}</span>
            <span class="text-sm opacity-80">Активные</span>
          </div>
        </BentoCard>
        <BentoCard title="Архивные мероприятия" size="1x1" variant="secondary" :aria-busy="loading">
          <template #header>
            <div class="flex items-center gap-2">
              <IconV2 name="inbox" size="sm" />
              <h3 class="text-base sm:text-lg font-semibold leading-tight">Архивные мероприятия</h3>
            </div>
          </template>
          <div v-if="loading" class="flex flex-col items-center justify-center h-full gap-2">
            <SkeletonV2 variant="text" width="48px" height="28px" animation="pulse" />
            <SkeletonV2 variant="text" width="60%" height="12px" animation="pulse" />
          </div>
          <div v-else class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold">{{ archivedCount }}</span>
            <span class="text-sm opacity-80">Архивные</span>
          </div>
        </BentoCard>

        <!-- Календарь мероприятий: растягиваем на всю ширину -->
        <BentoCard title="Календарь" size="2x2" variant="default" class="sm:col-span-2 lg:col-span-3" :aria-busy="loading">
          <div v-if="loading" class="space-y-2">
            <div class="grid grid-cols-7 gap-1 sm:gap-2">
              <SkeletonV2 v-for="i in 7" :key="'dow-'+i" variant="text" height="10px" animation="pulse" />
            </div>
            <div class="grid grid-cols-7 gap-1 sm:gap-2">
              <div v-for="i in 42" :key="'cell-'+i" class="rounded-lg overflow-hidden aspect-[6/5] md:aspect-[4/3]">
                <SkeletonV2 variant="rounded" height="100%" animation="wave" />
              </div>
            </div>
          </div>
          <template v-else>
            <EventsCalendar :events="displayEvents" v-model="calendarMonth" @event-click="goToEvent" />
          </template>
        </BentoCard>

        <!-- Список мероприятий: ниже календаря, на всю ширину -->
        <BentoCard title="Список мероприятий" size="2x2" variant="default" class="sm:col-span-2 lg:col-span-3" :aria-busy="loading">
          <template #header>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2 min-w-0">
                <IconV2 name="list" size="sm" class="text-primary flex-shrink-0" />
                <h3 class="text-base sm:text-lg font-semibold leading-tight text-primary truncate">Список мероприятий</h3>
              </div>
              <div class="w-full sm:w-auto sm:max-w-full overflow-hidden">
                <TabsV2 v-model="activeTab" :tabs="tabsConfig" :scrollable="true" />
              </div>
            </div>
          </template>
          <div class="min-h-[50vh]" style="overflow-anchor: none;">
            <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="i in 6" :key="i" class="p-4 rounded-lg border border-gray-200 bg-white">
                <div class="flex items-center gap-2 mb-3">
                  <SkeletonV2 variant="circular" width="24px" height="24px" animation="pulse" />
                  <SkeletonV2 variant="text" width="60%" height="14px" animation="pulse" />
                </div>
                <SkeletonV2 variant="text" width="90%" height="12px" animation="pulse" />
                <SkeletonV2 variant="text" width="70%" height="12px" animation="pulse" />
              </div>
            </div>
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
  ButtonV2,
  SkeletonV2
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

// /events/list удалена
const goToEvent = (ev) => router.push(`/events/${ev.id}`)

const handleCreateSuccess = () => {
  eventStore.loadEvents()
}
const handleCreateError = () => {}
</script>