// reportApi.js
// Сервис для CRUD-операций с таблицей отчётов (reports) через Supabase.
// Используется во всех компонентах и хуках, связанных с отчётами.

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список отчётов по event_id (если не передан — вернуть все)
 * @param {string} [eventId]
 */
export async function fetchReports(eventId) {
  let query = supabase.from('reports').select('*')
  if (eventId) query = query.eq('event_id', eventId)
  return await query
}

/**
 * Добавить новый отчёт
 * @param {Object} report
 */
export async function addReport(report) {
  // Сериализация content для jsonb
  const safeReport = {
    ...report,
    content: JSON.parse(JSON.stringify(report.content))
  }
  // Добавляем .select() чтобы получить вставленную строку
  return await supabase.from('reports').insert([safeReport]).select()
}

/**
 * Обновить отчёт
 * @param {string} id
 * @param {Object} updates
 */
export async function updateReport(id, updates) {
  return await supabase.from('reports').update(updates).eq('id', id)
}

/**
 * Удалить отчёт
 * @param {string} id
 */
export async function deleteReport(id) {
  return await supabase.from('reports').delete().eq('id', id)
} 