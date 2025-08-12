<template>
  <div class="rounded-xl border border-secondary/20 bg-white p-4 sm:p-6 md:p-7 hover:shadow-sm transition cursor-pointer min-h-[320px] sm:min-h-[380px] md:min-h-[400px] flex flex-col" @click="$emit('click')">
    <!-- Header: name + status badge -->
    <div class="flex items-start justify-between gap-4 sm:gap-5">
      <div class="min-w-0">
        <div class="flex items-center gap-2 sm:gap-3">
          <IconV2 name="map-pin" size="sm" class="text-primary" />
          <h4 class="text-base sm:text-lg font-semibold text-primary truncate" :title="mountPoint.name || 'Точка без названия'">
            {{ mountPoint.name || 'Точка без названия' }}
          </h4>
        </div>
        <div class="text-xs sm:text-sm text-secondary truncate mt-1" v-if="mountPoint.location">{{ mountPoint.location }}</div>
        <div class="text-xs sm:text-sm text-secondary italic mt-1" v-else>Локация не указана</div>
      </div>
      <div class="flex items-center gap-1.5 sm:gap-2">
        <ButtonV2 variant="minimal" size="sm" @click.stop="$emit('edit', mountPoint)">
          <template #icon><IconV2 name="edit" size="sm" /></template>
          <span class="hidden sm:inline">Редактировать</span>
        </ButtonV2>
        <StatusBadgeV2 :label="progressLabel" :variant="progressVariant" size="sm" />
      </div>
    </div>

    <!-- Meta: Start (row 1) -->
    <div class="mt-4 sm:mt-5 grid grid-cols-[36px_1fr] sm:grid-cols-[40px_1fr] items-start gap-3 sm:gap-4 min-w-0">
      <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <IconV2 name="calendar" size="sm" class="text-primary" />
      </div>
      <div class="text-sm min-w-0">
        <div class="text-secondary">Старт работ</div>
        <div class="text-primary text-base break-words mt-0.5">{{ startDateLabel }}</div>
      </div>
    </div>

    <!-- Meta: Engineers (row 2) -->
    <div class="mt-4 grid grid-cols-[36px_1fr] sm:grid-cols-[40px_1fr] items-start gap-3 sm:gap-4 min-w-0">
      <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <IconV2 name="users" size="sm" class="text-primary" />
      </div>
      <div class="text-sm min-w-0">
        <div class="text-secondary">Инженеры</div>
        <div class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="(name, idx) in engineersNames"
            :key="name + '-' + idx"
            class="px-2 py-1 rounded-full bg-accent text-primary text-xs"
          >{{ name }}</span>
        </div>
      </div>
    </div>

    <!-- Duties: progress + add button -->
    <div class="mt-5 sm:mt-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div class="text-sm text-secondary">Технические задания</div>
        <ButtonV2 variant="primary" size="sm" class="w-full sm:w-auto" @click.stop="$emit('add-duty')">
          <template #icon><IconV2 name="plus" size="sm" /></template>
          Добавить техническое задание
        </ButtonV2>
      </div>
      <div class="w-full h-3 rounded-full bg-accent overflow-hidden">
        <div class="h-3 rounded-full transition-all" :class="progressBarClass" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <!-- Status counters -->
      <div class="mt-3 flex items-center gap-2 sm:gap-3 flex-wrap">
        <StatusBadgeV2 v-if="total" size="sm" :label="`Готово: ${completed}`" variant="success" />
        <StatusBadgeV2 v-if="inProgressCount" size="sm" :label="`В работе: ${inProgressCount}`" variant="warning" />
        <StatusBadgeV2 v-if="problemsCount" size="sm" :label="`Проблемы: ${problemsCount}`" variant="danger" />
        <StatusBadgeV2 v-if="!total" size="sm" label="Нет заданий" variant="secondary" />
      </div>
    </div>

    <!-- Duties list (grouped, read-only) -->
    <div class="mt-5 space-y-5 flex-1">
      <div v-if="problems.length" class="space-y-2">
        <div class="text-xs text-secondary">Проблемы</div>
        <div v-for="d in problems" :key="d.id" class="p-3 rounded-lg border border-secondary/20 bg-accent/40">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 pr-2">
              <div class="text-base text-primary" :title="d.title">{{ d.title }}</div>
              <div v-if="d.description" class="text-sm text-secondary whitespace-pre-wrap mt-1">{{ d.description }}</div>
            </div>
            <StatusBadgeV2 variant="danger" :label="statusLabel(d.status)" size="sm" />
          </div>
        </div>
      </div>
      <div v-if="inprogress.length" class="space-y-2">
        <div class="text-xs text-secondary">В работе</div>
        <div v-for="d in inprogress" :key="d.id" class="p-3 rounded-lg border border-secondary/20 bg-accent/40">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 pr-2">
              <div class="text-base text-primary" :title="d.title">{{ d.title }}</div>
              <div v-if="d.description" class="text-sm text-secondary whitespace-pre-wrap mt-1">{{ d.description }}</div>
            </div>
            <StatusBadgeV2 variant="warning" :label="statusLabel(d.status)" size="sm" />
          </div>
        </div>
      </div>
      <div v-if="done.length" class="space-y-2">
        <div class="text-xs text-secondary">Готово</div>
        <div v-for="d in done" :key="d.id" class="p-3 rounded-lg border border-secondary/20 bg-accent/40">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 pr-2">
              <div class="text-base text-primary" :title="d.title">{{ d.title }}</div>
              <div v-if="d.description" class="text-sm text-secondary whitespace-pre-wrap mt-1">{{ d.description }}</div>
            </div>
            <StatusBadgeV2 variant="success" :label="statusLabel(d.status)" size="sm" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { StatusBadgeV2, IconV2, ButtonV2 } from '@/shared/ui-v2'
import { useUserStore } from '@/app/store/user-store'
import { storeToRefs } from 'pinia'

const props = defineProps({
  mountPoint: { type: Object, required: true }
})

defineEmits(['click', 'add-duty', 'edit'])

const userStore = useUserStore()
const { users } = storeToRefs(userStore)

const duties = computed(() => Array.isArray(props.mountPoint.technical_duties) ? props.mountPoint.technical_duties : [])
const total = computed(() => duties.value.length)
const completed = computed(() => duties.value.filter(d => d.status === 'выполнено').length)
const problemsCount = computed(() => duties.value.filter(d => d.status === 'проблема').length)
const inProgressCount = computed(() => duties.value.filter(d => d.status === 'в работе').length)

const problems = computed(() => duties.value.filter(d => d.status === 'проблема'))
const inprogress = computed(() => duties.value.filter(d => d.status === 'в работе'))
const done = computed(() => duties.value.filter(d => d.status === 'выполнено'))

const progressPercent = computed(() => total.value ? Math.round((completed.value / total.value) * 100) : 0)
const progressVariant = computed(() => {
  if (!total.value) return 'secondary'
  if (completed.value === total.value) return 'success'
  if (problemsCount.value) return 'danger'
  if (inProgressCount.value) return 'warning'
  return 'info'
})
const progressLabel = computed(() => {
  if (!total.value) return 'Нет заданий'
  if (completed.value === total.value) return 'Готово'
  if (problemsCount.value) return 'Проблемы'
  if (inProgressCount.value) return 'В работе'
  return 'Не начато'
})
const progressBarClass = computed(() => {
  switch (progressVariant.value) {
    case 'success': return 'bg-[var(--color-success)]'
    case 'danger': return 'bg-[var(--color-error)]'
    case 'warning': return 'bg-[var(--color-warning)]'
    case 'info': return 'bg-[var(--color-info)]'
    default: return 'bg-secondary/40'
  }
})

const engineersNames = computed(() => {
  const ids = Array.isArray(props.mountPoint.responsible_engineers) ? props.mountPoint.responsible_engineers : []
  return ids
    .map(id => users.value.find(u => u.id === id)?.name || users.value.find(u => u.id === id)?.email)
   .filter(Boolean)
})

function statusLabel(status) {
  if (status === 'выполнено') return 'Готово'
  if (status === 'проблема') return 'Проблема'
  return 'В работе'
}

const startDateLabel = computed(() => {
  const d = props.mountPoint.start_date ? new Date(props.mountPoint.start_date) : null
  return d ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(d) : '—'
})
</script>
