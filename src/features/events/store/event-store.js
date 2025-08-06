/**
 * event-store.js
 * (Перемещён в папку features/events/store для изоляции модуля)
 * Pinia store для управления мероприятиями (events).
 * Источник: src/app/store/event-store.js (без изменений в логике)
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
} from '@/features/events/api/eventApi'

export const useEventStore = defineStore('event', {
  state: () => ({
    events: [],
    currentEvent: null,
    loading: false,
    loadingCurrent: false,
    loadingCreate: false,
    loadingUpdate: false,
    loadingDelete: false,
    error: null,
    createError: null,
    updateError: null,
    deleteError: null,
    archiveFilter: 'all',
    archivingSupported: null,
    lastFetch: null,
    totalCount: 0
  }),
  getters: {
    activeEvents: (state) => state.events.filter(e => !e.is_archived),
    archivedEvents: (state) => state.events.filter(e => e.is_archived),
    filteredEvents: (state) => {
      switch (state.archiveFilter) {
        case 'active':
          return state.events.filter(e => !e.is_archived)
        case 'archived':
          return state.events.filter(e => e.is_archived)
        case 'all':
        default:
          return state.events
      }
    },
    eventsStats: (state) => {
      const total = state.events.length
      const active = state.events.filter(e => !e.is_archived).length
      const archived = state.events.filter(e => e.is_archived).length
      return {
        total,
        active,
        archived,
        activePercentage: total ? Math.round((active / total) * 100) : 0,
        archivedPercentage: total ? Math.round((archived / total) * 100) : 0
      }
    },
    isLoading: (state) =>
      state.loading || state.loadingCurrent || state.loadingCreate || state.loadingUpdate || state.loadingDelete,
    hasErrors: (state) => !!(state.error || state.createError || state.updateError || state.deleteError),
    getEventById: (state) => (id) => state.events.find(e => e.id === id),
    getEventsByOrganizer: (state) => (org) => state.events.filter(e => e.organizer?.toLowerCase().includes(org.toLowerCase())),
    getEventsByLocation: (state) => (loc) => state.events.filter(e => e.location?.toLowerCase().includes(loc.toLowerCase()))
  },
  actions: {
    clearErrors() {
      this.error = this.createError = this.updateError = this.deleteError = null
    },
    clearError(type = 'error') {
      if (this[type] !== undefined) this[type] = null
    },
    async checkArchiving() {
      if (this.archivingSupported === null) {
        try {
          this.archivingSupported = await checkArchivingSupport()
        } catch (e) {
          console.error(e)
          this.archivingSupported = false
        }
      }
      return this.archivingSupported
    },
    setArchiveFilter(filter) {
      if (['all', 'active', 'archived'].includes(filter)) this.archiveFilter = filter
    },
    async loadEvents() {
      this.loading = true
      this.error = null
      try {
        await this.checkArchiving()
        const { data, error } = await fetchEvents()
        if (error) throw new Error(error.message)
        this.events = (data || []).map(e => ({
          ...e,
          is_archived: this.archivingSupported ? e.is_archived : false,
          created_at: e.created_at || new Date().toISOString()
        }))
        this.totalCount = this.events.length
        this.lastFetch = new Date().toISOString()
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки мероприятий'
        this.events = []
        this.totalCount = 0
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    async loadActiveEvents() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchActiveEvents()
        if (error) throw new Error(error.message)
        this.events = (data || []).map(e => ({ ...e, created_at: e.created_at || new Date().toISOString() }))
        this.archiveFilter = 'active'
        this.totalCount = this.events.length
        this.lastFetch = new Date().toISOString()
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки активных мероприятий'
        this.events = []
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    async loadArchivedEvents() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchArchivedEvents()
        if (error) throw new Error(error.message)
        this.events = (data || []).map(e => ({ ...e, created_at: e.created_at || new Date().toISOString() }))
        this.archiveFilter = 'archived'
        this.totalCount = this.events.length
        this.lastFetch = new Date().toISOString()
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки архивных мероприятий'
        this.events = []
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    async loadEventById(id, setCurrent = true, forceReload = false) {
      const existing = this.events.find(e => e.id === id)
      if (existing && !forceReload) {
        if (setCurrent) this.currentEvent = existing
        return existing
      }
      this.loadingCurrent = true
      this.error = null
      try {
        const data = await fetchEventById(id)
        if (!data) throw new Error('Мероприятие не найдено')
        const eventData = { ...data, created_at: data.created_at || new Date().toISOString() }
        if (setCurrent) this.currentEvent = eventData
        const idx = this.events.findIndex(e => e.id === id)
        if (idx !== -1) this.events[idx] = eventData
        else this.events.push(eventData)
        return eventData
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки мероприятия'
        if (setCurrent) this.currentEvent = null
        console.error(e)
        throw e
      } finally {
        this.loadingCurrent = false
      }
    },
    setCurrentEvent(event) {
      this.currentEvent = event
    },
    clearCurrentEvent() {
      this.currentEvent = null
    },
    async createEvent(eventData) {
      this.loadingCreate = true
      this.createError = null
      try {
        const newData = {
          ...eventData,
          is_archived: false,
          created_at: new Date().toISOString(),
          mount_points_count: eventData.mount_points_count || 0,
          responsible_engineers: eventData.responsible_engineers || [],
          photos: eventData.photos || []
        }
        const { data, error } = await addEvent(newData)
        if (error) throw new Error(error.message)
        await this.loadEvents()
        return data
      } catch (e) {
        this.createError = e.message || 'Ошибка создания мероприятия'
        console.error(e)
        throw e
      } finally {
        this.loadingCreate = false
      }
    },
    async updateEvent(id, updates) {
      this.loadingUpdate = true
      this.updateError = null
      try {
        const { data, error } = await updateEvent(id, updates)
        if (error) throw new Error(error.message)
        const idx = this.events.findIndex(e => e.id === id)
        if (idx !== -1) this.events[idx] = { ...this.events[idx], ...updates }
        if (this.currentEvent?.id === id) this.currentEvent = { ...this.currentEvent, ...updates }
        return data
      } catch (e) {
        this.updateError = e.message || 'Ошибка обновления мероприятия'
        console.error(e)
        throw e
      } finally {
        this.loadingUpdate = false
      }
    },
    async deleteEvent(id) {
      this.loadingDelete = true
      this.deleteError = null
      try {
        const { error } = await deleteEvent(id)
        if (error) throw new Error(error.message)
        if (this.archivingSupported) {
          const idx = this.events.findIndex(e => e.id === id)
          if (idx !== -1) this.events[idx].is_archived = true
          if (this.currentEvent?.id === id) this.currentEvent.is_archived = true
        } else {
          this.events = this.events.filter(e => e.id !== id)
          if (this.currentEvent?.id === id) this.currentEvent = null
        }
        this.totalCount = this.events.length
      } catch (e) {
        this.deleteError = e.message || 'Ошибка удаления мероприятия'
        console.error(e)
        throw e
      } finally {
        this.loadingDelete = false
      }
    },
    async restoreEvent(id) {
      this.loadingUpdate = true
      this.updateError = null
      try {
        const { error } = await restoreEvent(id)
        if (error) throw new Error(error.message)
        const idx = this.events.findIndex(e => e.id === id)
        if (idx !== -1) this.events[idx].is_archived = false
        if (this.currentEvent?.id === id) this.currentEvent.is_archived = false
      } catch (e) {
        this.updateError = e.message || 'Ошибка восстановления мероприятия'
        console.error(e)
        throw e
      } finally {
        this.loadingUpdate = false
      }
    },
    searchEvents(query, fields = ['name', 'organizer', 'location', 'description']) {
      if (!query || query.trim() === '') return this.filteredEvents
      const term = query.toLowerCase().trim()
      return this.filteredEvents.filter(ev => fields.some(f => ev[f]?.toString().toLowerCase().includes(term)))
    },
    refreshLocalData() {
      this.totalCount = this.events.length
      this.lastFetch = new Date().toISOString()
    },
    resetStore() {
      this.events = []
      this.currentEvent = null
      this.loading = this.loadingCurrent = this.loadingCreate = this.loadingUpdate = this.loadingDelete = false
      this.error = this.createError = this.updateError = this.deleteError = null
      this.archiveFilter = 'all'
      this.archivingSupported = null
      this.lastFetch = null
      this.totalCount = 0
    }
  }
})
