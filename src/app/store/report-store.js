// report-store.js
// Pinia store для управления состоянием отчётов (reports)
// Архитектурная роль: feature-sliced store, централизует CRUD-логику и состояние для отчётов
// Используется на страницах и в компонентах, где требуется доступ к списку и операциям с отчётами

import { defineStore } from 'pinia'
import { fetchReports, addReport, updateReport, deleteReport } from '@/features/reports/api/reportApi'

// Store для отчётов
export const useReportStore = defineStore('report', {
  // Состояние: список отчётов, флаги загрузки, ошибки
  state: () => ({
    reports: [],        // Список отчётов
    loading: false,     // Флаг загрузки
    error: null,        // Текст ошибки (если есть)
  }),

  // Actions: асинхронные методы для CRUD
  actions: {
    /**
     * Загрузить список отчётов по eventId
     * @param {string} eventId
     */
    async loadReports(eventId) {
      this.loading = true
      this.error = null
      const { data, error } = await fetchReports(eventId)
      if (error) {
        this.error = error.message || 'Ошибка загрузки отчётов'
        this.reports = []
      } else {
        this.reports = data || []
      }
      this.loading = false
    },

    /**
     * Добавить новый отчёт
     * @param {Object} report
     */
    async createReport(report) {
      this.loading = true
      this.error = null
      const { data, error } = await addReport(report)
      if (error) {
        this.error = error.message || 'Ошибка добавления отчёта'
      } else if (data && data[0]) {
        this.reports.push(data[0])
      }
      this.loading = false
    },

    /**
     * Обновить отчёт
     * @param {string} id
     * @param {Object} updates
     */
    async updateReportById(id, updates) {
      this.loading = true
      this.error = null
      const { error } = await updateReport(id, updates)
      if (error) {
        this.error = error.message || 'Ошибка обновления отчёта'
      } else {
        // Обновляем локально
        const idx = this.reports.findIndex(r => r.id === id)
        if (idx !== -1) {
          this.reports[idx] = { ...this.reports[idx], ...updates }
        }
      }
      this.loading = false
    },

    /**
     * Удалить отчёт
     * @param {string} id
     */
    async deleteReportById(id) {
      this.loading = true
      this.error = null
      const { error } = await deleteReport(id)
      if (error) {
        this.error = error.message || 'Ошибка удаления отчёта'
      } else {
        this.reports = this.reports.filter(r => r.id !== id)
      }
      this.loading = false
    },

    /**
     * Сбросить ошибку
     */
    clearError() {
      this.error = null
    },
  },

  // Getters можно добавить по необходимости (например, фильтрация, сортировка)
}) 