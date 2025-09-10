<template>
  <!-- ✅ Модалка подтверждения удаления - UI Kit v2 -->
  <ModalV2
    v-model="show"
    title="Удалить оборудование"
    :description="`Вы уверены, что хотите удалить это оборудование? Это действие нельзя отменить.`"
    size="md"
    variant="danger"
    :loading="loading"
    :persistent="false"
    :show-default-actions="true"
    confirm-text="Удалить"
    cancel-text="Отмена"
    confirm-variant="danger"
    @close="handleClose"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <!-- ✅ Детали удаляемого оборудования -->
    <div v-if="equipment" class="space-y-4">
      <!-- Информация об оборудовании -->
      <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <IconV2 name="package" size="md" color="error" />
            </div>
          </div>
          
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-primary">
              {{ equipment.brand }} {{ equipment.model }}
            </h3>
            <p class="text-sm text-secondary mt-1">
              Серийный номер: {{ equipment.serialnumber }}
            </p>
            <div class="flex items-center gap-2 mt-2">
              <StatusBadgeV2 
                :variant="getStatusInfo(equipment.availability).variant"
                :label="getStatusInfo(equipment.availability).label"
                size="sm"
              />
              <span class="text-xs text-secondary">
                {{ equipment.type }}
                <span v-if="equipment.subtype"> → {{ equipment.subtype }}</span>
              </span>
            </div>
            <p v-if="equipment.location" class="text-xs text-secondary mt-1">
              📍 {{ equipment.location }}
            </p>
          </div>
        </div>
      </div>

      <!-- Предупреждение -->
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <IconV2 name="alert-triangle" size="sm" color="error" class="mt-0.5" />
          <div class="text-sm">
            <h4 class="font-medium text-red-900 mb-1">Внимание!</h4>
            <ul class="text-red-700 space-y-1">
              <li>• Оборудование будет удалено навсегда</li>
              <li>• Все связанные данные будут потеряны</li>
              <li>• Отменить это действие будет невозможно</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <IconV2 name="alert-circle" size="sm" color="error" />
          <span class="text-sm text-red-700">{{ error }}</span>
        </div>
      </div>
    </div>
  </ModalV2>
</template>

<script setup>
/**
 * EquipmentDeleteModal - EPR System
 * 
 * Модальное окно подтверждения удаления оборудования
 * Использует UI Kit v2 и показывает детали удаляемого элемента
 */

import { ref, computed, watch } from 'vue'

// UI Kit v2
import { 
  ModalV2,
  IconV2,
  StatusBadgeV2
} from '@/shared/ui-v2'

// Equipment module
import { useEquipmentStore } from '@/features/equipment'
import { getStatusInfo } from '@/features/equipment'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  equipment: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'deleted', 'close', 'cancel'])

// === STORE ===
const equipmentStore = useEquipmentStore()

// === СОСТОЯНИЕ ===
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const loading = ref(false)
const error = ref(null)

// === ОТЛАДОЧНЫЕ WATCHERS (можно убрать после тестирования) ===
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    console.log('🔍 [DeleteModal] Modal opened with equipment:', props.equipment)
    console.log('🔍 [DeleteModal] Equipment keys:', props.equipment ? Object.keys(props.equipment) : 'null')
  }
})

watch(() => props.equipment, (newEquipment) => {
  console.log('🔍 [DeleteModal] Equipment prop changed:', newEquipment)
}, { deep: true })

// === МЕТОДЫ ===
const handleConfirm = async () => {
  console.log('🔍 [DeleteModal] Props equipment:', props.equipment)
  console.log('🔍 [DeleteModal] Equipment ID:', props.equipment?.id)
  
  if (!props.equipment?.id) {
    console.error('❌ [DeleteModal] Нет ID оборудования для удаления')
    console.error('❌ [DeleteModal] Полный объект equipment:', JSON.stringify(props.equipment, null, 2))
    return
  }
  
  loading.value = true
  error.value = null

  try {
    console.log('🗑️ [DeleteModal] Удаляем оборудование:', props.equipment.id)
    await equipmentStore.deleteEquipment(props.equipment.id)
    
    console.log('✅ [DeleteModal] Оборудование успешно удалено')
    emit('deleted', props.equipment)
    handleClose()
  } catch (err) {
    console.error('❌ [DeleteModal] Ошибка удаления:', err)
    error.value = err.message || 'Ошибка удаления оборудования'
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
  handleClose()
}

const handleClose = () => {
  show.value = false
  error.value = null
  emit('close')
}
</script>