/**
 * useMountPointEquipment - управление оборудованием точки монтажа
 * Архитектурная роль: централизованная логика для планируемого/установленного оборудования
 * Включает валидацию уникальности, формирование финального списка, фильтрацию
 */
import { ref, computed, watch } from 'vue'
import { useUsedEquipmentIds } from '../use-used-equipment-ids'
import { filterAvailableEquipment } from '../filter-available-equipment'
import { useMountPointStore } from '@/stores/mount-point-store'
import { useEquipmentStore } from '@/stores/equipment-store'

export function useMountPointEquipment(eventId, mountPointId = null) {
  const mountPointStore = useMountPointStore()
  const equipmentStore = useEquipmentStore()
  
  // Локальные состояния
  const isLoading = ref(false)
  const error = ref(null)

  // Контроль уникальности между точками монтажа
  const { usedEquipmentIds, isEquipmentAvailable, getEquipmentUsageDetails } = useUsedEquipmentIds(eventId, mountPointId)

  return {
    // Состояния
    isLoading,
    error,

    // Вспомогательные
    isEquipmentAvailable,
    getEquipmentUsageDetails
  }
} 