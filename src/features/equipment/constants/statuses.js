/**
 * Equipment Statuses - EPR System
 * 
 * Статусы оборудования и константы для работы с ними
 * Вынесено из API для переиспользования
 */

/**
 * Статусы доступности оборудования
 */
export const EQUIPMENT_STATUSES = {
  AVAILABLE: 'available',
  IN_USE: 'in_use', 
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired',
  BROKEN: 'broken',
  RESERVED: 'reserved'
}

/**
 * Русские названия статусов
 */
export const EQUIPMENT_STATUS_LABELS = {
  [EQUIPMENT_STATUSES.AVAILABLE]: 'Доступно',
  [EQUIPMENT_STATUSES.IN_USE]: 'В использовании',
  [EQUIPMENT_STATUSES.MAINTENANCE]: 'На обслуживании', 
  [EQUIPMENT_STATUSES.RETIRED]: 'Списано',
  [EQUIPMENT_STATUSES.BROKEN]: 'Сломано',
  [EQUIPMENT_STATUSES.RESERVED]: 'Зарезервировано'
}

/**
 * Цветовые варианты для StatusBadgeV2
 */
export const EQUIPMENT_STATUS_VARIANTS = {
  [EQUIPMENT_STATUSES.AVAILABLE]: 'success',
  [EQUIPMENT_STATUSES.IN_USE]: 'warning',
  [EQUIPMENT_STATUSES.MAINTENANCE]: 'info',
  [EQUIPMENT_STATUSES.RETIRED]: 'error',
  [EQUIPMENT_STATUSES.BROKEN]: 'danger',
  [EQUIPMENT_STATUSES.RESERVED]: 'warning'
}

/**
 * Получить опции статусов для селектов
 */
export const getStatusOptions = () => {
  return Object.values(EQUIPMENT_STATUSES).map(status => ({
    label: EQUIPMENT_STATUS_LABELS[status],
    value: status,
    variant: EQUIPMENT_STATUS_VARIANTS[status]
  }))
}

/**
 * Получить информацию о статусе
 */
export const getStatusInfo = (status) => {
  if (!status || !EQUIPMENT_STATUS_LABELS[status]) {
    return {
      label: 'Неизвестно',
      value: status,
      variant: 'error'
    }
  }

  return {
    label: EQUIPMENT_STATUS_LABELS[status],
    value: status,
    variant: EQUIPMENT_STATUS_VARIANTS[status]
  }
}

/**
 * Проверить валидность статуса
 */
export const isStatusValid = (status) => {
  return status && Object.values(EQUIPMENT_STATUSES).includes(status)
}

/**
 * Получить активные статусы (не списанные)
 */
export const getActiveStatuses = () => {
  return Object.values(EQUIPMENT_STATUSES).filter(
    status => status !== EQUIPMENT_STATUSES.RETIRED
  )
}

/**
 * Получить доступные статусы (можно использовать)
 */
export const getAvailableStatuses = () => {
  return [
    EQUIPMENT_STATUSES.AVAILABLE,
    EQUIPMENT_STATUSES.RESERVED
  ]
}

/**
 * Приоритет статусов для сортировки
 */
export const STATUS_PRIORITY = {
  [EQUIPMENT_STATUSES.BROKEN]: 1,        // Критично
  [EQUIPMENT_STATUSES.MAINTENANCE]: 2,   // Важно
  [EQUIPMENT_STATUSES.IN_USE]: 3,        // Занято
  [EQUIPMENT_STATUSES.RESERVED]: 4,      // Зарезервировано
  [EQUIPMENT_STATUSES.AVAILABLE]: 5,     // Доступно
  [EQUIPMENT_STATUSES.RETIRED]: 6        // Списано
}