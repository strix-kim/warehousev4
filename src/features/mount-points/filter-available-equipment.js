/**
 * filter-available-equipment.js
 * Универсальная функция для фильтрации доступного оборудования точки монтажа
 * Архитектурная роль: контроль уникальности и фильтрация по различным критериям
 * Поддерживает: исключение занятого оборудования, фильтры категорий, поиск по тексту
 */

/**
 * Фильтрует доступное оборудование с учётом уникальности и пользовательских фильтров
 * @param {Array} allEquipment - массив всего доступного оборудования
 * @param {Set} usedEquipmentIds - Set ID оборудования, занятого в других точках монтажа
 * @param {Array} currentSelection - текущие выбранные ID (чтобы не исключать их)
 * @param {Object} filters - объект с фильтрами
 * @param {string} filters.category - фильтр по категории
 * @param {string} filters.subcategory - фильтр по подкатегории
 * @param {string} filters.search - поисковый запрос
 * @param {string} filters.status - фильтр по статусу
 * @param {Array} filters.extraExclude - дополнительные ID для исключения
 * @returns {Array} отфильтрованный массив объектов оборудования
 */
export function filterAvailableEquipment(allEquipment, usedEquipmentIds, currentSelection = [], filters = {}) {
  const { 
    category, 
    subcategory, 
    search, 
    status,
    extraExclude = [] 
  } = filters
  
  const searchQuery = (search || '').trim().toLowerCase()
  
  return allEquipment.filter(equipment => {
    // ПРОВЕРКА УНИКАЛЬНОСТИ: исключаем занятое оборудование, кроме уже выбранного
    const isUsedElsewhere = usedEquipmentIds.has(equipment.id) || extraExclude.includes(equipment.id)
    const isCurrentlySelected = currentSelection.includes(equipment.id)
    
    if (isUsedElsewhere && !isCurrentlySelected) {
      return false
    }
    
    // ФИЛЬТР ПО КАТЕГОРИИ
    if (category && equipment.category !== category) {
      return false
    }
    
    // ФИЛЬТР ПО ПОДКАТЕГОРИИ
    if (subcategory && equipment.subcategory !== subcategory) {
      return false
    }
    
    // ФИЛЬТР ПО СТАТУСУ
    if (status && equipment.status !== status) {
      return false
    }
    
    // ПОИСКОВЫЙ ФИЛЬТР: поиск по названию, модели, бренду, серийному номеру
    if (searchQuery) {
      const searchableFields = [
        equipment.name,
        equipment.model,
        equipment.brand,
        equipment.serial_number
      ].filter(Boolean) // Убираем undefined/null значения
      
      const matchFound = searchableFields.some(field => 
        field.toLowerCase().includes(searchQuery)
      )
      
      if (!matchFound) {
        return false
      }
    }
    
    return true
  })
}

/**
 * Получить статистику фильтрации
 * @param {Array} originalEquipment - исходный массив оборудования
 * @param {Array} filteredEquipment - отфильтрованный массив
 * @param {Set} usedEquipmentIds - занятое оборудование
 * @returns {Object} объект со статистикой
 */
export function getFilterStats(originalEquipment, filteredEquipment, usedEquipmentIds) {
  return {
    total: originalEquipment.length,
    available: filteredEquipment.length,
    used: usedEquipmentIds.size,
    filtered: originalEquipment.length - filteredEquipment.length - usedEquipmentIds.size
  }
}

/**
 * Проверить, доступно ли конкретное оборудование
 * @param {number} equipmentId - ID оборудования
 * @param {Set} usedEquipmentIds - занятое оборудование
 * @param {Array} currentSelection - текущий выбор
 * @returns {boolean} true, если доступно
 */
export function isEquipmentAvailable(equipmentId, usedEquipmentIds, currentSelection = []) {
  return !usedEquipmentIds.has(equipmentId) || currentSelection.includes(equipmentId)
} 