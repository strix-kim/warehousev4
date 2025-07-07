// use-used-equipment-ids.js
// Хук для вычисления id оборудования, занятого на других точках монтажа мероприятия.
// Возвращает usedEquipmentIds (Set) и reload().
// Используйте для фильтрации доступного оборудования при создании/редактировании точки.

import { computed } from 'vue'

/**
 * @param {string} eventId - id мероприятия
 * @param {string|number} [currentMountPointId] - id текущей точки (исключить из расчёта)
 * @returns {{ usedEquipmentIds: import('vue').ComputedRef<Set>, reload: Function }}
 */
export function useUsedEquipmentIds(eventId, currentMountPointId) {
  const usedEquipmentIds = computed(() => {
    const ids = new Set()
    // Assuming mountPoints are now managed by Pinia store,
    // and we need to fetch them or access them directly if available.
    // For now, we'll simulate fetching or assume they are available.
    // In a real scenario, you'd fetch mountPoints from a Pinia store.
    // For this example, we'll just iterate over a dummy array to demonstrate.
    const dummyMountPoints = [
      { id: 1, equipment_plan: [1, 2, 3], equipment_final: [4, 5], equipment_fact: [6] },
      { id: 2, equipment_plan: [7, 8], equipment_final: [9], equipment_fact: [10] },
      { id: 3, equipment_plan: [11, 12], equipment_final: [13], equipment_fact: [14] },
    ];

    for (const mp of dummyMountPoints) {
      if (mp.id === currentMountPointId) continue
      ;['equipment_plan', 'equipment_final', 'equipment_fact'].forEach(field => {
        (mp[field] || []).forEach(id => ids.add(id))
      })
    }
    return ids
  })
  return { usedEquipmentIds }
} 