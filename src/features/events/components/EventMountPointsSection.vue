<template>
  <BentoCard size="2x1" variant="default">
    <template #header>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <IconV2 name="map-pin" size="sm" />
            <h3 class="text-base sm:text-lg font-semibold leading-tight">Точки монтажа</h3>
            <StatusBadgeV2 :label="String(stats.total)" variant="info" size="xs" />
          </div>
          <!-- Compact stats for mobile -->
          <div class="flex sm:hidden items-center gap-4 text-xs text-secondary mt-1">
            <span v-if="stats.problems > 0" class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[var(--color-error)] inline-block"></span> 
              Проблемы: {{ stats.problems }}
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[var(--color-success)] inline-block"></span> 
              Готово: {{ stats.ready }}
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[var(--color-warning)] inline-block"></span> 
              В работе: {{ stats.pending }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-sm text-secondary hidden sm:flex items-center gap-4">
            <span v-if="stats.problems > 0" class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[var(--color-error)] inline-block"></span> 
              Проблемы: {{ stats.problems }}
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[var(--color-success)] inline-block"></span> 
              Готово: {{ stats.ready }}
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-[var(--color-warning)] inline-block"></span> 
              В работе: {{ stats.pending }}
            </span>
          </div>
          <ButtonV2 
            class="w-full sm:w-auto touch-manipulation" 
            variant="primary" 
            size="md" 
            @click="handleAddMountPoint"
          >
            <template #icon><IconV2 name="plus" size="sm" /></template>
            Добавить точку монтажа
          </ButtonV2>
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-secondary">
        <SpinnerV2 size="sm" />
        <span>Загрузка точек...</span>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-error">
        <IconV2 name="alert-circle" size="sm" />
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Empty State -->
      <div v-if="mountPoints.length === 0" class="text-center py-10">
        <IconV2 name="map-pin" size="lg" class="text-secondary/50 mb-3" />
        <div class="text-primary font-medium mb-2">Точек монтажа пока нет</div>
        <div class="text-secondary text-sm mb-4">Создайте первую точку для этого мероприятия</div>
        <ButtonV2 variant="primary" size="sm" @click="handleAddMountPoint">
          <template #icon><IconV2 name="plus" size="sm" /></template>
          Добавить точку монтажа
        </ButtonV2>
      </div>

      <!-- Mount Points Grid - Улучшенная адаптивная сетка -->
      <div v-else class="grid gap-4 sm:gap-6" :class="gridClasses">
        <MountPointCardV3
          v-for="mp in mountPoints"
          :key="mp.id"
          :mount-point="mp"
          @click="handleMountPointClick(mp.id)"
          @edit="handleEditMountPoint(mp)"
          @add-duty="handleAddDuty(mp)"
        />
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EventMountPointsSection - секция с точками монтажа мероприятия
 * Включает статистику, сетку карточек, состояния загрузки и ошибок
 */
import { computed } from 'vue'
import { 
  BentoCard, 
  ButtonV2, 
  IconV2, 
  StatusBadgeV2, 
  SpinnerV2 
} from '@/shared/ui-v2'
import MountPointCardV3 from '@/features/mount-points/ui/MountPointCardV3.vue'

const props = defineProps({
  // Данные точек монтажа
  mountPoints: {
    type: Array,
    default: () => []
  },
  
  // Статистика точек монтажа
  stats: {
    type: Object,
    default: () => ({ total: 0, ready: 0, pending: 0 }),
    validator: (value) => {
      return value && 
        typeof value.total === 'number' &&
        typeof value.ready === 'number' &&
        typeof value.pending === 'number'
    }
  },
  
  // Состояния загрузки
  isLoading: {
    type: Boolean,
    default: false
  },
  
  // Ошибки
  error: {
    type: String,
    default: null
  }
})

const emit = defineEmits([
  'add-mount-point',
  'mount-point-click', 
  'edit-mount-point',
  'add-duty'
])

// Адаптивная сетка в зависимости от количества карточек
const gridClasses = computed(() => {
  const count = props.mountPoints.length
  
  // Оптимизация для разного количества карточек
  if (count === 1) {
    return 'grid-cols-1 max-w-md mx-auto' // Одна карточка по центру
  } else if (count === 2) {
    return 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' // Две карточки
  } else if (count <= 6) {
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' // Стандартная сетка
  } else {
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' // Много карточек
  }
})

// Методы обработки событий
const handleAddMountPoint = () => {
  emit('add-mount-point')
}

const handleMountPointClick = (id) => {
  emit('mount-point-click', id)
}

const handleEditMountPoint = (mountPoint) => {
  emit('edit-mount-point', mountPoint)
}

const handleAddDuty = (mountPoint) => {
  emit('add-duty', mountPoint)
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
