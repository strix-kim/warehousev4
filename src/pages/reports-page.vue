<script setup>
// Страница отчётов: теперь использует Pinia store для централизованного состояния
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '@/stores/report-store'
import { supabase } from '@/shared/api/supabase'
import { v4 as uuidv4 } from 'uuid'
import { storeToRefs } from 'pinia'

const router = useRouter()
const reportStore = useReportStore()
const { reports, loading, error } = storeToRefs(reportStore)

// Загрузка отчётов при монтировании
onMounted(() => {
  reportStore.loadReports()
})

const isSending = ref(false)
const sendError = ref(null)

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

// Создать тестовый отчёт через Pinia store
async function sendTestReport() {
  isSending.value = true
  sendError.value = null
  try {
    // Получить существующий event_id
    const { data: events, error: eventsError } = await supabase.from('events').select('id').limit(1)
    if (eventsError) throw eventsError
    if (!events || !events.length) throw new Error('Нет ни одного мероприятия для теста')
    const testEventId = events[0].id
    const testReport = {
      event_id: testEventId,
      content: {
        event: {
          id: testEventId,
          name: 'Тестовое мероприятие',
          organizer: 'Тестовый организатор',
          start_date: new Date().toISOString().slice(0, 10),
          end_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        },
        mount_points: [
          { id: uuidv4(), name: 'Тестовая точка', equipment_plan: [1,2], equipment_final: [1], equipment_fact: [1,2] }
        ]
      }
    }
    await reportStore.createReport(testReport)
  } catch (e) {
    sendError.value = e.message || 'Ошибка отправки тестового отчёта'
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <!-- Production: светлый SVG-паттерн на фоне, как на других страницах -->
  <div class="min-h-screen" style="background: #f8fafc url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'0\' y=\'0\' width=\'40\' height=\'40\' fill=\'none\'/%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' stroke=\'%23e5e7eb\' stroke-width=\'1\'/%3E%3C/svg%3E'); background-size: 40px 40px; background-repeat: repeat;">
    <div class="max-w-4xl mx-auto p-4">
      <h1 class="text-2xl font-bold mb-8 flex items-center gap-3 text-gray-900">
        <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h8M8 12h8m-8 4h6"/></svg>
        Отчёты по мероприятиям
      </h1>
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="i in 4" :key="i" class="animate-pulse bg-white/60 rounded-2xl p-6 h-32 shadow border border-white/40"></div>
      </div>
      <div v-else-if="error" class="text-red-600 text-center">{{ error }}</div>
      <div v-else>
        <div v-if="reports.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h8M8 12h8m-8 4h6"/></svg>
          <div class="text-lg font-semibold">Нет отчётов</div>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="report in reports" :key="report.id" @click="goToReport(report.id)"
            class="cursor-pointer bg-white/80 hover:bg-white transition rounded-2xl p-6 shadow border border-white/40 flex flex-col gap-2 group">
            <div class="flex items-center gap-3 mb-1">
              <svg class="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h8M8 12h8m-8 4h6"/></svg>
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
  </div>
</template> 