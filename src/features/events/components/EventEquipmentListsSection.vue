<template>
  <BentoCard size="2x1" variant="default">
    <template #header>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <IconV2 name="package" size="sm" />
            <h3 class="text-base sm:text-lg font-semibold leading-tight">Списки оборудования</h3>
            <StatusBadgeV2 :label="String(equipmentStats.totalLists)" variant="info" size="xs" />
          </div>
          <!-- Compact stats for mobile -->
          <div class="flex sm:hidden items-center gap-4 text-xs text-secondary mt-1">
            <span class="flex items-center gap-1">
              <IconV2 name="package" size="xs" />
              Всего позиций: {{ equipmentStats.totalItems }}
            </span>
          </div>
        </div>
        <div class="text-sm text-secondary hidden sm:flex items-center gap-4">
          <span class="flex items-center gap-1">
            <IconV2 name="package" size="xs" />
            Всего позиций: {{ equipmentStats.totalItems }}
          </span>
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-secondary">
        <SpinnerV2 size="sm" />
        <span>Загрузка списков...</span>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-8">
      <div class="flex items-center gap-3 text-error">
        <IconV2 name="alert-circle" size="sm" />
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Empty State -->
      <div v-if="equipmentLists.length === 0" class="text-center py-10">
        <IconV2 name="package" size="lg" class="text-secondary/50 mb-3" />
        <div class="text-primary font-medium mb-2">Списков оборудования нет</div>
        <div class="text-secondary text-sm">Для этого мероприятия не создано ни одного списка оборудования</div>
      </div>

      <!-- Equipment Lists Grid -->
      <div v-else class="grid gap-4 sm:gap-6" :class="gridClasses">
        <EquipmentListCard
          v-for="list in equipmentLists"
          :key="list.id"
          :equipment-list="list"
          @click="handleListClick(list.id)"
        />
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EventEquipmentListsSection - секция со списками оборудования мероприятия
 * Отображает все списки оборудования, связанные с мероприятием
 */
import { computed } from 'vue'
import { 
  BentoCard, 
  ButtonV2, 
  IconV2, 
  StatusBadgeV2, 
  SpinnerV2 
} from '@/shared/ui-v2'
import EquipmentListCard from './EquipmentListCard.vue'

const props = defineProps({
  // Данные списков оборудования
  equipmentLists: {
    type: Array,
    default: () => []
  },
  
  // Состояния загрузки
  isLoading: {
    type: Boolean,
    default: false
  },
  
  // Ошибки
  error: {
    type: String,
    default: null
  }
})

const emit = defineEmits([
  'list-click'
])

// Статистика списков оборудования
const equipmentStats = computed(() => {
  const lists = props.equipmentLists
  const totalLists = lists.length
  
  // Подсчитываем общее количество позиций оборудования
  let totalItems = 0
  lists.forEach(list => {
    // Сначала проверяем equipment_items (если они загружены)
    if (list.equipment_items?.length) {
      totalItems += list.equipment_items.length
    } 
    // Если equipment_items нет, используем equipment_ids
    else if (list.equipment_ids?.length) {
      totalItems += list.equipment_ids.length
    }
  })
  
  return {
    totalLists,
    totalItems
  }
})

// Адаптивная сетка в зависимости от количества списков
const gridClasses = computed(() => {
  const count = props.equipmentLists.length
  
  if (count === 1) {
    return 'grid-cols-1 max-w-md mx-auto'
  } else if (count === 2) {
    return 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
  } else if (count <= 6) {
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
  } else {
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  }
})

// Методы обработки событий
const handleListClick = (id) => {
  emit('list-click', id)
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
