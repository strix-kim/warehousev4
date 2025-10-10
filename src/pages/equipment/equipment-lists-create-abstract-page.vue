<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 
          :items="breadcrumbs" 
          variant="minimal" 
          size="sm"
          @item-click="handleBreadcrumbClick"
        />
        
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">
              {{ isEditMode ? 'Редактирование списка оборудования' : 'Создание списка оборудования (по типам)' }}
            </h1>
            <p class="text-sm text-secondary mt-1">
              {{ isEditMode 
                ? 'Измените название и состав оборудования'
                : 'Выберите модели оборудования и укажите необходимое количество' 
              }}
            </p>
          </div>
          
          <ButtonV2 
            variant="ghost"
            size="md"
            @click="navigateBack"
          >
            <template #icon>
              <span class="text-sm">←</span>
            </template>
            Назад к спискам
          </ButtonV2>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <!-- Индикатор загрузки в режиме редактирования -->
      <div v-if="loadingListData" class="flex justify-center items-center py-12">
        <div class="text-center space-y-3">
          <SpinnerV2 size="lg" />
          <p class="text-secondary">Загрузка данных списка...</p>
        </div>
      </div>

      <div v-else class="space-y-6">
          <!-- Основная информация о списке -->
          <BentoCard title="Основная информация" size="1x1">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-primary mb-2">
                  Название списка
                </label>
                <InputV2
                  v-model="formData.name"
                  placeholder="Например: Оборудование для съемок"
                  :error="formErrors.name"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-primary mb-2">
                  Описание (опционально)
                </label>
                <textarea
                  v-model="formData.description"
                  placeholder="Краткое описание списка..."
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </BentoCard>

          <!-- Поиск и фильтры -->
          <BentoCard title="Поиск оборудования" size="1x1">
            <div class="space-y-4">
              <SearchInputV2
                v-model="searchQuery"
                placeholder="Поиск по модели, бренду, серийному номеру..."
                :results="searchSuggestions"
                :loading="searchLoading"
                @search="handleSearch"
                @select="handleSearchSelect"
                @clear="handleSearchClear"
              />

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-primary mb-2">
                    Категория
                  </label>
                  <select
                    v-model="selectedCategory"
                    @change="handleCategoryChange"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все категории</option>
                    <option
                      v-for="category in Object.keys(equipmentCategories)"
                      :key="category"
                      :value="category"
                    >
                      {{ category }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-primary mb-2">
                    Подкатегория
                  </label>
                  <select
                    v-model="selectedSubcategory"
                    @change="handleSubcategoryChange"
                    :disabled="!selectedCategory"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">Все подкатегории</option>
                    <option
                      v-for="subcategory in subcategoryOptions"
                      :key="subcategory"
                      :value="subcategory"
                    >
                      {{ subcategory }}
                    </option>
                  </select>
                </div>
              </div>

            </div>

            <!-- Кнопка сброса - всегда видна -->
            <div class="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <div class="text-sm text-secondary">
                <span v-if="hasActiveFilters">
                  Активные фильтры: {{ activeFiltersCount }}
                </span>
                <span v-else>
                  Фильтры не применены
                </span>
              </div>
              
              <ButtonV2
                variant="ghost"
                size="sm"
                @click="handleClearFilters"
                :disabled="!hasActiveFilters"
              >
                <template #icon>
                  <IconV2 name="filter-x" size="sm" />
                </template>
                Сбросить все
              </ButtonV2>
            </div>
          </BentoCard>

          <!-- Таблица сгруппированного оборудования -->
          <BentoCard title="Доступное оборудование" size="1x1" scrollable>
            <div v-if="equipmentLoading" class="flex justify-center py-8">
              <SpinnerV2 size="lg" />
            </div>

            <div v-else-if="equipmentError" class="text-center py-8 text-error">
              {{ equipmentError }}
            </div>

            <div v-else-if="groupedEquipment.length === 0" class="text-center py-8 text-secondary">
              Оборудование не найдено
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="group in groupedEquipment"
                :key="group.group_id"
                :class="[
                  'border rounded-lg p-4 hover:shadow-sm transition-all cursor-pointer',
                  isInList(group) 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-gray-200 hover:border-blue-300'
                ]"
                @click="openQuantityModal(group)"
              >
                <!-- Индикатор, что уже в списке -->
                <div v-if="isInList(group)" class="mb-2 flex items-center gap-2 text-xs font-medium text-green-700">
                  <IconV2 name="check-circle" size="xs" color="success" />
                  <span>Уже в списке: {{ getItemInList(group).count }} шт</span>
                </div>

                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="font-medium text-primary">
                      {{ group.brand }} {{ group.model }}
                    </div>
                    <div class="text-sm text-secondary mt-1">
                      {{ group.type }}
                      <span v-if="group.subtype"> → {{ group.subtype }}</span>
                    </div>
                  </div>

                  <div class="text-right">
                    <div class="text-lg font-bold text-primary">
                      {{ group.available_count }} шт
                    </div>
                    <div class="text-xs text-secondary">
                      доступно
                    </div>
                  </div>
                </div>

                <ButtonV2
                  :variant="isInList(group) ? 'success' : 'primary'"
                  size="sm"
                  class="mt-3 w-full"
                  @click.stop="openQuantityModal(group)"
                >
                  <template #icon>
                    <IconV2 :name="isInList(group) ? 'check' : 'plus'" size="sm" />
                  </template>
                  {{ isInList(group) ? 'Добавить еще' : 'Добавить в список' }}
                </ButtonV2>
              </div>
            </div>

            <!-- Пагинация -->
            <div v-if="totalPages > 1" class="mt-4">
              <div class="flex justify-center">
                <ButtonV2
                  variant="ghost"
                  size="sm"
                  @click="handlePageChange(currentPage - 1)"
                  :disabled="currentPage === 1"
                >
                  Назад
                </ButtonV2>
                <span class="mx-4 text-sm text-secondary">
                  Страница {{ currentPage }} из {{ totalPages }}
                </span>
                <ButtonV2
                  variant="ghost"
                  size="sm"
                  @click="handlePageChange(currentPage + 1)"
                  :disabled="currentPage === totalPages"
                >
                  Вперед
                </ButtonV2>
              </div>
            </div>
          </BentoCard>

        <!-- Выбранное оборудование -->
        <BentoCard 
          :title="`Выбранное оборудование (${selectedItems.length})`"
          size="1x1"
        >
          <div v-if="selectedItems.length === 0" class="text-center py-8 text-secondary">
            <IconV2 name="package" size="lg" color="secondary" class="mb-3" />
            <p>Список пуст</p>
            <p class="text-sm mt-1">Добавьте оборудование из таблицы выше</p>
          </div>

          <div v-else class="space-y-4">
            <!-- Поиск в выбранном -->
            <div v-if="selectedItems.length > 3" class="pb-3 border-b border-gray-200">
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="z-index: 10;">
                  <IconV2 name="search" size="sm" color="secondary" />
                </div>
                <InputV2
                  v-model="selectedItemsSearchQuery"
                  placeholder="Поиск в выбранном списке..."
                  type="text"
                  style="padding-left: 2.5rem;"
                />
              </div>
              
              <div v-if="selectedItemsSearchQuery" class="mt-2 flex items-center justify-between text-xs">
                <span class="text-secondary">
                  Найдено: {{ filteredSelectedItems.length }} из {{ selectedItems.length }}
                </span>
                <ButtonV2
                  variant="ghost"
                  size="sm"
                  @click="selectedItemsSearchQuery = ''"
                >
                  <template #icon>
                    <IconV2 name="x" size="xs" />
                  </template>
                  Очистить
                </ButtonV2>
              </div>
            </div>

            <!-- Список выбранного оборудования -->
            <div v-if="filteredSelectedItems.length === 0 && selectedItemsSearchQuery" class="text-center py-4 text-secondary">
              <IconV2 name="search-x" size="md" color="secondary" class="mb-2" />
              <p class="text-sm">Ничего не найдено по запросу "{{ selectedItemsSearchQuery }}"</p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(item, index) in filteredSelectedItems"
                :key="index"
                class="border border-gray-200 rounded-lg p-3"
              >
                <div class="flex justify-between items-start">
                  <div class="flex-1 pr-3">
                    <div class="font-medium text-primary text-sm">
                      {{ item.brand }} {{ item.model }}
                    </div>
                    <div class="text-xs text-secondary mt-1">
                      {{ item.type }}
                    </div>
                    <div class="text-xs text-secondary">
                      {{ item.subtype }}
                    </div>
                    <div class="text-sm font-bold text-primary mt-2">
                      Количество: {{ item.count }} шт
                    </div>
                  </div>

                  <ButtonV2
                    variant="error"
                    size="sm"
                    @click="removeItem(item)"
                  >
                    <template #icon>
                      <IconV2 name="trash-2" size="xs" />
                    </template>
                  </ButtonV2>
                </div>
              </div>
            </div>
          </div>

          <!-- Действия -->
          <div class="mt-6 flex gap-3">
            <ButtonV2
              variant="primary"
              size="md"
              class="flex-1"
              @click="handleCreateList"
              :disabled="!canCreate || loadingListData"
              :loading="creating || loadingListData"
            >
              <template #icon>
                <IconV2 name="save" size="sm" />
              </template>
              {{ isEditMode ? 'Сохранить изменения' : 'Создать список' }}
            </ButtonV2>

            <ButtonV2
              variant="ghost"
              size="md"
              @click="clearAll"
              :disabled="selectedItems.length === 0"
            >
              <template #icon>
                <IconV2 name="x" size="sm" />
              </template>
              Очистить все
            </ButtonV2>
          </div>
        </BentoCard>
      </div>
    </div>

    <!-- Модальное окно для ввода количества -->
    <EquipmentQuantityModal
      :show="showQuantityModal"
      :equipment="selectedEquipmentForModal"
      @close="closeQuantityModal"
      @confirm="addEquipmentToList"
    />

    <!-- Система уведомлений -->
    <NotificationV2 ref="notificationSystem" position="top-center" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'

// UI Components
import {
  BreadcrumbsV2,
  ButtonV2,
  InputV2,
  SearchInputV2,
  IconV2,
  SpinnerV2,
  NotificationV2
} from '@/shared/ui-v2'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

// Feature Components
import EquipmentQuantityModal from './components/EquipmentQuantityModal.vue'

// Stores и Composables
import { useEquipmentStore } from '@/features/equipment'
import { useAuthStore } from '@/app/store/auth-store'
import { EQUIPMENT_CATEGORIES } from '@/features/equipment/constants/categories.js'
import { 
  createEquipmentList, 
  updateEquipmentList,
  getEquipmentListById 
} from '@/features/equipment/api/equipment-lists-api.js'
import { useEquipmentGrouping } from './composables/useEquipmentGrouping.js'

const router = useRouter()
const equipmentStore = useEquipmentStore()
const authStore = useAuthStore()

// Пропсы для режима редактирования
const props = defineProps({
  id: {
    type: String,
    default: null
  }
})

// Режим работы
const isEditMode = computed(() => !!props.id)
const listId = ref(props.id)

// Breadcrumbs
const breadcrumbs = computed(() => [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Модуль оборудования', href: '/equipment' },
  { label: 'Списки оборудования', href: '/equipment/lists' },
  { 
    label: isEditMode.value ? 'Редактирование списка' : 'Создание списка (по типам)', 
    disabled: true 
  }
])

// (Адаптивность убрана, так как теперь одна колонка)

// Состояние формы
const formData = ref({
  name: '',
  description: '',
  list_mode: 'abstract'
})

const formErrors = ref({})
const creating = ref(false)
const loadingListData = ref(false)
const notificationSystem = ref(null)

// Поиск и фильтры
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedSubcategory = ref('')
const searchSuggestions = ref([])
const searchLoading = ref(false)

// Выбранное оборудование
const selectedItems = ref([])

// Поиск в выбранном оборудовании
const selectedItemsSearchQuery = ref('')

// Модальное окно
const showQuantityModal = ref(false)
const selectedEquipmentForModal = ref(null)

// Категории
const equipmentCategories = EQUIPMENT_CATEGORIES

const subcategoryOptions = computed(() => {
  if (!selectedCategory.value) return []
  return equipmentCategories[selectedCategory.value] || []
})

// Отслеживание активных фильтров
const hasActiveFilters = computed(() => {
  return !!(searchQuery.value || selectedCategory.value || selectedSubcategory.value)
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (searchQuery.value) count++
  if (selectedCategory.value) count++
  if (selectedSubcategory.value) count++
  return count
})

// Данные таблицы
const equipmentLoading = computed(() => equipmentStore.loading)
const equipmentError = computed(() => equipmentStore.error)
const equipments = computed(() => equipmentStore.equipments)
const currentPage = computed(() => equipmentStore.currentPage)
const totalPages = computed(() => equipmentStore.totalPages)

// Группировка оборудования
const { groupedEquipment, groupsStats } = useEquipmentGrouping(equipments)

// Фильтрация выбранного оборудования
const filteredSelectedItems = computed(() => {
  if (!selectedItemsSearchQuery.value.trim()) {
    return selectedItems.value
  }
  
  const query = selectedItemsSearchQuery.value.toLowerCase()
  
  return selectedItems.value.filter(item => {
    const searchString = `${item.brand} ${item.model} ${item.type} ${item.subtype}`.toLowerCase()
    return searchString.includes(query)
  })
})

// Валидация
const canCreate = computed(() => {
  return formData.value.name.trim().length > 0 && selectedItems.value.length > 0
})

// Helper для проверки, добавлено ли оборудование в список
const getItemInList = (group) => {
  return selectedItems.value.find(item =>
    item.model === group.model &&
    item.brand === group.brand &&
    item.type === group.type &&
    item.subtype === group.subtype
  )
}

const isInList = (group) => {
  return !!getItemInList(group)
}

// Методы поиска
const debouncedSearch = debounce(async (query) => {
  await equipmentStore.setSearchQuery(query)
}, 300)

const debouncedSuggestions = debounce(async (query) => {
  if (!query || query.length < 2) {
    searchSuggestions.value = []
    return
  }
  
  searchLoading.value = true
  try {
    const suggestions = await equipmentStore.getSearchSuggestions(query)
    searchSuggestions.value = suggestions
  } catch (error) {
    console.error('Ошибка получения автокомплита:', error)
    searchSuggestions.value = []
  } finally {
    searchLoading.value = false
  }
}, 150)

const handleSearch = (query) => {
  searchQuery.value = query
  debouncedSearch(query)
  debouncedSuggestions(query)
}

const handleSearchSelect = (suggestion) => {
  searchQuery.value = suggestion.value
  debouncedSearch(suggestion.value)
  searchSuggestions.value = []
}

const handleSearchClear = () => {
  searchQuery.value = ''
  searchSuggestions.value = []
  debouncedSearch.cancel()
  debouncedSuggestions.cancel()
  equipmentStore.setSearchQuery('')
}

const handleCategoryChange = async () => {
  selectedSubcategory.value = ''
  await equipmentStore.setFilters({ 
    type: selectedCategory.value, 
    subtype: '' 
  })
}

const handleSubcategoryChange = async () => {
  await equipmentStore.setFilters({ 
    type: selectedCategory.value, 
    subtype: selectedSubcategory.value 
  })
}

const handleClearFilters = async () => {
  selectedCategory.value = ''
  selectedSubcategory.value = ''
  searchQuery.value = ''
  searchSuggestions.value = []
  await equipmentStore.setFilters({ type: '', subtype: '' })
  await equipmentStore.setSearchQuery('')
}

const handlePageChange = async (page) => {
  await equipmentStore.setPage(page)
}

// Модальное окно
const openQuantityModal = (group) => {
  // Проверяем, есть ли уже это оборудование в списке
  const existingItem = selectedItems.value.find(item =>
    item.model === group.model &&
    item.brand === group.brand &&
    item.type === group.type &&
    item.subtype === group.subtype
  )
  
  if (existingItem) {
    // Показываем уведомление, что оборудование уже добавлено
    notificationSystem.value?.warning(
      `Текущее количество в списке: ${existingItem.count} шт. Вы можете добавить еще.`,
      { 
        title: `${group.brand} ${group.model} уже в списке`, 
        duration: 5000 
      }
    )
  }
  
  selectedEquipmentForModal.value = group
  showQuantityModal.value = true
}

const closeQuantityModal = () => {
  showQuantityModal.value = false
  selectedEquipmentForModal.value = null
}

const addEquipmentToList = ({ equipment, quantity }) => {
  // Проверяем, есть ли уже такое оборудование в списке
  const existingIndex = selectedItems.value.findIndex(item =>
    item.model === equipment.model &&
    item.brand === equipment.brand &&
    item.type === equipment.type &&
    item.subtype === equipment.subtype
  )

  if (existingIndex !== -1) {
    // Оборудование уже в списке - увеличиваем количество
    const oldCount = selectedItems.value[existingIndex].count
    selectedItems.value[existingIndex].count += quantity
    const newCount = selectedItems.value[existingIndex].count
    
    notificationSystem.value?.success(
      `Было: ${oldCount} шт → Стало: ${newCount} шт (добавлено +${quantity})`,
      { 
        title: `${equipment.brand} ${equipment.model} - количество обновлено`, 
        duration: 4000 
      }
    )
  } else {
    // Добавляем новую позицию
    selectedItems.value.push({
      model: equipment.model,
      brand: equipment.brand,
      type: equipment.type,
      subtype: equipment.subtype,
      count: quantity
    })
    
    notificationSystem.value?.success(
      `Добавлено в список: ${quantity} шт`,
      { 
        title: `${equipment.brand} ${equipment.model}`, 
        duration: 3000 
      }
    )
  }
}

const removeItem = (item) => {
  // Находим индекс в оригинальном массиве
  const index = selectedItems.value.findIndex(i =>
    i.model === item.model &&
    i.brand === item.brand &&
    i.type === item.type &&
    i.subtype === item.subtype
  )
  
  if (index !== -1) {
    selectedItems.value.splice(index, 1)
    
    notificationSystem.value?.info(
      `Удалено: ${item.brand} ${item.model}`,
      { title: 'Удалено', duration: 2000 }
    )
  }
}

const clearAll = () => {
  selectedItems.value = []
  selectedItemsSearchQuery.value = '' // Очищаем поиск
  notificationSystem.value?.info(
    'Все позиции удалены из списка',
    { title: 'Очищено', duration: 2000 }
  )
}

// Загрузка данных списка при редактировании
const loadListData = async () => {
  if (!listId.value) return
  
  loadingListData.value = true
  
  try {
    console.log('📋 Загрузка данных списка для редактирования:', listId.value)
    
    const list = await getEquipmentListById(listId.value)
    
    if (!list) {
      throw new Error('Список не найден')
    }
    
    // Заполняем форму
    formData.value.name = list.name || ''
    formData.value.description = list.description || ''
    
    // Загружаем выбранное оборудование
    if (list.equipment_items && Array.isArray(list.equipment_items)) {
      selectedItems.value = [...list.equipment_items]
      console.log('✅ Загружено позиций оборудования:', selectedItems.value.length)
    }
    
  } catch (error) {
    console.error('❌ Ошибка загрузки данных списка:', error)
    notificationSystem.value?.error(
      `Не удалось загрузить данные списка: ${error.message}`,
      { title: 'Ошибка загрузки', duration: 5000 }
    )
    router.push('/equipment/lists')
  } finally {
    loadingListData.value = false
  }
}

// Создание/обновление списка
const handleCreateList = async () => {
  // Валидация
  formErrors.value = {}
  
  if (!formData.value.name.trim()) {
    formErrors.value.name = 'Введите название списка'
    notificationSystem.value?.error('Введите название списка', {
      title: 'Ошибка валидации',
      duration: 3000
    })
    return
  }

  if (selectedItems.value.length === 0) {
    notificationSystem.value?.error('Добавьте хотя бы одну позицию оборудования', {
      title: 'Ошибка валидации',
      duration: 3000
    })
    return
  }

  creating.value = true

  try {
    const listData = {
      name: formData.value.name,
      description: formData.value.description || null,
      type: 'custom',
      list_mode: 'abstract',
      equipment_items: selectedItems.value,
      equipment_ids: [],
      event_id: null,
      mount_point_id: null
    }
    
    // В режиме создания добавляем метаданные
    if (!isEditMode.value) {
      if (!authStore.user?.id) {
        throw new Error('Пользователь не авторизован')
      }
      
      listData.created_by = authStore.user.id
      listData.metadata = {
        created_by_name: authStore.user.name || authStore.user.email || 'Неизвестный пользователь',
        created_by_role: authStore.role,
        version: '1.0',
        mode: 'abstract'
      }
    }

    console.log(isEditMode.value ? '📝 Обновление абстрактного списка:' : '✨ Создание абстрактного списка:', listData)

    let result
    if (isEditMode.value) {
      result = await updateEquipmentList(listId.value, listData)
    } else {
      result = await createEquipmentList(listData)
    }

    notificationSystem.value?.success(
      isEditMode.value ? 'Список оборудования успешно обновлен!' : 'Список оборудования успешно создан!',
      { title: 'Успех', duration: 4000 }
    )

    router.push('/equipment/lists')

  } catch (error) {
    console.error(isEditMode.value ? '❌ Ошибка обновления списка:' : '❌ Ошибка создания списка:', error)
    notificationSystem.value?.error(
      `Не удалось ${isEditMode.value ? 'обновить' : 'создать'} список: ${error.message}`,
      { title: 'Ошибка', duration: 5000 }
    )
  } finally {
    creating.value = false
  }
}

const navigateBack = () => {
  router.push('/equipment/lists')
}

const handleBreadcrumbClick = (data) => {
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
}

// Инициализация
onMounted(async () => {
  // В режиме редактирования сначала загружаем данные списка
  if (isEditMode.value) {
    await loadListData()
  }
  
  // Загружаем оборудование для выбора
  await equipmentStore.loadEquipments()
})
</script>

