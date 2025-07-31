<!--
  Компонент для отображения списков оборудования мероприятия
  Архитектурная роль: главный компонент списков оборудования с разделением на охрану и отчет
  Обеспечивает: два типа списков с разной детализацией
-->
<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventEquipmentStore } from '@/stores/event-equipment-store'
import { useEquipmentStore } from '@/stores/equipment-store'

// Компоненты
import EquipmentList from './EquipmentList.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

// Props
const props = defineProps({
  eventId: {
    type: String,
    required: true
  }
})

// Stores
const eventEquipmentStore = useEventEquipmentStore()
const equipmentStore = useEquipmentStore()
const { loading } = storeToRefs(eventEquipmentStore)

// Computed свойства
const securityEquipmentList = computed(() => {
  return eventEquipmentStore.securityEquipmentList || []
})

const reportEquipmentList = computed(() => {
  return eventEquipmentStore.reportEquipmentList || []
})

const allocationStats = computed(() => {
  return eventEquipmentStore.allocationStats || { categories: [] }
})

// Функция для генерации цветов категорий
const getCategoryColor = (categoryName) => {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#06B6D4', // cyan
    '#F97316', // orange
    '#EC4899', // pink
    '#84CC16', // lime
    '#6366F1'  // indigo
  ]
  
  // Простая хеш-функция для стабильного цвета
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}

// Загрузка данных
onMounted(async () => {
  try {
    // Загружаем распределение оборудования для мероприятия
    await eventEquipmentStore.loadEventAllocation(props.eventId)
    
    // Загружаем все оборудование если еще не загружено
    if (equipmentStore.equipments.length === 0) {
      await equipmentStore.loadAllEquipments()
    }
  } catch (error) {
    console.error('Ошибка загрузки данных оборудования:', error)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Список для постов охраны -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-900">
          Список оборудования для постов охраны
        </h3>
        <div class="flex items-center gap-2">
          <Icon name="Shield" set="lucide" size="md" class="text-blue-600" />
          <span class="text-sm font-medium text-blue-600">
            {{ (securityEquipmentList || []).length }} единиц
          </span>
        </div>
      </div>
      
      <div class="p-6">
        <EquipmentList 
          :equipment-ids="securityEquipmentList"
          :loading="loading"
          type="security"
        />
      </div>
    </div>

    <!-- Список для отчета -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              Список оборудования для отчета
            </h3>
            <p class="text-sm text-gray-600 mt-1">
              Планируемое и итоговое оборудование всех точек монтажа с указанием места установки
            </p>
          </div>
                     <div class="flex items-center gap-2">
             <Icon name="FileText" set="lucide" size="md" class="text-green-600" />
             <span class="text-sm font-medium text-green-600">
               {{ (reportEquipmentList || []).length }} единиц
             </span>
           </div>
        </div>
      </div>
      
      <div class="p-6">
        <EquipmentList 
          :equipment-details="reportEquipmentList"
          :loading="loading"
          type="report"
        />
      </div>
    </div>

    <!-- Статистика по категориям -->
    <div v-if="allocationStats && allocationStats.categories && allocationStats.categories.length > 0" class="bg-white rounded-lg shadow p-6">
      <h4 class="text-lg font-semibold text-gray-900 mb-4">
        Распределение оборудования по категориям
      </h4>
      
      <!-- Общая информация -->
      <div class="mb-6 p-4 bg-blue-50 rounded-lg">
        <div class="text-center">
          <div class="text-3xl font-bold text-blue-600">{{ allocationStats.totalUsed || 0 }}</div>
          <div class="text-sm text-gray-600">Всего единиц оборудования на мероприятии</div>
        </div>
      </div>
      
      <!-- График категорий -->
      <div class="space-y-4">
        <div 
          v-for="category in allocationStats.categories" 
          :key="category.name"
          class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: getCategoryColor(category.name) }"></div>
            <div>
              <div class="font-medium text-gray-900">{{ category.name }}</div>
              <div class="text-sm text-gray-600">{{ category.count }} единиц</div>
            </div>
          </div>
          
          <div class="flex items-center gap-4">
            <!-- Прогресс-бар -->
            <div class="w-32 bg-gray-200 rounded-full h-2">
              <div 
                class="h-2 rounded-full transition-all duration-300"
                :style="{ 
                  width: (category.percentage || 0) + '%',
                  backgroundColor: getCategoryColor(category.name)
                }"
              ></div>
            </div>
            
            <!-- Процент -->
            <div class="text-sm font-medium text-gray-700 w-12 text-right">
              {{ category.percentage || 0 }}%
            </div>
          </div>
        </div>
      </div>
      
      <!-- Детальная информация -->
      <div class="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          v-for="category in (allocationStats.categories || []).slice(0, 6)" 
          :key="category.name"
          class="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between mb-2">
            <h5 class="font-medium text-gray-900">{{ category.name }}</h5>
            <span class="text-sm font-bold" :style="{ color: getCategoryColor(category.name) }">
              {{ category.count }}
            </span>
          </div>
          <div class="text-xs text-gray-500">
            {{ category.percentage || 0 }}% от общего количества
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 