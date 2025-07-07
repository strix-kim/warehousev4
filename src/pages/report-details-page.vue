<script setup>
// Страница деталей отчёта: теперь использует Pinia store для загрузки отчёта по id
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useReportStore } from '@/stores/report-store'
import { supabase } from '@/shared/api/supabase'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'

const route = useRoute()
const reportId = route.params.id
const reportStore = useReportStore()
const { reports, loading, error } = storeToRefs(reportStore)

// Локальные состояния для users и equipment
const equipments = ref([])
const isEquipmentsLoading = ref(true)

// Получить отчёт по id из store (или загрузить, если нет)
const report = computed(() => reports.value.find(r => String(r.id) === String(reportId)))

async function loadEquipmentsForReport(reportData) {
  isEquipmentsLoading.value = true
  try {
    const allIds = new Set()
    if (reportData?.content?.mount_points) {
      reportData.content.mount_points.forEach(mp => {
        ['equipment_plan', 'equipment_final', 'equipment_fact'].forEach(key => {
          if (Array.isArray(mp[key])) {
            mp[key].forEach(id => allIds.add(id))
          }
        })
      })
    }
    const ids = Array.from(allIds)
    if (ids.length === 0) {
      equipments.value = []
      isEquipmentsLoading.value = false
      return
    }
    const { data, error } = await supabase.from('equipments').select('*').in('id', ids)
    if (error) throw error
    equipments.value = data || []
  } catch (e) {
    console.error('Ошибка загрузки оборудования:', e)
  } finally {
    isEquipmentsLoading.value = false
  }
}

const userStore = useUserStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)
function getUserNameById(id) {
  if (!id) return null
  const user = users.value.find(u => String(u.id).trim() === String(id).trim())
  return user ? user.name : id
}

onMounted(async () => {
  // Если отчёта нет в store — загружаем все отчёты (или можно реализовать отдельный action для одного отчёта)
  if (!report.value) {
    await reportStore.loadReports() // Можно заменить на loadReportById, если реализуете action
  }
  if (!users.value.length) await userStore.loadUsers()
  if (report.value) {
    await loadEquipmentsForReport(report.value)
  }
})

function downloadPDF() {
  alert('Функция скачивания PDF будет реализована позже.')
}

const isAllLoaded = computed(() => !loading.value && !isEquipmentsLoading.value && !isUsersLoading.value)
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900 print:bg-white print:text-black">
    <div class="max-w-3xl mx-auto p-6 sm:p-12 bg-white rounded-2xl shadow-lg border border-gray-200 print:shadow-none print:border-none">
      <!-- Официальная шапка отчёта -->
      <div class="mb-8 flex flex-col items-center">
        <div class="text-xs uppercase tracking-widest text-gray-400 mb-2">Официальный отчёт о проведённом мероприятии</div>
        <h1 class="text-2xl font-extrabold mb-2 text-center">{{ report?.content?.event?.name || 'Мероприятие' }}</h1>
        <div class="text-sm text-gray-700 text-center mb-2">Исполнитель — ООО ARGO MEDIA</div>
        <div class="text-base text-gray-700 text-center mb-1">Организатор: <span class="font-medium">{{ report?.content?.event?.organizer || '—' }}</span></div>
        <div class="text-sm text-gray-500 text-center mb-1">Период: {{ report?.content?.event?.start_date || '—' }}<span v-if="report?.content?.event?.end_date"> — {{ report.content.event.end_date }}</span></div>
        <div class="text-xs text-gray-400 text-center mb-1">ID мероприятия: {{ report?.event_id }}</div>
        <div class="text-xs text-gray-400 text-center mb-1">Дата формирования: {{ report?.created_at?.slice(0, 10) }}</div>
        <div class="text-xs text-gray-700 text-center mt-2">
          <span class="font-semibold">Ответственные:</span>
          <span>{{ Array.isArray(report?.content?.event?.responsible_engineers) ? report.content.event.responsible_engineers.map(getUserNameById).join(', ') : '—' }}</span>
        </div>
      </div>
      <div class="border-t border-gray-200 my-8"></div>
      <!-- Секция точек монтажа -->
      <div>
        <h2 class="text-xl font-bold mb-4">Точки монтажа</h2>
        <div v-if="!report?.content?.mount_points || report.content.mount_points.length === 0" class="text-gray-500 mb-8">Нет точек монтажа</div>
        <div v-else class="flex flex-col gap-6">
          <div v-for="(mp, idx) in report.content.mount_points" :key="mp.id" class="border border-gray-200 rounded-xl p-5 bg-gray-50 print:bg-white">
            <div class="flex items-center gap-3 mb-2">
              <div class="text-lg font-semibold">{{ idx + 1 }}. {{ mp.name }}</div>
              <div class="text-xs text-gray-400">ID: {{ mp.id }}</div>
            </div>
            <div class="mb-1">
              <span class="font-semibold text-xs">Обязанности:</span>
              <span class="text-xs">{{ mp.technical_duties?.join(', ') || '—' }}</span>
            </div>
            <div class="mb-1">
              <span class="font-semibold text-xs">Ответственные:</span>
              <span class="text-xs">{{ Array.isArray(mp.responsible_engineers) ? mp.responsible_engineers.map(getUserNameById).join(', ') : '—' }}</span>
            </div>
            <div class="mb-1">
              <span class="font-semibold text-xs">Оборудование (план):</span>
              <span class="text-xs">{{ Array.isArray(mp.equipment_plan) ? mp.equipment_plan.map(getEquipmentNameById).join(', ') : '—' }}</span>
            </div>
            <div class="mb-1">
              <span class="font-semibold text-xs">Финальный список оборудования:</span>
              <span class="text-xs">{{ Array.isArray(mp.equipment_final) ? mp.equipment_final.map(getEquipmentNameById).join(', ') : '—' }}</span>
            </div>
            <div class="mb-1">
              <span class="font-semibold text-xs">Фактический список оборудования:</span>
              <span class="text-xs">{{ Array.isArray(mp.equipment_fact) ? mp.equipment_fact.map(getEquipmentNameById).join(', ') : '—' }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- Место для подписи (опционально) -->
      <div class="mt-16 flex flex-col items-end print:items-start">
        <div class="text-xs text-gray-500 mb-2">Ответственный за отчёт:</div>
        <div class="h-8 border-b border-gray-400 w-64"></div>
      </div>
    </div>
  </div>
</template> 