<template>
  <BentoCard 
    :title="equipment.brand + ' ' + equipment.model"
    size="1x1" 
    variant="default"
    class="hover:shadow-lg transition-shadow duration-200"
  >
    <div class="space-y-4">
      <!-- Equipment Header -->
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <IconV2 name="package" size="xs" color="white" />
            </div>
            <div>
              <h3 class="font-semibold text-primary text-sm">
                {{ equipment.brand }} {{ equipment.model }}
              </h3>
              <p class="text-xs text-secondary">
                S/N: {{ equipment.serialnumber }}
              </p>
            </div>
          </div>
        </div>
        
        <StatusBadgeV2 
          :label="equipment.status"
          :variant="getStatusVariant(equipment.status)"
          size="sm"
        />
      </div>

      <!-- Equipment Details -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-secondary">Категория:</span>
          <p class="font-medium text-primary">{{ equipment.category }}</p>
        </div>
        
        <div>
          <span class="text-secondary">Подкатегория:</span>
          <p class="font-medium text-primary">{{ equipment.subcategory || '—' }}</p>
        </div>
        
        <div>
          <span class="text-secondary">Местоположение:</span>
          <p class="font-medium text-primary">{{ equipment.location || '—' }}</p>
        </div>
        
        <div>
          <span class="text-secondary">Дата покупки:</span>
          <p class="font-medium text-primary">{{ formatDate(equipment.purchase_date) || '—' }}</p>
        </div>
      </div>

      <!-- Description -->
      <div v-if="equipment.description" class="pt-2 border-t border-gray-100">
        <span class="text-secondary text-sm">Описание:</span>
        <p class="text-sm text-primary mt-1 line-clamp-2">
          {{ equipment.description }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-4 border-t border-gray-100">
        <div class="flex items-center gap-2">
          <ButtonV2
            variant="ghost"
            size="sm"
            @click="handleView"
          >
            <IconV2 name="eye" size="xs" class="mr-1" />
            Просмотр
          </ButtonV2>
          
          <ButtonV2
            variant="ghost"
            size="sm"
            @click="handleEdit"
          >
            <IconV2 name="edit" size="xs" class="mr-1" />
            Изменить
          </ButtonV2>
        </div>
        
        <DropdownV2
          :items="getEquipmentActions(equipment)"
          @select="handleAction"
          placement="bottom-end"
        >
          <ButtonV2 variant="ghost" size="sm" class="flex items-center gap-1">
            <IconV2 name="more-vertical" size="xs" color="secondary" />
            <span>•••</span>
          </ButtonV2>
        </DropdownV2>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EquipmentCard - EPR System
 * 
 * Компонент карточки оборудования
 * Использует UI Kit v2 и Bento Grid дизайн
 */

import { computed } from 'vue'

// UI Kit v2
import { 
  ButtonV2,
  IconV2,
  StatusBadgeV2,
  DropdownV2
} from '@/shared/ui-v2'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

// Props
const props = defineProps({
  equipment: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['view', 'edit', 'action'])

// Computed
const getStatusVariant = (status) => {
  const variants = {
    'available': 'success',
    'in_use': 'warning', 
    'maintenance': 'error',
    'retired': 'secondary'
  }
  return variants[status] || 'secondary'
}

const getEquipmentActions = (equipment) => [
  {
    label: 'Дублировать',
    value: 'duplicate',
    icon: 'copy',
    data: equipment
  },
  {
    label: 'История',
    value: 'history',
    icon: 'clock',
    data: equipment
  },
  { type: 'divider' },
  {
    label: 'Удалить',
    value: 'delete',
    icon: 'trash-2',
    variant: 'danger',
    data: equipment
  }
]

// Methods
const formatDate = (date) => {
  if (!date) return null
  return new Date(date).toLocaleDateString('ru-RU')
}

const handleView = () => {
  emit('view', props.equipment)
}

const handleEdit = () => {
  emit('edit', props.equipment)
}

const handleAction = (data) => {
  emit('action', data)
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