// Публичный API модуля events
export { default as EventDetails } from './EventDetails.vue'
export { default as EventEditor } from './EventEditor.vue'
export { default as EventFormModal } from './components/EventFormModal.vue'
export { default as EventDiagnostic } from './components/EventDiagnostic.vue'
export { default as EventEquipmentList } from './components/EventEquipmentList.vue'
export { default as EquipmentList } from './components/EquipmentList.vue'

// API
export * from './api/eventApi.js'

// Store
export { useEventStore } from './store/event-store.js'

// Composables
export * from './composables/useEventMountPoints.js'

// UI Components
export { default as EventTabs } from './ui/EventTabsV2.vue'
export { default as EventCardV2 } from './ui/EventCardV2.vue' 