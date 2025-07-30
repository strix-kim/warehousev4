<!--
  MountPointEquipmentManager - управление оборудованием точки монтажа
  Архитектурная роль: главный компонент для управления планируемым/установленным оборудованием
  Функции: кнопка формирования планируемого списка оборудования
-->
<template>
  <div class="mount-point-equipment-manager space-y-6">
    <!-- Кнопка формирования планируемого списка -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div class="flex items-center gap-4 mb-4">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Icon name="Calendar" set="lucide" size="lg" class="text-blue-600" />
          </div>
    </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-blue-900 mb-1">
            Планируемое оборудование
          </h3>
          <p class="text-sm text-blue-700">
            {{ hasPlannedEquipment
              ? `В списке ${props.initialData.equipment_plan.length} единиц оборудования. Нажмите кнопку для изменения.`
              : 'Создайте список оборудования, которое планируется использовать на данной точке монтажа'
            }}
          </p>
      </div>
    </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <Button
          @click="openPlannedListModal"
          variant="primary"
          size="lg"
          class="flex-1"
        >
          <Icon :name="buttonIcon" set="lucide" size="sm" class="mr-2" />
          {{ buttonText }}
        </Button>
      </div>
    </div>

    <!-- Список планируемого оборудования -->
    <div v-if="hasPlannedEquipment" class="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div class="px-6 py-4 border-b border-gray-200">
        <h4 class="text-lg font-semibold text-gray-900">
          Список планируемого оборудования
        </h4>
        <p class="text-sm text-gray-600 mt-1">
          {{ plannedEquipmentList.length }} единиц оборудования
        </p>
      </div>

      <div class="divide-y divide-gray-200">
        <div
          v-for="equipment in plannedEquipmentList"
          :key="equipment.id"
          class="px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Icon name="Package" set="lucide" size="sm" class="text-blue-600" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h5 class="text-sm font-medium text-gray-900 truncate">
                    {{ equipment.brand }} {{ equipment.model }}
                  </h5>
                  <div class="flex items-center gap-4 mt-1">
                    <span class="text-xs text-gray-500">{{ equipment.category }}</span>
                    <span class="text-xs text-gray-500">{{ equipment.subcategory }}</span>
                    <span
                      class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border"
                      :class="getStatusConfig(equipment.status).classes"
                    >
                      <span v-if="getStatusConfig(equipment.status).icon" class="mr-1">{{ getStatusConfig(equipment.status).icon }}</span>
                      {{ getStatusConfig(equipment.status).label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Заглушка, если список пуст -->
    <div v-else class="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon name="Package" set="lucide" size="lg" class="text-gray-400" />
             </div>
      <h4 class="text-lg font-medium text-gray-900 mb-2">Список еще не сформирован</h4>
      <p class="text-sm text-gray-600">
        Нажмите кнопку выше, чтобы создать список планируемого оборудования
      </p>
           </div>

    <!-- Кнопка формирования итогового списка -->
    <div class="bg-green-50 border border-green-200 rounded-lg p-6">
      <div class="flex items-center gap-4 mb-4">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Icon name="CheckCircle" set="lucide" size="lg" class="text-green-600" />
             </div>
           </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-green-900 mb-1">
            Итоговое оборудование
          </h3>
          <p class="text-sm text-green-700">
            {{ hasFinalEquipment
              ? `В списке ${props.initialData.equipment_final?.length || 0} единиц оборудования. Нажмите кнопку для изменения.`
              : 'Создайте итоговый список оборудования, которое будет использоваться на данной точке монтажа'
            }}
           </p>
         </div>
       </div>

      <div class="flex flex-col sm:flex-row gap-3">
               <Button
          @click="openFinalListModal"
          variant="primary"
          size="lg"
          class="flex-1"
          :disabled="!hasPlannedEquipment"
        >
          <Icon :name="finalButtonIcon" set="lucide" size="sm" class="mr-2" />
          {{ finalButtonText }}
               </Button>
             </div>
           </div>

    <!-- Список итогового оборудования -->
    <div v-if="hasFinalEquipment" class="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div class="px-6 py-4 border-b border-gray-200">
        <h4 class="text-lg font-semibold text-gray-900">
          Список итогового оборудования
        </h4>
        <p class="text-sm text-gray-600 mt-1">
          {{ finalEquipmentList.length }} единиц оборудования
        </p>
         </div>

      <div class="divide-y divide-gray-200">
        <div
          v-for="equipment in finalEquipmentList"
          :key="equipment.id"
          class="px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
               <Icon name="Package" set="lucide" size="sm" class="text-green-600" />
                  </div>
                </div>
               <div class="flex-1 min-w-0">
                  <h5 class="text-sm font-medium text-gray-900 truncate">
                    {{ equipment.brand }} {{ equipment.model }}
                  </h5>
                  <div class="flex items-center gap-4 mt-1">
                    <span class="text-xs text-gray-500">{{ equipment.category }}</span>
                    <span class="text-xs text-gray-500">{{ equipment.subcategory }}</span>
                    <span
                      class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border"
                      :class="getStatusConfig(equipment.status).classes"
                    >
                      <span v-if="getStatusConfig(equipment.status).icon" class="mr-1">{{ getStatusConfig(equipment.status).icon }}</span>
                      {{ getStatusConfig(equipment.status).label }}
                    </span>
             </div>
           </div>
         </div>
       </div>
     </div>
       </div>
         </div>
         </div>
         
    <!-- Заглушка, если итоговый список пуст -->
    <div v-else class="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon name="Package" set="lucide" size="lg" class="text-gray-400" />
       </div>
      <h4 class="text-lg font-medium text-gray-900 mb-2">Итоговый список еще не сформирован</h4>
      <p class="text-sm text-gray-600">
        {{ hasPlannedEquipment
          ? 'Нажмите кнопку выше, чтобы создать итоговый список оборудования'
          : 'Сначала создайте планируемый список оборудования'
        }}
         </p>
       </div>
  </div>
</template>

<script setup>
/**
 * MountPointEquipmentManager - главный компонент управления оборудованием
 * Упрощенная версия с только кнопкой формирования планируемого списка
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEquipmentStore } from '@/stores/equipment-store'
import { useEventEquipmentStore } from '@/stores/event-equipment-store'
import Button from '@/shared/ui/atoms/Button.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

// Пропсы
const props = defineProps({
  eventId: {
    type: [String, Number],
    required: true
  },
  mountPointId: {
    type: [String, Number],
    default: null
  },
  initialData: {
    type: Object,
    default: () => ({})
  }
})

// События
const emit = defineEmits(['save', 'change', 'error'])

// Router
const router = useRouter()

// Store
const equipmentStore = useEquipmentStore()
const eventEquipmentStore = useEventEquipmentStore()

// Computed свойства
const hasPlannedEquipment = computed(() => {
  return props.initialData?.equipment_plan && props.initialData.equipment_plan.length > 0
})

const plannedEquipmentList = computed(() => {
  if (!hasPlannedEquipment.value) return []

  return props.initialData.equipment_plan.map(equipmentId => {
    return equipmentStore.getEquipmentById(equipmentId)
  }).filter(Boolean)
})

const buttonText = computed(() => {
  return hasPlannedEquipment.value
    ? 'Изменить планируемый список оборудования'
    : 'Сформировать планируемый список оборудования'
})

const buttonIcon = computed(() => {
  return hasPlannedEquipment.value ? 'Edit' : 'Plus'
})

const hasFinalEquipment = computed(() => {
  return props.initialData?.equipment_final && props.initialData.equipment_final.length > 0
})

const finalEquipmentList = computed(() => {
  if (!hasFinalEquipment.value) return []

  return props.initialData.equipment_final.map(equipmentId => {
    return equipmentStore.getEquipmentById(equipmentId)
  }).filter(Boolean)
})

const finalButtonText = computed(() => {
  return hasFinalEquipment.value
    ? 'Изменить итоговый список оборудования'
    : 'Сформировать итоговый список оборудования'
})

const finalButtonIcon = computed(() => {
  return hasFinalEquipment.value ? 'Edit' : 'Plus'
})

// Статистика распределения оборудования
const allocationStats = computed(() => {
  return eventEquipmentStore.allocationStats
})

// Конфигурация статусов оборудования
const getStatusConfig = (status) => {
  const statusConfigs = {
    operational: {
      label: 'Работает',
      classes: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    },
    broken: {
      label: 'Сломано',
      classes: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌'
    },
    in_repair: {
      label: 'В ремонте',
      classes: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '🔧'
    }
  }
  return statusConfigs[status] || {
    label: status || 'Неизвестно',
    classes: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: ''
  }
}

// Локальные состояния - больше не нужны, но оставляем для совместимости

// Методы
const openPlannedListModal = () => {
  router.push(`/mount-point/${props.mountPointId}/equipment-selection/${props.eventId}`)
}

const openFinalListModal = () => {
  router.push(`/mount-point/${props.mountPointId}/final-equipment-selection/${props.eventId}`)
}

// Загрузка данных при монтировании
onMounted(async () => {
  // Загружаем распределение оборудования для мероприятия
  await eventEquipmentStore.loadEventAllocation(props.eventId)
  
  // Загружаем все оборудование если еще не загружено
  if (equipmentStore.equipments.length === 0) {
    await equipmentStore.loadAllEquipments()
  }
})
</script>

<style scoped>
.mount-point-equipment-manager {
  /* Стили для анимаций */
}

/* Анимация для карточек итогового списка */
.grid > div {
  transition: all 0.2s ease;
}

.grid > div:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* Стили для индикаторов изменений */
.has-changes {
  position: relative;
}

.has-changes::before {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background-color: #f59e0b;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
}
</style> 