<template>
  <div 
    class="group rounded-xl border bg-white hover:shadow-md transition-all duration-200 overflow-hidden relative flex flex-col"
    :class="[
      cardBorderClass,
      cardAnimationClass,
      'min-h-[200px]' // Сбалансированная минимальная высота
    ]"
  >
    <!-- 🚨 КРИТИЧЕСКИЙ ALERT BAR (если есть проблемы) -->
    <div 
      v-if="hasProblems" 
      class="bg-[var(--color-error)] text-white px-4 py-2 text-sm font-medium flex items-center gap-2"
    >
      <IconV2 name="alert-triangle" size="sm" />
      <span>{{ problemsCount }} {{ problemsCount === 1 ? 'проблема требует' : 'проблем требуют' }} внимания</span>
      <div class="ml-auto">
        <IconV2 name="chevron-right" size="sm" />
      </div>
    </div>

    <div class="p-4 flex-1 flex flex-col">
      <!-- 📍 ИДЕНТИФИКАЦИЯ: Название + Локация -->
      <div class="mb-4">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="min-w-0 flex-1">
            <h4 
              class="text-lg font-semibold text-primary truncate mb-1" 
              :title="mountPoint.name || 'Точка без названия'"
            >
              {{ mountPoint.name || 'Точка без названия' }}
            </h4>
            <div class="flex items-center gap-2 text-sm text-secondary">
              <IconV2 name="map-pin" size="xs" />
              <span class="truncate">{{ mountPoint.location || 'Локация не указана' }}</span>
            </div>
          </div>
          
          <!-- Dropdown меню действий -->
          <div class="flex items-center gap-2 shrink-0">
            <StatusBadgeV2 :label="progressLabel" :variant="progressVariant" size="sm" />
            <ButtonV2 
              variant="minimal" 
              size="sm" 
              @click.stop="toggleActions"
              class="opacity-70 hover:opacity-100 transition-opacity"
            >
              <IconV2 name="more-vertical" size="sm" />
            </ButtonV2>
          </div>
        </div>

        <!-- 🎯 ИСПРАВЛЕНО: Smart responsive dropdown без overflow -->
        <div v-if="showActions" class="absolute right-0 top-16 bg-white border border-secondary/20 rounded-lg shadow-lg z-10 py-2 w-44 max-w-[calc(100vw-2rem)]">
          <button 
            @click.stop="handleGoToPoint"
            class="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 font-medium text-primary"
          >
            <IconV2 name="external-link" size="xs" />
            Перейти к точке
          </button>
          <div class="border-t border-secondary/10 my-1"></div>
          <button 
            @click.stop="handleEdit"
            class="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
          >
            <IconV2 name="edit" size="xs" />
            Редактировать
          </button>
          <button 
            @click.stop="handleAddDuty"
            class="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
          >
            <IconV2 name="plus" size="xs" />
            Добавить задание
          </button>
          <div class="border-t border-secondary/10 my-1"></div>
          <button 
            @click.stop="handleDelete"
            class="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors"
          >
            <IconV2 name="trash-2" size="xs" />
            Удалить точку монтажа
          </button>
        </div>
      </div>

      <!-- 📊 СТАТУС И ПРОГРЕСС -->
      <div class="mb-4">
        <!-- Прогресс-бар -->
        <div class="w-full h-2 rounded-full bg-accent overflow-hidden mb-3">
          <div 
            class="h-2 rounded-full transition-all duration-300" 
            :class="progressBarClass" 
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        
        <!-- Компактная статистика -->
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center gap-4">
            <span class="text-secondary">{{ progressPercent }}% готово</span>
            <span v-if="total" class="text-secondary">{{ completed }}/{{ total }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="hasProblems" class="text-[var(--color-error)] font-medium">
              {{ problemsCount }} проблем
            </span>
            <span v-else-if="inProgressCount" class="text-[var(--color-warning)]">
              {{ inProgressCount }} в работе
            </span>
            <span v-else-if="completed === total && total > 0" class="text-[var(--color-success)]">
              Завершено
            </span>
          </div>
        </div>
      </div>

      <!-- 📅 ДАТА СТАРТА -->
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-3">
          <IconV2 name="calendar" size="xs" class="text-secondary" />
          <div class="text-secondary text-xs">Старт работ</div>
          <div class="text-primary font-medium text-sm">{{ startDateLabel }}</div>
        </div>
      </div>

      <!-- 👥 КОМАНДА ИНЖЕНЕРОВ -->
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-3">
          <IconV2 name="users" size="xs" class="text-secondary" />
          <span class="text-secondary text-xs">Ответственные инженеры</span>
          <span v-if="engineersNames.length" class="text-primary font-medium text-xs">({{ engineersNames.length }})</span>
        </div>
        
        <!-- Список инженеров с аватарами -->
        <div v-if="engineersNames.length" class="flex flex-wrap gap-2">
          <div 
            v-for="(name, idx) in engineersNames" 
            :key="name + '-' + idx"
            class="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent border border-secondary/20"
          >
            <!-- Аватар с инициалами -->
            <div class="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-xs">
              {{ getInitials(name) }}
            </div>
            <span class="text-primary text-sm font-medium">{{ name }}</span>
          </div>
        </div>
        
        <!-- Пустое состояние команды -->
        <div v-else class="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50 border border-secondary/20">
          <IconV2 name="alert-circle" size="xs" class="text-secondary" />
          <span class="text-secondary text-sm">Инженеры не назначены</span>
        </div>
      </div>

      <!-- 📋 ТЕХНИЧЕСКИЕ ЗАДАНИЯ (всегда видны) -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <IconV2 name="list" size="xs" class="text-secondary" />
            <span class="text-secondary text-xs">Технические задания</span>
            <span v-if="total" class="text-primary font-medium text-xs">({{ total }})</span>
          </div>
          <ButtonV2 
            variant="minimal" 
            size="sm" 
            @click.stop="handleAddDuty"
            class="opacity-70 hover:opacity-100"
          >
            <IconV2 name="plus" size="xs" />
          </ButtonV2>
        </div>

        <!-- Список заданий (всегда показан) -->
        <div v-if="total > 0" class="space-y-2">
          <!-- Проблемы (всегда развернуты) -->
          <div v-for="task in problems" :key="task.id" class="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-primary" :title="task.title">
                  {{ task.title }}
                </div>
              </div>
              <StatusBadgeV2 variant="error" label="Проблема" size="xs" />
            </div>
            <!-- Детали задания (сворачиваемые) -->
            <div v-if="task.description">
              <button 
                @click.stop="toggleTaskDetails(task.id)"
                class="text-xs text-secondary hover:text-primary flex items-center gap-1 mb-2"
              >
                <IconV2 
                  name="chevron-down" 
                  size="xs" 
                  :class="{ 'rotate-180': expandedTasks[task.id] }"
                  class="transition-transform"
                />
                Детали
              </button>
              <div v-if="expandedTasks[task.id]" class="text-xs text-secondary whitespace-pre-wrap">
                {{ task.description }}
              </div>
            </div>
          </div>
          
          <!-- В работе -->
          <div v-for="task in inprogress" :key="task.id" class="p-3 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-primary" :title="task.title">
                  {{ task.title }}
                </div>
              </div>
              <StatusBadgeV2 variant="warning" label="В работе" size="xs" />
            </div>
            <!-- Детали задания (сворачиваемые) -->
            <div v-if="task.description">
              <button 
                @click.stop="toggleTaskDetails(task.id)"
                class="text-xs text-secondary hover:text-primary flex items-center gap-1 mb-2"
              >
                <IconV2 
                  name="chevron-down" 
                  size="xs" 
                  :class="{ 'rotate-180': expandedTasks[task.id] }"
                  class="transition-transform"
                />
                Детали
              </button>
              <div v-if="expandedTasks[task.id]" class="text-xs text-secondary whitespace-pre-wrap">
                {{ task.description }}
              </div>
            </div>
          </div>
          
          <!-- Готово (с возможностью просмотра деталей) -->
          <div v-for="task in done" :key="task.id" class="p-3 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-primary" :title="task.title">
                  {{ task.title }}
                </div>
              </div>
              <StatusBadgeV2 variant="success" label="Готово" size="xs" />
            </div>
            <!-- Детали задания (сворачиваемые) -->
            <div v-if="task.description">
              <button 
                @click.stop="toggleTaskDetails(task.id)"
                class="text-xs text-secondary hover:text-primary flex items-center gap-1 mb-2"
              >
                <IconV2 
                  name="chevron-down" 
                  size="xs" 
                  :class="{ 'rotate-180': expandedTasks[task.id] }"
                  class="transition-transform"
                />
                Детали
              </button>
              <div v-if="expandedTasks[task.id]" class="text-xs text-secondary whitespace-pre-wrap">
                {{ task.description }}
              </div>
            </div>
          </div>
        </div>

        <!-- Пустое состояние -->
        <div v-else class="text-center py-4">
          <IconV2 name="list" size="sm" class="text-secondary/50 mb-2" />
          <div class="text-sm text-secondary mb-3">Нет технических заданий</div>
          <ButtonV2 
            variant="primary" 
            size="sm" 
            @click.stop="handleAddDuty"
            class="w-full"
          >
            <template #icon><IconV2 name="plus" size="xs" /></template>
            Добавить задание
          </ButtonV2>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * MountPointCardV3 - улучшенная карточка точки монтажа
 * 
 * ПРИНЦИПЫ ИНФОРМАЦИОННОЙ АРХИТЕКТУРЫ:
 * 1. Приоритизация: Проблемы → Статус → Метаданные → Детали
 * 2. Прогрессивное раскрытие: Компактный → Развернутый режим
 * 3. Визуальная иерархия: Размер, цвет, позиция отражают важность
 * 4. Адаптивность: Оптимизация для разных размеров экрана
 */
import { computed, ref } from 'vue'
import { StatusBadgeV2, IconV2, ButtonV2 } from '@/shared/ui-v2'
import { useUserStore } from '@/app/store/user-store'
import { storeToRefs } from 'pinia'

const props = defineProps({
  mountPoint: { 
    type: Object, 
    required: true 
  }
})

const emit = defineEmits(['click', 'add-duty', 'edit', 'delete'])

// Состояния UI
const showActions = ref(false)
const expandedTasks = ref({})

// Store
const userStore = useUserStore()
const { users } = storeToRefs(userStore)

// Вычисляемые свойства для заданий
const duties = computed(() => Array.isArray(props.mountPoint.technical_duties) ? props.mountPoint.technical_duties : [])
const total = computed(() => duties.value.length)
const completed = computed(() => duties.value.filter(d => d.status === 'выполнено').length)
const problemsCount = computed(() => duties.value.filter(d => d.status === 'проблема').length)
const inProgressCount = computed(() => duties.value.filter(d => d.status === 'в работе').length)

// Группировка заданий
const problems = computed(() => duties.value.filter(d => d.status === 'проблема'))
const inprogress = computed(() => duties.value.filter(d => d.status === 'в работе'))
const done = computed(() => duties.value.filter(d => d.status === 'выполнено'))

// Критические состояния
const hasProblems = computed(() => problemsCount.value > 0)

// Прогресс и статус
const progressPercent = computed(() => total.value ? Math.round((completed.value / total.value) * 100) : 0)

const progressVariant = computed(() => {
  if (!total.value) return 'secondary'
  if (hasProblems.value) return 'error'
  if (completed.value === total.value) return 'success'
  if (inProgressCount.value) return 'warning'
  return 'info'
})

const progressLabel = computed(() => {
  if (!total.value) return 'Нет заданий'
  if (hasProblems.value) return 'Проблемы'
  if (completed.value === total.value) return 'Готово'
  if (inProgressCount.value) return 'В работе'
  return 'Не начато'
})

const progressBarClass = computed(() => {
  switch (progressVariant.value) {
    case 'success': return 'bg-[var(--color-success)]'
    case 'error': return 'bg-[var(--color-error)]'
    case 'warning': return 'bg-[var(--color-warning)]'
    case 'info': return 'bg-[var(--color-info)]'
    default: return 'bg-secondary/40'
  }
})

// Стили карточки в зависимости от статуса
const cardBorderClass = computed(() => {
  if (hasProblems.value) return 'border-[var(--color-error)] border-2'
  if (progressVariant.value === 'success') return 'border-[var(--color-success)] border-2'
  if (progressVariant.value === 'warning') return 'border-[var(--color-warning)] border-2'
  return 'border-secondary/20'
})

// Анимированные классы для карточки
const cardAnimationClass = computed(() => {
  if (hasProblems.value) return 'animate-pulse-border-error'
  if (inProgressCount.value > 0 && !hasProblems.value) return 'animate-pulse-border-warning'
  if (progressVariant.value === 'success') return 'animate-glow-success'
  return ''
})

// Команда
const engineersNames = computed(() => {
  const ids = Array.isArray(props.mountPoint.responsible_engineers) ? props.mountPoint.responsible_engineers : []
  return ids
    .map(id => users.value.find(u => u.id === id)?.name || users.value.find(u => u.id === id)?.email)
    .filter(Boolean)
})

// Дата старта
const startDateLabel = computed(() => {
  const d = props.mountPoint.start_date ? new Date(props.mountPoint.start_date) : null
  return d ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(d) : '—'
})

// Методы
const toggleActions = () => {
  showActions.value = !showActions.value
}

const toggleTaskDetails = (taskId) => {
  expandedTasks.value = {
    ...expandedTasks.value,
    [taskId]: !expandedTasks.value[taskId]
  }
}

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '??'
  
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const handleGoToPoint = () => {
  showActions.value = false
  emit('click', props.mountPoint.id)
}

const handleEdit = () => {
  showActions.value = false
  emit('edit', props.mountPoint)
}

const handleAddDuty = () => {
  showActions.value = false
  emit('add-duty', props.mountPoint)
}

const handleDelete = () => {
  showActions.value = false
  emit('delete', props.mountPoint)
}

// Закрытие меню при клике вне
const closeActions = () => {
  showActions.value = false
}

// Слушаем клики вне компонента
if (typeof window !== 'undefined') {
  document.addEventListener('click', closeActions)
}
</script>

<style scoped>
/* Ограничение строк для описания */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Группировка карточки для hover эффектов */
.group:hover .opacity-0 {
  opacity: 1;
}

/* 🎯 ИСПРАВЛЕНО: Анимации БЕЗ overflow с inset shadows */
@keyframes pulse-border-error {
  0%, 100% {
    border-color: var(--color-error);
    box-shadow: inset 0 0 0 0 rgba(239, 68, 68, 0.1), 0 0 0 0 rgba(239, 68, 68, 0.05);
  }
  50% {
    border-color: var(--color-error);
    box-shadow: inset 0 0 0 2px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.1);
  }
}

@keyframes pulse-border-warning {
  0%, 100% {
    border-color: var(--color-warning);
    box-shadow: inset 0 0 0 0 rgba(245, 158, 11, 0.1), 0 0 0 0 rgba(245, 158, 11, 0.05);
  }
  50% {
    border-color: var(--color-warning);
    box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.15), 0 0 0 1px rgba(245, 158, 11, 0.1);
  }
}

@keyframes glow-success {
  0%, 100% {
    border-color: var(--color-success);
    box-shadow: inset 0 0 0 0 rgba(34, 197, 94, 0.1), 0 0 0 0 rgba(34, 197, 94, 0.05);
  }
  50% {
    border-color: var(--color-success);
    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.2), 0 0 0 1px rgba(34, 197, 94, 0.1);
  }
}

/* Применение анимаций */
.animate-pulse-border-error {
  animation: pulse-border-error 2s ease-in-out infinite;
}

.animate-pulse-border-warning {
  animation: pulse-border-warning 3s ease-in-out infinite;
}

.animate-glow-success {
  animation: glow-success 4s ease-in-out infinite;
}

/* Плавные переходы для всех элементов */
* {
  transition: all 0.2s ease-in-out;
}
</style>
