// equipmentApi.js
// Сервис для CRUD-операций с таблицей оборудования (equipments) через Supabase.
// Используется во всех компонентах и хуках, связанных с оборудованием.

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список оборудования
 */
export async function fetchEquipments() {
  return await supabase.from('equipments').select('*')
}

/**
 * Добавить новое оборудование
 * @param {Object} equipment
 */
export async function addEquipment(equipment) {
  return await supabase.from('equipments').insert([equipment])
}

/**
 * Обновить оборудование
 * @param {string} id
 * @param {Object} updates
 */
export async function updateEquipment(id, updates) {
  return await supabase.from('equipments').update(updates).eq('id', id)
}

/**
 * Удалить оборудование
 * @param {string} id
 */
export async function deleteEquipment(id) {
  return await supabase.from('equipments').delete().eq('id', id)
}

/**
 * Получить список оборудования с пагинацией и поиском
 * @param {Object} params { page, limit, search, status, brand, category, subcategory, location }
 * @returns {Object} { data, count, error }
 * page — номер страницы (1-based)
 * limit — количество на страницу
 * search — поисковый запрос (по model/brand/serial_number)
 * status — фильтр по статусу
 * brand — фильтр по бренду
 * category — фильтр по категории
 * subcategory — фильтр по подкатегории
 * location — фильтр по локации
 */
export async function fetchEquipmentsPaged({ page = 1, limit = 40, search = '', status = '', brand = '', category = '', subcategory = '', location = '' } = {}) {
  let query = supabase
    .from('equipments')
    .select('*', { count: 'exact' })

  if (status) {
    query = query.eq('status', status)
  }
  if (brand) {
    query = query.ilike('brand', `%${brand}%`)
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (subcategory) {
    query = query.eq('subcategory', subcategory)
  }
  if (location) {
    query = query.eq('location', location)
  }
  if (search) {
    // Поиск по model, brand, serial_number
    query = query.or(`model.ilike.%${search}%,brand.ilike.%${search}%,serial_number.ilike.%${search}%`)
  }
  // Сортировка: последние добавленные первыми
  query = query.order('created_at', { ascending: false })
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, count, error } = await query
  return { data, count, error }
}

/**
 * Получить список оборудования (fetchEquipment, совместимый экспорт)
 */
export async function fetchEquipment() {
  // Если таблица называется 'equipments', используем её
  return await supabase.from('equipments').select('*')
} 