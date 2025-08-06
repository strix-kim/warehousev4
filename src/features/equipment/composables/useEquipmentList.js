/**
 * useEquipmentList - EPR System
 * 
 * Composable для работы со списком оборудования
 * Использует UI Kit v2 принципы
 */

import { computed } from 'vue'
import { useEquipmentStore } from '../store/equipment-store.js'

export function useEquipmentList() {
  const store = useEquipmentStore()

  // Computed
  const equipments = computed(() => store.paginatedEquipments)
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)
  const total = computed(() => store.total)
  const hasData = computed(() => store.hasData)
  const isEmpty = computed(() => store.isEmpty)
  
  const pagination = computed(() => ({
    currentPage: store.currentPage,
    totalPages: store.totalPages,
    itemsPerPage: store.itemsPerPage,
    totalItems: store.filteredEquipments.length,
    startIndex: (store.currentPage - 1) * store.itemsPerPage,
    endIndex: Math.min(store.currentPage * store.itemsPerPage, store.filteredEquipments.length)
  }))

  const visiblePages = computed(() => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, store.currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(store.totalPages, start + maxVisible - 1)
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    return pages
  })

  // Methods
  const loadEquipments = () => store.loadEquipments()
  const setPage = (page) => store.setPage(page)
  const setItemsPerPage = (items) => store.setItemsPerPage(items)
  const clearError = () => store.clearError()

  return {
    // State
    equipments,
    loading,
    error,
    total,
    hasData,
    isEmpty,
    pagination,
    visiblePages,

    // Methods
    loadEquipments,
    setPage,
    setItemsPerPage,
    clearError
  }
} 