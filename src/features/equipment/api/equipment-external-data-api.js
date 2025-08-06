/**
 * equipment-external-data-api.js
 * ПОЛНОСТЬЮ ИЗОЛИРОВАННЫЙ API для загрузки внешних данных в equipment модуле
 * 
 * Архитектурная цель: НУЛЕВЫЕ зависимости от других модулей
 * Модуль работает автономно с динамической проверкой доступности других модулей
 */

// 🚫 НЕТ СТАТИЧЕСКИХ ИМПОРТОВ ИЗ ДРУГИХ МОДУЛЕЙ!
// Используем динамические импорты с проверкой доступности

/**
 * Динамически проверить доступность events модуля
 * @returns {Promise<boolean>}
 */
async function isEventsModuleAvailable() {
  try {
    await import('@/features/events/api/eventApi')
    return true
  } catch {
    return false
  }
}

/**
 * Динамически проверить доступность mount-points модуля
 * @returns {Promise<boolean>}
 */
async function isMountPointsModuleAvailable() {
  try {
    await import('@/features/mount-points/api/mountPointApi')
    return true
  } catch {
    return false
  }
}

/**
 * Загрузить активные мероприятия для создания списков оборудования
 * ПОЛНОСТЬЮ ИЗОЛИРОВАННАЯ функция с динамической проверкой модулей
 * 
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function loadEventsForEquipmentLists() {
  try {
    // 🔍 Динамическая проверка доступности events модуля
    const eventsAvailable = await isEventsModuleAvailable()
    
    if (!eventsAvailable) {
      console.warn('⚠️ Equipment: Events модуль недоступен, используем заглушки')
      return await loadEventsStub()
    }
    
    // 🔄 Динамический импорт только если модуль доступен
    const { fetchActiveEvents } = await import('@/features/events/api/eventApi')
    const { data, error } = await fetchActiveEvents()
    
    if (error) {
      throw new Error(error.message || 'Ошибка загрузки мероприятий')
    }
    
    // Equipment-специфическая фильтрация и обработка
    const equipmentReadyEvents = (data || []).filter(event => {
      // Только события, которые поддерживают списки оборудования
      return event.name && !event.is_archived
    }).map(event => ({
      id: event.id,
      name: event.name,
      location: event.location || '',
      // Добавляем метаданные специфичные для equipment
      equipmentCompatible: true,
      supportsLists: true
    }))
    
    console.log(`✅ Equipment: Загружено ${equipmentReadyEvents.length} мероприятий из events модуля`)
    return { data: equipmentReadyEvents, error: null }
    
  } catch (err) {
    console.error('❌ Equipment: Ошибка загрузки мероприятий, переключаемся на заглушки:', err)
    return await loadEventsStub()
  }
}

/**
 * Загрузить точки монтажа для создания списков оборудования
 * ПОЛНОСТЬЮ ИЗОЛИРОВАННАЯ функция с динамической проверкой модулей
 * 
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function loadMountPointsForEquipmentLists(eventId) {
  if (!eventId) {
    return { data: [], error: null }
  }

  try {
    // 🔍 Динамическая проверка доступности mount-points модуля
    const mountPointsAvailable = await isMountPointsModuleAvailable()
    
    if (!mountPointsAvailable) {
      console.warn('⚠️ Equipment: Mount-points модуль недоступен, используем заглушки')
      return await loadMountPointsStub(eventId)
    }
    
    // 🔄 Динамический импорт только если модуль доступен
    const { fetchMountPoints } = await import('@/features/mount-points/api/mountPointApi')
    const { data, error } = await fetchMountPoints(eventId)
    
    if (error) {
      throw new Error(error.message || 'Ошибка загрузки точек монтажа')
    }
    
    // Equipment-специфическая обработка точек монтажа
    const equipmentCompatiblePoints = (data || []).map(mountPoint => ({
      id: mountPoint.id,
      name: mountPoint.name,
      location: mountPoint.location || '',
      event_id: mountPoint.event_id,
      // Метаданные для совместимости с оборудованием
      canHoldEquipment: true,
      maxEquipmentCount: mountPoint.maxEquipmentCount || 100,
      equipmentTypes: mountPoint.supportedEquipmentTypes || []
    }))
    
    console.log(`✅ Equipment: Загружено ${equipmentCompatiblePoints.length} точек монтажа из mount-points модуля`)
    return { data: equipmentCompatiblePoints, error: null }
    
  } catch (err) {
    console.error('❌ Equipment: Ошибка загрузки точек монтажа, переключаемся на заглушки:', err)
    return await loadMountPointsStub(eventId)
  }
}

/**
 * Форматировать мероприятия для селектов в equipment модуле
 * @param {Array} events - массив мероприятий
 * @returns {Array} опции для селекта
 */
export function formatEventsForEquipmentSelect(events) {
  return events.map(event => ({
    value: event.id,
    label: event.name,
    meta: {
      location: event.location,
      equipmentCompatible: event.equipmentCompatible
    }
  }))
}

/**
 * Форматировать точки монтажа для селектов в equipment модуле
 * @param {Array} mountPoints - массив точек монтажа
 * @returns {Array} опции для селекта
 */
export function formatMountPointsForEquipmentSelect(mountPoints) {
  return mountPoints.map(mountPoint => ({
    value: mountPoint.id,
    label: mountPoint.name,
    meta: {
      location: mountPoint.location,
      maxEquipmentCount: mountPoint.maxEquipmentCount,
      canHoldEquipment: mountPoint.canHoldEquipment
    }
  }))
}

/**
 * Получить название мероприятия по ID (для equipment модуля)
 * @param {Array} events - массив мероприятий
 * @param {string} eventId - ID мероприятия
 * @returns {string} название мероприятия
 */
export function getEventNameForEquipment(events, eventId) {
  const event = events.find(e => e.id === eventId)
  return event ? event.name : 'Мероприятие'
}

/**
 * Получить название точки монтажа по ID (для equipment модуля)
 * @param {Array} mountPoints - массив точек монтажа
 * @param {string} mountPointId - ID точки монтажа
 * @returns {string} название точки монтажа
 */
export function getMountPointNameForEquipment(mountPoints, mountPointId) {
  const mountPoint = mountPoints.find(mp => mp.id === mountPointId)
  return mountPoint ? mountPoint.name : 'Точка монтажа'
}

// ===== ЗАГЛУШКИ ДЛЯ НЕЗАВИСИМОЙ РАБОТЫ МОДУЛЯ =====
// Используются когда другие модули недоступны

/**
 * Заглушка для загрузки мероприятий (когда events модуль недоступен)
 * @returns {Promise<{data: Array, error: string|null}>}
 */
async function loadEventsStub() {
  console.warn('⚠️ Equipment: Используется заглушка для мероприятий. Events модуль недоступен.')
  
  // Генерируем реалистичные демо-данные
  const demoEvents = [
    {
      id: 'demo-event-1',
      name: 'Демо концерт "Звёздная ночь"',
      location: 'Главная сцена',
      equipmentCompatible: true,
      supportsLists: true
    },
    {
      id: 'demo-event-2', 
      name: 'Корпоративное мероприятие',
      location: 'Конференц-зал',
      equipmentCompatible: true,
      supportsLists: true
    },
    {
      id: 'demo-event-3',
      name: 'Свадебная церемония',
      location: 'Банкетный зал',
      equipmentCompatible: true,
      supportsLists: true
    }
  ]
  
  console.log(`✅ Equipment: Заглушка загрузила ${demoEvents.length} демо-мероприятий`)
  return { data: demoEvents, error: null }
}

/**
 * Заглушка для загрузки точек монтажа (когда mount-points модуль недоступен)
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<{data: Array, error: string|null}>}
 */
async function loadMountPointsStub(eventId) {
  console.warn('⚠️ Equipment: Используется заглушка для точек монтажа. Mount-points модуль недоступен.')
  
  if (!eventId) {
    return { data: [], error: null }
  }
  
  // Генерируем демо точки монтажа в зависимости от мероприятия
  const demoMountPoints = [
    {
      id: `demo-mp-${eventId}-1`,
      name: 'Основная точка',
      location: 'Центр зала',
      event_id: eventId,
      canHoldEquipment: true,
      maxEquipmentCount: 50,
      equipmentTypes: ['Аудиооборудование', 'Видеотехника', 'Световое оборудование']
    },
    {
      id: `demo-mp-${eventId}-2`,
      name: 'Резервная точка',
      location: 'Боковая зона',
      event_id: eventId,
      canHoldEquipment: true,
      maxEquipmentCount: 25,
      equipmentTypes: ['Аудиооборудование', 'Световое оборудование']
    }
  ]
  
  console.log(`✅ Equipment: Заглушка загрузила ${demoMountPoints.length} демо-точек для события ${eventId}`)
  return { data: demoMountPoints, error: null }
}

/**
 * Получить данные оборудования по массиву ID
 * Для использования в списках оборудования
 * 
 * @param {Array<string>} equipmentIds - массив ID оборудования
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function getEquipmentByIds(equipmentIds) {
  if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
    return { data: [], error: null }
  }

  try {
    // Импортируем supabase динамически
    const { supabase } = await import('@/shared/api/supabase')
    
    console.log('🔍 [Equipment API] Загружаем оборудование по ID:', equipmentIds.length, 'единиц')
    
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .in('id', equipmentIds)
      .order('brand', { ascending: true })
    
    if (error) {
      console.error('❌ [Equipment API] Ошибка загрузки оборудования:', error)
      throw error
    }
    
    console.log('✅ [Equipment API] Загружено:', data?.length || 0, 'единиц оборудования')
    
    return {
      data: data || [],
      error: null
    }
    
  } catch (err) {
    console.error('❌ [Equipment API] Критическая ошибка при загрузке оборудования:', err)
    return {
      data: [],
      error: err.message || 'Не удалось загрузить данные оборудования'
    }
  }
}