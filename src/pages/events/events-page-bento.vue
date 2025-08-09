<script setup>
/**
 * events-page-bento.vue – новая страница «Мероприятия» на базе Bento + UI Kit v2
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '@/features/events/store/event-store'
import { storeToRefs } from 'pinia'
// UI Kit v2
import { ButtonV2, BreadcrumbsV2, TabsV2, NotificationV2, IconV2 } from '@/shared/ui-v2'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'
import { EventDataCardV2 } from '@/shared/ui-v2'
import EventFormModalV2 from '@/features/events/components/EventFormModalV2.vue'
import EventsCalendar from '@/features/events/components/EventsCalendar.vue'

// Хлебные крошки
const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Мероприятия', disabled: true }
]

// Store
const eventStore = useEventStore()
const { events, loading, error } = storeToRefs(eventStore)

// UI state
const activeTab = ref('active')
const showCreateModal = ref(false)
const notify = ref(null)
const calendarMonth = ref('') // YYYY-MM

// Tabs config
const tabsConfig = computed(() => [
  { value: 'active', label: `Активные (${events.value.filter(e => !e.is_archived).length})` },
  { value: 'archived', label: `Архивные (${events.value.filter(e => e.is_archived).length})` }
])

// Выводим события по выбранному табу
const displayEvents = computed(() =>
  activeTab.value === 'archived' ? events.value.filter(e => e.is_archived) : events.value.filter(e => !e.is_archived)
)

const router = useRouter()
const handleCardClick = (ev) => router.push(`/events/${ev.id}`)
const handleCalendarEventClick = (ev) => router.push(`/events/${ev.id}`)

const handleCreateSuccess = () => {
  eventStore.loadEvents()
  notify.value?.success('Мероприятие создано')
}

const handleCreateError = (message) => {
  notify.value?.error(message || 'Ошибка операции с мероприятием')
}

onMounted(() => eventStore.loadEvents())
</script>

<template>
  <div class="min-h-screen bg-accent">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 :items="breadcrumbs" variant="minimal" size="sm" />
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">Мероприятия</h1>
            <p class="text-sm text-secondary">Управление мероприятиями и планирование событий</p>
          </div>
          <ButtonV2 variant="primary" @click="showCreateModal = true">Создать мероприятие</ButtonV2>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <!-- Grid -->
      <BentoGrid columns="3" gap="6" minRowHeight="md">
        <template v-if="loading">
          <div class="text-secondary">Загрузка...</div>
        </template>
        <template v-else-if="error">
          <div class="text-error">{{ error }}</div>
        </template>
        <template v-else>
          <!-- Календарь (2/3 ширины) -->
          <BentoCard title="Календарь" size="2x1" variant="default" class="lg:col-span-2">
            <EventsCalendar :events="displayEvents" v-model="calendarMonth" @event-click="handleCalendarEventClick" />
          </BentoCard>

          <!-- Статистика (1/3 ширины) -->
          <BentoCard size="1x1" variant="secondary" class="self-start lg:col-span-1">
            <template #header>
              <div class="flex items-center gap-2">
                <IconV2 name="trending-up" size="sm" />
                <h3 class="text-base sm:text-lg font-semibold leading-tight">Статистика</h3>
              </div>
            </template>
            <div class="grid grid-cols-1 gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 opacity-90">
                  <IconV2 name="calendar-check" size="sm" />
                  <span>Всего</span>
                </div>
                <span class="text-xl font-bold">{{ events.length }}</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 opacity-90">
                  <IconV2 name="calendar" size="sm" />
                  <span>Активные</span>
                </div>
                <span class="text-xl font-bold">{{ events.filter(e=>!e.is_archived).length }}</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 opacity-90">
                  <IconV2 name="inbox" size="sm" />
                  <span>Архивные</span>
                </div>
                <span class="text-xl font-bold">{{ events.filter(e=>e.is_archived).length }}</span>
              </div>
            </div>
          </BentoCard>

          <!-- Список карточек -->
          <BentoCard title="Список мероприятий" size="2x2" variant="default" class="sm:col-span-2 lg:col-span-3">
            <div class="mb-4">
              <TabsV2 v-model="activeTab" :tabs="tabsConfig" />
            </div>
            <div v-if="displayEvents.length === 0" class="text-secondary">Нет мероприятий</div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <EventDataCardV2
                v-for="ev in displayEvents"
                :key="ev.id"
                :event="ev"
                variant="primary"
                :interactive="true"
                @click="handleCardClick(ev)"
              />
            </div>
          </BentoCard>
        </template>
      </BentoGrid>
    </div>

    <!-- Notification (placeholder) -->
    <NotificationV2 ref="notify" position="top-right" />

      <!-- Create Modal -->
      <EventFormModalV2
      v-model:show="showCreateModal"
      @success="handleCreateSuccess"
      @error="handleCreateError"
      @close="showCreateModal = false"
    />
  </div>
</template>
