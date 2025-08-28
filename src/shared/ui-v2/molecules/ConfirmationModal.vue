<template>
  <ModalV2
    :model-value="show"
    @update:modelValue="val => emit('update:show', val)"
    :title="title"
    size="sm"
    :show-close-button="true"
    @close="emit('update:show', false)"
  >
    <template #default>
      <div class="text-center py-4">
        <!-- Icon -->
        <div class="mx-auto flex items-center justify-center w-12 h-12 rounded-full mb-4"
             :class="iconBgClass">
          <IconV2 :name="icon" size="md" :class="iconClass" />
        </div>
        
        <!-- Message -->
        <h3 class="text-lg font-semibold text-primary mb-2">{{ title }}</h3>
        <p class="text-secondary mb-4">{{ message }}</p>
        
        <!-- Details (optional) -->
        <div v-if="details" class="text-sm text-secondary/80 bg-accent/50 rounded-lg p-3 mb-4">
          {{ details }}
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <ButtonV2 
          variant="ghost" 
          @click="emit('cancel')"
          :disabled="loading"
        >
          {{ cancelText }}
        </ButtonV2>
        <ButtonV2 
          :variant="confirmVariant" 
          @click="emit('confirm')"
          :loading="loading"
          :disabled="loading"
        >
          {{ confirmText }}
        </ButtonV2>
      </div>
    </template>
  </ModalV2>
</template>

<script setup>
/**
 * ConfirmationModal - универсальное модальное окно подтверждения
 * Поддерживает разные типы: info, warning, danger, success
 */
import { computed } from 'vue'
import { ModalV2, ButtonV2, IconV2 } from '@/shared/ui-v2'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: null
  },
  type: {
    type: String,
    default: 'warning',
    validator: (value) => ['info', 'warning', 'danger', 'success'].includes(value)
  },
  confirmText: {
    type: String,
    default: 'Подтвердить'
  },
  cancelText: {
    type: String,
    default: 'Отмена'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'confirm', 'cancel'])

// Стили в зависимости от типа
const icon = computed(() => {
  switch (props.type) {
    case 'danger': return 'alert-triangle'
    case 'warning': return 'alert-circle'
    case 'success': return 'check-circle'
    case 'info': 
    default: return 'info'
  }
})

const iconClass = computed(() => {
  switch (props.type) {
    case 'danger': return 'text-error'
    case 'warning': return 'text-warning'
    case 'success': return 'text-success'
    case 'info':
    default: return 'text-info'
  }
})

const iconBgClass = computed(() => {
  switch (props.type) {
    case 'danger': return 'bg-error/10'
    case 'warning': return 'bg-warning/10'
    case 'success': return 'bg-success/10'
    case 'info':
    default: return 'bg-info/10'
  }
})

const confirmVariant = computed(() => {
  switch (props.type) {
    case 'danger': return 'error'
    case 'warning': return 'warning'
    case 'success': return 'success'
    case 'info':
    default: return 'primary'
  }
})
</script>

<style scoped>
/* Additional styles if needed */
</style>
