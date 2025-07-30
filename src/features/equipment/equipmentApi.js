// equipmentApi.js
// Сервис для CRUD-операций с таблицей оборудования (equipments) через Supabase.
// Используется во всех компонентах и хуках, связанных с оборудованием.

import { supabase } from '@/shared/api/supabase'

/**
 * Получить список оборудования (без ограничений для селекторов)
 */
export async function fetchEquipments() {
  // Для селекторов загружаем ВСЁ оборудование с сортировкой
  return await supabase
    .from('equipments')
    .select('*')
    .order('brand', { ascending: true })
    .order('model', { ascending: true })
}

/**
 * Получить ограниченный список для таблиц (с лимитом)
 */
export async function fetchEquipmentsLimited(limit = 100) {
  return await supabase
    .from('equipments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
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
 * Получить подсказки для автодополнения поиска
 * @param {string} query - поисковый запрос
 * @param {number} limit - максимальное количество подсказок
 * @returns {Object} { data, error } - массив уникальных названий и брендов
 */
export async function fetchEquipmentSuggestions(query, limit = 10) {
  if (!query || query.length < 2) {
    return { data: [], error: null }
  }

  try {
    // Получаем уникальные модели и бренды для автодополнения
    const { data: models, error: modelsError } = await supabase
      .from('equipments')
      .select('model')
      .ilike('model', `%${query}%`)
      .limit(limit)

    const { data: brands, error: brandsError } = await supabase
      .from('equipments')
      .select('brand')
      .ilike('brand', `%${query}%`)
      .limit(limit)

    if (modelsError || brandsError) {
      throw modelsError || brandsError
    }

    // Объединяем и удаляем дубликаты
    const suggestions = [
      ...models.map(item => ({ type: 'model', value: item.model })),
      ...brands.map(item => ({ type: 'brand', value: item.brand }))
    ]
      .filter(item => item.value && item.value.toLowerCase().includes(query.toLowerCase()))
      .reduce((unique, item) => {
        if (!unique.find(u => u.value === item.value)) {
          unique.push(item)
        }
        return unique
      }, [])
      .slice(0, limit)

    return { data: suggestions, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/**
 * Получить уникальные категории из базы данных
 * @returns {Object} { data, error } - массив уникальных категорий
 */
export async function fetchEquipmentCategories() {
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('category')
      .not('category', 'is', null)

    if (error) throw error

    // Получаем уникальные категории
    const uniqueCategories = [...new Set(data.map(item => item.category))]
      .filter(Boolean)
      .sort()

    return { data: uniqueCategories, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/**
 * Получить подкатегории для выбранной категории
 * @param {string} category - выбранная категория
 * @returns {Object} { data, error } - массив подкатегорий для категории
 */
export async function fetchEquipmentSubcategories(category) {
  if (!category) {
    return { data: [], error: null }
  }

  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('subcategory')
      .eq('category', category)
      .not('subcategory', 'is', null)

    if (error) throw error

    // Получаем уникальные подкатегории для данной категории
    const uniqueSubcategories = [...new Set(data.map(item => item.subcategory))]
      .filter(Boolean)
      .sort()

    return { data: uniqueSubcategories, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/**
 * Получить статистику по оборудованию для дашборда
 * @returns {Object} { total, byStatus, byCategory, error }
 */
export async function fetchEquipmentStats() {
  try {
    // Общее количество
    const { count: total, error: totalError } = await supabase
      .from('equipments')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // По статусам
    const { data: statusData, error: statusError } = await supabase
      .from('equipments')
      .select('status')

    if (statusError) throw statusError

    const byStatus = statusData.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})

    // По категориям
    const { data: categoryData, error: categoryError } = await supabase
      .from('equipments')
      .select('category')

    if (categoryError) throw categoryError

    const byCategory = categoryData.reduce((acc, item) => {
      if (item.category) {
        acc[item.category] = (acc[item.category] || 0) + 1
      }
      return acc
    }, {})

    return { total, byStatus, byCategory, error: null }
  } catch (error) {
    return { total: 0, byStatus: {}, byCategory: {}, error }
  }
}

/**
 * Получить уникальные локации из базы данных
 * @returns {Object} { data, error } - массив уникальных локаций
 */
export async function fetchEquipmentLocations() {
  try {
    const { data, error } = await supabase
      .from('equipments')
      .select('location')
      .not('location', 'is', null)

    if (error) throw error

    // Получаем уникальные локации
    const uniqueLocations = [...new Set(data.map(item => item.location))]
      .filter(Boolean)
      .sort()

    return { data: uniqueLocations, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

/**
 * Получить список оборудования (fetchEquipment, совместимый экспорт)
 */
export async function fetchEquipment() {
  // Если таблица называется 'equipments', используем её
  return await supabase.from('equipments').select('*')
} 