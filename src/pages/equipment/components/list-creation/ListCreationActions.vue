<template>
  <BentoCard 
    title="" 
    size="1x1" 
    variant="primary"
    class="overflow-hidden"
  >
    <!-- Современный заголовок с градиентом -->
    <div class="relative -m-6 mb-6 p-6 bg-gradient-to-br from-primary to-primary/80 text-white">
      <div class="absolute top-2 right-2 w-16 h-16 bg-white/5 rounded-full -translate-y-2 translate-x-2"></div>
      <div class="absolute bottom-0 left-0 w-8 h-8 bg-white/5 rounded-full translate-y-1 -translate-x-1"></div>
      
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold">+</span>
          </div>
          <h3 class="text-lg font-semibold font-mono text-white">
          {{ isEditMode ? 'Редактирование списка' : 'Создание списка' }}
        </h3>
        </div>
        
        <!-- Прогресс бар -->
        <div class="flex items-center gap-2 text-sm font-mono">
          <div class="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
            <div 
              class="h-full bg-white transition-all duration-500 ease-out"
              :style="`width: ${progressPercentage}%`"
            ></div>
          </div>
          <span class="text-white font-mono text-xs">{{ progressPercentage }}%</span>
        </div>
      </div>
    </div>

    <div class="space-y-6">
      
      <!-- Минималистичная сводка -->
      <div class="space-y-3">
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="flex items-center justify-between mb-1">
            <span class="text-secondary font-mono text-sm">Название</span>
          </div>
          <div class="font-medium text-primary font-mono text-sm break-words leading-relaxed">
            {{ displayName || '—' }}
          </div>
        </div>
        
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span class="text-secondary font-mono text-sm">Тип</span>
          <span class="font-medium text-primary font-mono text-sm">
            {{ typeDisplayName }}
          </span>
        </div>
        
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span class="text-secondary font-mono text-sm">Оборудование</span>
          <span class="font-medium text-primary font-mono text-sm">
            {{ selectedEquipmentCount }} ед.
          </span>
        </div>
        
        <div 
          v-if="formData.type === 'security' && formData.event_id" 
          class="p-3 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-secondary font-mono text-sm">Мероприятие</span>
          </div>
          <div class="font-medium text-primary font-mono text-sm break-words leading-relaxed">
            {{ eventName }}
          </div>
        </div>
      </div>

      <!-- Статус готовности -->
      <div class="relative">
        <div 
          class="text-center p-4 rounded-xl border-2 transition-all duration-300" 
          :class="canCreateList 
            ? 'border-success bg-success/10 shadow-lg' 
            : 'border-warning bg-warning/10'"
        >
          
          <div class="flex items-center justify-center gap-2 mb-2">
            <div 
              class="w-3 h-3 rounded-full animate-pulse" 
              :class="canCreateList ? 'bg-success' : 'bg-warning'"
            ></div>
            <span 
              class="font-mono text-base font-bold" 
              :class="canCreateList ? 'text-success' : 'text-warning'"
            >
              {{ canCreateList ? 'ГОТОВ' : 'ОЖИДАНИЕ' }}
            </span>
          </div>
          
          <div class="text-sm text-secondary font-mono" v-if="!canCreateList">
            {{ statusMessage }}
          </div>
        </div>
      </div>

      <!-- Главное действие -->
      <ButtonV2 
        variant="primary" 
        :size="isMobile ? 'md' : 'lg'" 
        @click="handleCreateList"
        :loading="createLoading"
        :disabled="!canCreateList"
        full-width
        class="text-sm md:text-base font-semibold font-mono relative overflow-hidden group"
      >
        <div v-if="createLoading" class="absolute inset-0 bg-primary/20 animate-pulse"></div>
        <template #icon>
          <span class="font-bold">+</span>
        </template>
        {{ createLoading 
          ? (isEditMode ? 'Сохранение...' : 'Создание...') 
          : (isEditMode ? 'СОХРАНИТЬ ИЗМЕНЕНИЯ' : 'СОЗДАТЬ СПИСОК') 
        }}
      </ButtonV2>
      
      <!-- Вторичные действия -->
      <div class="flex gap-2 pt-2 border-t border-gray-100">
        <!-- Кнопка "Сбросить" только в режиме создания -->
        <ButtonV2 
          v-if="!isEditMode"
          variant="minimal" 
          size="sm" 
          @click="handleResetForm"
          :disabled="createLoading"
          class="flex-1 font-mono text-xs"
        >
          <template #icon>
            <span class="text-xs">⟲</span>
          </template>
          Сбросить
        </ButtonV2>
        
        <ButtonV2 
          variant="minimal" 
          size="sm" 
          @click="handleCancel"
          :disabled="createLoading"
          class="flex-1 font-mono text-xs"
        >
          <template #icon>
            <span class="text-xs">←</span>
          </template>
          Отменить
        </ButtonV2>
      </div>

    </div>
  </BentoCard>
</template>

<script setup>
/**
 * ListCreationActions - EPR System
 * 
 * Компонент панели создания списка с прогрессом, сводкой и действиями
 * Отображает текущий статус создания и предоставляет действия
 * 
 * @component
 * @example
 * <ListCreationActions
 *   :form-data="formData"
 *   :can-create-list="canCreateList"
 *   :progress-percentage="progressPercentage"
 *   :create-loading="createLoading"
 *   :auto-generated-name="autoGeneratedName"
 *   :selected-equipment-count="selectedEquipmentIds.length"
 *   :event-name="getEventName(formData.event_id)"
 *   :is-mobile="isMobile"
 *   @create-list="handleCreateList"
 *   @reset-form="handleResetForm"
 *   @cancel="handleCancel"
 * />
 */

import { computed } from 'vue'
import { 
  BentoCard,
  ButtonV2
} from '@/shared/ui-v2'

// ===== PROPS =====
const props = defineProps({
  formData: {
    type: Object,
    required: true,
    validator: (value) => {
      return typeof value === 'object' && 
             value !== null &&
             'type' in value &&
             'name' in value
    }
  },
  canCreateList: {
    type: Boolean,
    default: false
  },
  progressPercentage: {
    type: Number,
    default: 0
  },
  createLoading: {
    type: Boolean,
    default: false
  },
  autoGeneratedName: {
    type: String,
    default: ''
  },
  selectedEquipmentCount: {
    type: Number,
    default: 0
  },
  eventName: {
    type: String,
    default: ''
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  isEditMode: {
    type: Boolean,
    default: false
  }
})

// ===== EMITS =====
const emit = defineEmits([
  'create-list',
  'reset-form',
  'cancel'
])

// ===== COMPUTED =====
const displayName = computed(() => {
  if (props.formData.type === 'security') {
    // В режиме редактирования показываем реальное название из формы
    // В режиме создания показываем автогенерированное название
    return props.isEditMode ? props.formData.name : props.autoGeneratedName
  }
  return props.formData.name
})

const typeDisplayName = computed(() => {
  switch (props.formData.type) {
    case 'custom':
      return '🆓 Кастомный'
    case 'security':
      return '🔒 Охрана'
    default:
      return '—'
  }
})

const statusMessage = computed(() => {
  if (!props.formData.type) {
    return 'Выберите тип списка →'
  }
  
  if (props.selectedEquipmentCount === 0) {
    return 'Добавьте оборудование →'
  }
  
  if (props.formData.type === 'custom' && !props.formData.name?.trim()) {
    return 'Введите название →'
  }
  
  if (props.formData.type === 'security') {
    if (!props.formData.event_id) {
      return 'Выберите мероприятие →'
    }
    if (!props.formData.mount_point_id) {
      return 'Выберите точку монтажа →'
    }
  }
  
  return 'Заполните поля →'
})

// ===== МЕТОДЫ =====
const handleCreateList = () => {
  console.log('🚀 [ListCreationActions] Создание списка')
  emit('create-list')
}

const handleResetForm = () => {
  console.log('🧹 [ListCreationActions] Сброс формы')
  emit('reset-form')
}

const handleCancel = () => {
  console.log('↩️ [ListCreationActions] Отмена создания')
  emit('cancel')
}
</script>

<style scoped>
/* UI Kit v2 + Bento Grid стили */

/* Градиентный фон заголовка */
.bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, var(--tw-gradient-stops));
}

.from-primary {
  --tw-gradient-from: #2B2D42;
  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(43, 45, 66, 0));
}

.to-primary\/80 {
  --tw-gradient-to: rgba(43, 45, 66, 0.8);
}

/* Анимации */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Переходы для прогресс-бара */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

.duration-500 {
  transition-duration: 500ms;
}

.ease-out {
  transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
}

/* Семантические цвета */
.bg-success\/10 {
  background-color: rgba(34, 197, 94, 0.1);
}

.border-success {
  border-color: #22c55e;
}

.text-success {
  color: #22c55e;
}

.bg-success {
  background-color: #22c55e;
}

.bg-warning\/10 {
  background-color: rgba(245, 158, 11, 0.1);
}

.border-warning {
  border-color: #f59e0b;
}

.text-warning {
  color: #f59e0b;
}

.bg-warning {
  background-color: #f59e0b;
}

/* Отступы */
.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.space-y-3 > * + * {
  margin-top: 0.75rem;
}

/* Позиционирование декоративных элементов */
.absolute {
  position: absolute;
}

.relative {
  position: relative;
}

.z-10 {
  z-index: 10;
}

/* Трансформации */
.-translate-y-2 {
  transform: translateY(-0.5rem);
}

.translate-x-2 {
  transform: translateX(0.5rem);
}

.translate-y-1 {
  transform: translateY(0.25rem);
}

.-translate-x-1 {
  transform: translateX(-0.25rem);
}

/* Размеры */
.w-16 {
  width: 4rem;
}

.h-16 {
  height: 4rem;
}

.w-8 {
  width: 2rem;
}

.h-8 {
  height: 2rem;
}

.w-3 {
  width: 0.75rem;
}

.h-3 {
  height: 0.75rem;
}
</style>