/**
 * useExcelExport.js - Композабл для экспорта данных в Excel формат
 * 
 * Использует библиотеки xlsx-populate и file-saver для генерации и скачивания Excel файлов
 * Полностью поддерживает форматирование, стили, изображения и мета-информацию из шаблонов
 */

import { ref } from 'vue'
import XlsxPopulate from 'xlsx-populate'
import { saveAs } from 'file-saver'

export function useExcelExport() {
  const exporting = ref(false)
  const error = ref(null)

  /**
   * Экспорт списка оборудования в Excel на основе шаблона
   * @param {Object} listData - Данные списка оборудования
   * @param {Array} equipmentData - Массив оборудования
   * @param {Object} options - Дополнительные опции
   */
  const exportEquipmentList = async (listData, equipmentData, options = {}) => {
    exporting.value = true
    error.value = null

    try {
      // === ЗАГРУЖАЕМ ШАБЛОН ИЗ PUBLIC ===
      const templatePath = '/Exel.xlsx'
      const response = await fetch(templatePath)
      
      if (!response.ok) {
        throw new Error(`Не удалось загрузить шаблон: ${response.statusText}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      
      // Загружаем шаблон с помощью xlsx-populate
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer)
      
      // Получаем первый лист
      const sheet = workbook.sheet(0)
      
      // === ЗАПОЛНЯЕМ ДАННЫЕ ОБОРУДОВАНИЯ ===
      // Начинаем со строки 14, так как строка 13 - заголовки
      const startRow = 14
      
      equipmentData.forEach((item, index) => {
        const rowNumber = startRow + index
        
        // Заполняем ячейки (xlsx-populate автоматически сохраняет форматирование)
        sheet.cell(`B${rowNumber}`).value(item.model || '—')       // Model
        sheet.cell(`C${rowNumber}`).value(item.brand || '—')       // Brand
        sheet.cell(`D${rowNumber}`).value(item.type || '—')        // Type (Category)
        sheet.cell(`E${rowNumber}`).value(item.subtype || '—')     // Subtype (Subcategory)
        sheet.cell(`F${rowNumber}`).value(item.count || 1)         // Count
      })

      // === ГЕНЕРАЦИЯ И СКАЧИВАНИЕ ФАЙЛА ===
      const fileName = `Список_оборудования_${sanitizeFileName(listData.name || 'Мероприятие')}_${formatDateForFilename(new Date())}.xlsx`
      
      // Генерируем blob (xlsx-populate полностью сохраняет шаблон)
      const blob = await workbook.outputAsync()
      
      // Сохраняем файл
      saveAs(blob, fileName)

      return { success: true, fileName }

    } catch (err) {
      console.error('❌ Ошибка экспорта в Excel:', err)
      error.value = err.message || 'Ошибка при создании Excel файла'
      return { success: false, error: error.value }
    } finally {
      exporting.value = false
    }
  }

  /**
   * Экспорт простой таблицы оборудования
   * @param {Array} data - Данные для экспорта
   * @param {String} filename - Имя файла
   */
  const exportSimpleTable = async (data, filename = 'export') => {
    exporting.value = true
    error.value = null

    try {
      // Создаем новую книгу Excel
      const workbook = await XlsxPopulate.fromBlankAsync()
      const sheet = workbook.sheet(0)
      sheet.name('Data')

      // Если есть данные, добавляем их
      if (data && data.length > 0) {
        // Получаем заголовки из первого объекта
        const headers = Object.keys(data[0])
        
        // Добавляем заголовки в первую строку
        headers.forEach((header, colIndex) => {
          sheet.cell(1, colIndex + 1).value(header)
        })

        // Добавляем данные
        data.forEach((row, rowIndex) => {
          headers.forEach((header, colIndex) => {
            sheet.cell(rowIndex + 2, colIndex + 1).value(row[header])
          })
        })
      }

      const fileName = `${sanitizeFileName(filename)}_${formatDateForFilename(new Date())}.xlsx`
      const blob = await workbook.outputAsync()
      saveAs(blob, fileName)

      return { success: true, fileName }
    } catch (err) {
      console.error('❌ Ошибка экспорта:', err)
      error.value = err.message || 'Ошибка при создании файла'
      return { success: false, error: error.value }
    } finally {
      exporting.value = false
    }
  }

  // === HELPER ФУНКЦИИ ===

  const getListTypeLabel = (type) => {
    switch (type) {
      case 'security': return 'Для охраны'
      case 'report': return 'Отчетный'
      case 'custom': return 'Кастомный'
      default: return 'Неизвестный'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateString))
    } catch {
      return dateString
    }
  }

  const formatDateForFilename = (date) => {
    return date.toISOString().slice(0, 10).replace(/-/g, '_')
  }

  const sanitizeFileName = (name) => {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100)
  }

  return {
    // State
    exporting,
    error,
    
    // Methods
    exportEquipmentList,
    exportSimpleTable
  }
}
