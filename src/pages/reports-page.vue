<script setup>
/**
 * reports-page.vue — современная страница отчётов
 * Фирменный стиль: градиентный фон, breadcrumbs, крупный заголовок, адаптивная сетка
 * Только просмотр, без CRUD
 * Использует Pinia, Tailwind CSS, feature-sliced архитектуру
 * Все состояния: загрузка, ошибка, пусто
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '@/stores/report-store'
import { storeToRefs } from 'pinia'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

const router = useRouter()
const reportStore = useReportStore()
const { reports, loading, error } = storeToRefs(reportStore)

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
</script>

<template>
  <!-- Градиентный фон на всю страницу -->
  <div class="fixed inset-0 min-h-screen min-w-full bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 -z-10"></div>
  <div class="relative z-10">
    <div class="max-w-7xl mx-auto py-10 px-2 md:px-4 min-h-screen flex flex-col">
      <!-- Breadcrumbs -->
      <nav class="flex mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <li>
            <button
              @click="$router.push('/')"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="ArrowLeft" set="lucide" size="sm" />
              На главную
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
      <!-- Заголовок -->
      <div class="flex items-center gap-3 mb-8">
        <Icon name="FileText" set="lucide" size="lg" class="text-purple-600" />
        <h1 class="text-3xl font-bold text-gray-900">Отчёты по мероприятиям</h1>
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
      <ErrorState v-else-if="error" :message="error" @retry="reportStore.loadReports()" />
      <EmptyState v-else-if="reports.length === 0" message="Нет отчётов" description="Отчёты по мероприятиям ещё не созданы." />
      <!-- Сетка отчётов -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
        <div
          v-for="report in reports"
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
              Даты: {{ report.content.event.start_date }}<span v-if="report.content.event.end_date"> — {{ report.content.event.end_date }}</span>
            </span>
          </div>
          <div class="text-xs text-gray-400">ID мероприятия: {{ report.event_id }}</div>
          <div class="text-xs text-gray-400">Создан: {{ report.created_at?.slice(0, 10) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>