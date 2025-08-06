<script setup>
/**
 * Страница выбора итогового оборудования для точки монтажа
 * Адаптированная версия equipment-selection-page для выбора итогового оборудования
 * Архитектурная роль: страница выбора итогового оборудования с сохранением в точку монтажа
 * Обеспечивает: выбор оборудования, фильтрацию, сохранение выбора (исключая уже выбранное в планируемом списке)
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEquipmentStore } from '@/features/equipment'
import { useMountPointStore } from '@/app/store/mount-point-store'
import { useEventEquipmentStore } from '@/app/store/event-equipment-store'

// Компоненты фичи оборудования
import EquipmentFilters from '@/features/equipment/ui/EquipmentFilters.vue'
import EquipmentTable from '@/features/equipment/EquipmentTable.vue'

// Компоненты дизайн-системы
import Button from '@/shared/ui/atoms/Button.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'
import Pagination from '@/shared/ui/molecules/Pagination.vue'

// Router
const route = useRoute()
const router = useRouter()

// Параметры из URL
const mountPointId = route.params.mountPointId
const eventId = route.params.eventId

// Stores
const equipmentStore = useEquipmentStore()
const { equipments, loading, error, total, page, limit } = storeToRefs(equipmentStore)
const { loadEquipments, clearError, setPage, setLimit } = equipmentStore
const mountPointStore = useMountPointStore()
const eventEquipmentStore = useEventEquipmentStore()

// Локальные состояния страницы
const isInitialLoading = ref(true)
const selectedEquipment = ref([])
const isSaving = ref(false)

// Computed свойства
const hasData = computed(() => equipments.value && equipments.value.length > 0)
const isEmpty = computed(() => !loading.value && !error.value && !hasData.value)
const hasError = computed(() => Boolean(error.value))
const hasSelection = computed(() => selectedEquipment.value.length > 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

// Получаем планируемое оборудование для фильтрации
const plannedEquipmentIds = computed(() => {
  const mountPoint = mountPointStore.getMountPointById(mountPointId)
  return mountPoint?.equipment_plan || []
})

// Получаем доступное оборудование с учетом других точек монтажа и планируемого списка
const availableEquipments = computed(() => {
  // Получаем оборудование, исключая планируемое из текущей точки
  const plannedIds = plannedEquipmentIds.value
  const allAvailable = eventEquipmentStore.getAvailableEquipment(mountPointId, 'final')
  
  return allAvailable.filter(equipment => 
    !plannedIds.includes(equipment.id)
  )
})

// Проверка наличия изменений
const hasChanges = computed(() => {
  if (!mountPointId) return false
  
  const mountPoint = mountPointStore.getMountPointById(mountPointId)
  const currentEquipmentFinal = mountPoint?.equipment_final || []
  
  // Сравниваем массивы строковых ID
  const currentSorted = [...currentEquipmentFinal].sort()
  const selectedSorted = [...selectedEquipment.value].sort()
  
  return JSON.stringify(currentSorted) !== JSON.stringify(selectedSorted)
})

const pageTitle = computed(() => {
  if (loading.value && isInitialLoading.value) return 'Загрузка оборудования...'
  if (hasError.value) return 'Ошибка загрузки оборудования'
  if (isEmpty.value) return 'Оборудование не найдено'
  return `Выбор итогового оборудования (${availableEquipments.value.length} доступно)`
})

const mountPointName = computed(() => {
  const mountPoint = mountPointStore.getMountPointById(mountPointId)
  return mountPoint?.name || 'Точка монтажа'
})

// Статистика распределения оборудования
const allocationStats = computed(() => {
  return eventEquipmentStore.allocationStats
})

// Функция для загрузки уже выбранного итогового оборудования
const loadExistingSelection = () => {
  if (!mountPointId) return
  
  const mountPoint = mountPointStore.getMountPointById(mountPointId)
  
  if (mountPoint && mountPoint.equipment_final) {
    // Оставляем ID как строки, так как в базе данных они хранятся как строки
    selectedEquipment.value = [...mountPoint.equipment_final]
  }
}

// Обработчики событий
const handleSearch = (query) => {
  // Поиск обрабатывается автоматически через composables и store
}

const handleRetry = () => {
  clearError()
  loadEquipments()
}

const handleEquipmentSelect = (equipmentId) => {
  const index = selectedEquipment.value.indexOf(equipmentId)
  if (index > -1) {
    selectedEquipment.value.splice(index, 1)
  } else {
    selectedEquipment.value.push(equipmentId)
  }
}

const clearSelection = () => {
  selectedEquipment.value = []
}

const handlePageChange = (newPage) => {
  setPage(newPage)
}

const saveSelection = async () => {
  if (!mountPointId) {
    console.error('Нет ID точки монтажа')
    return
  }

  isSaving.value = true
  
  try {
    // Используем новый store для обновления
    await eventEquipmentStore.updateMountPointEquipment(
      mountPointId, 
      'final', 
      selectedEquipment.value
    )
    
    // Возвращаемся к странице точки монтажа
    router.push(`/mount-point/${mountPointId}`)
    
  } catch (err) {
    console.error('Ошибка сохранения итогового оборудования:', err)
  } finally {
    isSaving.value = false
  }
}

const goBack = () => {
  router.push(`/mount-point/${mountPointId}`)
}

// Конфигурация статусов оборудования (как в EquipmentTable)
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

// Загрузка данных при монтировании
onMounted(async () => {
  try {
    // Сначала загружаем распределение оборудования для мероприятия
    await eventEquipmentStore.loadEventAllocation(eventId)
    
    // Затем загружаем данные точки монтажа
    if (!mountPointStore.getMountPointById(mountPointId)) {
      await mountPointStore.loadMountPoints()
    }
    
    // Загружаем уже выбранное оборудование
    loadExistingSelection()
    
    // Затем загружаем оборудование
    await loadEquipments()
    
  } finally {
    isInitialLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Основной контейнер -->
    <div class="relative z-10 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4">
      <!-- Breadcrumbs -->
      <nav class="flex mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <li>
            <button
              @click="goBack"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="ArrowLeft" set="lucide" size="sm" />
              Назад к точке монтажа
            </button>
          </li>
          <li aria-current="page">
            <div class="inline-flex items-center gap-2">
              <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400" />
              <span class="text-sm font-medium text-gray-500">Выбор итогового оборудования</span>
            </div>
          </li>
        </ol>
      </nav>

      <!-- Заголовок страницы -->
      <div class="mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">{{ pageTitle }}</h1>
            <p class="mt-2 text-sm text-gray-600">
              Выберите итоговое оборудование для точки монтажа "{{ mountPointName }}"
            </p>
            <p class="mt-1 text-sm text-green-600">
              💡 Оборудование из планируемого списка автоматически исключено из выбора
            </p>
          </div>
          
          <!-- Панель действий -->
          <div class="flex flex-col sm:flex-row gap-3">
            <Button
              @click="clearSelection"
              variant="secondary"
              size="lg"
              :disabled="!hasSelection"
              class="w-full sm:w-auto"
            >
              <Icon name="X" set="lucide" size="sm" class="mr-2" />
              Очистить выбор
            </Button>
            <Button
              @click="saveSelection"
              variant="primary"
              size="lg"
              :loading="isSaving"
              :disabled="!hasChanges"
              class="w-full sm:w-auto"
            >
              <Icon name="Save" set="lucide" size="sm" class="mr-2" />
              {{ hasChanges ? 'Сохранить изменения' : 'Нет изменений' }}
            </Button>
          </div>
        </div>

        <!-- Статистика выбора -->
        <div v-if="hasSelection || hasChanges" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center gap-4">
            <Icon name="CheckCircle" set="lucide" size="md" class="text-green-600" />
            <div>
              <p class="text-sm font-medium text-green-900">
                Выбрано итоговое оборудование: <span class="font-bold">{{ selectedEquipment.length }}</span> единиц
              </p>
              <p v-if="hasChanges" class="text-xs text-green-700 mt-1">
                Есть несохраненные изменения. Нажмите "Сохранить изменения" для завершения.
              </p>
              <p v-else class="text-xs text-green-700 mt-1">
                Итоговое оборудование уже сохранено. Внесите изменения для обновления.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Состояние начальной загрузки -->
      <div v-if="loading && isInitialLoading" class="flex justify-center items-center min-h-[400px]">
        <div class="text-center">
          <Spinner class="h-12 w-12 text-green-600 mx-auto mb-4" />
          <p class="text-gray-600">Загрузка оборудования...</p>
        </div>
      </div>

      <!-- Состояние ошибки -->
      <ErrorState
        v-else-if="hasError"
        :message="error"
        description="Не удалось загрузить список оборудования. Проверьте подключение к интернету и попробуйте еще раз."
        icon="⚠️"
        class="my-12"
      >
        <Button
          @click="handleRetry"
          variant="secondary"
          size="lg"
          class="mt-6"
        >
          Повторить попытку
        </Button>
      </ErrorState>

      <!-- Основной контент: фильтры + таблица -->
      <div v-else class="space-y-2">
        <!-- Панель фильтров и выбор лимита -->
        <div class="mb-4">
          <EquipmentFilters
            :loading="loading"
            :results-count="availableEquipments.length"
            @search="handleSearch"
          />
        </div>

        <!-- Состояние пустого списка -->
        <EmptyState
          v-if="availableEquipments.length === 0"
          message="Доступное оборудование не найдено"
          description="Все оборудование уже включено в планируемый список или не соответствует фильтрам"
          icon="📦"
          class="my-12"
        />

        <!-- Таблица оборудования с выбором -->
        <div v-else class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900">
                Доступное оборудование (исключая планируемое)
              </h2>
              <div class="flex items-center gap-4">
                <span class="text-sm text-gray-500">
                  Показано: {{ availableEquipments.length }} из {{ equipments.length }}
                </span>
                <span v-if="hasSelection" class="text-sm text-green-600 font-medium">
                  Выбрано: {{ selectedEquipment.length }}
                </span>
              </div>
            </div>
            
            <!-- Статистика распределения оборудования -->
            <div v-if="allocationStats" class="mt-4 p-3 bg-green-50 rounded-lg">
              <div class="flex items-center gap-6 text-sm">
                <div class="flex items-center gap-2">
                  <span class="text-gray-600">Всего оборудования:</span>
                  <span class="font-semibold">{{ allocationStats.total }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-600">Используется:</span>
                  <span class="font-semibold text-green-600">{{ allocationStats.used }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-600">Доступно:</span>
                  <span class="font-semibold text-green-600">{{ allocationStats.available }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-600">Загрузка:</span>
                  <span class="font-semibold">{{ allocationStats.utilizationRate }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Таблица с чекбоксами -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      :checked="selectedEquipment.length === availableEquipments.length && availableEquipments.length > 0"
                      :indeterminate="selectedEquipment.length > 0 && selectedEquipment.length < availableEquipments.length"
                      @change="selectedEquipment.length === availableEquipments.length ? clearSelection() : selectedEquipment = availableEquipments.map(e => e.id)"
                      class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Оборудование
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Категория
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Серийный номер
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="equipment in availableEquipments"
                  :key="equipment.id"
                  :class="[
                    'hover:bg-gray-50 cursor-pointer transition-colors',
                    selectedEquipment.includes(equipment.id) ? 'bg-green-50' : ''
                  ]"
                  @click="handleEquipmentSelect(equipment.id)"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      :checked="selectedEquipment.includes(equipment.id)"
                      @change="handleEquipmentSelect(equipment.id)"
                      @click.stop
                      class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
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
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-900">{{ equipment.category }}</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border"
                      :class="getStatusConfig(equipment.status).classes"
                    >
                      <span v-if="getStatusConfig(equipment.status).icon" class="mr-1.5">{{ getStatusConfig(equipment.status).icon }}</span>
                      {{ getStatusConfig(equipment.status).label }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ equipment.serial_number || 'Не указан' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Пагинация и выбор лимита -->
          <div 
            v-if="!loading && !error && totalPages > 1"
            class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <!-- Пагинация -->
            <Pagination
              :current-page="page"
              :total-pages="totalPages"
              :total="availableEquipments.length"
              :items-on-page="availableEquipments.length"
              @page-change="handlePageChange"
            />
            <!-- Выбор количества элементов на странице -->
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <label for="equipment-limit" class="text-sm text-gray-600 font-medium">Показывать по:</label>
              <select
                id="equipment-limit"
                class="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors cursor-pointer"
                :value="limit"
                @change="setLimit(Number($event.target.value))"
              >
                <option :value="30">30</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 