<template>
  <!-- ✅ Модальное окно просмотра оборудования - UI Kit v2 -->
  <ModalV2
    v-model="show"
    title="Просмотр оборудования"
    :description="`Информация об оборудовании: ${equipment?.brand || ''} ${equipment?.model || ''}`"
    size="lg"
    variant="default"
    :loading="loading"
    :persistent="false"
    scrollable
    @close="handleClose"
  >
    <!-- ✅ Содержимое просмотра -->
    <div class="space-y-6 pb-4" v-if="equipment">
      
      <!-- Основная информация -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-semibold text-primary mb-4">Основная информация</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Бренд</label>
            <p class="text-sm text-primary mt-1">{{ equipment.brand || '—' }}</p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Модель</label>
            <p class="text-sm text-primary mt-1">{{ equipment.model || '—' }}</p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Серийный номер</label>
            <p class="text-sm text-primary mt-1">{{ equipment.serialnumber || '—' }}</p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Статус</label>
            <div class="mt-1">
              <StatusBadgeV2
                v-if="equipment.availability"
                :label="getStatusInfo(equipment.availability)?.label || 'Неизвестно'"
                :variant="getStatusInfo(equipment.availability)?.variant || 'secondary'"
                size="sm"
              />
              <span v-else class="text-sm text-secondary">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Категоризация -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-semibold text-primary mb-4">Категория и местоположение</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Категория</label>
            <p class="text-sm text-primary mt-1">{{ equipment.type || '—' }}</p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Подкатегория</label>
            <p class="text-sm text-primary mt-1">{{ equipment.subtype || '—' }}</p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Местоположение</label>
            <p class="text-sm text-primary mt-1">{{ equipment.location || '—' }}</p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Количество</label>
            <p class="text-sm text-primary mt-1">{{ equipment.count || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Техническая информация -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6" v-if="equipment.technicalspecification || equipment.lengthinmeters">
        <h3 class="text-lg font-semibold text-primary mb-4">Техническая информация</h3>
        <div class="space-y-4">
          <div v-if="equipment.technicalspecification">
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Технические характеристики</label>
            <p class="text-sm text-primary mt-1 whitespace-pre-wrap">{{ equipment.technicalspecification }}</p>
          </div>
          
          <div v-if="equipment.lengthinmeters">
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Длина (метры)</label>
            <p class="text-sm text-primary mt-1">{{ equipment.lengthinmeters }} м</p>
          </div>
        </div>
      </div>

      <!-- Описание -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6" v-if="equipment.description">
        <h3 class="text-lg font-semibold text-primary mb-4">Описание и заметки</h3>
        <div>
          <label class="text-xs font-medium text-secondary uppercase tracking-wider">Описание</label>
          <p class="text-sm text-primary mt-1 whitespace-pre-wrap">{{ equipment.description }}</p>
        </div>
      </div>

      <!-- Системная информация -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-8">
        <h3 class="text-lg font-semibold text-primary mb-4">Системная информация</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Дата создания</label>
            <p class="text-sm text-primary mt-1">
              {{ equipment.created_at ? new Date(equipment.created_at).toLocaleDateString('ru-RU') : '—' }}
            </p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">Последнее обновление</label>
            <p class="text-sm text-primary mt-1">
              {{ equipment.updated_at ? new Date(equipment.updated_at).toLocaleDateString('ru-RU') : '—' }}
            </p>
          </div>
          
          <div>
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">ID оборудования</label>
            <p class="text-xs text-secondary mt-1 font-mono">{{ equipment.id || '—' }}</p>
          </div>
          
          <div v-if="equipment.uuid">
            <label class="text-xs font-medium text-secondary uppercase tracking-wider">UUID</label>
            <p class="text-xs text-secondary mt-1 font-mono">{{ equipment.uuid }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ✅ Кнопки действий в футере -->
    <template #footer>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
        <!-- Мобильная версия: все кнопки в одну колонку -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 sm:w-auto">
          <ButtonV2 
            variant="ghost" 
            size="sm"
            class="w-full sm:w-auto"
            @click="handleClose"
          >
            Закрыть
          </ButtonV2>
        </div>
        
        <!-- Основные действия: адаптивные -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <ButtonV2 
            variant="secondary" 
            size="sm"
            class="w-full sm:w-auto"
            @click="handleEdit"
            :loading="loading"
          >
            <template #icon>
              <IconV2 name="edit" size="xs" />
            </template>
            <span class="hidden sm:inline">Редактировать</span>
            <span class="sm:hidden">Изменить</span>
          </ButtonV2>
          
          <ButtonV2 
            variant="danger" 
            size="sm"
            class="w-full sm:w-auto"
            @click="handleDelete"
            :loading="loading"
          >
            <template #icon>
              <IconV2 name="trash-2" size="xs" />
            </template>
            Удалить
          </ButtonV2>
        </div>
      </div>
    </template>
  </ModalV2>
</template>

<script setup>
/**
 * EquipmentViewModal - EPR System
 * 
 * Модальное окно просмотра оборудования с возможностью
 * перехода к редактированию или удалению
 * Использует UI Kit v2
 */

import { ref, watch } from 'vue'
import { 
  ModalV2, 
  ButtonV2, 
  IconV2,
  StatusBadgeV2 
} from '@/shared/ui-v2'
import { getStatusInfo } from '@/features/equipment/constants/statuses.js'

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
const emit = defineEmits(['update:modelValue', 'edit', 'delete', 'close'])

// State
const show = ref(props.modelValue)
const loading = ref(false)

// Watchers
watch(() => props.modelValue, (newValue) => {
  show.value = newValue
})

watch(() => show.value, (newValue) => {
  emit('update:modelValue', newValue)
})

// Methods
const handleClose = () => {
  show.value = false
  emit('close')
}

const handleEdit = () => {
  console.log('📝 [ViewModal] Edit equipment:', props.equipment?.id)
  emit('edit', props.equipment)
  handleClose()
}

const handleDelete = () => {
  console.log('🗑️ [ViewModal] Delete equipment:', props.equipment?.id)
  emit('delete', props.equipment)
  handleClose()
}
</script>