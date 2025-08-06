/**
 * Equipment API - EPR System
 * 
 * API для работы с оборудованием
 * Использует Supabase
 */

import { supabase } from '@/shared/api/supabase.js'

export const equipmentApi = {
  /**
   * Получить список оборудования с серверной пагинацией, поиском и фильтрами
   */
  async getEquipments({ 
    search = '',
    filters = {},
    page = 1, 
    limit = 30,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    try {
      let query = supabase
        .from('equipment')
        .select('*', { count: 'exact' })

      // Серверный поиск по основным полям
      if (search && search.trim()) {
        const searchTerm = search.trim()
        query = query.or(
          `brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,serialnumber.ilike.%${searchTerm}%`
        )
      }

      // Серверные фильтры
      if (filters.type && filters.type !== '') {
        query = query.eq('type', filters.type)
      }
      
      if (filters.subtype && filters.subtype !== '') {
        query = query.eq('subtype', filters.subtype)
      }
      
      if (filters.location && filters.location !== '') {
        query = query.eq('location', filters.location)
      }
      
      if (filters.availability && filters.availability !== '') {
        query = query.eq('availability', filters.availability)
      }

      // Сортировка
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Серверная пагинация
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      console.log('🔍 [API] Серверный поиск + фильтры:', {
        search: search || 'нет поиска',
        filters: Object.keys(filters).length > 0 ? filters : 'нет фильтров',
        found: count,
        page,
        loaded: data?.length
      })

      return {
        data: data || [],
        total: count || 0,
        page,
        pages: Math.ceil((count || 0) / limit),
        limit,
        hasMore: offset + limit < (count || 0),
        search: search || '',
        filters: filters || {}
      }
    } catch (error) {
      console.error('Equipment API error:', error)
      throw new Error('Ошибка загрузки оборудования')
    }
  },



  /**
   * Получить оборудование по ID
   */
  async getEquipment(id) {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      return { data }
    } catch (error) {
      console.error('Equipment API error:', error)
      throw new Error('Ошибка загрузки оборудования')
    }
  },

  /**
   * Создать оборудование
   */
  async createEquipment(equipmentData) {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .insert([equipmentData])
        .select()
        .single()

      if (error) throw error

      return { data }
    } catch (error) {
      console.error('Equipment API error:', error)
      throw new Error('Ошибка создания оборудования')
    }
  },

  /**
   * Обновить оборудование
   */
  async updateEquipment(id, equipmentData) {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .update(equipmentData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return { data }
    } catch (error) {
      console.error('Equipment API error:', error)
      throw new Error('Ошибка обновления оборудования')
    }
  },

  /**
   * Удалить оборудование
   */
  async deleteEquipment(id) {
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Equipment API error:', error)
      throw new Error('Ошибка удаления оборудования')
    }
  },

  /**
   * Поиск оборудования
   */
  async searchEquipments(query) {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .or(`brand.ilike.%${query}%,model.ilike.%${query}%,serial_number.ilike.%${query}%`)
        .limit(10)
        .order('created_at', { ascending: false })

      if (error) throw error

      return { data: data || [] }
    } catch (error) {
      console.error('Equipment search error:', error)
      throw new Error('Ошибка поиска оборудования')
    }
  },

  /**
   * Получить категории оборудования
   */
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('equipment_categories')
        .select('*')
        .order('name')

      if (error) throw error

      return { data: data || [] }
    } catch (error) {
      console.error('Categories API error:', error)
      throw new Error('Ошибка загрузки категорий')
    }
  },

  /**
   * Получить статусы оборудования
   */
  getStatuses() {
    return [
      { value: 'available', label: 'Доступно' },
      { value: 'in_use', label: 'В использовании' },
      { value: 'maintenance', label: 'На обслуживании' },
      { value: 'retired', label: 'Списано' }
    ]
  },

  /**
   * Получить локации оборудования
   */
  async getLocations() {
    try {
      const { data, error } = await supabase
        .from('equipment_locations')
        .select('*')
        .order('name')

      if (error) throw error

      return { data: data || [] }
    } catch (error) {
      console.error('Locations API error:', error)
      throw new Error('Ошибка загрузки локаций')
    }
  },

  /**
   * Получить предложения для автокомплита поиска
   */
  async getSearchSuggestions(query) {
    try {
      if (!query || query.length < 2) return []
      
      const searchTerm = query.trim().toLowerCase()
      const suggestions = []
      
      // Получаем уникальные бренды
      const { data: brands } = await supabase
        .from('equipment')
        .select('brand')
        .ilike('brand', `%${searchTerm}%`)
        .not('brand', 'is', null)
        .limit(5)
      
      if (brands) {
        const uniqueBrands = [...new Set(brands.map(item => item.brand).filter(Boolean))]
        uniqueBrands.forEach(brand => {
          suggestions.push({
            text: brand,
            type: 'brand'
          })
        })
      }
      
      // Получаем уникальные модели
      const { data: models } = await supabase
        .from('equipment')
        .select('model')
        .ilike('model', `%${searchTerm}%`)
        .not('model', 'is', null)
        .limit(5)
      
      if (models) {
        const uniqueModels = [...new Set(models.map(item => item.model).filter(Boolean))]
        uniqueModels.forEach(model => {
          suggestions.push({
            text: model,
            type: 'model'
          })
        })
      }
      
      // Получаем уникальные серийные номера
      const { data: serials } = await supabase
        .from('equipment')
        .select('serialnumber')
        .ilike('serialnumber', `%${searchTerm}%`)
        .not('serialnumber', 'is', null)
        .limit(3)
      
      if (serials) {
        const uniqueSerials = [...new Set(serials.map(item => item.serialnumber).filter(Boolean))]
        uniqueSerials.forEach(serial => {
          suggestions.push({
            text: serial,
            type: 'serialnumber'
          })
        })
      }
      
      // Удаляем дубликаты по тексту (оставляем первое вхождение с приоритетом типов)
      const uniqueSuggestions = []
      const seenTexts = new Set()
      
      // Сортируем по приоритету типов: brand > model > serialnumber
      const typePriority = { 'brand': 1, 'model': 2, 'serialnumber': 3 }
      suggestions.sort((a, b) => typePriority[a.type] - typePriority[b.type])
      
      suggestions.forEach(suggestion => {
        const normalizedText = suggestion.text.toLowerCase().trim()
        if (!seenTexts.has(normalizedText)) {
          seenTexts.add(normalizedText)
          uniqueSuggestions.push(suggestion)
        }
      })
      
      console.log('🔍 [API] Автокомплит результаты:', {
        всего: suggestions.length,
        уникальных: uniqueSuggestions.length,
        query: searchTerm
      })
      
      // Ограничиваем общее количество результатов
      return uniqueSuggestions.slice(0, 10)
      
    } catch (error) {
      console.error('Equipment API error:', error)
      return []
    }
  }
} 