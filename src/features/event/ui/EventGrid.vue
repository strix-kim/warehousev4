<template>
  <!--
    EventGrid.vue — сетка карточек мероприятий с состояниями
    Архитектурная роль: контейнер для отображения списка мероприятий
    Поддерживает: loading, error, empty состояния, responsive grid
    ИСПРАВЛЕНО: использует Tailwind CSS, синюю цветовую схему
  -->
  <div class="w-full">
    <!-- Состояние загрузки -->
    <div v-if="loading" class="flex flex-col gap-6">
      <div class="flex items-center justify-center gap-3 p-8 bg-white/90 border border-gray-200 rounded-2xl backdrop-blur-sm">
        <Spinner class="h-8 w-8 text-blue-600" />
        <span class="text-gray-600 font-medium">Загрузка мероприятий...</span>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="i in skeletonCount" 
          :key="`skeleton-${i}`"
          class="bg-white/90 border border-gray-200 rounded-2xl p-6 backdrop-blur-sm min-h-[200px] flex flex-col gap-4"
        >
          <div class="flex items-center gap-3">
            <div class="skeleton-shimmer w-10 h-10 rounded-xl"></div>
            <div class="skeleton-shimmer flex-1 h-5 rounded"></div>
          </div>
          <div class="flex-1 flex flex-col gap-2">
            <div class="skeleton-shimmer h-3.5 rounded"></div>
            <div class="skeleton-shimmer h-3.5 rounded"></div>
            <div class="skeleton-shimmer h-3.5 w-3/4 rounded"></div>
          </div>
          <div class="pt-4 border-t border-gray-100">
            <div class="flex gap-4">
              <div class="skeleton-shimmer w-20 h-4 rounded"></div>
              <div class="skeleton-shimmer w-20 h-4 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Состояние ошибки -->
    <ErrorState
      v-else-if="error"
      :message="error"
      description="Не удалось загрузить список мероприятий. Проверьте подключение к интернету и попробуйте еще раз."
      icon="⚠️"
      class="my-12"
    >
      <Button
        label="Повторить попытку"
        variant="primary"
        size="lg"
        class="mt-6"
        @click="$emit('retry')"
      />
    </ErrorState>

    <!-- Состояние пустого списка -->
    <EmptyState
      v-else-if="isEmpty"
      :message="emptyMessage"
      :description="emptyDescription"
      icon="📅"
      class="my-12"
    >
      <Button
        label="Создать мероприятие"
        variant="primary"
        size="lg"
        class="mt-6"
        @click="$emit('create')"
      />
    </EmptyState>

    <!-- Сетка карточек мероприятий -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
      <EventCard
        v-for="event in events"
        :key="`event-${event.id}`"
        :event="event"
        @click="$emit('eventClick', event)"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * EventGrid — сетка карточек мероприятий с состояниями
 * Обрабатывает loading, error, empty состояния и отображает карточки
 * ИСПРАВЛЕНО: только Tailwind CSS, синяя цветовая схема
 */
import { computed } from 'vue'
import EventCard from './EventCard.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'

// Пропсы
const props = defineProps({
  /** Список мероприятий */
  events: {
    type: Array,
    default: () => []
  },
  /** Состояние загрузки */
  loading: {
    type: Boolean,
    default: false
  },
  /** Текст ошибки */
  error: {
    type: String,
    default: null
  },
  /** Тип мероприятий (active/archived) для кастомизации пустого состояния */
  eventsType: {
    type: String,
    default: 'active'
  },
  /** Количество skeleton карточек при загрузке */
  skeletonCount: {
    type: Number,
    default: 6
  }
})

// События
defineEmits(['eventClick', 'create', 'retry'])

// Computed свойства
const isEmpty = computed(() => 
  !props.loading && !props.error && props.events.length === 0
)

const emptyMessage = computed(() => {
  switch (props.eventsType) {
    case 'archived':
      return 'Нет архивных мероприятий'
    case 'active':
    default:
      return 'Нет активных мероприятий'
  }
})

const emptyDescription = computed(() => {
  switch (props.eventsType) {
    case 'archived':
      return 'Архивные мероприятия будут отображаться здесь после их завершения'
    case 'active':
    default:
      return 'Создайте первое мероприятие, чтобы начать планирование событий'
  }
})
</script>

<style scoped>
/**
 * Минимальные стили для skeleton анимации
 * Все остальное перенесено в Tailwind классы
 */
.skeleton-shimmer {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style> 