<template>
  <BentoCard title="Поиск и фильтры" size="1x1" variant="default">
    <div class="space-y-4">
      <!-- Поиск -->
      <div>
        <SearchInputV2
          :model-value="searchQuery"
          placeholder="Поиск по бренду, модели, серийному номеру..."
          class="w-full"
          :results="searchSuggestions"
          :loading="searchLoading"
          @search="handleSearch"
          @select="handleSearchSelect"
          @clear="handleSearchClear"
        />
      </div>
      
      <!-- Фильтры -->
      <div class="flex flex-wrap gap-3">
        <SelectV2 
          :model-value="selectedCategory"
          :options="categoryOptions"
          placeholder="Все категории"
          size="sm"
          class="min-w-48"
          @update:model-value="handleCategoryChange"
        />
        
        <SelectV2 
          :model-value="selectedSubcategory"
          :options="subcategoryOptions"
          placeholder="Все подкатегории"
          size="sm"
          class="min-w-48"
          :disabled="!selectedCategory"
          @update:model-value="handleSubcategoryChange"
        />
        
        <ButtonV2 
          variant="ghost" 
          size="sm"
          @click="handleClearFilters"
          :disabled="!searchQuery && !selectedCategory && !selectedSubcategory"
        >
          <template #icon>
            <IconV2 name="x" size="xs" />
          </template>
          Очистить
        </ButtonV2>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EquipmentSearchFilters - EPR System
 * 
 * Компонент для поиска и фильтрации оборудования
 * Использует UI Kit v2
 */

import { 
  BentoCard,
  SearchInputV2,
  SelectV2,
  ButtonV2,
  IconV2
} from '@/shared/ui-v2'
import { computed } from 'vue'
import { getCategoryOptions, getSubcategoryOptions } from '@/features/equipment/constants/categories.js'

// Props
const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  selectedCategory: {
    type: String,
    default: ''
  },
  selectedSubcategory: {
    type: String,
    default: ''
  },
  searchSuggestions: {
    type: Array,
    default: () => []
  },
  searchLoading: {
    type: Boolean,
    default: false
  },
  equipmentCategories: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits([
  'search',
  'search-select', 
  'search-clear',
  'category-change',
  'subcategory-change',
  'clear-filters'
])

// Computed properties для опций селектов
const categoryOptions = computed(() => {
  return getCategoryOptions()
})

const subcategoryOptions = computed(() => {
  if (!props.selectedCategory) {
    return []
  }
  return getSubcategoryOptions(props.selectedCategory)
})

// Methods
const handleSearch = (query) => {
  emit('search', query)
}

const handleSearchSelect = (item) => {
  emit('search-select', item)
}

const handleSearchClear = () => {
  emit('search-clear')
}

const handleCategoryChange = (category) => {
  emit('category-change', category)
}

const handleSubcategoryChange = (subcategory) => {
  emit('subcategory-change', subcategory)
}

const handleClearFilters = () => {
  emit('clear-filters')
}
</script>