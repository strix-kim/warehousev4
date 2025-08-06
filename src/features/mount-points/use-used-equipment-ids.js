/**
 * useUsedEquipmentIds - управление контролем уникальности оборудования
 * Архитектурная роль: предотвращение дублирования оборудования между точками монтажа
 * Возвращает Set занятых ID с автоматическим обновлением при изменении данных
 */
import { computed } from 'vue'
import { useMountPointStore } from '@/app/store/mount-point-store'

/**
 * Хук для вычисления ID оборудования, занятого на других точках монтажа мероприятия
 * @param {string|number} eventId - ID мероприятия
 * @param {string|number} [currentMountPointId] - ID текущей точки (исключить из расчёта)
 * @returns {{ usedEquipmentIds: import('vue').ComputedRef<Set> }}
 */
export function useUsedEquipmentIds(eventId, currentMountPointId = null) {
  const mountPointStore = useMountPointStore()

  /**
   * Реактивный computed для отслеживания занятого оборудования
   * Автоматически обновляется при изменении точек монтажа в store
   */
  const usedEquipmentIds = computed(() => {
    const ids = new Set()
    
    // Получаем все точки монтажа для данного мероприятия
    const mountPoints = mountPointStore.getMountPointsByEventId(eventId)
    
    for (const mountPoint of mountPoints) {
      // Пропускаем текущую точку монтажа при редактировании
      if (currentMountPointId && String(mountPoint.id) === String(currentMountPointId)) {
        continue
      }
      
      // Собираем ID из всех списков оборудования
      const equipmentFields = ['equipment_plan', 'equipment_fact', 'equipment_final']
      
      for (const field of equipmentFields) {
        const equipmentList = mountPoint[field]
        if (Array.isArray(equipmentList)) {
          equipmentList.forEach(equipmentId => {
            if (equipmentId != null) {
              ids.add(Number(equipmentId))
            }
          })
        }
      }
    }
    
    return ids
  })

  /**
   * Получить детальную информацию о том, где используется конкретное оборудование
   * @param {number} equipmentId - ID оборудования
   * @returns {Array} Список точек монтажа, где используется это оборудование
   */
  const getEquipmentUsageDetails = (equipmentId) => {
    const mountPoints = mountPointStore.getMountPointsByEventId(eventId)
    const usage = []
    
    for (const mountPoint of mountPoints) {
      if (currentMountPointId && String(mountPoint.id) === String(currentMountPointId)) {
        continue
      }
      
      const equipmentFields = ['equipment_plan', 'equipment_fact', 'equipment_final']
      
      for (const field of equipmentFields) {
        const equipmentList = mountPoint[field]
        if (Array.isArray(equipmentList) && equipmentList.includes(equipmentId)) {
          usage.push({
            mountPointId: mountPoint.id,
            mountPointName: mountPoint.name,
            field: field,
            fieldLabel: getFieldLabel(field)
          })
        }
      }
    }
    
    return usage
  }

  /**
   * Проверить, доступно ли конкретное оборудование для использования
   * @param {number} equipmentId - ID оборудования
   * @returns {boolean} true, если оборудование доступно
   */
  const isEquipmentAvailable = (equipmentId) => {
    return !usedEquipmentIds.value.has(Number(equipmentId))
  }

  /**
   * Получить статистику использования оборудования
   * @returns {Object} Объект со статистикой
   */
  const getUsageStats = () => {
    const mountPoints = mountPointStore.getMountPointsByEventId(eventId)
    let totalPlanned = 0
    let totalActual = 0
    let totalFinal = 0
    
    for (const mountPoint of mountPoints) {
      if (currentMountPointId && String(mountPoint.id) === String(currentMountPointId)) {
        continue
      }
      
      totalPlanned += mountPoint.equipment_plan?.length || 0
      totalActual += mountPoint.equipment_fact?.length || 0
      totalFinal += mountPoint.equipment_final?.length || 0
    }
    
    return {
      totalUsed: usedEquipmentIds.value.size,
      totalPlanned,
      totalActual,
      totalFinal,
      mountPointsCount: mountPoints.length - (currentMountPointId ? 1 : 0)
    }
  }

  return {
    usedEquipmentIds,
    getEquipmentUsageDetails,
    isEquipmentAvailable,
    getUsageStats
  }
}

/**
 * Вспомогательная функция для получения читаемого названия поля
 * @param {string} field - Название поля
 * @returns {string} Читаемое название
 */
function getFieldLabel(field) {
  const labels = {
    equipment_plan: 'Планируемое',
    equipment_fact: 'Установленное',
    equipment_final: 'Финальное'
  }
  return labels[field] || field
} 