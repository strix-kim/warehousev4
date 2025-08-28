<template>
  <div 
    class="group relative bg-white border rounded-xl p-4 transition-all duration-200 hover:shadow-md"
    :class="cardBorderClass"
  >
    <!-- Status Indicator -->
    <div 
      class="absolute top-0 left-0 w-1 h-full rounded-l-xl transition-all duration-200"
      :class="statusIndicatorClass"
    ></div>

    <!-- Header -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex-1 min-w-0">
        <h4 class="font-semibold text-primary mb-1 leading-tight">
          {{ duty.title }}
        </h4>
        <p v-if="duty.description" class="text-sm text-secondary line-clamp-2">
          {{ duty.description }}
        </p>
      </div>
      
      <!-- Status Badge -->
      <StatusBadgeV2 
        :label="statusLabel" 
        :variant="statusVariant" 
        size="sm" 
      />
    </div>

    <!-- Status Controls -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <label :for="`duty-status-${duty.id}`" class="text-sm font-medium text-secondary">
          Статус:
        </label>
        <select
          :id="`duty-status-${duty.id}`"
          :value="duty.status"
          @change.prevent="handleStatusChange"
          :disabled="loading"
          class="text-sm border border-secondary/20 rounded-lg px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        >
          <option value="в работе">В работе</option>
          <option value="выполнено">Выполнено</option>
          <option value="проблема">Проблема</option>
        </select>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ButtonV2 
          variant="ghost" 
          size="sm" 
          @click="$emit('edit', duty)"
          :disabled="loading"
        >
          <template #icon><IconV2 name="edit" size="xs" /></template>
        </ButtonV2>
        
        <ButtonV2 
          variant="ghost" 
          size="sm" 
          @click="$emit('delete', duty)"
          :disabled="loading"
        >
          <template #icon><IconV2 name="trash-2" size="xs" /></template>
        </ButtonV2>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div 
      v-if="loading" 
      class="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center"
    >
      <SpinnerV2 size="sm" />
    </div>

    <!-- Progress Animation -->
    <div 
      v-if="duty.status === 'выполнено'" 
      class="absolute top-2 right-2 text-success animate-pulse"
    >
      <IconV2 name="check-circle" size="sm" />
    </div>
    
    <div 
      v-else-if="duty.status === 'проблема'" 
      class="absolute top-2 right-2 text-error animate-pulse"
    >
      <IconV2 name="alert-circle" size="sm" />
    </div>
  </div>
</template>

<script setup>
/**
 * TechnicalDutyCard - карточка технического задания
 * Интерактивная карточка с изменением статуса и действиями
 */
import { computed } from 'vue'
import { ButtonV2, StatusBadgeV2, IconV2, SpinnerV2 } from '@/shared/ui-v2'

const props = defineProps({
  duty: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['status-change', 'edit', 'delete'])

// Status styling
const statusVariant = computed(() => {
  switch (props.duty.status) {
    case 'выполнено': return 'success'
    case 'проблема': return 'error'
    case 'в работе': return 'warning'
    default: return 'info'
  }
})

const statusLabel = computed(() => {
  switch (props.duty.status) {
    case 'выполнено': return 'Выполнено'
    case 'проблема': return 'Проблема'
    case 'в работе': return 'В работе'
    default: return 'Неизвестно'
  }
})

const cardBorderClass = computed(() => {
  switch (props.duty.status) {
    case 'выполнено': return 'border-success/20 bg-success/5'
    case 'проблема': return 'border-error/20 bg-error/5'
    case 'в работе': return 'border-warning/20 bg-warning/5'
    default: return 'border-secondary/20'
  }
})

const statusIndicatorClass = computed(() => {
  switch (props.duty.status) {
    case 'выполнено': return 'bg-success'
    case 'проблема': return 'bg-error'
    case 'в работе': return 'bg-warning'
    default: return 'bg-secondary/40'
  }
})

// Methods
const handleStatusChange = (event) => {
  console.log('🔄 [TechnicalDutyCard] Status change triggered:', {
    dutyId: props.duty.id,
    oldStatus: props.duty.status,
    newStatus: event.target.value
  })
  
  const newStatus = event.target.value
  emit('status-change', props.duty, newStatus)
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
