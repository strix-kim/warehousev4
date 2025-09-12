/**
 * useEquipmentSearch - EPR System
 * 
 * Composable для поиска оборудования
 * Использует UI Kit v2 принципы
 */

import { ref, computed } from 'vue'
import { useEquipmentStore } from '../store/equipment-store.js'
import { equipmentApi } from '../api/equipment-api.js'

export function useEquipmentSearch() {
  const store = useEquipmentStore()
  
  // Local state
  const searchResults = ref([])
  const searchLoading = ref(false)
  const searchQuery = computed(() => store.searchQuery)

  // Methods
  const setSearchQuery = (query) => {
    store.setSearchQuery(query)
  }

  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      searchResults.value = []
      return
    }

    searchLoading.value = true
    
    try {
      // Сначала ищем в локальных данных для быстрого результата
      const localResults = store.equipments.filter(equipment => 
        equipment.brand?.toLowerCase().includes(query.toLowerCase()) ||
        equipment.model?.toLowerCase().includes(query.toLowerCase()) ||
        equipment.serialnumber?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)

      searchResults.value = localResults

      // Затем выполняем поиск на сервере
      const serverResults = await equipmentApi.searchEquipments(query)
      searchResults.value = serverResults.data || []
    } catch (err) {
      console.error('Search error:', err)
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }

  const handleSearchSelect = (data) => {
    const equipment = data.result
    setSearchQuery(`${equipment.brand} ${equipment.model}`)
    searchResults.value = []
    
    // Scroll to equipment in table
    const tableRow = document.querySelector(`[data-equipment-id="${equipment.id}"]`)
    if (tableRow) {
      tableRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
      tableRow.classList.add('highlight')
      setTimeout(() => tableRow.classList.remove('highlight'), 2000)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    searchResults.value = []
  }

  const getStatusVariant = (status) => {
    const variants = {
      'available': 'success',
      'in_use': 'warning', 
      'maintenance': 'error',
      'retired': 'secondary'
    }
    return variants[status] || 'secondary'
  }

  return {
    // State
    searchResults,
    searchLoading,
    searchQuery,

    // Methods
    setSearchQuery,
    performSearch,
    handleSearchSelect,
    clearSearch,
    getStatusVariant
  }
} 