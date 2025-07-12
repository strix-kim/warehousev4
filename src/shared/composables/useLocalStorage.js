/**
 * Composable для работы с localStorage
 * Поддерживает автоматическую сериализацию/десериализацию JSON
 * Обработка ошибок и fallback значений
 */
import { ref, watch } from 'vue'

export function useLocalStorage(key, defaultValue = null) {
  /**
   * Чтение значения из localStorage
   */
  const read = () => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return defaultValue
      return JSON.parse(item)
    } catch (error) {
      console.warn(`Ошибка чтения из localStorage (${key}):`, error)
      return defaultValue
    }
  }
  
  /**
   * Запись значения в localStorage
   */
  const write = (value) => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.warn(`Ошибка записи в localStorage (${key}):`, error)
    }
  }
  
  /**
   * Удаление значения из localStorage
   */
  const remove = () => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`Ошибка удаления из localStorage (${key}):`, error)
    }
  }
  
  // Создаем реактивное значение
  const storedValue = read()
  const state = ref(storedValue)
  
  // Автоматическое сохранение при изменении
  watch(state, (newValue) => {
    write(newValue)
  }, { deep: true })
  
  return {
    state,
    save: write,
    load: read,
    clear: remove
  }
} 