<script setup>
// EventDetails.vue — теперь использует Pinia store useEventStore для загрузки мероприятия по id
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '@/stores/event-store'
import { storeToRefs } from 'pinia'
import Spinner from '@/components/Spinner.vue'
import { useUserStore } from '@/stores/user-store'
import { fetchMountPoints, deleteMountPoint } from '@/features/mount-point/mountPointApi'
import { addReport } from '@/features/report/reportApi'
import EventEditor from './EventEditor.vue'
import MountPointSkeleton from './MountPointSkeleton.vue'

const route = useRoute()
const router = useRouter()
const eventId = route.params.id
const eventStore = useEventStore()
const { loading: isLoading, error: hasError } = storeToRefs(eventStore)
const event = ref(null)
const userStore = useUserStore()
const { users, isLoading: isUsersLoading } = storeToRefs(userStore)
const mountPoints = ref([])
const isMountPointsLoading = ref(true)
const mountPointsError = ref(null)
const isReportLoading = ref(false)
const reportError = ref(null)
// Состояние для модального редактора
const showEditor = ref(false)
// ref для скролла к карточкам точек монтажа
const mountPointsRef = ref(null)

const responsibleNames = computed(() => {
  if (!event.value || !Array.isArray(event.value.responsible_engineers)) return []
  return event.value.responsible_engineers
    .map(id => users.value.find(u => u.id === id)?.name)
    .filter(Boolean)
})

const isOngoing = computed(() => {
  if (!event.value) return false
  const now = new Date()
  const start = event.value.start_date ? new Date(event.value.start_date) : null
  const end = event.value.end_date ? new Date(event.value.end_date) : null
  return start && end && now >= start && now <= end
})

function formatHumanDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }).format(date)
}

function onAddMountPoint() {
  router.push(`/events/${eventId}/mount-point/create`)
}

function goToMountPoint(id) {
  router.push(`/mount-point/${id}`)
}

function getEngineerNames(ids) {
  if (!Array.isArray(users.value) || users.value.length === 0) return []
  return (ids || []).map(id => users.value.find(u => u.id === id)?.name).filter(Boolean)
}

function getInitials(name) {
  if (!name) return ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
}

// Функция формирования и сохранения отчёта, удаления мероприятия
async function handleDeleteAndReport() {
  isReportLoading.value = true
  reportError.value = null
  try {
    // Получить все точки монтажа мероприятия
    const { data: mountPoints, error: mpErr } = await fetchMountPoints(eventId)
    if (mpErr) throw mpErr
    // Сформировать объект отчёта
    const reportData = {
      event: { ...event.value },
      mount_points: mountPoints
    }
    // Сохранить отчёт через сервис addReport (гарантирует сериализацию jsonb)
    const { data: reportInsertData, error: repErr } = await addReport({
      event_id: eventId,
      content: reportData
    })
    if (repErr) throw repErr
    if (!reportInsertData || !reportInsertData.length) throw new Error('Отчёт не был создан!')
    // Архивировать мероприятие через store
    await eventStore.archiveEventById(eventId)
    // Перенаправить на страницу отчётов
    router.push('/reports')
  } catch (e) {
    reportError.value = e.message || 'Ошибка формирования отчёта или удаления мероприятия'
  } finally {
    isReportLoading.value = false
  }
}

function openEdit() {
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
}

async function afterEditSubmit() {
  showEditor.value = false
  // Перезагрузить данные мероприятия после редактирования
  event.value = await eventStore.fetchEvent(eventId)
}

function isToday(dateStr) {
  if (!dateStr) return false
  const today = new Date()
  const date = new Date(dateStr)
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
}

function scrollToMountPoints() {
  if (mountPointsRef.value) {
    mountPointsRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(async () => {
  // Загружаем пользователей, если store пуст
  if (!users.value.length) await userStore.loadUsers()
  isLoading.value = true
  hasError.value = null
  event.value = await eventStore.fetchEvent(eventId)
  if (!event.value) {
    hasError.value = 'Ошибка загрузки мероприятия'
  } else {
    // Загружаем точки монтажа
    isMountPointsLoading.value = true
    const { data: mpData, error: mpError } = await fetchMountPoints(eventId)
    if (mpError) {
      mountPointsError.value = mpError.message || 'Ошибка загрузки точек монтажа'
    } else {
      mountPoints.value = mpData
    }
    isMountPointsLoading.value = false
  }
  isLoading.value = false
})
</script>

<template>
  <div class="event-details-bg min-h-screen pt-12 sm:pt-20">
    <div class="event-details-container max-w-3xl mx-auto bg-white rounded-2xl shadow p-10 sm:p-16">
      <!-- Шапка мероприятия -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-12 mb-14">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-5 mb-5">
            <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 truncate" :title="event?.name">{{ event?.name }}</h1>
            <span v-if="event?.is_archived" class="px-4 py-1 rounded bg-gray-400 text-white text-sm font-bold">АРХИВ</span>
            <span v-else-if="isOngoing" class="px-4 py-1 rounded bg-green-500 text-white text-sm font-bold">ИДЁТ СЕЙЧАС</span>
            <span v-else class="px-4 py-1 rounded bg-gray-200 text-gray-900 text-sm font-bold">АКТИВНО</span>
          </div>
          <div class="flex flex-wrap gap-x-12 gap-y-3 text-gray-700 text-base mb-3">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/><path d="M4.22 19.78a10 10 0 0115.56 0"/></svg>
              <span>Организатор: <span class="font-medium">{{ event?.organizer || '—' }}</span></span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2C7.03 2 3 6.03 3 11c0 5.25 7.5 11 8.1 11.45.18.13.42.13.6 0C13.5 22 21 16.25 21 11c0-4.97-4.03-9-9-9zm0 16.88C9.09 16.13 5 12.36 5 11c0-3.86 3.14-7 7-7s7 3.14 7 7c0 1.36-4.09 5.13-7 7.88z"/></svg>
              <span>Место: <span class="font-medium">{{ event?.location || '—' }}</span></span>
            </div>
          </div>
          <div class="flex flex-wrap gap-x-12 gap-y-3 text-gray-700 text-base mb-3">
            <div v-if="event?.mount_start_date" class="flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M16.862 2.487a2.25 2.25 0 013.182 3.182l-1.06 1.06a2.25 2.25 0 01-3.182-3.182l1.06-1.06z"/><path d="M19.5 6.75L17.25 9"/><path d="M2.25 21.75l6.72-1.68a2.25 2.25 0 001.26-.72l7.5-7.5a2.25 2.25 0 00-3.182-3.182l-7.5 7.5a2.25 2.25 0 00-.72 1.26L2.25 21.75z"/></svg>
              <span>Монтаж: <span class="font-medium">{{ formatHumanDate(event.mount_start_date) }}</span></span>
            </div>
            <div v-if="event?.start_date" class="flex items-center gap-2">
              <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M10 8l6 4-6 4V8z" fill="currentColor"/></svg>
              <span>Начало: <span class="font-medium">{{ formatHumanDate(event.start_date) }}</span></span>
            </div>
            <div v-if="event?.end_date" class="flex items-center gap-2">
              <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M8 8l6 4-6 4V8z" fill="currentColor"/></svg>
              <span>Окончание: <span class="font-medium">{{ formatHumanDate(event.end_date) }}</span></span>
            </div>
            <div v-if="event?.mount_end_date" class="flex items-center gap-2">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M9 9h6v6H9z" fill="currentColor"/></svg>
              <span>Демонтаж: <span class="font-medium">{{ formatHumanDate(event.mount_end_date) }}</span></span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4 sm:items-end min-w-[180px]">
          <button @click="openEdit" class="event-hero-btn secondary w-full sm:w-auto flex items-center justify-center gap-2" aria-label="Редактировать мероприятие">
            <!-- Иконка карандаша (Heroicons PencilSquare) -->
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-1.06 1.06-3.182-3.182 1.06-1.06z"/><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 6.75l6 6m-6-6L4.5 13.5V19.5h6l6-6-6-6z"/></svg>
            Редактировать
          </button>
          <button @click="scrollToMountPoints" class="event-hero-btn secondary w-full sm:w-auto flex items-center justify-center gap-2" aria-label="Прокрутить к точкам монтажа">
            <!-- Иконка монтажных точек (Heroicons MapPin) -->
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z"/><circle cx="12" cy="13" r="3"/></svg>
            К точкам монтажа
          </button>
        </div>
      </div>
      <!-- Блок ответственных инженеров (вынесен отдельно для лучшей структуры и читаемости) -->
      <div v-if="responsibleNames.length" class="bg-gray-50 rounded-xl shadow p-8 mb-10">
        <div class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2a4 4 0 100 8 4 4 0 000-8zM2 16a8 8 0 1116 0v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z" clip-rule="evenodd"/></svg>
          Ответственные инженеры
        </div>
        <div class="flex flex-wrap gap-4">
          <span v-for="name in responsibleNames" :key="name"
            class="font-medium bg-gray-200 border border-gray-300 text-gray-900 rounded px-4 py-1 flex items-center gap-2 shadow-sm"
            >
            <!--
              bg-gray-200 — более контрастный фон для читаемости на светлом bg-gray-50;
              border border-gray-300 — тонкая рамка для отделения карточки;
              text-gray-900 — тёмный текст для максимальной читаемости;
              shadow-sm — лёгкая тень для отделения от секции.
            -->
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2a4 4 0 100 8 4 4 0 000-8zM2 16a8 8 0 1116 0v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z" clip-rule="evenodd"/></svg>
            {{ name }}
          </span>
        </div>
      </div>
      <!-- Секции -->
      <div class="mb-14">
        <div class="bg-gray-50 rounded-xl shadow p-8 mb-10">
          <div class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M8 6h8M8 10h8m-8 4h6"/></svg>
            Описание
          </div>
          <div class="text-gray-800 text-base">{{ event?.description || '—' }}</div>
        </div>
        <div class="bg-gray-50 rounded-xl shadow p-8 mb-10">
          <div class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 6h16M4 10h16m-7 4h7"/></svg>
            Техническое задание
          </div>
          <div class="text-gray-800 text-base">{{ event?.technical_task || '—' }}</div>
        </div>
      </div>
      <!-- Карточки точек монтажа (production-grid) -->
      <div ref="mountPointsRef" class="event-mountpoints-grid mb-10">
        <!-- Карточка для добавления новой точки монтажа -->
        <div class="event-mountpoint-card add cursor-pointer" @click="onAddMountPoint">
          <span class="event-mountpoint-add-icon">+</span>
          <span class="event-mountpoint-add-label">Добавить точку</span>
        </div>
        <!-- Скелетон при загрузке -->
        <MountPointSkeleton v-if="isMountPointsLoading" v-for="i in 2" :key="'skeleton-'+i" />
        <!-- Карточки точек монтажа -->
        <div v-else-if="mountPoints.length" v-for="mp in mountPoints" :key="mp.id" class="event-mountpoint-card cursor-pointer" @click="goToMountPoint(mp.id)">
          <div class="event-mountpoint-header">
            <span class="event-mountpoint-title">{{ mp.name }}</span>
            <span v-if="mp.status" class="event-mountpoint-badge">{{ mp.status }}</span>
          </div>
          <div v-if="mp.engineers && mp.engineers.length" class="event-mountpoint-engineers mt-2">
            <span v-for="eid in mp.engineers" :key="eid" class="event-mountpoint-user">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2a4 4 0 100 8 4 4 0 000-8zM2 16a8 8 0 1116 0v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z" clip-rule="evenodd"/></svg>
              {{ getEngineerNames([eid])[0] || '—' }}
            </span>
          </div>
        </div>
        <!-- Пустое состояние -->
        <div v-else-if="!isMountPointsLoading && !mountPoints.length" class="event-mountpoints-empty">
          Нет точек монтажа для этого мероприятия
        </div>
      </div>
      <!-- Кнопка "Отчёт/Архив" теперь в самом низу, визуально отделена -->
      <div class="flex justify-center mt-16 mb-2">
        <button
          @click="handleDeleteAndReport"
          :disabled="isReportLoading"
          class="event-hero-btn danger px-8 py-3 text-base rounded-lg shadow-md opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          aria-label="Удалить мероприятие и сформировать отчёт"
        >
          <span v-if="!isReportLoading">Отчёт/Архив</span>
          <span v-else>Формирование...</span>
        </button>
      </div>
      <!-- Модальное окно редактора мероприятия (управление через v-model:visible) -->
      <EventEditor
        v-model:visible="showEditor"
        :event="event"
        @close="closeEditor"
        @submit="afterEditSubmit"
      />
    </div>
  </div>
</template>

<style scoped>
/* Production-ready стили для hero, divider, секций, мини-аватаров, CTA */
.event-details-bg {
  min-height: 100vh;
  background: #f8fafc url('data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Crect x="0" y="0" width="40" height="40" fill="none"/%3E%3Cpath d="M 40 0 L 0 0 0 40" stroke="%23e5e7eb" stroke-width="1"/%3E%3C/svg%3E');
  background-size: 40px 40px;
  background-repeat: repeat;
  padding: 0;
}
.event-details-container {
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  padding: 40px 18px 32px 18px;
  background: rgba(255,255,255,0.98);
  border-radius: 24px;
  box-shadow: 0 4px 32px 0 rgba(16,16,16,0.08);
  position: relative;
}
.event-hero {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 18px;
}
.event-hero-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px 0 rgba(239,68,68,0.06);
}
.event-hero-main {
  flex: 1 1 auto;
  min-width: 0;
}
.event-hero-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #18181b;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.event-hero-badge {
  display: inline-block;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  margin-left: 4px;
  letter-spacing: 0.03em;
}
.event-hero-badge.archived {
  background: #9ca3af;
  color: #fff;
}
.event-hero-badge.ongoing {
  background: #22c55e;
  color: #fff;
}
.event-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  font-size: 15px;
  color: #374151;
  align-items: center;
}
.event-hero-meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.event-hero-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f3f4f6;
  color: #ef4444;
  font-weight: 700;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
  box-shadow: 0 1px 4px 0 rgba(16,16,16,0.04);
}
.event-hero-meta-label {
  font-weight: 500;
  color: #18181b;
}
.event-hero-status {
  display: inline-block;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  background: #f3f4f6;
  color: #18181b;
}
.event-hero-status.archived {
  background: #9ca3af;
  color: #fff;
}
.event-hero-status.ongoing {
  background: #22c55e;
  color: #fff;
}
.event-hero-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-left: 18px;
}
.event-hero-btn {
  min-width: 180px;
  height: 44px;
  border-radius: 8px;
  font-size: 15px;
  font-family: 'JetBrains Mono', monospace;
  background: #ef4444;
  color: #fff;
  border: none;
  transition: background 0.18s;
  cursor: pointer;
  padding: 0 18px;
  font-weight: 600;
  box-shadow: 0 1px 4px 0 rgba(16,16,16,0.04);
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: normal;
  text-align: center;
  justify-content: center;
}
.event-hero-btn.secondary {
  background: #f3f4f6;
  color: #1f2937;
}
.event-hero-btn.secondary:hover {
  background: #e5e7eb;
}
.event-hero-btn.danger {
  background: #ef4444;
  color: #fff;
}
.event-hero-btn.danger:hover {
  background: #dc2626;
}
.event-divider {
  width: 100%;
  height: 1.5px;
  background: #f3f4f6;
  margin: 28px 0 18px 0;
  border-radius: 2px;
}
.event-section {
  margin-bottom: 18px;
}
.event-section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #18181b;
  margin-bottom: 6px;
}
.event-section-content {
  font-size: 15px;
  color: #374151;
  background: #fafbfc;
  border-radius: 8px;
  padding: 12px 16px;
  min-height: 36px;
}
.event-section-engineers {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.event-engineer-user {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  color: #18181b;
  background: #f3f4f6;
  border-radius: 6px;
  padding: 4px 10px 4px 6px;
  font-weight: 500;
}
.event-engineer-user svg {
  width: 20px;
  height: 20px;
  color: #ef4444;
  flex-shrink: 0;
}
.event-details-loading, .event-details-error, .event-details-empty {
  text-align: center;
  padding: 48px 0;
  color: #ef4444;
  font-size: 18px;
}
.event-mountpoints-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
  margin-top: 10px;
}
.event-mountpoint-card {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px 0 rgba(16,16,16,0.06);
  border: 1px solid #e5e7eb;
  padding: 18px 16px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  font-size: 15px;
  color: #18181b;
  line-height: 1.5;
  cursor: pointer;
  transition: box-shadow 0.18s, transform 0.18s;
}
.event-mountpoint-card:hover {
  box-shadow: 0 6px 24px 0 rgba(239,68,68,0.10);
  transform: translateY(-2px) scale(1.01);
}
.event-mountpoint-card.add {
  background: #f3f4f6;
  color: #ef4444;
  border: 2px dashed #ef4444;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  min-height: 90px;
  gap: 4px;
}
.event-mountpoint-add-icon {
  font-size: 2rem;
  font-weight: 900;
  margin-bottom: 2px;
}
.event-mountpoint-add-label {
  font-size: 1rem;
  font-weight: 600;
}
.event-mountpoint-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.08rem;
  font-weight: 700;
  color: #18181b;
}
.event-mountpoint-title {
  flex: 1;
  color: #18181b;
  text-align: left;
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.event-mountpoint-badge {
  background: #9ca3af;
  color: #fff;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  margin-left: 4px;
  opacity: 0.85;
  pointer-events: none;
}
.event-mountpoint-engineers {
  display: flex;
  align-items: center;
  gap: 10px;
}
.event-mountpoint-user {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #18181b;
  background: #f3f4f6;
  border-radius: 6px;
  padding: 2px 8px 2px 4px;
  font-weight: 500;
}
.event-mountpoint-user svg {
  width: 16px;
  height: 16px;
  color: #ef4444;
  flex-shrink: 0;
}
.event-mountpoints-empty {
  grid-column: 1/-1;
  text-align: center;
  color: #9ca3af;
  font-size: 15px;
  padding: 18px 0;
}
.event-mountpoints-loading {
  text-align: center;
  padding: 32px 0;
}
@media (max-width: 700px) {
  .event-details-container {
    padding: 16px 2vw 16px 2vw;
  }
  .event-hero {
    flex-direction: column;
    gap: 12px;
  }
  .event-hero-actions {
    flex-direction: row;
    gap: 10px;
    margin-left: 0;
    margin-top: 10px;
  }
  .event-hero-btn {
    width: 100%;
    min-width: 0;
  }
  .event-mountpoints-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .event-mountpoint-card {
    padding: 12px 6px 10px 6px;
  }
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>