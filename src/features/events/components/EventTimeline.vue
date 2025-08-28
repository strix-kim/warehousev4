<template>
  <div class="space-y-4">
    <!-- Mobile vertical progression -->
    <div class="sm:hidden">
      <div class="grid grid-cols-[24px_1fr] gap-x-4">
        <template
          v-for="(step, idx) in timelineSteps"
          :key="step.key"
        >
          <div class="flex flex-col items-center">
            <div 
              class="relative cursor-pointer transition-all duration-200 active:scale-95"
              @click="handleStepClick(step)"
            >
              <span
                :class="getStepClasses(step)"
              ></span>
              <!-- Pulse animation for active steps -->
              <span 
                v-if="step.active"
                :class="getPulseClasses(step)"
              ></span>
            </div>
            <div v-if="idx < timelineSteps.length - 1" :class="getConnectorClasses(idx)"></div>
          </div>
          <div class="pb-6 touch-manipulation">
            <div class="flex items-center justify-between mb-1">
              <div class="font-medium text-sm text-accent">{{ step.title }}</div>
              <div v-if="step.active" class="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse"></div>
            </div>
            <div class="text-sm text-accent/80 mb-1">{{ step.label }}</div>
            <div v-if="step.date" class="text-xs text-secondary">
              {{ formatStepTime(step.date) }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Desktop/Tablet timeline with lines -->
    <div class="hidden sm:flex items-center gap-2 text-accent">
      <template v-for="(step, idx) in timelineSteps" :key="step.key">
        <!-- Timeline Node -->
        <TooltipV2 
          :content="getTooltipContent(step)"
          placement="top"
        >
          <div 
            class="flex items-center gap-2 w-16 sm:w-24 md:w-28 flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105"
            @mouseenter="handleStepHover(step.key)"
            @mouseleave="handleStepLeave"
          >
            <span :class="getDesktopStepClasses(step)"></span>
            <span class="text-xs text-accent/80 whitespace-nowrap transition-colors duration-200" :class="getStepTextClasses(step)">
              <span class="hidden md:inline">{{ step.title }}: </span>
              <span class="text-accent">{{ step.label }}</span>
            </span>
          </div>
        </TooltipV2>
        
        <!-- Connector -->
        <div 
          v-if="idx < timelineSteps.length - 1"
          :class="getDesktopConnectorClasses(idx)"
        ></div>
      </template>
    </div>

    <!-- Bottom row: chips + KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="event?.organizer" class="px-2 py-1 rounded-full border border-secondary/30 bg-white text-sm text-primary inline-flex items-center gap-1">
          <IconV2 name="user" size="xs" /> {{ event.organizer }}
        </span>
        <span v-if="event?.location" class="px-2 py-1 rounded-full border border-secondary/30 bg-white text-sm text-primary inline-flex items-center gap-1">
          <IconV2 name="map-pin" size="xs" /> {{ event.location }}
        </span>
      </div>
      <div class="rounded-xl border border-secondary/20 bg-white p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <IconV2 name="map-pin" size="sm" class="text-primary" />
          </div>
          <div class="text-sm text-secondary">Точек</div>
        </div>
        <div class="text-2xl font-semibold text-primary">{{ mountPointsCount }}</div>
      </div>
      <div class="rounded-xl border border-secondary/20 bg-white p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <IconV2 name="users" size="sm" class="text-primary" />
          </div>
          <div class="text-sm text-secondary">Инженеров</div>
        </div>
        <div class="text-2xl font-semibold text-primary">{{ teamSize }}</div>
      </div>
    </div>

    <!-- Accent bar -->
    <div class="h-1 rounded-full bg-gradient-to-r from-[var(--color-brand-red)] to-[var(--color-brand-deep-red)]"></div>
  </div>
</template>

<script setup>
/**
 * EventTimeline - компонент timeline мероприятия
 * Поддерживает мобильную и десктопную версии
 * Интерактивные элементы с hover эффектами и tooltips
 */
import { computed, ref } from 'vue'
import { IconV2, TooltipV2 } from '@/shared/ui-v2'

const props = defineProps({
  // Timeline данные
  timeline: {
    type: Object,
    required: true,
    validator: (value) => {
      return value && 
        typeof value.setup === 'object' &&
        typeof value.start === 'object' &&
        typeof value.end === 'object' &&
        typeof value.teardown === 'object' &&
        Array.isArray(value.bars)
    }
  },
  
  // Данные события
  event: {
    type: Object,
    default: () => ({})
  },
  
  // Статистика
  mountPointsCount: {
    type: Number,
    default: 0
  },
  teamSize: {
    type: Number,
    default: 0
  },
  
  // Состояние hover
  hoveredStep: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['step-hover', 'step-leave', 'step-click', 'notify'])

// Форматтеры дат
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', { 
  day: '2-digit', 
  month: 'long', 
  year: 'numeric', 
  hour: '2-digit', 
  minute: '2-digit' 
})

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { 
  weekday: 'short', 
  hour: '2-digit', 
  minute: '2-digit' 
})

// Computed свойства
const timelineSteps = computed(() => [
  { 
    key: 'setup', 
    title: 'Монтаж', 
    label: props.timeline.setup.label, 
    active: props.timeline.setup.active, 
    date: props.event?.setup_date 
  },
  { 
    key: 'start', 
    title: 'Старт', 
    label: props.timeline.start.label, 
    active: props.timeline.start.active, 
    date: props.event?.start_date 
  },
  { 
    key: 'end', 
    title: 'Финиш', 
    label: props.timeline.end.label, 
    active: props.timeline.end.active, 
    date: props.event?.end_date 
  },
  { 
    key: 'teardown', 
    title: 'Демонтаж', 
    label: props.timeline.teardown.label, 
    active: props.timeline.teardown.active, 
    date: props.event?.teardown_date 
  }
])

// Методы
const handleStepClick = (step) => {
  if (step.date) {
    const message = `${step.title}: ${dateTimeFormatter.format(new Date(step.date))}`
    emit('notify', { type: 'info', message })
  }
  emit('step-click', step)
}

const handleStepHover = (stepKey) => {
  emit('step-hover', stepKey)
}

const handleStepLeave = () => {
  emit('step-leave')
}

const formatStepTime = (date) => {
  return date ? timeFormatter.format(new Date(date)) : ''
}

const getTooltipContent = (step) => {
  const baseText = step.key === 'setup' ? 'Подготовка к мероприятию' :
                   step.key === 'start' ? 'Начало мероприятия' :
                   step.key === 'end' ? 'Окончание мероприятия' :
                   'Завершение мероприятия'
  
  return step.date ? `${baseText}: ${dateTimeFormatter.format(new Date(step.date))}` : baseText
}

// CSS классы
const getStepClasses = (step) => [
  'inline-block shrink-0 w-3 h-3 rounded-full ring-2 ring-white/80 transition-all duration-200',
  step.active
    ? (step.key === 'setup'
        ? 'bg-[var(--color-info)] ring-[var(--color-info)]/30'
        : step.key === 'teardown'
          ? 'bg-[var(--color-warning)] ring-[var(--color-warning)]/30'
          : 'bg-[var(--color-success)] ring-[var(--color-success)]/30')
    : 'bg-white/30 ring-white/40'
]

const getPulseClasses = (step) => [
  'absolute inset-0 w-3 h-3 rounded-full animate-ping',
  step.key === 'setup' ? 'bg-[var(--color-info)]' : 
  step.key === 'teardown' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'
]

const getConnectorClasses = (idx) => [
  'w-0.5 flex-1 mt-2 mb-1 transition-colors duration-300',
  props.timeline.bars[idx]
]

const getDesktopStepClasses = (step) => [
  'inline-block shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/80 transition-all duration-200',
  step.active 
    ? (step.key === 'setup' ? 'bg-[var(--color-info)]' :
       step.key === 'teardown' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]')
    : 'bg-white/30',
  props.hoveredStep === step.key ? 'ring-4 ring-white/60 scale-110' : ''
]

const getStepTextClasses = (step) => ({
  'text-accent': props.hoveredStep === step.key
})

const getDesktopConnectorClasses = (idx) => [
  'w-8 sm:w-12 md:w-16 lg:w-20 xl:w-24 h-[2px] flex-shrink-0',
  props.timeline.bars[idx]
]
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
