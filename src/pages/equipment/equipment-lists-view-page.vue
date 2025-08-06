<template>
  <div class="min-h-screen bg-accent" style="scroll-behavior: auto;">
    <!-- Header с Breadcrumbs и действиями -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 
          :items="breadcrumbs" 
          variant="minimal" 
          size="sm"
          @item-click="handleBreadcrumbClick"
        />
        
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <IconV2 name="list" size="lg" color="primary" />
              <h1 class="text-3xl font-bold text-primary">
                {{ listData?.name || 'Загрузка...' }}
              </h1>
              <StatusBadgeV2 
                v-if="listData?.type"
                :variant="getListTypeVariant(listData.type)"
                :label="getListTypeLabel(listData.type)"
                size="sm"
              />
            </div>
            <p class="text-base text-secondary">
              {{ listData?.description || 'Описание отсутствует' }}
            </p>
          </div>
          
          <!-- Действия -->
          <div class="flex gap-2 w-full sm:w-auto">
            <ButtonV2 
              variant="ghost" 
              size="md"
              @click="navigateToEdit"
              :disabled="loading"
              class="flex-1 sm:flex-none"
            >
              <template #icon>
                <IconV2 name="edit" size="sm" />
              </template>
              Редактировать
            </ButtonV2>
            
            <ButtonV2 
              variant="error" 
              size="md"
              @click="handleDelete"
              :disabled="loading"
              class="flex-1 sm:flex-none"
            >
              <template #icon>
                <IconV2 name="trash-2" size="sm" />
              </template>
              Удалить
            </ButtonV2>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <SpinnerV2 size="lg" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <IconV2 name="alert-triangle" size="xl" color="error" class="mx-auto mb-4" />
        <h3 class="text-xl font-semibold text-primary mb-2">Ошибка загрузки</h3>
        <p class="text-secondary mb-4">{{ error }}</p>
        <ButtonV2 variant="primary" @click="loadListDetails">
          Попробовать снова
        </ButtonV2>
      </div>

      <!-- Content -->
      <BentoGrid v-else-if="listData" columns="1" gap="6">
        <!-- Компактная информация о списке -->
        <BentoCard 
          title="Информация о списке" 
          size="1x1" 
          variant="minimal"
          class="mb-4"
        >
          <div class="flex flex-col sm:flex-row gap-6 justify-between">
            <div class="flex-1">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span class="text-secondary">Создан:</span>
                  <p class="text-primary font-medium">{{ formatDate(listData.created_at) }}</p>
                </div>
                <div v-if="listData.metadata?.created_by_name">
                  <span class="text-secondary">Автор:</span>
                  <p class="text-primary font-medium">{{ listData.metadata.created_by_name }}</p>
                </div>
                <div>
                  <span class="text-secondary">Единиц оборудования:</span>
                  <p class="text-primary font-medium">{{ equipmentCount }}</p>
                </div>
              </div>
            </div>
            
            <!-- Связанные данные для security списков -->
            <div v-if="listData.type === 'security' && (eventDetails || mountPointDetails)" class="flex gap-4">
              <div v-if="eventDetails" class="flex items-center gap-2 text-sm">
                <IconV2 name="calendar" size="xs" color="secondary" />
                <span class="text-secondary">Мероприятие:</span>
                <span class="text-primary font-medium">{{ eventDetails.name }}</span>
              </div>
              <div v-if="mountPointDetails" class="flex items-center gap-2 text-sm">
                <IconV2 name="map-pin" size="xs" color="secondary" />
                <span class="text-secondary">Точка:</span>
                <span class="text-primary font-medium">{{ mountPointDetails.name }}</span>
              </div>
            </div>
          </div>
        </BentoCard>

        <!-- Поиск и фильтры для оборудования -->
        <BentoCard 
          title="Поиск по оборудованию" 
          size="1x1" 
          variant="minimal"
        >
          <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div class="flex-1">
              <SearchInputV2
                v-model="equipmentSearchQuery"
                placeholder="Поиск по названию, модели, серийному номеру..."
                variant="minimal"
                @search="handleEquipmentSearch"
                @clear="handleEquipmentSearchClear"
              />
            </div>
            
            <div class="w-full sm:w-48">
              <SelectV2 
                v-model="selectedEquipmentType"
                :options="equipmentTypeOptions"
                placeholder="Все типы"
                variant="minimal"
                @change="handleEquipmentTypeFilter"
              />
            </div>
            
            <div class="flex gap-2">
              <ButtonV2 
                v-if="selectedEquipmentType"
                variant="ghost" 
                size="sm"
                @click="clearEquipmentTypeFilter"
                class="whitespace-nowrap"
              >
                <template #icon>
                  <IconV2 name="x" size="xs" />
                </template>
                Сбросить тип
              </ButtonV2>
              
              <ButtonV2 
                v-if="equipmentSearchQuery || selectedEquipmentType"
                variant="ghost" 
                size="sm"
                @click="clearAllEquipmentFilters"
                class="whitespace-nowrap"
              >
                <template #icon>
                  <IconV2 name="filter-x" size="xs" />
                </template>
                Очистить всё
              </ButtonV2>
            </div>
          </div>
        </BentoCard>

        <!-- Список оборудования -->
        <BentoCard 
          title="Оборудование в списке" 
          size="1x1" 
          variant="default"
          :scrollable="true"
        >
          <div v-if="equipmentLoading" class="flex justify-center py-8">
            <div class="text-center space-y-3">
              <SpinnerV2 size="lg" />
              <p class="text-secondary">Загрузка оборудования...</p>
            </div>
          </div>
          
          <div v-else-if="equipmentError" class="text-center py-8">
            <IconV2 name="alert-triangle" size="lg" color="error" class="mx-auto mb-2" />
            <p class="text-secondary">Ошибка загрузки оборудования</p>
            <ButtonV2 variant="ghost" size="sm" @click="loadEquipmentDetails(listData.equipment_ids)" class="mt-3">
              Попробовать снова
            </ButtonV2>
          </div>
          
          <div v-else-if="filteredEquipmentData.length === 0" class="text-center py-8">
            <IconV2 name="inbox" size="lg" color="secondary" class="mx-auto mb-2" />
            <p class="text-secondary">
              {{ equipmentSearchQuery || selectedEquipmentType 
                ? 'Оборудование не найдено по заданным критериям' 
                : 'В списке нет оборудования' 
              }}
            </p>
            <ButtonV2 
              v-if="equipmentSearchQuery || selectedEquipmentType"
              variant="ghost" 
              size="sm" 
              @click="clearAllEquipmentFilters"
              class="mt-3"
            >
              Очистить фильтры
            </ButtonV2>
          </div>
          
          <!-- Компактные карточки оборудования -->
          <div v-else class="space-y-3">
            <div 
              v-for="equipment in paginatedFilteredEquipment" 
              :key="equipment.id"
              class="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
            >
              <div class="flex flex-col sm:flex-row gap-4">
                <!-- Основная информация -->
                <div class="flex items-start gap-3 flex-1">
                  <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconV2 name="package" size="md" color="secondary" />
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-primary mb-1">
                      {{ equipment.brand || 'Без бренда' }} {{ equipment.model || 'Без модели' }}
                    </h3>
                    
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                      <span class="text-sm text-secondary">{{ equipment.type || '—' }}</span>
                      <span v-if="equipment.subtype" class="text-sm text-secondary">• {{ equipment.subtype }}</span>
                      <StatusBadgeV2 
                        :variant="getAvailabilityVariant(equipment.availability)"
                        :label="equipment.availability || 'Не указано'"
                        size="xs"
                      />
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div v-if="equipment.serialnumber">
                        <span class="text-secondary">Серийный номер:</span>
                        <p class="text-primary font-mono text-xs">{{ equipment.serialnumber }}</p>
                      </div>
                      
                      <div v-if="equipment.location">
                        <span class="text-secondary">Локация:</span>
                        <p class="text-primary">{{ equipment.location }}</p>
                      </div>
                      
                      <div v-if="equipment.technicalspecification" class="sm:col-span-2">
                        <span class="text-secondary">Характеристики:</span>
                        <p class="text-primary text-sm">{{ equipment.technicalspecification }}</p>
                      </div>
                      
                      <div v-if="equipment.lengthinmeters" class="sm:col-span-2">
                        <span class="text-secondary">Длина:</span>
                        <p class="text-primary">{{ equipment.lengthinmeters }} м</p>
                      </div>
                      
                      <div v-if="equipment.description" class="sm:col-span-2">
                        <span class="text-secondary">Описание:</span>
                        <p class="text-primary text-sm">{{ equipment.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Количество (если больше 1) -->
                <div v-if="equipment.count && equipment.count > 1" class="flex-shrink-0 text-center sm:text-right">
                  <div class="text-xl font-bold text-primary">{{ equipment.count }}</div>
                  <div class="text-xs text-secondary uppercase tracking-wider">штук</div>
                </div>
              </div>
            </div>

            <!-- Pagination для оборудования -->
            <div v-if="totalEquipmentPages > 1" class="pt-6 border-t border-gray-100">
              <PaginationV2
                :current-page="currentEquipmentPage"
                :total-pages="totalEquipmentPages"
                :items-per-page="equipmentItemsPerPage"
                :total-items="filteredEquipmentData.length"
                @update:current-page="currentEquipmentPage = $event"
                @update:items-per-page="equipmentItemsPerPage = $event"
                variant="minimal"
                class="justify-center"
              />
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </div>

    <!-- Delete Confirmation Modal -->
    <ModalV2 
      v-model="showDeleteModal"
      title="Подтвердите удаление"
      size="md"
    >
      <p class="text-secondary mb-4">
        Вы уверены, что хотите удалить список "{{ listToDelete?.name }}"?
      </p>
      <p class="text-sm text-secondary mb-6">
        Это действие нельзя отменить.
      </p>
      
      <div class="flex gap-3 justify-end">
        <ButtonV2 variant="ghost" @click="showDeleteModal = false">
          Отмена
        </ButtonV2>
        <ButtonV2 
          variant="error" 
          @click="confirmDelete"
          :loading="deleteLoading"
        >
          Удалить список
        </ButtonV2>
      </div>
    </ModalV2>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
/**
 * Equipment List View Page
 * 
 * Страница просмотра конкретного списка оборудования
 * Отображает полную информацию о списке, статистику и содержимое
 * 
 * Философия дизайна:
 * - Следует UI Kit v2 и Bento принципам
 * - Минималистичный дизайн с акцентом на информацию
 * - Адаптивная верстка mobile-first
 * - Консистентность с остальными страницами модуля
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// UI Kit v2
import { 
  BreadcrumbsV2, 
  ButtonV2, 
  IconV2,
  ModalV2,
  NotificationV2,
  PaginationV2,
  SearchInputV2,
  SelectV2,
  StatusBadgeV2,
  SpinnerV2
} from '@/shared/ui-v2'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

// API
import { 
  getEquipmentListById, 
  deleteEquipmentList 
} from '@/features/equipment/api/equipment-lists-api'
import { getEquipmentByIds } from '@/features/equipment/api/equipment-external-data-api'

const router = useRouter()
const route = useRoute()

// ═══ NAVIGATION ═══
const breadcrumbs = computed(() => [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Оборудование', href: '/equipment' },
  { label: 'Списки', href: '/equipment/lists' },
  { label: listData.value?.name || 'Просмотр', disabled: true }
])

// ═══ STATE ═══
const listId = route.params.id
const loading = ref(true)
const error = ref(null)
const listData = ref(null)
const equipmentData = ref([])
const equipmentLoading = ref(false)
const equipmentError = ref(null)
const eventDetails = ref(null)
const mountPointDetails = ref(null)
const notificationSystem = ref(null)

// Delete confirmation
const showDeleteModal = ref(false)
const listToDelete = ref(null)
const deleteLoading = ref(false)

// ═══ EQUIPMENT SEARCH & FILTERS ═══
const equipmentSearchQuery = ref('')
const selectedEquipmentType = ref('')
const currentEquipmentPage = ref(1)
const equipmentItemsPerPage = ref(10)

// ═══ COMPUTED ═══
const equipmentCount = computed(() => {
  return listData.value?.equipment_ids?.length || 0
})

const uniqueTypesCount = computed(() => {
  if (!equipmentData.value.length) return 0
  
  const types = new Set()
  equipmentData.value.forEach(item => {
    if (item.type) types.add(item.type)
  })
  return types.size
})

// ═══ EQUIPMENT FILTER OPTIONS ═══
const equipmentTypeOptions = computed(() => {
  const types = new Set()
  equipmentData.value.forEach(item => {
    if (item.type) types.add(item.type)
  })
  return Array.from(types).map(type => ({ value: type, label: type }))
})

// ═══ EQUIPMENT FILTERING ═══
const filteredEquipmentData = computed(() => {
  let filtered = equipmentData.value || []

  // Поиск
  if (equipmentSearchQuery.value) {
    const query = equipmentSearchQuery.value.toLowerCase()
    filtered = filtered.filter(equipment => 
      (equipment.brand?.toLowerCase().includes(query)) ||
      (equipment.model?.toLowerCase().includes(query)) ||
      (equipment.serialnumber?.toLowerCase().includes(query)) ||
      (equipment.type?.toLowerCase().includes(query)) ||
      (equipment.technicalspecification?.toLowerCase().includes(query))
    )
  }

  // Фильтр по типу
  if (selectedEquipmentType.value) {
    filtered = filtered.filter(equipment => equipment.type === selectedEquipmentType.value)
  }

  return filtered
})

// ═══ EQUIPMENT PAGINATION ═══
const totalEquipmentPages = computed(() => 
  Math.ceil(filteredEquipmentData.value.length / equipmentItemsPerPage.value)
)

const paginatedFilteredEquipment = computed(() => {
  const start = (currentEquipmentPage.value - 1) * equipmentItemsPerPage.value
  const end = start + equipmentItemsPerPage.value
  return filteredEquipmentData.value.slice(start, end)
})

// ═══ EQUIPMENT SEARCH & FILTER METHODS ═══
const handleEquipmentSearch = (query) => {
  equipmentSearchQuery.value = query
  currentEquipmentPage.value = 1 // Сбрасываем на первую страницу
}

const handleEquipmentSearchClear = () => {
  equipmentSearchQuery.value = ''
  currentEquipmentPage.value = 1
}

const handleEquipmentTypeFilter = (type) => {
  selectedEquipmentType.value = type
  currentEquipmentPage.value = 1
}

const clearEquipmentTypeFilter = () => {
  selectedEquipmentType.value = ''
  currentEquipmentPage.value = 1
}

const clearAllEquipmentFilters = () => {
  equipmentSearchQuery.value = ''
  selectedEquipmentType.value = ''
  currentEquipmentPage.value = 1
}

// ═══ METHODS ═══
const loadListDetails = async () => {
  loading.value = true
  error.value = null
  
  try {
    console.log('🔍 Загружаем детали списка:', listId)
    
    // Получаем данные списка
    const list = await getEquipmentListById(listId)
    
    // Проверяем что список найден
    if (!list) {
      throw new Error('Список оборудования не найден')
    }
    
    listData.value = list
    console.log('✅ Список загружен:', list)
    
    // Загружаем оборудование если есть IDs
    if (list.equipment_ids && Array.isArray(list.equipment_ids) && list.equipment_ids.length > 0) {
      await loadEquipmentDetails(list.equipment_ids)
    }
    
    // Загружаем связанные данные для security списков
    if (list.type === 'security') {
      // TODO: Загрузить данные мероприятия и точки монтажа
      // await loadEventDetails(list.event_id)
      // await loadMountPointDetails(list.mount_point_id)
    }
    
  } catch (err) {
    console.error('❌ Ошибка загрузки списка:', err)
    error.value = err.message || 'Не удалось загрузить список'
  } finally {
    loading.value = false
  }
}

const loadEquipmentDetails = async (equipmentIds) => {
  equipmentLoading.value = true
  equipmentError.value = null
  
  try {
    console.log('🔍 Загружаем детали оборудования:', equipmentIds)
    
    const result = await getEquipmentByIds(equipmentIds)
    console.log('🔍 Результат getEquipmentByIds:', result)
    
    // getEquipmentByIds возвращает { data, error }
    if (result.error) {
      throw new Error(result.error)
    }
    
    equipmentData.value = result.data || []
    console.log('✅ Оборудование загружено:', result.data?.length, 'единиц')
    console.log('🔍 Первые 3 элемента оборудования:', result.data?.slice(0, 3))
    
  } catch (err) {
    console.error('❌ Ошибка загрузки оборудования:', err)
    equipmentError.value = err.message || 'Не удалось загрузить оборудование'
  } finally {
    equipmentLoading.value = false
  }
}

const navigateToEdit = () => {
  router.push(`/equipment/lists/edit/${listId}`)
}

const handleDelete = () => {
  listToDelete.value = listData.value
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (!listToDelete.value) return
  
  deleteLoading.value = true
  
  try {
    await deleteEquipmentList(listToDelete.value.id)
    
    notificationSystem.value?.success('Список успешно удален', {
      title: 'Успех',
      duration: 3000
    })
    
    // Возвращаемся на страницу списков
    router.push('/equipment/lists')
    
  } catch (err) {
    console.error('❌ Ошибка удаления списка:', err)
    notificationSystem.value?.error('Не удалось удалить список', {
      title: 'Ошибка',
      duration: 5000
    })
  } finally {
    deleteLoading.value = false
    showDeleteModal.value = false
    listToDelete.value = null
  }
}

const handleBreadcrumbClick = (data) => {
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
}

// ═══ HELPERS ═══
const getListTypeVariant = (type) => {
  switch (type) {
    case 'security': return 'warning'
    case 'report': return 'info'
    case 'custom': return 'success'
    default: return 'secondary'
  }
}

const getListTypeLabel = (type) => {
  switch (type) {
    case 'security': return 'Для охраны'
    case 'report': return 'Отчетный'
    case 'custom': return 'Кастомный'
    default: return 'Неизвестный'
  }
}

const getAvailabilityVariant = (availability) => {
  switch (availability?.toLowerCase()) {
    case 'доступно':
    case 'available': 
      return 'success'
    case 'в работе':
    case 'busy':
      return 'warning'
    case 'сломано':
    case 'broken':
      return 'error'
    default:
      return 'secondary'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '—'
  
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString))
  } catch {
    return dateString
  }
}

// ═══ LIFECYCLE ═══
onMounted(() => {
  loadListDetails()
  
  // ✅ Скролл теперь управляется глобально в router.js через scrollBehavior
})
</script>

<style scoped>
/* Предотвращаем скролл в середину страницы */
:deep(*) {
  scroll-behavior: auto !important;
}
</style>