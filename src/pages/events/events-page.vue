<script setup>
/**
 * events-page.vue — современная страница мероприятий
 * Использует новую архитектуру с вкладками, сеткой и модальным окном
 * ИСПРАВЛЕНО: только Tailwind CSS, синяя цветовая схема
 */
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useEventStore } from '@/features/events/store/event-store'
import Button from '@/shared/ui/atoms/Button.vue'
import EventTabs from '@/features/events/ui/EventTabs.vue'
import EventGrid from '@/features/events/ui/EventGrid.vue'
import EventFormModal from '@/features/events/components/EventFormModal.vue'
import EventDiagnostic from '@/features/events/components/EventDiagnostic.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

// Роутер
const router = useRouter()

// Store
const eventStore = useEventStore()
const { events, loading, error } = storeToRefs(eventStore)

// Локальное состояние
const activeTab = ref('active')
const showCreateModal = ref(false)
const showDiagnostic = ref(false)

// Computed свойства
const activeEvents = computed(() => 
  events.value.filter(event => !event.is_archived)
)

const archivedEvents = computed(() => 
  events.value.filter(event => event.is_archived)
)

const displayEvents = computed(() => {
  switch (activeTab.value) {
    case 'archived':
      return archivedEvents.value
    case 'active':
    default:
      return activeEvents.value
  }
})

const tabsConfig = computed(() => [
  {
    key: 'active',
    label: 'Активные',
    count: activeEvents.value.length
  },
  {
    key: 'archived',
    label: 'Архивные',
    count: archivedEvents.value.length
  }
])

// Методы
const handleEventClick = (event) => {
  router.push(`/events/${event.id}`)
}

const handleCreateSuccess = () => {
  // Перезагружаем список мероприятий после создания
  eventStore.loadEvents()
}

const handleRetry = () => {
  eventStore.loadEvents()
}

// Загружаем данные при монтировании
onMounted(() => {
  eventStore.loadEvents()
})
</script>

<template>
  <!--
    events-page.vue — современная страница управления мероприятиями
    Архитектурная роль: главная страница для просмотра и создания мероприятий
    Поддерживает: вкладки активные/архивные, создание мероприятий, переход к деталям
    ИСПРАВЛЕНО: использует только Tailwind CSS, синюю цветовую схему
  -->
  <div class="min-h-screen relative bg-gray-50">
    
    
    <!-- Основной контент -->
    <div class="relative z-10 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4">
      <!-- Хлебные крошки (breadcrumbs) — единый стиль с точкой монтажа -->
      <nav class="flex mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <!-- Кнопка На главную -->
          <li class="inline-flex items-center">
            <button 
              @click="$router.push('/')"
              class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="ArrowLeft" set="lucide" size="sm" class="mr-2" />
              На главную
            </button>
          </li>
          <!-- Текущая страница -->
          <li aria-current="page">
            <div class="flex items-center">
              <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400 mx-1" />
              <span class="text-sm font-medium text-gray-500">Мероприятия</span>
            </div>
          </li>
        </ol>
      </nav>
      <!-- Заголовок страницы -->
      <header class="mb-8">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white/90 border border-gray-200 rounded-2xl p-6 lg:p-8 shadow-sm backdrop-blur-sm">
          <div class="flex items-center gap-4">
            <div class="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl shrink-0">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="text-blue-600 stroke-current stroke-2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
            </div>
            <div class="flex-1">
              <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 font-mono tracking-wide">Мероприятия</h1>
              <p class="text-sm text-gray-600 font-medium mt-1">
                Управление мероприятиями и планирование событий
              </p>
            </div>
          </div>
          
          <!-- Кнопки управления -->
          <div class="flex flex-col lg:flex-row gap-3 shrink-0">
            <Button
              label="Диагностика"
              variant="secondary"
              size="lg"
              class="transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105 lg:w-auto w-full justify-center"
              @click="showDiagnostic = !showDiagnostic"
            >
              <template #icon>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="stroke-current stroke-2">
                  <path d="M9 12l2 2 4-4"/>
                  <path d="M21 12c-1.5 1.5-4 1.5-5.5 0s-4-1.5-5.5 0-4 1.5-5.5 0-4-1.5-5.5 0"/>
                </svg>
              </template>
            </Button>
            <Button
              label="Создать мероприятие"
              variant="primary"
              size="lg"
              class="transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105 lg:w-auto w-full justify-center"
              @click="showCreateModal = true"
            >
              <template #icon>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="stroke-current stroke-2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </template>
            </Button>
          </div>
        </div>
      </header>
      
      <!-- Диагностический блок -->
      <EventDiagnostic v-if="showDiagnostic" class="mb-8" />
      
      <!-- Навигационные вкладки -->
      <EventTabs
        v-model="activeTab"
        :tabs="tabsConfig"
      />
      
      <!-- Сетка мероприятий -->
      <EventGrid
        :events="displayEvents"
        :loading="loading"
        :error="error"
        :events-type="activeTab"
        @event-click="handleEventClick"
        @create="showCreateModal = true"
        @retry="handleRetry"
      />
    </div>
    
    <!-- Модальное окно создания мероприятия -->
    <EventFormModal
      v-model:show="showCreateModal"
      @success="handleCreateSuccess"
      @close="showCreateModal = false"
    />
  </div>
</template> 