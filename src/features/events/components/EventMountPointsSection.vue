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

    <!-- 🎯 ПРАВИЛЬНО: Initial Loading State (только при первой загрузке) -->
    <div v-if="initialLoading" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-secondary">
        <SpinnerV2 size="sm" />
        <span>Загрузка точек...</span>
      </div>
    </div>

    <!-- Error State (только если нет данных) -->
    <div v-else-if="error && mountPoints.length === 0" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-error">
        <IconV2 name="alert-circle" size="sm" />
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Content (всегда показывается если есть данные) -->
    <div v-else class="relative">
      <!-- 🔄 Тонкий индикатор обновления (НЕ скрывает контент) -->
      <div 
        v-if="refreshing" 
        class="absolute -top-2 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 rounded-full overflow-hidden z-10"
      >
        <div class="h-full bg-primary/60 rounded-full animate-pulse"></div>
      </div>
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

      <!-- Mount Points Grid - Улучшенная адаптивная сетка с плавными переходами -->
      <TransitionGroup 
        v-if="mountPoints.length > 0"
        name="mount-point-update"
        tag="div" 
        class="grid gap-4 sm:gap-6" 
        :class="gridClasses"
      >
        <MountPointCardV3
          v-for="mp in mountPoints"
          :key="mp.id"
          :mount-point="mp"
          @click="handleMountPointClick(mp.id)"
          @edit="handleEditMountPoint(mp)"
          @add-duty="handleAddDuty(mp)"
          @delete="handleDeleteMountPoint(mp)"
        />
      </TransitionGroup>
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
  
  // 🎯 НОВЫЕ СОСТОЯНИЯ (Best Practices)
  initialLoading: {
    type: Boolean,
    default: false
  },
  
  refreshing: {
    type: Boolean,
    default: false
  },
  
  // Ошибки
  error: {
    type: String,
    default: null
  },
  
  // 🗑️ DEPRECATED: Для обратной совместимости (будет удален)
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'add-mount-point',
  'mount-point-click', 
  'edit-mount-point',
  'add-duty',
  'delete-mount-point'
])

// Адаптивная сетка в зависимости от количества карточек
const gridClasses = computed(() => {
  const count = props.mountPoints.length
  
  // Оптимизация для разного количества карточек
  if (count === 1) {
    return 'grid-cols-1 max-w-3xl mx-auto' // Одна карточка с достаточной шириной
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

const handleDeleteMountPoint = (mountPoint) => {
  emit('delete-mount-point', mountPoint)
}
</script>

<style scoped>
/* 🎨 Плавные переходы для обновления точек монтажа */

/* Обновление существующих карточек (основной переход) */
.mount-point-update-move,
.mount-point-update-enter-active,
.mount-point-update-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 🎨 Новые карточки появляются плавно */
.mount-point-update-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.mount-point-update-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* 🎨 Удаляемые карточки исчезают плавно */
.mount-point-update-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.mount-point-update-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

/* Плавное перемещение при изменении порядка */
.mount-point-update-move {
  transition: transform 0.3s ease;
}

/* 🔧 Предотвращение мерцания при обновлении */
.mount-point-update-leave-active {
  position: absolute;
  z-index: 0;
}

/* 🎨 Дополнительная оптимизация для плавности */
.grid {
  position: relative;
}

/* Сглаживание для webkit browsers */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
