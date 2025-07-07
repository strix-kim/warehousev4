// event-store.js
// Pinia store для управления состоянием мероприятий (events)
// Архитектурная роль: feature-sliced store, централизует CRUD-логику, фильтр архив/активные и состояние для мероприятий
// Используется на страницах и в компонентах, где требуется доступ к списку и операциям с мероприятиями

import { defineStore } from 'pinia'
import {
  fetchEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  fetchEventById,
  restoreEvent
} from '@/features/event/eventApi'

export const useEventStore = defineStore('event', {
  state: () => ({
    events: [],         // Список мероприятий
    loading: false,     // Флаг загрузки
    error: null,        // Текст ошибки (если есть)
    showArchived: false // Флаг: показывать архивные или активные
  }),

  actions: {
    /**
     * Загрузить список мероприятий (архив/активные)
     */
    async loadEvents() {
      this.loading = true
      this.error = null
      try {
        // Фильтрация по архиву
        const { data, error } = await this.fetchEventsFiltered(this.showArchived)
        if (error) throw error
        this.events = data
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки мероприятий'
        this.events = []
      } finally {
        this.loading = false
      }
    },

    /**
     * Получить мероприятия с фильтром по архиву
     * @param {boolean} isArchived
     */
    async fetchEventsFiltered(isArchived) {
      // Аналогично use-event-list.js
      return await fetchEvents().then(({ data, error }) => {
        if (error) return { data: [], error }
        // Фильтруем по is_archived
        return { data: data.filter(ev => !!ev.is_archived === !!isArchived), error: null }
      })
    },

    /**
     * Установить фильтр архив/активные и перезагрузить
     */
    setShowArchived(val) {
      this.showArchived = val
      this.loadEvents()
    },

    /**
     * Добавить новое мероприятие
     */
    async createEvent(event) {
      this.loading = true
      this.error = null
      try {
        const { error } = await addEvent(event)
        if (error) throw error
        await this.loadEvents()
      } catch (e) {
        this.error = e.message || 'Ошибка добавления мероприятия'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Обновить мероприятие
     */
    async updateEventById(id, updates) {
      this.loading = true
      this.error = null
      try {
        const { error } = await updateEvent(id, updates)
        if (error) throw error
        await this.loadEvents()
      } catch (e) {
        this.error = e.message || 'Ошибка обновления мероприятия'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Архивировать мероприятие (is_archived = true)
     */
    async archiveEventById(id) {
      this.loading = true
      this.error = null
      try {
        const { error } = await deleteEvent(id)
        if (error) throw error
        await this.loadEvents()
      } catch (e) {
        this.error = e.message || 'Ошибка архивирования мероприятия'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Восстановить мероприятие из архива (is_archived = false)
     */
    async restoreEventById(id) {
      this.loading = true
      this.error = null
      try {
        const { error } = await restoreEvent(id)
        if (error) throw error
        await this.loadEvents()
      } catch (e) {
        this.error = e.message || 'Ошибка восстановления мероприятия'
        throw e
      } finally {
        this.loading = false
      }
    },

    /**
     * Получить мероприятие по id (из API, не из state)
     */
    async fetchEvent(id) {
      this.loading = true
      this.error = null
      try {
        const data = await fetchEventById(id)
        return data
      } catch (e) {
        this.error = e.message || 'Ошибка загрузки мероприятия'
        return null
      } finally {
        this.loading = false
      }
    },

    /**
     * Сбросить ошибку
     */
    clearError() {
      this.error = null
    },
  },
}) 