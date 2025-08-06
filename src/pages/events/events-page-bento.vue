<script setup>
/**
 * events-page-bento.vue – новая страница «Мероприятия» на базе Bento + UI Kit v2
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '@/features/events/store/event-store'
import { storeToRefs } from 'pinia'
// UI Kit v2
import { ButtonV2, BreadcrumbsV2, TabsV2, NotificationV2 } from '@/shared/ui-v2'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import EventCardV2 from '@/features/events/ui/EventCardV2.vue'
import EventFormModal from '@/features/events/components/EventFormModalV2.vue' // временно legacy, позже заменим

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

const handleCreateSuccess = () => eventStore.loadEvents()

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
      <!-- Tabs -->
      <TabsV2 v-model="activeTab" :tabs="tabsConfig" class="mb-6" />

      <!-- Grid -->
      <BentoGrid columns="auto" gap="6">
        <template v-if="loading">
          <div class="text-secondary">Загрузка...</div>
        </template>
        <template v-else-if="error">
          <div class="text-error">{{ error }}</div>
        </template>
        <template v-else-if="displayEvents.length === 0">
          <div class="text-secondary">Нет мероприятий</div>
        </template>
        <template v-else>
          <EventCardV2
            v-for="ev in displayEvents"
            :key="ev.id"
            :event="ev"
            @click="handleCardClick(ev)"
          />
        </template>
      </BentoGrid>
    </div>

    <!-- Notification (placeholder) -->
    <NotificationV2 ref="notify" position="top-right" />

    <!-- Create Modal -->
    <EventFormModal
      v-model:show="showCreateModal"
      @success="handleCreateSuccess"
      @close="showCreateModal = false"
    />
  </div>
</template>
