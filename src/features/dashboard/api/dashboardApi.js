// src/features/dashboard/api/dashboardApi.js
// API для загрузки данных, отображаемых на главной странице (дашборде).

import { supabase } from '@/shared/api/supabase'

/**
 * Загружает основную статистику для виджетов на дашборде.
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export async function fetchDashboardStats() {
  try {
    const now = new Date().toISOString()
    // Загружаем статистику параллельно
    const [equipmentRes, eventsRes, eventsActiveRes, reportsRes, usersRes] = await Promise.all([
      supabase.from('equipments').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .gte('end_date', now),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true })
    ])

    // Проверяем ошибки каждого запроса
    if (equipmentRes.error) throw equipmentRes.error
    if (eventsRes.error) throw eventsRes.error
    if (eventsActiveRes.error) throw eventsActiveRes.error
    if (reportsRes.error) throw reportsRes.error
    if (usersRes.error) throw usersRes.error

    // Формируем и возвращаем объект со статистикой
    const stats = {
      equipmentTotal: equipmentRes.count,
      equipmentAvailable: equipmentRes.count, // TODO: добавить фильтр по статусу
      eventsTotal: eventsRes.count,
      eventsActive: eventsActiveRes.count,
      reportsTotal: reportsRes.count,
      reportsRecent: Math.min(reportsRes.count, 5), // TODO: добавить фильтр по дате
      usersTotal: usersRes.count,
      usersActive: usersRes.count // TODO: добавить фильтр по активным
    }
    
    return { data: stats, error: null }
  } catch (error) {
    console.error('Ошибка при загрузке статистики для дашборда:', error)
    return { data: null, error }
  }
}

/**
 * Загружает список последних (недавних) мероприятий.
 * @param {number} limit - Количество мероприятий для загрузки.
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export async function fetchRecentEvents(limit = 3) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, organizer, start_date, end_date, is_archived')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Ошибка при загрузке последних мероприятий:', error)
    return { data: null, error }
  }
}
