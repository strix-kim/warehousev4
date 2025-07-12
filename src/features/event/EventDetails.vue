<script setup>
/**
 * EventDetails.vue — Современная страница деталей мероприятия
 * МИГРИРОВАНО: полностью переписан на Tailwind CSS, синяя цветовая схема
 * Новая архитектура: Hero + Status Dashboard, табы, современное управление точками монтажа
 * Использует корпоративную палитру с синими акцентами, микроанимации и WCAG 2.1 AA
 * ИНТЕГРИРОВАНА система точек монтажа с Pinia store и компонентами
 * ОПТИМИЗИРОВАНО: убрана секция прогресса, исправлена двойная перезагрузка, добавлено прямое создание точек
 */
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '@/stores/event-store'
import { useMountPointStore } from '@/stores/mount-point-store'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import { addReport } from '@/features/report/reportApi'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import EventEditor from './EventEditor.vue'
import MountPointList from '@/features/mount-point/components/MountPointList.vue'
import MountPointFormModal from '@/features/mount-point/components/MountPointFormModal.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

const route = useRoute()
const router = useRouter()
const eventId = String(route.params.id)

// Stores
const eventStore = useEventStore()
const { loading: isLoading, error: hasError } = storeToRefs(eventStore)
const mountPointStore = useMountPointStore()
const { mountPoints, loading: isMountPointsLoading, error: mountPointsError } = storeToRefs(mountPointStore)
const userStore = useUserStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)

// Локальное состояние
const isReportLoading = ref(false)
const reportError = ref(null)
const showEditor = ref(false)
const showMountPointForm = ref(false)
const activeTab = ref('overview')
const mountPointView = ref('grid') // grid | list | map

// Computed свойства для Hero + Status Dashboard
const responsibleNames = computed(() => {
  if (!eventStore.getEventById(eventId) || !Array.isArray(eventStore.getEventById(eventId).responsible_engineers)) return []
  return eventStore.getEventById(eventId).responsible_engineers
    .map(id => users.value.find(u => u.id === id)?.name)
    .filter(Boolean)
})

const teamSize = computed(() => responsibleNames.value.length)

const mountPointsCount = computed(() => mountPointStore.getMountPointsByEventId(eventId).length)

const daysUntilEvent = computed(() => {
  if (!eventStore.getEventById(eventId)?.start_date) return null
  const now = new Date()
  const startDate = new Date(eventStore.getEventById(eventId).start_date)
  const diffTime = startDate - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
})

const eventStatus = computed(() => {
  if (!eventStore.getEventById(eventId)) {
    return { 
      label: 'Неизвестно', 
      statusClass: 'bg-gray-100 text-gray-800' 
    }
  }
  
  if (eventStore.getEventById(eventId).is_archived) {
    return { 
      label: 'Архив', 
      statusClass: 'bg-gray-100 text-gray-800' 
    }
  }
  
  const now = new Date()
  const start = eventStore.getEventById(eventId).start_date ? new Date(eventStore.getEventById(eventId).start_date) : null
  const end = eventStore.getEventById(eventId).end_date ? new Date(eventStore.getEventById(eventId).end_date) : null
  
  if (start && end && now >= start && now <= end) {
    return { 
      label: 'Идёт сейчас', 
      statusClass: 'bg-green-100 text-green-800' 
    }
  }
  
  if (start && now < start) {
    return { 
      label: 'Запланировано', 
      statusClass: 'bg-blue-100 text-blue-800' 
    }
  }
  
  if (end && now > end) {
    return { 
      label: 'Завершено', 
      statusClass: 'bg-gray-100 text-gray-800' 
    }
  }
  
  return { 
    label: 'Активно', 
    statusClass: 'bg-blue-100 text-blue-800' 
  }
})

// Mount Points статистика
const mountPointStats = computed(() => {
  const eventMountPoints = mountPointStore.getMountPointsByEventId(eventId)
  const total = eventMountPoints.length
  const withEquipment = eventMountPoints.filter(mp => mp.equipment_plan?.length > 0).length
  const ready = eventMountPoints.filter(mp => mp.equipment_fact?.length > 0).length
  
  return {
    total,
    withEquipment, 
    ready,
    pending: total - ready
  }
})

// Функции
const formatDate = (dateStr) => {
  if (!dateStr) return 'дата не указана'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  }).format(date)
}

const formatShortDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { 
    day: 'numeric', 
    month: 'short'
  }).format(date)
}

// Функции управления точками монтажа
const openMountPointForm = () => {
  showMountPointForm.value = true
}

const closeMountPointForm = () => {
  showMountPointForm.value = false
}

const handleMountPointCreate = async (formData) => {
  try {
    const result = await mountPointStore.createMountPoint({
      ...formData,
      event_id: eventId
    })
    
    if (result.error) {
      console.error('Ошибка создания точки монтажа:', result.error)
      return
    }
    
    showMountPointForm.value = false
    
    // Обновляем список точек монтажа без перезагрузки страницы
    await mountPointStore.loadMountPointsByEventId(eventId)
    
    // Переходим на страницу созданной точки монтажа только если есть ID
    if (result.data?.id) {
      router.push(`/mount-point/${result.data.id}`)
    }
  } catch (error) {
    console.error('Ошибка создания точки монтажа:', error)
  }
}

const goToMountPoint = (id) => {
  router.push(`/mount-point/${id}`)
}

const openEdit = () => {
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
}

const afterEditSubmit = async () => {
  showEditor.value = false
  // Принудительно загружаем свежие данные после редактирования
  await eventStore.loadEventById(eventId, false, true)
}

const handleArchive = async () => {
  isReportLoading.value = true
  reportError.value = null
  try {
    // Получаем точки монтажа для архивирования
    const eventMountPoints = mountPointStore.getMountPointsByEventId(eventId)
    
    const reportData = {
      event: { ...eventStore.getEventById(eventId) },
      mount_points: eventMountPoints
    }
    
    const { data: reportInsertData, error: repErr } = await addReport({
      event_id: eventId,
      content: reportData
    })
    if (repErr) throw repErr
    
    await eventStore.deleteEvent(eventId)
    router.push('/reports')
  } catch (e) {
    reportError.value = e.message || 'Ошибка архивирования мероприятия'
  } finally {
    isReportLoading.value = false
  }
}

// Загрузка данных (исправлена двойная перезагрузка)
onMounted(async () => {
  try {
    // Проверяем, что нужно загрузить, и запускаем параллельно
    const usersPromise = users.value.length ? Promise.resolve() : userStore.loadUsers()
    const eventPromise = eventStore.loadEventById(eventId, false, false) // forceReload = false
    const mountPointsPromise = mountPointStore.getMountPointsByEventId(eventId).length
      ? Promise.resolve()
      : mountPointStore.loadMountPointsByEventId(eventId)

    // Параллельная загрузка
    await Promise.all([usersPromise, eventPromise, mountPointsPromise])

    // Проверяем, что событие найдено
    if (!eventStore.getEventById(eventId)) {
      hasError.value = 'Мероприятие не найдено'
      return
    }
  } catch (error) {
    hasError.value = error.message || 'Ошибка загрузки данных'
  }
})
</script>

<template>
  <!-- Контейнер страницы с фоном -->
  <div class="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
    <!-- Лоадер -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
    
    <!-- Ошибка -->
    <div v-else-if="hasError" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="text-red-600 text-xl font-semibold mb-4">{{ hasError }}</div>
        <Button @click="router.push('/events')" variant="secondary">
          Вернуться к списку
        </Button>
      </div>
    </div>
    
    <!-- Основной контент -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      <!-- Хлебные крошки (breadcrumbs) — единый стиль -->
      <nav class="flex mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <!-- Кнопка На главную -->
          <li>
            <button
              @click="router.push('/')"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="ArrowLeft" set="lucide" size="sm" />
              На главную
            </button>
          </li>
          <!-- К разделу Мероприятия -->
          <li>
            <button
              @click="router.push('/events')"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400" />
              Мероприятия
            </button>
          </li>
          <!-- Текущая страница -->
          <li aria-current="page">
            <div class="inline-flex items-center gap-2">
              <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400" />
              <span class="text-sm font-medium text-gray-500">{{ eventStore.getEventById(eventId)?.name || 'Детали мероприятия' }}</span>
            </div>
          </li>
        </ol>
      </nav>
      
      <!-- 1. Hero + Status Dashboard -->
      <section class="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-12">
        <!-- Градиентная шапка -->
        <div class="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <!-- Основная информация -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-3">
                <h1 class="text-3xl lg:text-4xl font-bold text-white truncate">
                  {{ eventStore.getEventById(eventId)?.name }}
                </h1>
                <span 
                  :class="[
                    'px-3 py-1 rounded-full text-sm font-medium',
                    eventStatus.statusClass
                  ]"
                >
                  {{ eventStatus.label }}
                </span>
              </div>
              
              <div class="flex flex-wrap gap-6 text-blue-100">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                  </svg>
                  <span>{{ eventStore.getEventById(eventId)?.organizer }}</span>
                </div>
                
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                  </svg>
                  <span>{{ eventStore.getEventById(eventId)?.location }}</span>
                </div>
                
                <div v-if="eventStore.getEventById(eventId)?.start_date" class="flex items-center gap-2">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                  </svg>
                  <span>{{ formatShortDate(eventStore.getEventById(eventId)?.start_date) }}</span>
                </div>
              </div>
            </div>
            
            <!-- Метрики -->
            <div class="flex gap-6">
              <div class="text-center">
                <div class="flex items-center justify-center gap-2 mb-1">
                  <Icon name="MapPin" set="lucide" size="md" class="text-white" />
                  <span class="text-2xl font-bold text-white">{{ mountPointsCount }}</span>
                </div>
                <div class="text-sm text-blue-200">Точек монтажа</div>
              </div>
              <div class="text-center">
                <div class="flex items-center justify-center gap-2 mb-1">
                  <Icon name="Users" set="lucide" size="md" class="text-white" />
                  <span class="text-2xl font-bold text-white">{{ teamSize }}</span>
                </div>
                <div class="text-sm text-blue-200">Инженеров</div>
              </div>
              <div v-if="daysUntilEvent !== null" class="text-center">
                <div class="flex items-center justify-center gap-2 mb-1">
                  <Icon name="CalendarDays" set="lucide" size="md" class="text-white" />
                  <span class="text-2xl font-bold text-white">
                    {{ daysUntilEvent > 0 ? daysUntilEvent : 0 }}
                  </span>
                </div>
                <div class="text-sm text-blue-200">
                  {{ daysUntilEvent > 0 ? 'Дней до старта' : 'Дней с начала' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Быстрые действия -->
        <div class="px-8 py-4 bg-gray-50 border-t border-gray-200">
          <div class="flex flex-wrap gap-3">
            <Button @click="openEdit" variant="secondary" size="sm">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Редактировать
            </Button>
            
            <Button @click="openMountPointForm" variant="primary" size="sm">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Добавить точку
            </Button>
            
            <Button 
              @click="handleArchive" 
              variant="danger" 
              size="sm"
              :loading="isReportLoading"
              class="ml-auto"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8l6 6V9l5 5V8a2 2 0 00-2-2H7a2 2 0 00-2 2z"/>
              </svg>
              Архивировать
            </Button>
          </div>
        </div>
      </section>

      <!-- 2. Team & Responsibilities -->
      <section v-if="responsibleNames.length" class="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-12">
        <div class="flex items-center gap-3 mb-6">
          <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <h2 class="text-xl font-bold text-gray-900">Команда проекта</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="name in responsibleNames" 
            :key="name"
            class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors duration-200"
          >
            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span class="text-blue-600 font-semibold text-sm">
                {{ name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) }}
              </span>
            </div>
            <div>
              <div class="font-medium text-gray-900">{{ name }}</div>
              <div class="text-sm text-gray-600">Ответственный инженер</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Content Sections (Табы) -->
      <section class="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-12">
        <!-- Табы -->
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8 px-8" aria-label="Tabs">
            <button
              @click="activeTab = 'overview'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Обзор
              </div>
            </button>
            
            <button
              @click="activeTab = 'technical'"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'technical'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Техзадание
              </div>
            </button>
          </nav>
        </div>
        
        <!-- Контент табов -->
        <div class="p-8">
          <!-- Таб Обзор -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Описание мероприятия</h3>
              <div class="max-w-none">
                <p class="text-gray-700 leading-relaxed">
                  {{ eventStore.getEventById(eventId)?.description || 'Описание не указано' }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Таб Техзадание -->
          <div v-if="activeTab === 'technical'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Техническое задание</h3>
              <div class="max-w-none">
                <div class="bg-gray-50 rounded-xl p-6 font-mono text-sm text-gray-800">
                  <pre class="whitespace-pre-wrap">{{ eventStore.getEventById(eventId)?.technical_task || 'Техническое задание не указано' }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Mount Points Management -->
      <section class="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-12">
        <!-- Заголовок и управление -->
        <div class="px-8 py-6 border-b border-gray-200">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center gap-3">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <h2 class="text-xl font-bold text-gray-900">Точки монтажа</h2>
              <span class="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {{ mountPointStats.total }}
              </span>
            </div>
            
            <!-- Статистика -->
            <div class="flex items-center gap-6 text-sm">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                <span class="text-gray-600">Готово: {{ mountPointStats.ready }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span class="text-gray-600">В работе: {{ mountPointStats.pending }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Компонент списка точек монтажа -->
        <div class="p-8">
          <MountPointList 
            :mount-points="mountPointStore.getMountPointsByEventId(eventId)"
            :loading="isMountPointsLoading"
            :error="mountPointsError"
            :event-id="eventId"
            :event="eventStore.getEventById(eventId)"
            @create="openMountPointForm"
            @retry="() => mountPointStore.loadMountPointsByEventId(eventId, true)"
          />
        </div>
      </section>
    </div>
    
    <!-- Модальное окно редактора события -->
    <EventEditor
      v-model:visible="showEditor"
      :event="eventStore.getEventById(eventId)"
      @close="closeEditor"
      @submit="afterEditSubmit"
    />
    
    <!-- Модальное окно создания точки монтажа -->
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

<!-- 
  EventDetails.vue — ОПТИМИЗИРОВАНО
  Убрана секция Timeline & Progress, исправлена двойная перезагрузка
  Добавлено прямое создание точек монтажа через модальное окно
  Все стили используют Tailwind утилиты для единообразия дизайн-системы
-->