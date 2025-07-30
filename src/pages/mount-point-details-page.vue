<script setup>
/**
 * MountPointDetailsPage — страница деталей точки монтажа
 * Полнофункциональная страница с управлением оборудованием, назначением инженеров,
 * техническими заданиями, редактированием и удалением
 * Использует современный дизайн с синей цветовой схемой и Tailwind CSS
 */
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMountPointStore } from '@/stores/mount-point-store'
import { useUserStore } from '@/stores/user-store'
import { useEquipmentStore } from '@/stores/equipment-store'
import { useEventStore } from '@/stores/event-store'
import { storeToRefs } from 'pinia'
import Layout from '@/shared/ui/templates/Layout.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import Card from '@/shared/ui/molecules/Card.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import MountPointFormModal from '@/features/mount-point/components/MountPointFormModal.vue'
import MountPointEquipmentManager from '@/features/mount-point/components/MountPointEquipmentManager.vue'
import Modal from '@/shared/ui/molecules/Modal.vue'

const route = useRoute()
const router = useRouter()
const mountPointId = route.params.id

// Stores
const mountPointStore = useMountPointStore()
const { isLoading, error } = storeToRefs(mountPointStore)
const userStore = useUserStore()
const { users } = storeToRefs(userStore)
const equipmentStore = useEquipmentStore()
const { equipments } = storeToRefs(equipmentStore)
const eventStore = useEventStore()

// Локальное состояние
const mountPoint = ref(null)
const showEditModal = ref(false)
const isDeleting = ref(false)
const activeTab = ref('overview')
const loadingDutyId = ref(null)
const showDeleteModal = ref(false)

// Инициализация активной вкладки из URL или localStorage
const initializeActiveTab = () => {
  // Сначала проверяем URL параметр
  const urlTab = route.query.tab
  if (urlTab && ['overview', 'equipment', 'team', 'duties'].includes(urlTab)) {
    activeTab.value = urlTab
    return
  }
  
  // Если нет в URL, проверяем localStorage
  const savedTab = localStorage.getItem(`mount-point-tab-${mountPointId}`)
  if (savedTab && ['overview', 'equipment', 'team', 'duties'].includes(savedTab)) {
    activeTab.value = savedTab
  }
}

// Сохранение активной вкладки
const saveActiveTab = (tab) => {
  // Сохраняем в localStorage
  localStorage.setItem(`mount-point-tab-${mountPointId}`, tab)
  
  // Обновляем URL без перезагрузки страницы
  const newQuery = { ...route.query, tab }
  router.replace({ query: newQuery })
}

// Обработчик изменения вкладки
const handleTabChange = (tab) => {
  activeTab.value = tab
  saveActiveTab(tab)
}

// Computed свойства
const mountPointData = computed(() => {
  return mountPointStore.getMountPointById(mountPointId) || mountPoint.value
})

const eventData = computed(() => {
  if (!mountPointData.value?.event_id) return null
  return eventStore.getEventById(mountPointData.value.event_id)
})

const responsibleEngineers = computed(() => {
  if (!mountPointData.value?.responsible_engineers) return []
  return mountPointData.value.responsible_engineers
    .map(id => users.value.find(u => u.id === id))
    .filter(Boolean)
})

const plannedEquipment = computed(() => {
  if (!mountPointData.value?.equipment_plan) return []
  return mountPointData.value.equipment_plan
    .map(id => equipments.value.find(e => e.id === id))
    .filter(Boolean)
})

const actualEquipment = computed(() => {
  if (!mountPointData.value?.equipment_fact) return []
  return mountPointData.value.equipment_fact
    .map(id => equipments.value.find(e => e.id === id))
    .filter(Boolean)
})

const completionStatus = computed(() => {
  const planned = mountPointData.value?.equipment_plan?.length || 0
  const actual = mountPointData.value?.equipment_fact?.length || 0
  
  if (planned === 0) {
    return { label: 'Планирование', progress: 0, color: 'gray' }
  }
  
  const progress = Math.round((actual / planned) * 100)
  
  if (progress === 0) {
    return { label: 'Не начато', progress: 0, color: 'red' }
  } else if (progress < 100) {
    return { label: 'В процессе', progress, color: 'yellow' }
  } else {
    return { label: 'Завершено', progress: 100, color: 'green' }
  }
})

const readinessStatus = computed(() => {
  const duties = technicalDuties.value
  if (!duties.length) return { label: 'Не начато', color: 'gray', progress: 0 }

  const total = duties.length
  const completed = duties.filter(d => d.status === 'выполнено').length
  const inProgress = duties.filter(d => d.status === 'в работе').length
  const problem = duties.filter(d => d.status === 'проблема').length

  if (completed === 0) {
    return { label: 'Не начато', color: 'red', progress: 0 }
  }
  if (completed === total) {
    return { label: 'Готово', color: 'green', progress: 100 }
  }
  // Если есть хотя бы одно "в работе" или "проблема", и не все "выполнено"
  return { label: 'В процессе', color: problem > 0 ? 'red' : 'yellow', progress: Math.round((completed / total) * 100) }
})

const technicalDuties = computed(() => {
  return mountPointData.value?.technical_duties || []
})

// Статистика статусов технических заданий
const dutiesStats = computed(() => {
  const duties = technicalDuties.value
  
  return {
    inProgress: duties.filter(duty => {
      const status = typeof duty === 'object' ? duty.status : 'в работе'
      return status === 'в работе'
    }).length,
    completed: duties.filter(duty => {
      const status = typeof duty === 'object' ? duty.status : 'в работе'
      return status === 'выполнено'
    }).length,
    problem: duties.filter(duty => {
      const status = typeof duty === 'object' ? duty.status : 'в работе'
      return status === 'проблема'
    }).length
  }
})

// Функции
const formatDate = (dateStr) => {
  if (!dateStr) return 'не указана'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const openEditModal = () => {
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
}

const handleEditSubmit = async (formData) => {
  try {
    await mountPointStore.editMountPoint(mountPointId, formData)
    showEditModal.value = false
    // Обновляем локальные данные
    mountPoint.value = { ...mountPoint.value, ...formData }
  } catch (error) {
    console.error('Ошибка редактирования точки монтажа:', error)
  }
}

// handleDelete теперь вызывается только из модального окна, confirm() удалён
const handleDelete = async () => {
  isDeleting.value = true
  try {
    // Сохраняем event_id до удаления, чтобы не потерять его после удаления точки
    const eventId = mountPointData.value?.event_id
    await mountPointStore.removeMountPoint(mountPointId)
    showDeleteModal.value = false
    if (eventId) {
      router.push(`/events/${eventId}`)
    } else {
      router.push('/events')
    }
  } catch (error) {
    console.error('Ошибка удаления точки монтажа:', error)
  } finally {
    isDeleting.value = false
  }
}

const goToEvent = () => {
  if (mountPointData.value?.event_id) {
    router.push(`/events/${mountPointData.value.event_id}`)
  }
}

const goBack = () => {
  router.back()
}

const onStatusChange = async (duty, event) => {
  const prevStatus = duty.status
  const newStatus = event.target.value
  loadingDutyId.value = duty.id
  duty.error = null
  try {
    await mountPointStore.updateTechnicalDutyStatus(mountPointId, duty.id, newStatus)
    // После успешного обновления статус уже синхронизирован через store
  } catch (e) {
    duty.status = prevStatus
    duty.error = 'Не удалось обновить статус. Попробуйте ещё раз.'
  } finally {
    loadingDutyId.value = null
  }
}

// Обработчики для управления оборудованием
const handleEquipmentSave = (equipmentData) => {
  console.log('Оборудование сохранено:', equipmentData)
  // Обновляем локальные данные точки монтажа, если нужно
  if (mountPoint.value) {
    mountPoint.value.equipment_plan = equipmentData.planned
    mountPoint.value.equipment_fact = equipmentData.actual
    mountPoint.value.equipment_final = equipmentData.final
  }
}

const handleEquipmentChange = (equipmentData) => {
  // Можно добавить валидацию или другую логику при изменении
  console.log('Оборудование изменено:', equipmentData)
}

const handleEquipmentError = (errorMessage) => {
  console.error('Ошибка управления оборудованием:', errorMessage)
  // Можно показать уведомление пользователю
}

// Загрузка данных
onMounted(async () => {
  // Параллельно загружаем пользователей, оборудование и события, если их нет
  await Promise.all([
    users.value.length ? Promise.resolve() : userStore.loadUsers(),
    equipments.value.length ? Promise.resolve() : equipmentStore.loadEquipments(),
    eventStore.events.length ? Promise.resolve() : eventStore.loadEvents()
  ])
  // Инициализируем активную вкладку
  initializeActiveTab()
  // Затем загружаем точку монтажа
  const data = await mountPointStore.loadMountPointById(mountPointId)
  if (data) {
    mountPoint.value = data
  }
})

// Отслеживаем изменения URL для восстановления вкладки
watch(() => route.query.tab, (newTab) => {
  if (newTab && ['overview', 'equipment', 'team', 'duties'].includes(newTab)) {
    activeTab.value = newTab
  }
})
</script>

<template>
  <Layout>
    <!-- Хлебные крошки -->
    <nav class="flex mb-6" aria-label="Breadcrumb">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <button 
            @click="goBack"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            <Icon name="ArrowLeft" set="lucide" size="sm" class="mr-2" />
            Назад
          </button>
        </li>
        <li v-if="mountPointData?.event_id">
          <div class="flex items-center">
            <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400 mx-1" />
            <button 
              @click="goToEvent"
              class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Мероприятие
            </button>
            </div>
              </li>
        <li aria-current="page">
          <div class="flex items-center">
            <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400 mx-1" />
            <span class="text-sm font-medium text-gray-500">Точка монтажа</span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- Лоадер -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-96">
      <Spinner size="lg" />
    </div>
    
    <!-- Ошибка -->
    <ErrorState 
      v-else-if="error"
      :message="error"
      description="Попробуйте обновить страницу или вернуться назад"
    >
      <Button @click="goBack" variant="secondary" class="mt-4">
        Вернуться назад
      </Button>
    </ErrorState>

    <!-- Основной контент -->
    <div v-else-if="mountPointData" class="space-y-8">
      
      <!-- Hero секция (теперь без Card, как в EventDetails.vue) -->
      <section class="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-8">
        <!-- Градиентная шапка без внутренних отступов -->
        <div class="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700">
          <div class="px-8 py-6">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <!-- Основная информация: название и статус -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-3">
                  <h1 class="text-3xl lg:text-4xl font-bold text-white truncate">
                    {{ mountPointData.name }}
                  </h1>
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-sm font-medium',
                      readinessStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                      readinessStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    ]"
                  >
                    {{ readinessStatus.label }}
                  </span>
                </div>
                <!-- Метрики на мобильных -->
                <div class="flex flex-wrap gap-6 text-blue-100 lg:hidden">
                  <div class="flex items-center gap-2">
                    <Icon name="Users" set="lucide" size="sm" class="text-white" />
                    <span>{{ responsibleEngineers.length }} инженеров</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon name="Package" set="lucide" size="sm" class="text-white" />
                    <span>{{ plannedEquipment.length }} оборудования</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon name="ClipboardCheck" set="lucide" size="sm" class="text-white" />
                    <span>{{ readinessStatus.progress }}% готово</span>
                  </div>
                </div>
              </div>
              <!-- Метрики справа на десктопе -->
              <div class="hidden lg:flex gap-8">
                <div class="text-center">
                  <div class="flex items-center justify-center gap-2 mb-1">
                    <Icon name="Users" set="lucide" size="md" class="text-white" />
                    <span class="text-2xl font-bold text-white">{{ responsibleEngineers.length }}</span>
                  </div>
                  <div class="text-sm text-blue-200">Инженеров</div>
                </div>
                <div class="text-center">
                  <div class="flex items-center justify-center gap-2 mb-1">
                    <Icon name="Package" set="lucide" size="md" class="text-white" />
                    <span class="text-2xl font-bold text-white">{{ plannedEquipment.length }}</span>
                  </div>
                  <div class="text-sm text-blue-200">Оборудования</div>
                </div>
                <div class="text-center">
                  <div class="flex items-center justify-center gap-2 mb-1">
                    <Icon name="ClipboardCheck" set="lucide" size="md" class="text-white" />
                    <span class="text-2xl font-bold text-white">{{ readinessStatus.progress }}%</span>
                  </div>
                  <div class="text-sm text-blue-200">Готовность</div>
                  <!-- Крупный прогрессбар -->
                  <div class="w-32 h-2 bg-blue-200 rounded-full mt-2 mx-auto">
                    <div
                      class="h-2 rounded-full transition-all duration-500"
                      :class="{
                        'bg-green-500': readinessStatus.color === 'green',
                        'bg-yellow-400': readinessStatus.color === 'yellow',
                        'bg-red-400': readinessStatus.color === 'red' || readinessStatus.color === 'gray'
                      }"
                      :style="`width: ${readinessStatus.progress}%`"
                    ></div>
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Быстрые действия под секцией -->
        <div class="px-8 py-4 bg-gray-50 border-t border-gray-200">
          <div class="flex flex-wrap gap-3">
            <Button @click="openEditModal" variant="secondary" size="sm">
              <Icon name="Edit" set="lucide" size="sm" class="mr-2" />
              Редактировать
            </Button>
            <Button 
              @click="showDeleteModal = true" 
              variant="danger" 
              size="sm"
              :loading="isDeleting"
              class="ml-auto"
            >
              <Icon name="Trash2" set="lucide" size="sm" class="mr-2" />
              Удалить
            </Button>
          </div>
        </div>
      </section>

      <!-- Табы -->
      <Card variant="default" size="lg">
        <!-- Навигация табов -->
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8 px-8" aria-label="Tabs">
            <button
              @click="handleTabChange('overview')"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <div class="flex items-center gap-2">
                <Icon name="Info" set="lucide" size="sm" />
                Обзор
              </div>
            </button>
            
            <button
              @click="handleTabChange('equipment')"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'equipment'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <div class="flex items-center gap-2">
                <Icon name="Package" set="lucide" size="sm" />
                Оборудование
              </div>
            </button>
            
            <button
              @click="handleTabChange('team')"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <div class="flex items-center gap-2">
                <Icon name="Users" set="lucide" size="sm" />
                Команда
              </div>
            </button>
            
            <button
              @click="handleTabChange('duties')"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'duties'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <div class="flex items-center gap-2">
                <Icon name="ClipboardList" set="lucide" size="sm" />
                Техзадания
              </div>
            </button>
          </nav>
        </div>
        
        <!-- Контент табов -->
        <div class="p-8">
          <!-- Таб Обзор -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <!-- Локация -->
              <div>
                <h4 class="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Icon name="MapPin" set="lucide" size="sm" class="text-blue-600" />
                  Локация
                </h4>
                <!-- Если локация указана, показываем её, иначе — подпись -->
                <p v-if="mountPointData.location" class="text-gray-600">{{ mountPointData.location }}</p>
                <p v-else class="text-gray-400 italic">ещё не заполнено</p>
              </div>
              
              <!-- Дата начала работы -->
              <div>
                <h4 class="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Icon name="Calendar" set="lucide" size="sm" class="text-blue-600" />
                  Дата начала работы
                </h4>
                <!-- Если дата указана, форматируем, иначе — подпись -->
                <p v-if="mountPointData.start_date" class="text-gray-600">{{ formatDate(mountPointData.start_date) }}</p>
                <p v-else class="text-gray-400 italic">ещё не заполнено</p>
              </div>
              
              <!-- Пример для дополнительного поля: описание -->
          <div>
                <h4 class="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Icon name="FileText" set="lucide" size="sm" class="text-blue-600" />
                  Описание
                </h4>
                <p v-if="mountPointData.description" class="text-gray-600">{{ mountPointData.description }}</p>
                <p v-else class="text-gray-400 italic">ещё не заполнено</p>
              </div>
            </div>
            
            <!-- Статистика технических заданий -->
            <div v-if="mountPointData.technical_duties?.length > 0">
              <h4 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Icon name="BarChart3" set="lucide" size="sm" class="text-blue-600" />
                Статистика заданий
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span class="text-sm font-medium text-yellow-800">В работе</span>
                  </div>
                  <div class="text-2xl font-bold text-yellow-900">{{ dutiesStats.inProgress }}</div>
                    </div>
                
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span class="text-sm font-medium text-green-800">Выполнено</span>
                  </div>
                  <div class="text-2xl font-bold text-green-900">{{ dutiesStats.completed }}</div>
                </div>
                
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span class="text-sm font-medium text-red-800">Проблемы</span>
                  </div>
                  <div class="text-2xl font-bold text-red-900">{{ dutiesStats.problem }}</div>
                </div>
              </div>
            </div>
                  </div>
          
          <!-- Таб Оборудование -->
          <div v-if="activeTab === 'equipment'" class="space-y-6">
            <!-- Интерактивное управление оборудованием -->
            <MountPointEquipmentManager
              :event-id="String(mountPointData.event_id)"
              :mount-point-id="String(mountPointData.id)"
              :initial-data="mountPointData"
              @save="handleEquipmentSave"
              @change="handleEquipmentChange"
              @error="handleEquipmentError"
            />
          </div>
          
          <!-- Таб Команда -->
          <div v-if="activeTab === 'team'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Ответственные инженеры</h3>
              <div v-if="responsibleEngineers.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div 
                  v-for="engineer in responsibleEngineers" 
                  :key="engineer.id"
                  class="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 font-semibold">
                      {{ engineer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) }}
                    </span>
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">{{ engineer.name }}</div>
                    <div class="text-sm text-gray-600">{{ engineer.role }}</div>
                  </div>
                </div>
              </div>
              <!-- Если инженеры не назначены, показываем подпись -->
              <p v-else class="text-gray-400 italic">ещё не заполнено</p>
            </div>
          </div>
          
          <!-- Таб Техзадания -->
          <div v-if="activeTab === 'duties'" class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Технические задания</h3>
              <div v-if="technicalDuties.length" class="space-y-4">
                <div 
                  v-for="(duty, index) in technicalDuties" 
                  :key="duty.id || index"
                  class="p-4 rounded-lg border-2 transition-colors duration-200 flex flex-col gap-2 md:flex-row md:items-center"
                  :class="{
                    'bg-yellow-50 border-yellow-200': duty.status === 'в работе',
                    'bg-green-50 border-green-200': duty.status === 'выполнено',
                    'bg-red-50 border-red-200': duty.status === 'проблема',
                    'bg-gray-50 border-gray-200': !duty.status
                  }"
                >
                  <div class="flex-1">
                    <h4 class="text-lg font-medium text-gray-900 mb-1">{{ duty.title }}</h4>
                    <div class="flex items-center gap-2">
                      <label :for="`status-${duty.id}`" class="text-sm font-medium text-gray-700">Статус:</label>
                      <select
                        :id="`status-${duty.id}`"
                        v-model="duty.status"
                        @change="onStatusChange(duty, $event)"
                        :disabled="loadingDutyId === duty.id"
                        class="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors duration-200 cursor-pointer"
                        aria-label="Изменить статус задания"
                      >
                        <option value="в работе">В работе</option>
                        <option value="выполнено">Выполнено</option>
                        <option value="проблема">Проблема</option>
                      </select>
                      <Spinner v-if="loadingDutyId === duty.id" class="w-4 h-4 text-blue-600 ml-2" />
                    </div>
                    <p v-if="duty.error" class="text-xs text-red-600 mt-1">{{ duty.error }}</p>
                  </div>
                  <div class="flex-shrink-0 flex items-center gap-2 mt-2 md:mt-0">
                    <Icon v-if="duty.status === 'выполнено'" name="CheckCircle2" set="lucide" size="md" class="text-green-600" />
                    <Icon v-else-if="duty.status === 'проблема'" name="AlertCircle" set="lucide" size="md" class="text-red-600" />
                    <Icon v-else name="Clock" set="lucide" size="md" class="text-yellow-600" />
                  </div>
                </div>
              </div>
              <!-- Если технические задания не указаны, показываем подпись -->
              <p v-else class="text-gray-400 italic">ещё не заполнено</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
    
    <!-- Модальное окно редактирования -->
    <MountPointFormModal
      :visible="showEditModal"
      @update:visible="showEditModal = $event"
      :mount-point="mountPointData"
      :event-id="String(mountPointData?.event_id || '')"
      :event="eventData"
      @close="closeEditModal"
      @submit="handleEditSubmit"
    />

    <!-- Модальное окно подтверждения удаления -->
    <Modal
      v-model="showDeleteModal"
      header="Удалить точку монтажа?"
      :closable="!isDeleting"
      size="sm"
    >
      <template #default>
        <div class="flex flex-col items-center text-center gap-4">
          <Icon name="Trash2" set="lucide" size="lg" class="text-red-500 mb-2" />
          <p class="text-base text-gray-700">Это действие <span class='font-semibold text-red-600'>необратимо</span>.<br>Вы уверены, что хотите удалить точку монтажа?</p>
  </div>
      </template>
      <template #footer>
        <Button @click="showDeleteModal = false" variant="secondary" :disabled="isDeleting">Отмена</Button>
        <Button @click="handleDelete" variant="danger" :loading="isDeleting">Удалить</Button>
      </template>
    </Modal>
  </Layout>
</template> 