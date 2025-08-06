<!--
  Компонент для отображения списка оборудования
  Архитектурная роль: отображение оборудования с информацией о точках монтажа
  Обеспечивает: табличное представление, статусы, детали монтажа
-->
<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEquipmentStore } from '@/features/equipment'

// Компоненты дизайн-системы
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

// Props
const props = defineProps({
  equipmentIds: {
    type: Array,
    default: () => []
  },
  equipmentDetails: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'security', // 'security' или 'report'
    validator: (value) => ['security', 'report'].includes(value)
  }
})

// Stores
const equipmentStore = useEquipmentStore()
const { equipments } = storeToRefs(equipmentStore)

// Computed свойства
const equipmentList = computed(() => {
  if (props.type === 'security') {
    // Для постов охраны - простой список ID
    return props.equipmentIds
      .map(id => equipments.value.find(e => e.id === id))
      .filter(Boolean)
  } else {
    // Для отчета - с деталями о точках монтажа
    return props.equipmentDetails
      .map(detail => {
        const equipment = equipments.value.find(e => e.id === detail.equipmentId)
        if (!equipment) return null
        
        return {
          ...equipment,
          mountPointName: detail.mountPointName,
          source: detail.source,
          listType: detail.listType
        }
      })
      .filter(Boolean)
  }
})

// Конфигурация статусов оборудования
const getStatusConfig = (status) => {
  const statusConfigs = {
    'В наличии': {
      label: 'В наличии',
      classes: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    },
    'Не на складе': {
      label: 'Не на складе', 
      classes: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌'
    },
    'Необходима диагностика': {
      label: 'Необходима диагностика',
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

// Конфигурация типов списков
const getListTypeConfig = (listType) => {
  const typeConfigs = {
    'planned': {
      label: 'Планируемое',
      classes: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: '📋'
    },
    'final': {
      label: 'Итоговое',
      classes: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    }
  }
  return typeConfigs[listType] || {
    label: listType || 'Неизвестно',
    classes: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: ''
  }
}
</script>

<template>
  <div>
    <!-- Состояние загрузки -->
    <div v-if="loading" class="flex justify-center py-8">
      <Spinner class="h-8 w-8 text-blue-600" />
    </div>

    <!-- Пустой список -->
    <EmptyState
      v-else-if="!equipmentList.length"
      message="Оборудование не найдено"
      description="Нет оборудования в выбранных списках"
      icon="📦"
    />

    <!-- Таблица оборудования -->
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Оборудование
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Категория
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Статус
            </th>
            <th v-if="type === 'report'" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Точка монтажа
            </th>
            <th v-if="type === 'report'" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Тип списка
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Серийный номер
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr 
            v-for="equipment in equipmentList" 
            :key="equipment.id"
            class="hover:bg-gray-50 transition-colors"
          >
            <!-- Оборудование -->
            <td class="px-4 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="max-w-xs">
                  <div class="text-sm font-medium text-gray-900 truncate">
                    {{ equipment.brand }} {{ equipment.model }}
                  </div>
                  <div class="text-sm text-gray-500 truncate">
                    {{ equipment.subcategory }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Категория -->
            <td class="px-4 py-4 whitespace-nowrap">
              <span class="text-sm text-gray-900">{{ equipment.category }}</span>
            </td>

            <!-- Статус -->
            <td class="px-4 py-4 whitespace-nowrap">
              <span
                class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border"
                :class="getStatusConfig(equipment.status).classes"
              >
                <span v-if="getStatusConfig(equipment.status).icon" class="mr-1.5">
                  {{ getStatusConfig(equipment.status).icon }}
                </span>
                {{ getStatusConfig(equipment.status).label }}
              </span>
            </td>

            <!-- Точка монтажа (только для отчета) -->
            <td v-if="type === 'report'" class="px-4 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <Icon name="MapPin" set="lucide" size="sm" class="text-gray-400 mr-2" />
                <span class="text-sm text-gray-900">{{ equipment.mountPointName }}</span>
              </div>
            </td>

            <!-- Тип списка (только для отчета) -->
            <td v-if="type === 'report'" class="px-4 py-4 whitespace-nowrap">
              <span
                class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border"
                :class="getListTypeConfig(equipment.listType).classes"
              >
                <span v-if="getListTypeConfig(equipment.listType).icon" class="mr-1.5">
                  {{ getListTypeConfig(equipment.listType).icon }}
                </span>
                {{ getListTypeConfig(equipment.listType).label }}
              </span>
            </td>

            <!-- Серийный номер -->
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ equipment.serial_number || 'Не указан' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Статистика -->
    <div v-if="equipmentList.length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-600">
          Всего оборудования: <span class="font-semibold">{{ equipmentList.length }}</span>
        </span>
        <span v-if="type === 'report'" class="text-gray-600">
          Уникальных единиц: <span class="font-semibold">{{ new Set(equipmentList.map(e => e.id)).size }}</span>
        </span>
      </div>
    </div>
  </div>
</template> 