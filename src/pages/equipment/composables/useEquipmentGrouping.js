/**
 * useEquipmentGrouping - Композабл для группировки оборудования
 * 
 * Группирует одинаковые модели оборудования в один айтем
 * Показывает общее доступное количество
 */

import { computed } from 'vue'

export function useEquipmentGrouping(equipmentList) {
  /**
   * Группирует оборудование по уникальному ключу (model + brand + type + subtype)
   * Одинаковые модели объединяются с подсчетом количества
   */
  const groupedEquipment = computed(() => {
    if (!equipmentList.value || !Array.isArray(equipmentList.value)) {
      return []
    }

    // Map для группировки: ключ -> объект с данными
    const groupsMap = new Map()

    equipmentList.value.forEach(item => {
      // Создаем уникальный ключ для группировки
      const key = `${item.model}|${item.brand}|${item.type}|${item.subtype}`
      
      if (groupsMap.has(key)) {
        // Группа уже существует - увеличиваем count
        const existing = groupsMap.get(key)
        existing.available_count += 1
        existing.item_ids.push(item.id) // Сохраняем ID всех единиц
      } else {
        // Создаем новую группу
        groupsMap.set(key, {
          // Уникальный ID группы (используем первый ID)
          group_id: key,
          
          // Данные модели
          model: item.model,
          brand: item.brand,
          type: item.type,
          subtype: item.subtype,
          
          // Количество доступных единиц
          available_count: 1,
          
          // ID всех единиц этой модели (для детализации если нужно)
          item_ids: [item.id],
          
          // Дополнительные данные из первой единицы
          serialnumber: item.serialnumber, // Для справки
          availability: item.availability,
          location: item.location,
          created_at: item.created_at
        })
      }
    })

    // Преобразуем Map в массив и сортируем
    return Array.from(groupsMap.values()).sort((a, b) => {
      // Сортировка: сначала по типу, потом по бренду, потом по модели
      if (a.type !== b.type) return a.type.localeCompare(b.type)
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand)
      return a.model.localeCompare(b.model)
    })
  })

  /**
   * Получить детальную информацию о группе
   */
  const getGroupDetails = (groupId) => {
    return groupedEquipment.value.find(group => group.group_id === groupId)
  }

  /**
   * Получить доступное количество для группы
   */
  const getAvailableCount = (groupId) => {
    const group = getGroupDetails(groupId)
    return group ? group.available_count : 0
  }

  /**
   * Статистика по группам
   */
  const groupsStats = computed(() => {
    const groups = groupedEquipment.value
    
    return {
      total_groups: groups.length,
      total_items: groups.reduce((sum, group) => sum + group.available_count, 0),
      by_type: groups.reduce((acc, group) => {
        acc[group.type] = (acc[group.type] || 0) + 1
        return acc
      }, {})
    }
  })

  return {
    groupedEquipment,
    getGroupDetails,
    getAvailableCount,
    groupsStats
  }
}

