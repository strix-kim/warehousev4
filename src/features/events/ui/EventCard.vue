<template>
  <!--
    EventCard.vue — современная карточка мероприятия
    Архитектурная роль: переиспользуемый UI компонент для отображения мероприятия
    Поддерживает: клик для перехода, hover эффекты, статусы, responsive design
    ИСПРАВЛЕНО: использует только Tailwind CSS, синюю цветовую схему
  -->
  <article 
    :class="[
      'relative flex flex-col bg-white/95 border border-gray-200 rounded-2xl p-6 shadow-sm backdrop-blur-sm',
      'cursor-pointer transition-all duration-300 ease-out min-h-[200px]',
      'hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg hover:border-blue-300',
      'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
      { 'bg-gray-50/80 opacity-80': event.is_archived }
    ]"
    role="button"
    tabindex="0"
    :aria-label="`Мероприятие ${event.name}. Нажмите для просмотра деталей`"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <!-- Заголовок карточки -->
    <header class="flex items-center gap-3 mb-4 relative">
      <div class="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl text-blue-600 shrink-0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="stroke-current stroke-2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
        </svg>
      </div>
      
      <h3 class="flex-1 text-lg font-bold text-gray-900 line-height-tight font-mono tracking-wide">{{ event.name }}</h3>
      
      <!-- Статус архива -->
      <div v-if="event.is_archived" class="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md tracking-wider">
        АРХИВ
      </div>
    </header>
    
    <!-- Основная информация -->
    <div class="flex-1 mb-4">
      <div class="space-y-2">
        <div class="flex items-start gap-2 text-sm leading-relaxed">
          <span class="font-semibold text-gray-600 min-w-[80px] shrink-0">Организатор:</span>
          <span class="text-gray-900 font-medium break-words">{{ event.organizer }}</span>
        </div>
        
        <div class="flex items-start gap-2 text-sm leading-relaxed">
          <span class="font-semibold text-gray-600 min-w-[80px] shrink-0">Локация:</span>
          <span class="text-gray-900 font-medium break-words">{{ event.location }}</span>
        </div>
        
        <div class="flex items-start gap-2 text-sm leading-relaxed">
          <span class="font-semibold text-gray-600 min-w-[80px] shrink-0">Даты:</span>
          <span class="text-gray-900 font-medium break-words">{{ formatEventDates }}</span>
        </div>
        
        <div v-if="event.description" class="mt-3 p-3 bg-gray-50/80 rounded-lg text-sm leading-relaxed text-gray-700 italic">
          {{ truncatedDescription }}
        </div>
      </div>
    </div>
    
    <!-- Подвал карточки -->
    <footer class="flex items-center justify-between pt-4 border-t border-gray-100">
      <div class="flex gap-4">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="stroke-current stroke-2 opacity-70">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>{{ mountPointsCount }} точек</span>
        </div>
        
        <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="stroke-current stroke-2 opacity-70">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.59a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>{{ formatEventStatus }}</span>
        </div>
      </div>
      
      <!-- Индикатор кликабельности -->
      <div class="flex items-center justify-center text-gray-400 transition-all duration-200 group-hover:text-blue-600 group-hover:translate-x-1">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="stroke-current stroke-2">
          <path d="m9 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </footer>
  </article>
</template>

<script setup>
/**
 * EventCard — карточка мероприятия с поддержкой навигации
 * Интегрирован с роутером для перехода на страницу деталей
 * ИСПРАВЛЕНО: только Tailwind CSS, синяя цветовая схема
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

// Пропсы
const props = defineProps({
  /** Объект мероприятия */
  event: {
    type: Object,
    required: true
  }
})

// События
const emit = defineEmits(['click'])

// Роутер для навигации
const router = useRouter()

// Computed свойства
const formatEventDates = computed(() => {
  const start = props.event.start_date
  const end = props.event.end_date
  
  if (!start) return 'Даты не указаны'
  
  if (end && end !== start) {
    return `${formatDate(start)} — ${formatDate(end)}`
  }
  
  return formatDate(start)
})

const truncatedDescription = computed(() => {
  const desc = props.event.description
  if (!desc) return ''
  
  return desc.length > 120 ? `${desc.substring(0, 120)}...` : desc
})

const mountPointsCount = computed(() => {
  return props.event.mount_points_count || 0
})

const formatEventStatus = computed(() => {
  const today = new Date()
  const startDate = new Date(props.event.start_date)
  const endDate = props.event.end_date ? new Date(props.event.end_date) : startDate
  
  if (props.event.is_archived) return 'Архив'
  if (today < startDate) return 'Планируется'
  if (today >= startDate && today <= endDate) return 'Проходит'
  if (today > endDate) return 'Завершено'
  
  return 'Неизвестно'
})

// Методы
const formatDate = (dateString) => {
  if (!dateString) return ''
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch (error) {
    return dateString
  }
}

const handleClick = () => {
  emit('click', props.event)
  router.push(`/events/${props.event.id}`)
}
</script> 