/**
 * event-store.js
 * Pinia store для управления мероприятиями (events) с полной поддержкой CRUD операций
 * 
 * Поля записи:
 * - id, name, organizer, location, description, technical_task
 * - photos, setup_date, start_date, end_date, teardown_date
 * - mount_points_count, responsible_engineers, created_at, is_archived
 * 
 * Функциональность:
 * - Загрузка всех записей, добавление, обновление, удаление
 * - Фильтрация по is_archived
 * - Управление текущей выбранной записью
 * - Обработка состояний загрузки и ошибок
 */

import { defineStore } from 'pinia'
import {
  fetchEvents,
  fetchActiveEvents,
  fetchArchivedEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  fetchEventById,
  restoreEvent,
  checkArchivingSupport
} from '@/features/event/eventApi'

export const useEventStore = defineStore('event', {
  state: () => ({
    // Основные данные
    events: [],                    // Список всех мероприятий
    currentEvent: null,            // Текущая выбранная запись
    
    // Состояния загрузки
    loading: false,                // Общая загрузка
    loadingCurrent: false,         // Загрузка текущей записи
    loadingCreate: false,          // Создание записи
    loadingUpdate: false,          // Обновление записи
    loadingDelete: false,          // Удаление записи
    
    // Состояния ошибок
    error: null,                   // Общая ошибка
    createError: null,             // Ошибка создания
    updateError: null,             // Ошибка обновления
    deleteError: null,             // Ошибка удаления
    
    // Фильтрация и настройки
    archiveFilter: 'all',          // 'all' | 'active' | 'archived'
    archivingSupported: null,      // Поддержка архивирования в БД
    
    // Метаданные
    lastFetch: null,               // Время последней загрузки
    totalCount: 0,                 // Общее количество записей
  }),

  getters: {
    /**
     * Активные мероприятия (is_archived = false)
     */
    activeEvents: (state) => {
      return state.events.filter(event => !event.is_archived)
    },

    /**
     * Архивные мероприятия (is_archived = true)
     */
    archivedEvents: (state) => {
      return state.events.filter(event => event.is_archived)
    },

    /**
     * Отфильтрованные мероприятия согласно текущему фильтру
     */
    filteredEvents: (state) => {
      switch (state.archiveFilter) {
        case 'active':
          return state.events.filter(event => !event.is_archived)
        case 'archived':
          return state.events.filter(event => event.is_archived)
        case 'all':
        default:
          return state.events
      }
    },

    /**
     * Статистика по мероприятиям
     */
    eventsStats: (state) => {
      const total = state.events.length
      const active = state.events.filter(e => !e.is_archived).length
      const archived = state.events.filter(e => e.is_archived).length
      
      return {
        total,
        active,
        archived,
        activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
        archivedPercentage: total > 0 ? Math.round((archived / total) * 100) : 0
      }
    },

    /**
     * Проверка загрузки любой операции
     */
    isLoading: (state) => {
      return state.loading || state.loadingCurrent || state.loadingCreate || 
             state.loadingUpdate || state.loadingDelete
    },

    /**
     * Проверка наличия ошибок
     */
    hasErrors: (state) => {
      return !!(state.error || state.createError || state.updateError || state.deleteError)
    },

    /**
     * Мероприятие по ID
     */
    getEventById: (state) => {
      return (id) => state.events.find(event => event.id === id)
    },

    /**
     * Мероприятия по организатору
     */
    getEventsByOrganizer: (state) => {
      return (organizer) => state.events.filter(event => 
        event.organizer?.toLowerCase().includes(organizer.toLowerCase())
      )
    },

    /**
     * Мероприятия по локации
     */
    getEventsByLocation: (state) => {
      return (location) => state.events.filter(event => 
        event.location?.toLowerCase().includes(location.toLowerCase())
      )
    }
  },

  actions: {
    /**
     * Очистка всех ошибок
     */
    clearErrors() {
      this.error = null
      this.createError = null
      this.updateError = null
      this.deleteError = null
    },

    /**
     * Очистка конкретной ошибки
     * @param {string} errorType - тип ошибки ('error', 'createError', 'updateError', 'deleteError')
     */
    clearError(errorType = 'error') {
      if (this[errorType] !== undefined) {
        this[errorType] = null
      }
    },

    /**
     * Проверка поддержки архивирования в БД
     */
    async checkArchiving() {
      if (this.archivingSupported === null) {
        try {
          this.archivingSupported = await checkArchivingSupport()
          if (!this.archivingSupported) {
            console.warn('⚠️ Архивирование не поддерживается. Добавьте поле is_archived в таблицу events.')
          }
        } catch (error) {
          console.error('Ошибка проверки архивирования:', error)
          this.archivingSupported = false
        }
      }
      return this.archivingSupported
    },

    /**
     * Установка фильтра архивирования
     * @param {string} filter - 'all' | 'active' | 'archived'
     */
    setArchiveFilter(filter) {
      if (['all', 'active', 'archived'].includes(filter)) {
        this.archiveFilter = filter
      }
    },

    /**
     * Загрузка всех мероприятий
     */
    async loadEvents() {
      this.loading = true
      this.error = null
      
      try {
        await this.checkArchiving()
        
        const { data, error } = await fetchEvents()
        if (error) throw new Error(error.message)
        
        // Обрабатываем данные с учетом поддержки архивирования
        if (!this.archivingSupported) {
          this.events = (data || []).map(event => ({ 
            ...event, 
            is_archived: false,
            created_at: event.created_at || new Date().toISOString()
          }))
        } else {
          this.events = (data || []).map(event => ({
            ...event,
            created_at: event.created_at || new Date().toISOString()
          }))
        }
        
        this.totalCount = this.events.length
        this.lastFetch = new Date().toISOString()
        
      } catch (error) {
        this.error = error.message || 'Ошибка загрузки мероприятий'
        this.events = []
        this.totalCount = 0
        console.error('Ошибка загрузки мероприятий:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Загрузка только активных мероприятий
     */
    async loadActiveEvents() {
      this.loading = true
      this.error = null
      
      try {
        const { data, error } = await fetchActiveEvents()
        if (error) throw new Error(error.message)
        
        this.events = (data || []).map(event => ({
          ...event,
          created_at: event.created_at || new Date().toISOString()
        }))
        this.archiveFilter = 'active'
        this.totalCount = this.events.length
        this.lastFetch = new Date().toISOString()
        
      } catch (error) {
        this.error = error.message || 'Ошибка загрузки активных мероприятий'
        this.events = []
        console.error('Ошибка загрузки активных мероприятий:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Загрузка только архивных мероприятий
     */
    async loadArchivedEvents() {
      this.loading = true
      this.error = null
      
      try {
        const { data, error } = await fetchArchivedEvents()
        if (error) throw new Error(error.message)
        
        this.events = (data || []).map(event => ({
          ...event,
          created_at: event.created_at || new Date().toISOString()
        }))
        this.archiveFilter = 'archived'
        this.totalCount = this.events.length
        this.lastFetch = new Date().toISOString()
        
      } catch (error) {
        this.error = error.message || 'Ошибка загрузки архивных мероприятий'
        this.events = []
        console.error('Ошибка загрузки архивных мероприятий:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Загрузка мероприятия по ID
     * @param {string} id - ID мероприятия
     * @param {boolean} setCurrent - установить как текущую запись
     * @param {boolean} forceReload - форсировать загрузку с сервера
     */
    async loadEventById(id, setCurrent = true, forceReload = false) {
      // Если уже есть в events и не требуется forceReload — возвращаем локально
      const existing = this.events.find(event => event.id === id)
      if (existing && !forceReload) {
        if (setCurrent) this.currentEvent = existing
        return existing
      }
      this.loadingCurrent = true
      this.error = null
      try {
        const data = await fetchEventById(id)
        if (!data) throw new Error('Мероприятие не найдено')
        const eventData = {
          ...data,
          created_at: data.created_at || new Date().toISOString()
        }
        if (setCurrent) {
          this.currentEvent = eventData
        }
        // Обновляем запись в списке, если она там есть
        const index = this.events.findIndex(event => event.id === id)
        if (index !== -1) {
          this.events[index] = eventData
        } else {
          this.events.push(eventData)
        }
        return eventData
      } catch (error) {
        this.error = error.message || 'Ошибка загрузки мероприятия'
        if (setCurrent) {
          this.currentEvent = null
        }
        console.error('Ошибка загрузки мероприятия:', error)
        throw error
      } finally {
        this.loadingCurrent = false
      }
    },

    /**
     * Установка текущей записи
     * @param {Object|null} event - мероприятие или null для очистки
     */
    setCurrentEvent(event) {
      this.currentEvent = event
    },

    /**
     * Очистка текущей записи
     */
    clearCurrentEvent() {
      this.currentEvent = null
    },

    /**
     * Создание нового мероприятия
     * @param {Object} eventData - данные мероприятия
     */
    async createEvent(eventData) {
      this.loadingCreate = true
      this.createError = null
      
      try {
        // Подготавливаем данные с валидацией
        const newEventData = {
          ...eventData,
          is_archived: false,
          created_at: new Date().toISOString(),
          mount_points_count: eventData.mount_points_count || 0,
          responsible_engineers: eventData.responsible_engineers || [],
          photos: eventData.photos || []
        }
        
        const { data, error } = await addEvent(newEventData)
        if (error) throw new Error(error.message)
        
        // Обновляем локальный список
        await this.loadEvents()
        
        return data
        
      } catch (error) {
        this.createError = error.message || 'Ошибка создания мероприятия'
        console.error('Ошибка создания мероприятия:', error)
        throw error
      } finally {
        this.loadingCreate = false
      }
    },

    /**
     * Обновление мероприятия
     * @param {string} id - ID мероприятия
     * @param {Object} updates - обновляемые данные
     */
    async updateEvent(id, updates) {
      this.loadingUpdate = true
      this.updateError = null
      
      try {
        const { data, error } = await updateEvent(id, updates)
        if (error) throw new Error(error.message)
        
        // Обновляем локальные данные
        const index = this.events.findIndex(event => event.id === id)
        if (index !== -1) {
          this.events[index] = { ...this.events[index], ...updates }
        }
        
        // Обновляем текущую запись, если это она
        if (this.currentEvent?.id === id) {
          this.currentEvent = { ...this.currentEvent, ...updates }
        }
        
        return data
        
      } catch (error) {
        this.updateError = error.message || 'Ошибка обновления мероприятия'
        console.error('Ошибка обновления мероприятия:', error)
        throw error
      } finally {
        this.loadingUpdate = false
      }
    },

    /**
     * Удаление мероприятия (архивирование)
     * @param {string} id - ID мероприятия
     */
    async deleteEvent(id) {
      this.loadingDelete = true
      this.deleteError = null
      
      try {
        const { error } = await deleteEvent(id)
        if (error) throw new Error(error.message)
        
        // Обновляем локальные данные
        if (this.archivingSupported) {
          // Если поддерживается архивирование, обновляем статус
          const index = this.events.findIndex(event => event.id === id)
          if (index !== -1) {
            this.events[index].is_archived = true
          }
          
          if (this.currentEvent?.id === id) {
            this.currentEvent.is_archived = true
          }
        } else {
          // Если архивирование не поддерживается, удаляем из списка
          this.events = this.events.filter(event => event.id !== id)
          
          if (this.currentEvent?.id === id) {
            this.currentEvent = null
          }
        }
        
        this.totalCount = this.events.length
        
      } catch (error) {
        this.deleteError = error.message || 'Ошибка удаления мероприятия'
        console.error('Ошибка удаления мероприятия:', error)
        throw error
      } finally {
        this.loadingDelete = false
      }
    },

    /**
     * Восстановление мероприятия из архива
     * @param {string} id - ID мероприятия
     */
    async restoreEvent(id) {
      this.loadingUpdate = true
      this.updateError = null
      
      try {
        const { error } = await restoreEvent(id)
        if (error) throw new Error(error.message)
        
        // Обновляем локальные данные
        const index = this.events.findIndex(event => event.id === id)
        if (index !== -1) {
          this.events[index].is_archived = false
        }
        
        if (this.currentEvent?.id === id) {
          this.currentEvent.is_archived = false
        }
        
      } catch (error) {
        this.updateError = error.message || 'Ошибка восстановления мероприятия'
        console.error('Ошибка восстановления мероприятия:', error)
        throw error
      } finally {
        this.loadingUpdate = false
      }
    },

    /**
     * Поиск мероприятий по тексту
     * @param {string} query - поисковый запрос
     * @param {Array} fields - поля для поиска
     */
    searchEvents(query, fields = ['name', 'organizer', 'location', 'description']) {
      if (!query || query.trim() === '') {
        return this.filteredEvents
      }
      
      const searchTerm = query.toLowerCase().trim()
      
      return this.filteredEvents.filter(event => {
        return fields.some(field => {
          const value = event[field]
          return value && value.toString().toLowerCase().includes(searchTerm)
        })
      })
    },

    /**
     * Обновление локального списка без перезагрузки
     */
    refreshLocalData() {
      this.totalCount = this.events.length
      this.lastFetch = new Date().toISOString()
    },

    /**
     * Сброс состояния store
     */
    resetStore() {
      this.events = []
      this.currentEvent = null
      this.loading = false
      this.loadingCurrent = false
      this.loadingCreate = false
      this.loadingUpdate = false
      this.loadingDelete = false
      this.error = null
      this.createError = null
      this.updateError = null
      this.deleteError = null
      this.archiveFilter = 'all'
      this.archivingSupported = null
      this.lastFetch = null
      this.totalCount = 0
    }
  }
}) 