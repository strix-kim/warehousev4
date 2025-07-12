/**
 * Универсальный composable для валидации форм
 * Поддерживает валидацию отдельных полей и всей формы
 * Интегрируется с reactive состоянием Vue 3
 */
import { reactive } from 'vue'

export function useFormValidation(rules) {
  const errors = reactive({})
  
  /**
   * Валидация отдельного поля
   * @param {string} fieldName - имя поля
   * @param {any} value - значение для валидации
   * @returns {boolean} - результат валидации
   */
  const validateField = (fieldName, value) => {
    const rule = rules[fieldName]
    if (!rule) return true
    
    const error = rule(value)
    if (error) {
      errors[fieldName] = error
      return false
    } else {
      delete errors[fieldName]
      return true
    }
  }
  
  /**
   * Валидация всей формы
   * @param {Object} data - данные формы
   * @returns {boolean} - результат валидации
   */
  const validateForm = (data) => {
    let isValid = true
    Object.keys(rules).forEach(fieldName => {
      if (!validateField(fieldName, data[fieldName])) {
        isValid = false
      }
    })
    return isValid
  }
  
  /**
   * Очистка всех ошибок валидации
   */
  const clearErrors = () => {
    Object.keys(errors).forEach(key => delete errors[key])
  }
  
  /**
   * Проверка наличия ошибок
   */
  const hasErrors = () => {
    return Object.keys(errors).length > 0
  }
  
  return {
    errors,
    validateField,
    validateForm,
    clearErrors,
    hasErrors
  }
} 