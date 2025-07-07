// filter-available-equipment.js
// Универсальная функция для фильтрации доступного оборудования для выбора в монтажной точке.
// Используется для equipment_plan, equipment_final и других списков.

/**
 * @param {Array} allEquipment - все объекты оборудования
 * @param {Set} usedEquipmentIds - id, занятые на других точках
 * @param {Array} draft - текущий draft выбора (чтобы не исключать уже выбранные)
 * @param {Object} options - { category, subcategory, search, extraExclude }
 * @returns {Array} отфильтрованный массив оборудования
 */
export function filterAvailableEquipment(allEquipment, usedEquipmentIds, draft, options = {}) {
  const { category, subcategory, search, extraExclude = [] } = options
  const q = (search || '').trim().toLowerCase()
  return allEquipment.filter(eq => {
    if ((usedEquipmentIds.has(eq.id) || extraExclude.includes(eq.id)) && !draft.includes(eq.id)) return false
    if (category && eq.category !== category) return false
    if (subcategory && eq.subcategory !== subcategory) return false
    if (q && !(
      eq.model?.toLowerCase().includes(q) ||
      eq.brand?.toLowerCase().includes(q) ||
      eq.serial_number?.toLowerCase().includes(q)
    )) return false
    return true
  })
} 