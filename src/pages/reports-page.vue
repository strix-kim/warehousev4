<script setup>
/**
 * reports-page.vue — современная страница отчётов
 * АДАПТИРОВАНО: приведено к единообразному дизайну с другими страницами
 * Фирменный стиль: фоновый паттерн, breadcrumbs, статистика, фильтры
 * Только просмотр, без CRUD
 * Использует Pinia, Tailwind CSS, feature-sliced архитектуру
 * Все состояния: загрузка, ошибка, пусто
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '@/stores/report-store'
import { storeToRefs } from 'pinia'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'
import Card from '@/shared/ui/molecules/Card.vue'

const router = useRouter()
const reportStore = useReportStore()
const { reports, loading, error } = storeToRefs(reportStore)

// Состояние фильтров
const searchQuery = ref('')
const selectedStatus = ref('all')

// Computed свойства
const filteredReports = computed(() => {
  let filtered = reports.value

  // Фильтр по поиску
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(report => 
      getEventName(report).toLowerCase().includes(query) ||
      getEventDate(report).toLowerCase().includes(query)
    )
  }

  // Фильтр по статусу
  if (selectedStatus.value !== 'all') {
    filtered = filtered.filter(report => {
      const isArchived = report.content?.event?.is_archived
      return selectedStatus.value === 'archived' ? isArchived : !isArchived
    })
  }

  return filtered
})

// Статистика
const statistics = computed(() => {
  const totalReports = reports.value.length
  const activeReports = reports.value.filter(report => !report.content?.event?.is_archived).length
  const archivedReports = reports.value.filter(report => report.content?.event?.is_archived).length
  const thisMonthReports = reports.value.filter(report => {
    const reportDate = new Date(report.created_at)
    const now = new Date()
    return reportDate.getMonth() === now.getMonth() && reportDate.getFullYear() === now.getFullYear()
  }).length
  
  return [
    {
      title: 'Всего отчётов',
      value: totalReports,
      icon: 'FileText',
      color: 'bg-blue-500'
    },
    {
      title: 'Активные',
      value: activeReports,
      icon: 'CheckCircle',
      color: 'bg-green-500'
    },
    {
      title: 'Архивные',
      value: archivedReports,
      icon: 'Archive',
      color: 'bg-orange-500'
    },
    {
      title: 'За месяц',
      value: thisMonthReports,
      icon: 'Calendar',
      color: 'bg-purple-500'
    }
  ]
})

onMounted(() => {
  reportStore.loadReports()
})

// Получить название мероприятия из content
function getEventName(report) {
  return report.content?.event?.name || 'Без названия'
}

function getEventDate(report) {
  return report.content?.event?.start_date || ''
}

function goToReport(reportId) {
  router.push(`/report-details/${reportId}`)
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<template>
  <!--
    Страница отчётов по мероприятиям
    Архитектура: фоновый паттерн + breadcrumbs + заголовок + статистика + фильтры + сетка
    АДАПТИРОВАНО: приведено к единообразному дизайну с другими страницами
  -->
  <div class="min-h-screen bg-gray-50">
    <!-- Фоновый паттерн -->
    <div class="absolute inset-0 w-full h-full pointer-events-none select-none opacity-40 z-0" aria-hidden="true">
      <div style="width:100%;height:100%;background-image:url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'0\' y=\'0\' width=\'40\' height=\'40\' fill=\'none\'/%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' stroke=\'%23e5e7eb\' stroke-width=\'1\'/%3E%3C/svg%3E');background-size:40px 40px;background-repeat:repeat;"></div>
    </div>

    <!-- Основной контейнер -->
    <div class="relative z-10 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4">
      <!-- Breadcrumbs -->
      <nav class="flex items-center mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <li class="inline-flex items-center">
            <button 
              @click="router.push('/')"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="Home" set="lucide" size="sm" />
              Главная
            </button>
          </li>
          <li aria-current="page">
            <div class="inline-flex items-center gap-2">
              <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400" />
              <span class="text-sm font-medium text-gray-500">Отчёты</span>
            </div>
          </li>
        </ol>
      </nav>

      <!-- Заголовок страницы -->
      <div class="mb-8">
        <div class="flex items-center gap-3">
          <Icon name="FileText" set="lucide" size="lg" class="text-purple-600" />
          <h1 class="text-3xl font-bold text-gray-900">Отчёты по мероприятиям</h1>
        </div>
        <p class="mt-2 text-sm text-gray-600">
          Просмотр и анализ отчётов по проведённым мероприятиям
        </p>
      </div>

      <!-- Статистические карточки -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card
          v-for="stat in statistics"
          :key="stat.title"
          class="text-center"
        >
          <div class="flex items-center justify-center">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center h-12 w-12 rounded-md text-white" :class="stat.color">
                <Icon :name="stat.icon" set="lucide" size="md" />
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">{{ stat.title }}</p>
              <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Фильтры и поиск -->
      <div class="mb-8 space-y-4">
        <!-- Фильтры -->
        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Поиск -->
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск по названию мероприятия или дате..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <!-- Фильтр по статусу -->
          <select
            v-model="selectedStatus"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">Все отчёты</option>
            <option value="active">Активные</option>
            <option value="archived">Архивные</option>
          </select>
        </div>
      </div>

      <!-- Состояния -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
        <div v-for="i in 4" :key="i" class="bg-white/90 rounded-2xl p-6 shadow border border-gray-200 flex flex-col gap-2 animate-pulse min-h-[140px]">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-6 h-6 rounded bg-gray-200" />
            <div class="h-5 w-2/3 bg-gray-200 rounded" />
          </div>
          <div class="h-4 w-1/2 bg-gray-100 rounded mb-2" />
          <div class="h-3 w-1/3 bg-gray-100 rounded mb-1" />
          <div class="h-3 w-1/4 bg-gray-100 rounded" />
        </div>
      </div>

      <ErrorState 
        v-else-if="error" 
        :message="error" 
        description="Не удалось загрузить отчёты"
        class="my-12"
      >
        <button
          @click="reportStore.loadReports()"
          class="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Повторить попытку
        </button>
      </ErrorState>

      <EmptyState 
        v-else-if="filteredReports.length === 0" 
        message="Отчёты не найдены"
        description="Попробуйте изменить фильтры или создайте новый отчёт"
        icon="📊"
        class="my-12"
      />

      <!-- Сетка отчётов -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
        <div
          v-for="report in filteredReports"
          :key="report.id"
          @click="goToReport(report.id)"
          class="cursor-pointer bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
          tabindex="0"
          :aria-label="`Отчёт по мероприятию ${getEventName(report)}`"
        >
          <div class="flex items-center gap-3 mb-1">
            <Icon name="FileText" set="lucide" size="md" class="text-purple-400 flex-shrink-0" />
            <span class="font-semibold text-lg text-gray-900 truncate" :title="getEventName(report)">{{ getEventName(report) }}</span>
          </div>
          <div class="text-sm text-gray-500">
            <span v-if="report.content?.event?.start_date">
              Даты: {{ formatDate(report.content.event.start_date) }}<span v-if="report.content.event.end_date"> — {{ formatDate(report.content.event.end_date) }}</span>
            </span>
            <span v-else>Дата не указана</span>
          </div>
          <div class="text-xs text-gray-400 mt-2">
            Создан: {{ formatDate(report.created_at) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>