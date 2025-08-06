<script setup>
import { computed } from 'vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'
import { StatusBadgeV2, IconV2 } from '@/shared/ui-v2'

// Данные мероприятия
const props = defineProps({
  event: {
    type: Object,
    required: true
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
</script>

<template>
  <BentoCard :title="event.name" size="1x1" variant="default" class="hover:shadow-lg transition-shadow">
    <template #subtitle>
      <span class="text-secondary text-xs">{{ event.location }}</span>
    </template>

    <div class="flex flex-col gap-3 text-sm">
      <!-- Даты -->
      <div>
        <span class="text-secondary">{{ event.start_date || '—' }} → {{ event.end_date || '—' }}</span>
      </div>

      <!-- Ответственные -->
      <div v-if="Array.isArray(event.responsible_engineers) && event.responsible_engineers.length" class="flex items-center gap-1 text-secondary">
        <IconV2 name="users" size="xs" />
        <span>{{ event.responsible_engineers.length }} инженера</span>
      </div>

      <!-- Статус -->
      <StatusBadgeV2 :variant="statusInfo.variant" :label="statusInfo.label" size="sm" />
    </div>
  </BentoCard>
</template>

<style scoped>
</style>
