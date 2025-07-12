<!--
  MountPointList - список точек монтажа для события
  Адаптивная сетка карточек, состояния загрузки и ошибок, пустое состояние
  Интеграция с Pinia store и навигацией
-->
<template>
  <div class="space-y-6">
    <!-- Заголовок с кнопкой создания -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-gray-900">Точки монтажа</h2>
        <p class="text-sm text-gray-600 mt-1">
          {{ mountPointsCount }} {{ mountPointsText }}
        </p>
      </div>
      
      <!-- Кнопка создания новой точки (только если есть права) -->
      <Button
        v-if="canCreateMountPoint"
        variant="primary"
        size="md"
        @click="$emit('create')"
        class="inline-flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Создать точку монтажа
      </Button>
    </div>
    
    <!-- Состояние загрузки -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="i in 3" 
        :key="i"
        class="bg-white border border-gray-200 rounded-xl p-6 animate-pulse"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gray-200 rounded-lg"></div>
            <div>
              <div class="h-5 bg-gray-200 rounded w-32 mb-2"></div>
              <div class="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        </div>
        <div class="space-y-3">
          <div class="h-4 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="flex gap-4">
            <div class="h-4 bg-gray-200 rounded w-16"></div>
            <div class="h-4 bg-gray-200 rounded w-16"></div>
            <div class="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Состояние ошибки -->
    <ErrorState 
      v-else-if="error"
      :message="error"
      description="Не удалось загрузить список точек монтажа"
    >
      <Button
        variant="primary"
        @click="$emit('retry')"
        class="mt-4"
      >
        Повторить
      </Button>
    </ErrorState>
    
    <!-- Пустое состояние -->
    <EmptyState
      v-else-if="mountPoints.length === 0"
      message="Нет точек монтажа"
      description="Создайте первую точку монтажа для этого мероприятия"
      icon="📍"
    >
      <Button
        v-if="canCreateMountPoint"
        variant="primary"
        @click="$emit('create')"
        class="mt-4"
      >
        Создать точку монтажа
      </Button>
    </EmptyState>
    
    <!-- Список точек монтажа -->
    <div 
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-8"
    >
      <MountPointCard
        v-for="mountPoint in mountPoints"
        :key="mountPoint.id"
        :mount-point="mountPoint"
        @click="handleMountPointClick(mountPoint)"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * MountPointList - список точек монтажа для события
 * Отображает карточки точек монтажа в адаптивной сетке
 * Поддерживает создание новых точек и переход к деталям
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import MountPointCard from './MountPointCard.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import { useAuthStore } from '@/stores/auth-store'
import { storeToRefs } from 'pinia'

// Пропсы
const props = defineProps({
  mountPoints: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  eventId: {
    type: String,
    required: true
  },
  event: {
    type: Object,
    default: null
  }
})

// События
defineEmits(['create', 'retry'])

// Навигация
const router = useRouter()

// Авторизация для проверки прав
const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

// Вычисляемые свойства
const mountPointsCount = computed(() => props.mountPoints.length)

const mountPointsText = computed(() => {
  const count = mountPointsCount.value
  if (count === 1) return 'точка монтажа'
  if (count >= 2 && count <= 4) return 'точки монтажа'
  return 'точек монтажа'
})

// Проверка прав на создание точек монтажа
const canCreateMountPoint = computed(() => {
  if (!user.value || !props.event) return false
  
  // Менеджеры и админы могут создавать точки
  if (['manager', 'admin'].includes(user.value.role)) {
    return true
  }
  
  // Ответственные инженеры события могут создавать точки
  return props.event.responsible_engineers?.includes(user.value.id)
})

// Методы
function handleMountPointClick(mountPoint) {
  router.push(`/mount-point/${mountPoint.id}`)
}
</script> 