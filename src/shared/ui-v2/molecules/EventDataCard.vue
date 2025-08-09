<template>
  <BentoCard :title="event.name" :variant="variant" :interactive="interactive" size="1x1" class="event-data-card" @click="emit('click')">
    <div class="h-full flex flex-col gap-3">
      <!-- Верхняя строка: статус и иконка -->
      <div class="flex items-center justify-between">
        <StatusBadgeV2 :label="statusInfo.label" :variant="statusInfo.variant" size="sm" />
        <div class="rounded-lg bg-accent/20 p-2">
          <IconV2 name="calendar" size="sm" color="current" />
        </div>
      </div>

      <!-- Основной блок: даты и локация -->
      <div class="space-y-2 text-sm">
        <div class="flex items-center gap-2 opacity-90">
          <IconV2 name="map-pin" size="xs" />
          <span class="truncate">{{ event.location || 'Локация не указана' }}</span>
        </div>
        <div class="flex items-center gap-2 opacity-90">
          <IconV2 name="calendar" size="xs" />
          <span class="truncate">{{ fmt(event.start_date) }} → {{ fmt(event.end_date) }}</span>
        </div>
        <div class="flex items-center gap-4 text-xs opacity-90">
          <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full bg-info"></span> Монтаж: {{ fmt(event.setup_date) }}</span>
          <span class="flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full bg-warning"></span> Демонтаж: {{ fmt(event.teardown_date) }}</span>
        </div>
      </div>

      <!-- Нижняя строка: инженер(ы) и точки -->
      <div class="mt-auto flex items-center justify-between text-xs opacity-90">
        <div class="flex items-center gap-1">
          <IconV2 name="users" size="xs" />
          <span>{{ engineersCount }} инженера</span>
        </div>
        <div class="flex items-center gap-1">
          <IconV2 name="map-pin" size="xs" />
          <span>{{ pointsCount }} точек</span>
        </div>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
import { computed } from 'vue'
import BentoCard from '../layouts/BentoCard.vue'
import StatusBadgeV2 from '../atoms/StatusBadge.vue'
import IconV2 from '../atoms/Icon.vue'

const props = defineProps({
  event: { type: Object, required: true },
  variant: { type: String, default: 'primary' },
  interactive: { type: Boolean, default: true }
})

const emit = defineEmits(['click'])

const statusInfo = computed(() => {
  const e = props.event
  if (e.is_archived) return { label: 'Архив', variant: 'inactive' }
  const now = new Date()
  const start = e.start_date ? new Date(e.start_date) : null
  const end = e.end_date ? new Date(e.end_date) : null
  if (start && end && now >= start && now <= end) return { label: 'Идёт', variant: 'success' }
  if (start && now < start) return { label: 'Запланировано', variant: 'info' }
  if (end && now > end) return { label: 'Завершено', variant: 'inactive' }
  return { label: 'Активно', variant: 'primary' }
})

const engineersCount = computed(() => Array.isArray(props.event.responsible_engineers) ? props.event.responsible_engineers.length : 0)
const pointsCount = computed(() => props.event.mount_points_count || 0)

const fmt = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(d)
}
</script>

<style scoped>
.event-data-card {
  min-height: 160px;
}
</style>


