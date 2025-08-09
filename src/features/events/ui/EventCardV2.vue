<script setup>
import { computed } from 'vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'
import { StatusBadgeV2, IconV2 } from '@/shared/ui-v2'

// Данные мероприятия
const props = defineProps({
  event: {
    type: Object,
    required: true
  },
  variant: {
    type: String,
    default: 'default'
  },
  interactive: {
    type: Boolean,
    default: true
  }
})

// Определяем статус и вариант бейджа
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

const formatShort = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(d)
}

const engineersCount = computed(() => Array.isArray(props.event.responsible_engineers) ? props.event.responsible_engineers.length : 0)
const mountPointsCount = computed(() => props.event.mount_points_count || 0)
</script>

<template>
  <BentoCard :title="event.name" size="1x1" :variant="variant" :interactive="interactive" class="hover:shadow-lg transition-shadow">
    <template #subtitle>
      <div class="flex items-center gap-2 text-xs text-secondary truncate">
        <IconV2 name="map-pin" size="xs" />
        <span class="truncate">{{ event.location || 'Локация не указана' }}</span>
      </div>
    </template>

    <div class="flex flex-col gap-3 text-sm">
      <!-- Даты мероприятия -->
      <div class="flex items-center gap-2 text-secondary">
        <IconV2 name="calendar" size="xs" />
        <span class="truncate">{{ formatShort(event.start_date) }} → {{ formatShort(event.end_date) }}</span>
      </div>

      <!-- Организатор -->
      <div v-if="event.organizer" class="flex items-center gap-2 text-secondary">
        <IconV2 name="user" size="xs" />
        <span class="truncate">{{ event.organizer }}</span>
      </div>

      <!-- Команда и точки монтажа -->
      <div class="flex items-center gap-4 text-secondary">
        <div class="flex items-center gap-1">
          <IconV2 name="users" size="xs" />
          <span>{{ engineersCount }} инженера</span>
        </div>
        <div class="flex items-center gap-1">
          <IconV2 name="map-pin" size="xs" />
          <span>{{ mountPointsCount }} точек</span>
        </div>
      </div>

      <!-- Монтаж/Демонтаж (кратко) -->
      <div class="flex items-center gap-3 text-xs">
        <div class="flex items-center gap-1 text-info">
          <span class="inline-block w-2 h-2 rounded-full bg-info"></span>
          <span>Монтаж: {{ formatShort(event.setup_date) }}</span>
        </div>
        <div class="flex items-center gap-1 text-warning">
          <span class="inline-block w-2 h-2 rounded-full bg-warning"></span>
          <span>Демонтаж: {{ formatShort(event.teardown_date) }}</span>
        </div>
      </div>

      <!-- Статус -->
      <StatusBadgeV2 :variant="statusInfo.variant" :label="statusInfo.label" size="sm" />
    </div>
  </BentoCard>
</template>

<style scoped>
</style>
