<template>
  <div 
    class="group rounded-xl border border-secondary/20 bg-white hover:shadow-md transition-all duration-200 overflow-hidden relative min-h-0"
  >
    <!-- 📦 ЗАГОЛОВОК СПИСКА -->
    <div class="p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0 flex-1">
          <h4 
            class="text-lg font-semibold text-primary truncate mb-1" 
            :title="equipmentList.name || 'Список без названия'"
          >
            {{ equipmentList.name || 'Список без названия' }}
          </h4>
          <div class="flex items-center gap-2 text-sm text-secondary">
            <IconV2 name="package" size="xs" />
            <span class="truncate">{{ equipmentList.type || 'Общий список' }}</span>
          </div>
        </div>
        
        <!-- Количество позиций -->
        <div class="text-xs text-secondary">
          {{ equipmentCount }} позиций
        </div>
      </div>
    </div>

    <!-- 📦 СПИСОК ОБОРУДОВАНИЯ -->
    <div class="px-4 pb-4">
      <!-- Краткая информация о списке -->
      <div class="mb-4">
        <div class="flex items-center justify-between text-sm mb-2">
          <span class="text-secondary">Позиций в списке:</span>
          <span class="font-medium text-primary">{{ equipmentCount }}</span>
        </div>
        
        <!-- Описание списка если есть -->
        <div v-if="equipmentList.description" class="text-sm text-secondary line-clamp-2">
          {{ equipmentList.description }}
        </div>
        
        <!-- Дата обновления -->
        <div class="flex items-center gap-2 text-xs text-secondary mt-2">
          <IconV2 name="calendar" size="xs" />
          <span>Обновлен {{ formatDate(equipmentList.updated_at) }}</span>
        </div>
      </div>
    </div>

    <!-- Кнопка открытия списка -->
    <div class="px-4 pb-4">
      <ButtonV2 
        variant="primary" 
        size="sm" 
        @click.stop="handleGoToList"
        class="w-full"
      >
        <template #icon><IconV2 name="external-link" size="xs" /></template>
        Открыть список
      </ButtonV2>
    </div>
  </div>
</template>

<script setup>
/**
 * EquipmentListCard - карточка списка оборудования
 * Отображает информацию о списке оборудования с статистикой и действиями
 */
import { computed } from 'vue'
import { StatusBadgeV2, IconV2, ButtonV2 } from '@/shared/ui-v2'

const props = defineProps({
  equipmentList: { 
    type: Object, 
    required: true 
  }
})

const emit = defineEmits(['click'])

// Количество позиций оборудования в списке
const equipmentCount = computed(() => {
  console.log('🔍 [EquipmentListCard] Данные списка:', {
    id: props.equipmentList.id,
    name: props.equipmentList.name,
    equipment_items: props.equipmentList.equipment_items?.length,
    equipment_ids: props.equipmentList.equipment_ids?.length,
    fullData: props.equipmentList
  })
  
  // Сначала проверяем equipment_items (если они загружены)
  if (props.equipmentList.equipment_items?.length) {
    return props.equipmentList.equipment_items.length
  }
  
  // Если equipment_items нет, используем equipment_ids
  if (props.equipmentList.equipment_ids?.length) {
    return props.equipmentList.equipment_ids.length
  }
  
  return 0
})

// Методы
const handleGoToList = () => {
  emit('click', props.equipmentList.id)
}

// Форматирование даты
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { 
    day: '2-digit', 
    month: 'short' 
  }).format(date)
}
</script>

<style scoped>
/* Плавные переходы для всех элементов */
* {
  transition: all 0.2s ease-in-out;
}
</style>
