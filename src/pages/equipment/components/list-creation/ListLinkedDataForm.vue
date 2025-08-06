<template>
  <div v-if="formData.type === 'security'" class="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-primary">🔗</span>
      <h4 class="font-medium text-primary">Привязка к мероприятию</h4>
    </div>
    
    <!-- Селект мероприятий -->
    <FormFieldV2 
      type="select"
      :model-value="formData.event_id"
      label="Мероприятие"
      required
      :options="eventOptions"
      placeholder="Выберите мероприятие"
      :loading="eventsLoading"
      :error="formErrors.event_id"
      @update:model-value="handleEventChange"
    />

    <!-- Селект точек монтажа -->
    <FormFieldV2 
      type="select"
      :model-value="formData.mount_point_id"
      label="Точка монтажа"
      required
      :options="mountPointOptions"
      placeholder="Выберите точку монтажа"
      :disabled="!formData.event_id"
      :loading="mountPointsLoading"
      :error="formErrors.mount_point_id"
      @update:model-value="handleMountPointChange"
    />

    <!-- Индикатор загрузки точек монтажа -->
    <div v-if="mountPointsLoading" class="flex items-center gap-2 text-sm text-secondary">
      <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span>Загружаются точки монтажа...</span>
    </div>

    <!-- Информация о конфликтах (если есть) -->
    <div v-if="conflictInfo && Object.keys(conflictInfo).length > 0" 
         class="p-3 bg-warning/10 border border-warning rounded-lg">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-warning">⚠️</span>
        <span class="font-medium text-warning">Обнаружены конфликты</span>
      </div>
      <div class="text-sm text-secondary">
        Некоторое оборудование уже используется в других списках для этого мероприятия
      </div>
    </div>

    <!-- Ошибки загрузки -->
    <div v-if="eventsError" class="p-3 bg-error/10 border border-error rounded-lg">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-error">❌</span>
        <span class="font-medium text-error">Ошибка загрузки мероприятий</span>
      </div>
      <div class="text-sm text-error">{{ eventsError }}</div>
    </div>

    <div v-if="mountPointsError" class="p-3 bg-error/10 border border-error rounded-lg">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-error">❌</span>
        <span class="font-medium text-error">Ошибка загрузки точек монтажа</span>
      </div>
      <div class="text-sm text-error">{{ mountPointsError }}</div>
    </div>
  </div>
</template>

<script setup>
/**
 * ListLinkedDataForm - EPR System
 * 
 * Компонент формы связанных данных для security списков
 * Управляет выбором мероприятий и точек монтажа с обработкой зависимостей
 * 
 * @component
 * @example
 * <ListLinkedDataForm
 *   :form-data="formData"
 *   :form-errors="formErrors"
 *   :event-options="eventOptions"
 *   :mount-point-options="mountPointOptions"
 *   :events-loading="eventsLoading"
 *   :mount-points-loading="mountPointsLoading"
 *   :conflict-info="conflictInfo"
 *   @event-change="handleEventChange"
 *   @mount-point-change="handleMountPointChange"
 * />
 */

import { FormFieldV2 } from '@/shared/ui-v2'

// ===== PROPS =====
const props = defineProps({
  formData: {
    type: Object,
    required: true,
    validator: (value) => {
      return typeof value === 'object' && 
             value !== null &&
             'type' in value &&
             'event_id' in value &&
             'mount_point_id' in value
    }
  },
  formErrors: {
    type: Object,
    default: () => ({})
  },
  eventOptions: {
    type: Array,
    default: () => []
  },
  mountPointOptions: {
    type: Array,
    default: () => []
  },
  eventsLoading: {
    type: Boolean,
    default: false
  },
  mountPointsLoading: {
    type: Boolean,
    default: false
  },
  eventsError: {
    type: String,
    default: ''
  },
  mountPointsError: {
    type: String,
    default: ''
  },
  conflictInfo: {
    type: Object,
    default: () => ({})
  }
})

// ===== EMITS =====
const emit = defineEmits([
  'event-change',
  'mount-point-change',
  'update:form-data',
  'update:form-errors'
])

// ===== МЕТОДЫ =====
const handleEventChange = async (eventId) => {
  console.log('🔄 [ListLinkedDataForm] Выбрано мероприятие:', eventId)
  
  // Обновляем form data
  const updatedFormData = {
    ...props.formData,
    event_id: eventId,
    mount_point_id: null // Очищаем точку монтажа при смене мероприятия
  }
  emit('update:form-data', updatedFormData)
  
  // Очищаем ошибки
  const newErrors = { ...props.formErrors }
  delete newErrors.event_id
  delete newErrors.mount_point_id
  emit('update:form-errors', newErrors)
  
  // Уведомляем родительский компонент
  emit('event-change', eventId)
}

const handleMountPointChange = (mountPointId) => {
  console.log('🔄 [ListLinkedDataForm] Выбрана точка монтажа:', mountPointId)
  
  // Обновляем form data
  const updatedFormData = {
    ...props.formData,
    mount_point_id: mountPointId
  }
  emit('update:form-data', updatedFormData)
  
  // Очищаем ошибку точки монтажа
  if (props.formErrors.mount_point_id) {
    const newErrors = { ...props.formErrors }
    delete newErrors.mount_point_id
    emit('update:form-errors', newErrors)
  }
  
  // Уведомляем родительский компонент
  emit('mount-point-change', mountPointId)
}
</script>

<style scoped>
/* UI Kit v2 + Bento Grid стили */

/* Анимация загрузки */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Стили для информационных блоков */
.bg-blue-50 {
  background-color: rgba(59, 130, 246, 0.05);
}

.border-blue-200 {
  border-color: rgba(59, 130, 246, 0.2);
}

/* Цвета для состояний */
.bg-warning\/10 {
  background-color: rgba(245, 158, 11, 0.1);
}

.border-warning {
  border-color: rgba(245, 158, 11, 0.3);
}

.text-warning {
  color: #f59e0b;
}

.bg-error\/10 {
  background-color: rgba(239, 68, 68, 0.1);
}

.border-error {
  border-color: rgba(239, 68, 68, 0.3);
}

.text-error {
  color: #ef4444;
}

/* Отступы */
.space-y-4 > * + * {
  margin-top: 1rem;
}
</style>