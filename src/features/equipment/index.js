/**
 * Equipment Module - EPR System
 * 
 * Модуль для управления оборудованием
 * Использует UI Kit v2 и Bento Grid дизайн
 */

// Store
export { useEquipmentStore } from './store/equipment-store.js'

// API
export { equipmentApi } from './api/equipment-api.js'

// Constants ✅ НОВОЕ
export * from './constants/index.js'

// Composables
export { useEquipmentList } from './composables/useEquipmentList.js'
export { useEquipmentForm } from './composables/useEquipmentForm.js'
export { useEquipmentSearch } from './composables/useEquipmentSearch.js'

// Components  
export { default as EquipmentFormModal } from './components/EquipmentFormModal.vue'
export { default as EquipmentDeleteModal } from './components/EquipmentDeleteModal.vue'
export { default as EquipmentViewModal } from './components/EquipmentViewModal.vue'
export { default as EquipmentCard } from './components/EquipmentCard.vue' 