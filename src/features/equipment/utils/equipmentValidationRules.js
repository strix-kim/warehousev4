/**
 * Правила валидации для формы оборудования
 * Покрывают все поля схемы БД с детальными проверками
 */

export const equipmentValidationRules = {
  /**
   * Валидация модели оборудования
   */
  model: (value) => {
    if (!value?.trim()) return 'Модель обязательна для заполнения'
    if (value.length < 2) return 'Модель должна содержать минимум 2 символа'
    if (value.length > 100) return 'Модель не должна превышать 100 символов'
    return null
  },
  
  /**
   * Валидация бренда
   */
  brand: (value) => {
    if (!value?.trim()) return 'Бренд обязателен для заполнения'
    if (value.length < 2) return 'Бренд должен содержать минимум 2 символа'
    if (value.length > 50) return 'Бренд не должен превышать 50 символов'
    return null
  },
  
  /**
   * Валидация серийного номера
   */
  serial_number: (value) => {
    if (!value?.trim()) return 'Серийный номер обязателен для заполнения'
    if (value.length < 3) return 'Серийный номер должен содержать минимум 3 символа'
    if (value.length > 50) return 'Серийный номер не должен превышать 50 символов'
    
    // Проверка на недопустимые символы
    const validPattern = /^[a-zA-Z0-9\-_]+$/
    if (!validPattern.test(value)) {
      return 'Серийный номер может содержать только буквы, цифры, дефисы и подчеркивания'
    }
    
    return null
  },
  
  /**
   * Валидация количества
   */
  quantity: (value) => {
    const num = Number(value)
    if (!num || num < 1) return 'Количество должно быть больше 0'
    if (num > 1000) return 'Количество не должно превышать 1000'
    if (!Number.isInteger(num)) return 'Количество должно быть целым числом'
    return null
  },
  
  /**
   * Валидация статуса
   */
  status: (value) => {
    const validStatuses = ['operational', 'broken', 'in_repair']
    if (!value) return 'Статус обязателен для выбора'
    if (!validStatuses.includes(value)) return 'Недопустимое значение статуса'
    return null
  },
  
  /**
   * Валидация категории
   */
  category: (value) => {
    if (!value?.trim()) return 'Категория обязательна для выбора'
    return null
  },
  
  /**
   * Валидация подкатегории
   */
  subcategory: (value) => {
    if (!value?.trim()) return 'Подкатегория обязательна для выбора'
    return null
  },
  
  /**
   * Валидация локации
   */
  location: (value) => {
    if (!value?.trim()) return 'Локация обязательна для заполнения'
    if (value.length > 100) return 'Локация не должна превышать 100 символов'
    return null
  },
  
  /**
   * Валидация технического описания (необязательное поле)
   */
  tech_description: (value) => {
    if (value && value.length > 1000) {
      return 'Техническое описание не должно превышать 1000 символов'
    }
    return null
  },
  
  /**
   * Валидация описания (необязательное поле)
   */
  description: (value) => {
    if (value && value.length > 500) {
      return 'Описание не должно превышать 500 символов'
    }
    return null
  }
}

/**
 * Получить начальные данные формы
 */
export function getInitialFormData(existingData = null) {
  if (existingData) {
    return { ...existingData }
  }
  
  return {
    model: '',
    brand: '',
    serial_number: '',
    quantity: 1,
    status: 'operational',
    location: '',
    category: '',
    subcategory: '',
    tech_description: '',
    description: ''
  }
}

/**
 * Проверка, есть ли изменения в форме
 */
export function hasFormChanges(currentData, originalData) {
  if (!originalData) return true
  
  const fields = Object.keys(currentData)
  return fields.some(field => currentData[field] !== originalData[field])
} 