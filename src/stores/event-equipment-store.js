// event-equipment-store.js
// Pinia store для управления оборудованием на уровне мероприятия
// Архитектурная роль: централизованное управление распределением оборудования между точками монтажа
// Обеспечивает: автоматическое исключение уже используемого оборудования, валидацию доступности

import { defineStore } from 'pinia'
import { useEquipmentStore } from './equipment-store'
import { useMountPointStore } from './mount-point-store'

export const useEventEquipmentStore = defineStore('eventEquipment', {
  state: () => ({
    currentEventId: null,
    allocation: {}, // Распределение оборудования по точкам монтажа
    loading: false,
    error: null
  }),

  getters: {
    // Получить все оборудование, используемое в мероприятии
    usedEquipmentInEvent: (state) => {
      const used = []
      Object.values(state.allocation || {}).forEach(lists => {
        used.push(...(lists.planned || []))
        used.push(...(lists.final || []))
        used.push(...(lists.fact || []))
      })
      return [...new Set(used)] // Убираем дубликаты
    },

    // Получить доступное оборудование для конкретной точки монтажа
    getAvailableEquipment: (state) => (mountPointId, listType = 'planned') => {
      const equipmentStore = useEquipmentStore()
      const allEquipment = equipmentStore.equipments
      
      console.log('🔧 getAvailableEquipment:', {
        mountPointId,
        listType,
        allEquipmentLength: allEquipment?.length || 0,
        totalEquipment: equipmentStore.total,
        allocation: state.allocation,
        usedEquipmentInEvent: state.usedEquipmentInEvent
      })
      
      if (!allEquipment || allEquipment.length === 0) {
        console.log('❌ Нет оборудования в store')
        return []
      }

      // Получаем ID используемого оборудования (исключая текущую точку)
      const usedEquipment = (state.usedEquipmentInEvent || []).filter(id => {
        // Исключаем оборудование из текущей точки монтажа
        const currentPointLists = (state.allocation || {})[mountPointId] || {}
        const currentPointEquipment = [
          ...(currentPointLists.planned || []),
          ...(currentPointLists.final || []),
          ...(currentPointLists.fact || [])
        ]
        return !currentPointEquipment.includes(id)
      })

      console.log('🔧 usedEquipment (исключая текущую точку):', usedEquipment)

      // Сначала фильтруем по использованию
      const notUsedEquipment = allEquipment.filter(equipment => 
        !usedEquipment.includes(equipment.id)
      )
      
      console.log('🔧 notUsedEquipment (по использованию):', notUsedEquipment.length)
      
      // Затем фильтруем по статусу - только оборудование "В наличии"
      const availableEquipment = notUsedEquipment.filter(equipment => 
        equipment.status === 'В наличии'
      )
      
      console.log('🔧 availableEquipment (по статусу):', availableEquipment.length)
      console.log('🔧 Статусы оборудования:', [...new Set(allEquipment.map(e => e.status))])

      console.log('🔧 availableEquipment:', availableEquipment.length)

      return availableEquipment
    },

    // Получить информацию об использовании конкретного оборудования
    getEquipmentUsage: (state) => (equipmentId) => {
      const mountPointStore = useMountPointStore()
      
      for (const [mountPointId, lists] of Object.entries(state.allocation)) {
        const allLists = [
          ...(lists.planned || []),
          ...(lists.final || []),
          ...(lists.fact || [])
        ]
        
        if (allLists.includes(equipmentId)) {
          const mountPoint = mountPointStore.getMountPointById(mountPointId)
          return {
            mountPointId,
            mountPointName: mountPoint?.name || 'Неизвестная точка',
            listTypes: []
          }
        }
      }
      
      return null
    },

    // Получить статистику распределения оборудования по категориям
    allocationStats: (state) => {
      const equipmentStore = useEquipmentStore()
      const usedEquipmentIds = state.usedEquipmentInEvent || []
      
      // Получаем детальную информацию об используемом оборудовании
      const usedEquipment = (equipmentStore.equipments || []).filter(eq => 
        usedEquipmentIds.includes(eq.id)
      )
      
      // Группируем по категориям
      const byCategory = usedEquipment.reduce((acc, equipment) => {
        const category = equipment.category || 'Не указана'
        if (!acc[category]) {
          acc[category] = {
            count: 0,
            items: []
          }
        }
        acc[category].count++
        acc[category].items.push(equipment)
        return acc
      }, {})
      
      // Сортируем категории по количеству оборудования
      const sortedCategories = Object.entries(byCategory)
        .sort(([,a], [,b]) => b.count - a.count)
        .map(([category, data]) => ({
          category,
          count: data.count,
          items: data.items
        }))
      
      return {
        totalUsed: usedEquipmentIds.length,
        byCategory: sortedCategories,
        categories: sortedCategories.map(cat => ({
          name: cat.category,
          count: cat.count,
          percentage: usedEquipmentIds.length > 0 
            ? ((cat.count / usedEquipmentIds.length) * 100).toFixed(1)
            : '0'
        }))
      }
    },

    // Список оборудования для постов охраны (только планируемое)
    securityEquipmentList: (state) => {
      const allPlanned = []
      Object.values(state.allocation || {}).forEach(lists => {
        allPlanned.push(...(lists.planned || []))
      })
      return [...new Set(allPlanned)] // Убираем дубликаты
    },

    // Список оборудования для отчета с детальной информацией
    reportEquipmentList: (state) => {
      const equipmentWithDetails = []
      
      Object.entries(state.allocation || {}).forEach(([mountPointId, lists]) => {
        const mountPointStore = useMountPointStore()
        const mountPoint = mountPointStore.getMountPointById(mountPointId)
        
        // Планируемое оборудование
        lists.planned?.forEach(equipmentId => {
          equipmentWithDetails.push({
            equipmentId,
            mountPointId,
            mountPointName: mountPoint?.name || 'Неизвестная точка',
            listType: 'planned',
            source: 'Планируемое'
          })
        })
        
        // Итоговое оборудование
        lists.final?.forEach(equipmentId => {
          equipmentWithDetails.push({
            equipmentId,
            mountPointId,
            mountPointName: mountPoint?.name || 'Неизвестная точка',
            listType: 'final',
            source: 'Итоговое'
          })
        })
      })
      
      return equipmentWithDetails
    },

    // Получить детальную информацию об оборудовании с указанием точки монтажа
    getEquipmentWithMountPointInfo: (state) => (equipmentId) => {
      for (const [mountPointId, lists] of Object.entries(state.allocation || {})) {
        const mountPointStore = useMountPointStore()
        const mountPoint = mountPointStore.getMountPointById(mountPointId)
        
        // Проверяем в планируемом списке
        if (lists.planned?.includes(equipmentId)) {
          return {
            equipmentId,
            mountPointId,
            mountPointName: mountPoint?.name || 'Неизвестная точка',
            listType: 'planned',
            source: 'Планируемое'
          }
        }
        
        // Проверяем в итоговом списке
        if (lists.final?.includes(equipmentId)) {
          return {
            equipmentId,
            mountPointId,
            mountPointName: mountPoint?.name || 'Неизвестная точка',
            listType: 'final',
            source: 'Итоговое'
          }
        }
      }
      return null
    }
  },

  actions: {
    // Загрузить распределение оборудования для мероприятия
    async loadEventAllocation(eventId) {
      this.loading = true
      this.error = null
      this.currentEventId = eventId
      
      try {
        // Загружаем все точки монтажа мероприятия
        const mountPointStore = useMountPointStore()
        await mountPointStore.loadMountPointsByEventId(eventId)
        
        const mountPoints = mountPointStore.getMountPointsByEventId(eventId)
        
        // Формируем allocation объект
        this.allocation = {}
        mountPoints.forEach(mountPoint => {
          this.allocation[mountPoint.id] = {
            planned: mountPoint.equipment_plan || [],
            final: mountPoint.equipment_final || [],
            fact: mountPoint.equipment_fact || []
          }
        })
        
      } catch (error) {
        this.error = error.message
        console.error('Ошибка загрузки распределения оборудования:', error)
      } finally {
        this.loading = false
      }
    },

    // Обновить список оборудования для точки монтажа
    async updateMountPointEquipment(mountPointId, listType, equipmentIds) {
      try {
        const mountPointStore = useMountPointStore()
        
        // Маппинг типов списков на поля базы данных
        const fieldMapping = {
          'planned': 'equipment_plan',
          'final': 'equipment_final',
          'fact': 'equipment_fact'
        }
        
        const fieldName = fieldMapping[listType]
        if (!fieldName) {
          throw new Error(`Неизвестный тип списка: ${listType}`)
        }
        
        // Обновляем в базе данных
        await mountPointStore.editMountPoint(mountPointId, {
          [fieldName]: equipmentIds
        })
        
        // Обновляем локальное состояние
        if (!this.allocation[mountPointId]) {
          this.allocation[mountPointId] = {}
        }
        this.allocation[mountPointId][listType] = equipmentIds
        
        return true
      } catch (error) {
        this.error = error.message
        console.error('Ошибка обновления оборудования:', error)
        throw error
      }
    },

    // Проверить доступность оборудования
    isEquipmentAvailable(equipmentId, mountPointId) {
      const usage = this.getEquipmentUsage(equipmentId)
      
      // Если оборудование не используется нигде
      if (!usage) {
        return true
      }
      
      // Если оборудование используется в текущей точке монтажа
      if (usage.mountPointId === mountPointId) {
        return true
      }
      
      // Иначе оборудование недоступно
      return false
    },

    // Получить информацию о недоступном оборудовании
    getUnavailableEquipmentInfo(equipmentIds, mountPointId) {
      const unavailable = []
      
      equipmentIds.forEach(equipmentId => {
        if (!this.isEquipmentAvailable(equipmentId, mountPointId)) {
          const usage = this.getEquipmentUsage(equipmentId)
          unavailable.push({
            equipmentId,
            usedIn: usage?.mountPointName || 'Неизвестная точка'
          })
        }
      })
      
      return unavailable
    },

    // Очистить состояние
    clearState() {
      this.currentEventId = null
      this.allocation = {}
      this.loading = false
      this.error = null
    }
  }
}) 