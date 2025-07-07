<script setup>
// EventList.vue — теперь использует Pinia store useEventStore для централизованного состояния и CRUD
import { ref, onMounted } from 'vue'
import { useEventStore } from '@/stores/event-store'
import { storeToRefs } from 'pinia'
import Button from '@/components/Button.vue'
import Spinner from '@/components/Spinner.vue'
import UiStateEmpty from '@/components/UiStateEmpty.vue'
import UiStateForbidden from '@/components/UiStateForbidden.vue'
import UiStateOffline from '@/components/UiStateOffline.vue'
import { useRouter } from 'vue-router'
import EventEditor from './EventEditor.vue'

const router = useRouter()
const eventStore = useEventStore()
const { events, loading, error, showArchived } = storeToRefs(eventStore)

// Модалка/состояния для добавления/редактирования/удаления
const showEditor = ref(false)
const editingEvent = ref(null)
const isDeleting = ref(false)
const deleteError = ref(null)

// Загрузка мероприятий при монтировании
onMounted(() => {
  eventStore.loadEvents()
})

function openAdd() {
  editingEvent.value = null
  showEditor.value = true
}
function openEdit(event) {
  editingEvent.value = { ...event }
  showEditor.value = true
}
function closeEditor() {
  showEditor.value = false
  editingEvent.value = null
}
async function afterSubmit() {
  showEditor.value = false
  editingEvent.value = null
  await eventStore.loadEvents()
}
async function openDelete(event) {
  if (!confirm('Архивировать это мероприятие? Все точки монтажа и отчёты сохранятся, мероприятие исчезнет из активных.')) return
  isDeleting.value = true
  deleteError.value = null
  try {
    await eventStore.archiveEventById(event.id)
  } catch (e) {
    deleteError.value = e.message || 'Ошибка архивирования мероприятия'
  } finally {
    isDeleting.value = false
  }
}
async function openRestore(event) {
  if (!confirm('Восстановить это мероприятие из архива?')) return
  isDeleting.value = true
  deleteError.value = null
  try {
    await eventStore.restoreEventById(event.id)
  } catch (e) {
    deleteError.value = e.message || 'Ошибка восстановления мероприятия'
  } finally {
    isDeleting.value = false
  }
}
function goToDetails(event) {
  router.push(`/events/${event.id}`)
}
function getMountPointsCount(event) {
  return event.mount_points_count ?? 0
}
// Для реактивного переключения фильтра
function toggleArchived() {
  eventStore.setShowArchived(!showArchived.value)
}
</script>

<template>
  <div class="events-panel">
    <div class="events-header">
      <div class="events-title">
        <svg class="events-title-icon" width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="4" fill="#ef4444" fill-opacity="0.12"/><rect x="7" y="9" width="10" height="6" rx="2" fill="#ef4444" fill-opacity="0.18"/></svg>
        <span>Мероприятия</span>
      </div>
      <div class="events-actions">
        <button @click="openAdd" class="event-btn primary">
          <svg class="event-btn-icon" width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
          Добавить
        </button>
        <button @click="toggleArchived" class="event-btn secondary">
          <svg v-if="showArchived" class="event-btn-icon" width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>
          <svg v-else class="event-btn-icon" width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#ef4444" stroke-width="2"/></svg>
          {{ showArchived ? 'Активные' : 'Архивные' }}
        </button>
      </div>
    </div>
    <div class="events-divider">
      <svg height="8" width="100%" viewBox="0 0 400 8" fill="none"><line x1="0" y1="4" x2="400" y2="4" stroke="#ef4444" stroke-width="2" stroke-dasharray="8 8" opacity="0.18" /><circle cx="0" cy="4" r="2" fill="#ef4444" opacity="0.3" /><circle cx="400" cy="4" r="2" fill="#ef4444" opacity="0.3" /></svg>
    </div>
    <div v-if="loading" class="events-loading"><div class="events-skeleton" v-for="i in 4" :key="i"></div></div>
    <div v-else-if="error" class="events-error">
      {{ error }}
      <button @click="eventStore.loadEvents" class="event-btn danger">Повторить</button>
    </div>
    <div v-else-if="events.length === 0" class="events-empty">
      <UiStateEmpty text="Нет мероприятий" />
    </div>
    <div v-else class="events-grid">
      <div v-for="event in events" :key="event.id" class="event-card" :class="{ archived: event.is_archived }">
        <div class="event-card-header">
          <svg class="event-card-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="5" fill="#ef4444" fill-opacity="0.10"/><rect x="7" y="9" width="10" height="6" rx="2" fill="#ef4444" fill-opacity="0.18"/></svg>
          <span class="event-card-title">{{ event.name }}</span>
        </div>
        <div class="event-card-info">
          <div><b>Организатор:</b> {{ event.organizer }}</div>
          <div><b>Локация:</b> {{ event.location }}</div>
          <div><b>Даты:</b> {{ event.start_date }}<span v-if="event.end_date"> — {{ event.end_date }}</span></div>
          <div><b>Точек монтажа:</b> {{ getMountPointsCount(event) }}</div>
        </div>
        <div class="event-card-actions">
          <button @click="openEdit(event)" class="event-btn icon" title="Редактировать">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm-2 6h6" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button v-if="!showArchived" @click="openDelete(event)" class="event-btn icon danger" title="Архивировать">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button v-if="showArchived" @click="openRestore(event)" class="event-btn icon secondary" title="Восстановить">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M4 12h16m-8-8v16" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button @click="goToDetails(event)" class="event-btn icon secondary" title="Подробнее">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#64748b" stroke-width="2"/></svg>
          </button>
        </div>
      </div>
    </div>
    <EventEditor
      v-model:visible="showEditor"
      :event="editingEvent"
      :onSubmit="afterSubmit"
      :onClose="closeEditor"
    />
    <div v-if="deleteError" class="events-error">{{ deleteError }}</div>
  </div>
</template>

<style scoped>
/*
  events-panel, events-table, event-btn, event-badge, event-link, events-header, events-title, events-divider, events-actions, events-skeleton — production-UI для страницы мероприятий.
  Чистый CSS, фирменный стиль, glassmorphism, tech/minimal, адаптивность, micro-interactions.
*/
.events-panel {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  background: rgba(255,255,255,0.82);
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  box-shadow: 0 4px 32px 0 rgba(16,16,16,0.08);
  padding: 36px 32px 32px 32px;
  position: relative;
  backdrop-filter: blur(8px);
}
.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.events-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 2rem;
  font-weight: 800;
  color: #1f2937;
  letter-spacing: 0.04em;
}
.events-title-icon {
  display: inline-block;
}
.events-actions {
  display: flex;
  gap: 12px;
}
.events-divider {
  width: 100%;
  margin: 0 0 18px 0;
}
.events-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: rgba(255,255,255,0.98);
  border-radius: 18px;
  box-shadow: 0 2px 12px 0 rgba(16,16,16,0.04);
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  table-layout: fixed;
}
.events-table th, .events-table td {
  padding: 18px 20px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.events-table th {
  background: rgba(243,244,246,0.7);
  font-weight: 700;
  font-size: 16px;
  color: #1f2937;
  letter-spacing: 0.04em;
}
.events-table th:first-child,
.events-table td:first-child {
  max-width: 220px;
  text-overflow: ellipsis;
  overflow: hidden;
}
.events-table tr:last-child td {
  border-bottom: none;
}
.events-table tr:hover {
  background: #fef2f2;
  box-shadow: 0 2px 8px 0 rgba(239,68,68,0.04);
  transition: background 0.2s, box-shadow 0.2s;
}
.events-table tr.archived {
  background: #f3f4f6 !important;
  color: #9ca3af;
}
.event-link {
  color: #2563eb;
  font-weight: 700;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  font-size: 15px;
  transition: color 0.18s;
}
.event-link:hover {
  color: #ef4444;
}
.event-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #9ca3af;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  box-shadow: 0 1px 4px 0 rgba(16,16,16,0.04);
}
.event-actions {
  display: flex;
  gap: 6px;
}
.event-btn {
  height: 38px;
  min-width: 38px;
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
}
.event-btn.primary {
  background: #ef4444;
  color: #fff;
}
.event-btn.primary:hover {
  background: #dc2626;
}
.event-btn.secondary {
  background: #f3f4f6;
  color: #1f2937;
}
.event-btn.secondary:hover {
  background: #e5e7eb;
}
.event-btn.danger {
  background: #fee2e2;
  color: #ef4444;
}
.event-btn.danger:hover {
  background: #fecaca;
}
.event-btn.icon {
  min-width: 38px;
  width: 38px;
  padding: 0;
  justify-content: center;
}
.event-btn-icon {
  display: inline-block;
  vertical-align: middle;
}
.events-loading {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px 0;
}
.events-skeleton {
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  animation: skeleton 1.2s infinite linear;
}
@keyframes skeleton {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
.events-error {
  color: #ef4444;
  text-align: center;
  font-weight: 600;
  margin: 18px 0 0 0;
  font-size: 16px;
}
.events-empty {
  padding: 32px 0;
  text-align: center;
}
.table-scroll-x {
  width: 100%;
  overflow-x: auto;
}
@media (max-width: 900px) {
  .events-table {
    min-width: 600px;
    font-size: 14px;
  }
  .events-panel {
    padding: 18px 6vw 18px 6vw;
  }
}
@media (max-width: 600px) {
  .events-table {
    min-width: 480px;
    font-size: 13px;
  }
  .events-panel {
    padding: 10px 2vw 10px 2vw;
    max-width: 100vw;
    width: 100vw;
    overflow-x: hidden;
    box-sizing: border-box;
  }
  .events-title {
    font-size: 1.2rem;
  }
}
/*
  events-grid, event-card, event-card-header, event-card-info, event-card-actions — production-карточки мероприятий.
  Чистый CSS, фирменный стиль, tech/minimal, micro-interactions, адаптивность.
*/
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  margin-top: 12px;
}
.event-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 12px 0 rgba(16,16,16,0.06);
  border: 1px solid #e5e7eb;
  padding: 28px 24px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  transition: box-shadow 0.18s, transform 0.18s;
  font-size: 16px;
  color: #18181b;
  line-height: 1.6;
}
.event-card:hover {
  box-shadow: 0 6px 24px 0 rgba(239,68,68,0.10);
  transform: translateY(-2px) scale(1.01);
}
.event-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.18rem;
  font-weight: 800;
  color: #18181b;
}
.event-card-title {
  flex: 1;
  color: #18181b;
  text-align: left;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}
.event-card-info {
  font-size: 15px;
  color: #374151;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.5;
}
.event-card-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.event-card.archived {
  background: #f3f4f6;
  /* opacity: 1; */
  position: relative;
}
.event-card.archived::after {
  content: 'АРХИВ';
  position: absolute;
  top: 16px; right: 16px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  padding: 2px 8px;
  opacity: 0.85;
  pointer-events: none;
}
@media (max-width: 700px) {
  .events-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .event-card {
    padding: 16px 8px 12px 8px;
  }
}
</style> 