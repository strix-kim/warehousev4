<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <EquipmentPageHeader 
      @breadcrumb-click="handleBreadcrumbClick"
      @add-equipment="handleAddEquipment"
    />

    <!-- Main Content в Bento Grid -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <BentoGrid columns="1" gap="6">
        <!-- Поиск и фильтры -->
        <EquipmentSearchFilters
          :search-query="searchQuery"
          :selected-category="selectedCategory"
          :selected-subcategory="selectedSubcategory"
          :search-suggestions="searchSuggestions"
          :search-loading="searchLoading"
          :equipment-categories="equipmentCategories"
          @search="handleSearch"
          @search-select="handleSearchSelect"
          @search-clear="handleSearchClear"
          @category-change="handleCategoryChange"
          @subcategory-change="handleSubcategoryChange"
          @clear-filters="clearFilters"
        />

        <!-- Таблица оборудования -->
        <EquipmentTable
          ref="equipmentTableRef"
          :data="paginatedEquipments"
          :loading="loading"
          :error="error"
          :sort-by="sortBy"
          :sort-order="sortOrder"
          :current-page="currentPage"
          :total-pages="totalPages"
          :items-per-page="itemsPerPage"
          :total="total"
          @equipment-click="handleEquipmentClick"
          @sort="handleSort"
          @page-change="handlePageChange"
          @items-per-page-change="handleItemsPerPageChange"
          @edit="handleEdit"
          @view="handleView"
        />

        <!-- Отладочная информация -->
        <EquipmentDebugInfo
          :search-query="searchQuery"
          :selected-category="selectedCategory"
          :selected-subcategory="selectedSubcategory"
          :current-page="currentPage"
          :items-per-page="itemsPerPage"
          :total-pages="totalPages"
          :total="total"
          :has-more="equipmentStore.hasMore"
          :sort-by="sortBy"
          :sort-order="sortOrder"
          :loading="loading"
          :error="error"
          :search-suggestions="searchSuggestions"
          :show-debug="true"
        />
      </BentoGrid>
    </div>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
/**
 * Equipment Page - EPR System (Refactored)
 * 
 * Главная страница оборудования, разбитая на компоненты
 * Использует UI Kit v2 и композицию компонентов
 */

import { ref, computed, onMounted } from 'vue'
import { debounce } from 'lodash-es'

// UI Kit v2
import { BentoGrid, NotificationV2 } from '@/shared/ui-v2'

// Page Components
import EquipmentPageHeader from './components/EquipmentPageHeader.vue'
import EquipmentSearchFilters from './components/EquipmentSearchFilters.vue'
import EquipmentTable from './components/EquipmentTable.vue'
import EquipmentDebugInfo from './components/EquipmentDebugInfo.vue'

// Equipment module
import { useEquipmentStore } from '@/features/equipment'
import { EQUIPMENT_CATEGORIES } from '@/features/equipment/constants/categories.js'

// === STORE ===
const equipmentStore = useEquipmentStore()

// === СОСТОЯНИЕ ПОИСКА И ФИЛЬТРОВ ===
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedSubcategory = ref('')
const searchSuggestions = ref([])
const searchLoading = ref(false)

// === REFS ===
const equipmentTableRef = ref(null)

// === КАТЕГОРИИ ОБОРУДОВАНИЯ ===
// Используем константы вместо жестко закодированных данных
const equipmentCategories = EQUIPMENT_CATEGORIES

// === COMPUTED PROPERTIES ===
const loading = computed(() => equipmentStore.loading)
const error = computed(() => equipmentStore.error)
const paginatedEquipments = computed(() => equipmentStore.paginatedEquipments)
const currentPage = computed(() => equipmentStore.currentPage)
const itemsPerPage = computed(() => equipmentStore.itemsPerPage)
const totalPages = computed(() => equipmentStore.totalPages)
const total = computed(() => equipmentStore.total)
const sortBy = computed(() => equipmentStore.sortBy)
const sortOrder = computed(() => equipmentStore.sortOrder)

// === DEBOUNCED FUNCTIONS ===
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

// === EVENT HANDLERS ===

// Header
const handleBreadcrumbClick = (data) => {
  console.log('🧭 [Page] Breadcrumb clicked:', data.item.label)
}

const handleAddEquipment = () => {
  console.log('➕ [Page] Add equipment clicked')
  // Вызываем метод openAddForm у EquipmentTable
  equipmentTableRef.value?.openAddForm()
}

// Search & Filters
const handleSearch = (query) => {
  searchQuery.value = query
  debouncedSearch(query)
  debouncedSuggestions(query)
}

const handleSearchSelect = (suggestion) => {
  console.log('🎯 [Page] Search select:', suggestion)
  searchQuery.value = suggestion.value
  debouncedSearch(suggestion.value)
  searchSuggestions.value = []
}

const handleSearchClear = () => {
  console.log('🗑️ [Page] Search clear')
  searchQuery.value = ''
  searchSuggestions.value = []
  debouncedSearch.cancel()
  debouncedSuggestions.cancel()
  equipmentStore.setSearchQuery('')
}

const handleCategoryChange = async (category) => {
  selectedCategory.value = category
  selectedSubcategory.value = ''
  await equipmentStore.setFilters({ type: category, subtype: '' })
}

const handleSubcategoryChange = async (subcategory) => {
  selectedSubcategory.value = subcategory
  await equipmentStore.setFilters({ 
    type: selectedCategory.value, 
    subtype: subcategory 
  })
}

const clearFilters = async () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedSubcategory.value = ''
  searchSuggestions.value = []
  debouncedSearch.cancel()
  debouncedSuggestions.cancel()
  await equipmentStore.setSearchQuery('')
  await equipmentStore.clearFilters()
}

// Table
const handleEquipmentClick = (item) => {
  console.log('🖱️ [Page] Equipment clicked:', item)
}

const handleSort = async (sortEvent) => {
  console.log('🔄 [Page] Sort:', sortEvent)
  // НЕ передаем direction, позволяем store самому управлять логикой переключения
  await equipmentStore.setSorting(sortEvent.column)
}

const handlePageChange = async (page) => {
  await equipmentStore.setPage(page)
}

const handleItemsPerPageChange = async (items) => {
  await equipmentStore.setItemsPerPage(items)
}

const handleEdit = (item) => {
  console.log('✏️ [Page] Edit equipment:', item)
  // TODO: Открыть форму редактирования
}

const handleView = (item) => {
  console.log('👁️ [Page] View equipment:', item)
  // TODO: Открыть детальную страницу
}

// === LIFECYCLE ===
onMounted(async () => {
  console.log('🚀 [Page] Equipment page mounted')
  // Сбрасываем состояние поиска и фильтров при повторном входе на страницу
  await equipmentStore.resetState()
  
  // Синхронизируем локальное состояние с store
  searchQuery.value = equipmentStore.searchQuery
  selectedCategory.value = equipmentStore.filters.type || ''
  selectedSubcategory.value = equipmentStore.filters.subtype || ''
})
</script>