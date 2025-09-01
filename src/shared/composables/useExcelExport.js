/**
 * useExcelExport.js - Композабл для экспорта данных в Excel формат
 * 
 * Использует библиотеки xlsx и file-saver для генерации и скачивания Excel файлов
 * Поддерживает форматирование, стили и мета-информацию
 */

import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export function useExcelExport() {
  const exporting = ref(false)
  const error = ref(null)

  /**
   * Экспорт списка оборудования в Excel для печати на A4 (заезды на мероприятия)
   * @param {Object} listData - Данные списка оборудования
   * @param {Array} equipmentData - Массив оборудования
   * @param {Object} options - Дополнительные опции
   */
  const exportEquipmentList = async (listData, equipmentData, options = {}) => {
    exporting.value = true
    error.value = null

    try {
      // Создаем новую книгу Excel
      const wb = XLSX.utils.book_new()

      // === СОЗДАЕМ ДОКУМЕНТ ДЛЯ ПЕЧАТИ НА A4 ===
      const currentDate = formatDate(new Date().toISOString())
      
      const documentData = [
        // === ОФИЦИАЛЬНАЯ ШАПКА ===
        ['СПИСОК ОБОРУДОВАНИЯ ДЛЯ МЕРОПРИЯТИЯ'],
        [''],
        ['Название списка:', listData.name || '—', '', '', '', 'Дата:', currentDate],
        ['Тип:', getListTypeLabel(listData.type), '', '', '', 'Всего единиц:', equipmentData.length],
        ['Описание:', listData.description || '—'],
        [''],
        
        // === ЗАГОЛОВКИ ТАБЛИЦЫ (ОПТИМИЗИРОВАНЫ ДЛЯ A4) ===
        ['№', 'Оборудование', 'Серийный номер', 'Тип', 'Локация', 'Кол-во', 'Отметка'],
        []
      ]

      // === ДОБАВЛЯЕМ ОБОРУДОВАНИЕ ===
      equipmentData.forEach((item, index) => {
        const equipmentName = [item.brand, item.model].filter(Boolean).join(' ') || 'Без названия'
        
        documentData.push([
          index + 1, // Номер по порядку
          equipmentName, // Бренд + модель
          item.serialnumber || '—', // Серийный номер
          item.type || '—', // Категория
          item.location || '—', // Локация
          item.count || 1, // Количество
          '' // Пустая колонка для отметок при заезде
        ])
      })

      // === ДОБАВЛЯЕМ ПОДПИСИ ===
      const signatureRows = Math.max(3, Math.ceil((documentData.length - 8) / 20)) // Минимум 3 пустых строки
      
      for (let i = 0; i < signatureRows; i++) {
        documentData.push(['', '', '', '', '', '', ''])
      }

      documentData.push(
        [''],
        ['ПОДПИСИ:'],
        [''],
        ['Ответственный за выдачу:', '________________________', '', 'Дата:', '______________'],
        ['', '(подпись, ФИО)'],
        [''],
        ['Ответственный за получение:', '________________________', '', 'Дата:', '______________'],
        ['', '(подпись, ФИО)'],
        [''],
        ['Примечания:', '________________________________________________________________']
      )

      // Создаем лист
      const ws = XLSX.utils.aoa_to_sheet(documentData)

      // === НАСТРОЙКИ ДЛЯ ПЕЧАТИ НА A4 ===
      
      // Фиксированная ширина колонок для A4
      ws['!cols'] = [
        { wch: 4 },   // № - узкая
        { wch: 25 },  // Оборудование - широкая
        { wch: 15 },  // Серийный номер
        { wch: 12 },  // Тип
        { wch: 12 },  // Локация  
        { wch: 6 },   // Количество
        { wch: 10 }   // Отметка
      ]

      // === ФОРМАТИРОВАНИЕ ===
      
      // Главный заголовок
      if (ws['A1']) {
        ws['A1'].s = {
          font: { color: { rgb: 'FFFFFF' }, bold: true, size: 16 },
          alignment: { horizontal: 'center' },
          fill: { fgColor: { rgb: '2B2D42' } } // Фирменный цвет primary
        }
        // Объединяем ячейки для заголовка
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
      }

      // Заголовки таблицы (строка 7, индекс 6)
      const tableHeaderRow = 6
      const tableHeaders = ['№', 'Оборудование', 'Серийный номер', 'Тип', 'Локация', 'Кол-во', 'Отметка']
      
      tableHeaders.forEach((header, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: tableHeaderRow, c: colIndex })
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true, size: 12 },
            fill: { fgColor: { rgb: 'F5F5F5' } },
            alignment: { horizontal: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          }
        }
      })

      // Границы для таблицы с оборудованием
      for (let rowIndex = tableHeaderRow; rowIndex < tableHeaderRow + equipmentData.length + 1; rowIndex++) {
        for (let colIndex = 0; colIndex < 7; colIndex++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
          if (ws[cellRef]) {
            ws[cellRef].s = {
              ...ws[cellRef].s,
              border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
              },
              alignment: { 
                horizontal: colIndex === 0 || colIndex === 5 ? 'center' : 'left',
                vertical: 'center'
              }
            }
          }
        }
      }

      // Настройки печати
      ws['!printHeader'] = [{ s: { r: 0, c: 0 }, e: { r: 6, c: 6 } }]
      ws['!margins'] = { 
        left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, 
        header: 0.3, footer: 0.3 
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Список оборудования')

      // === ГЕНЕРАЦИЯ И СКАЧИВАНИЕ ФАЙЛА ===
      const fileName = `Список_оборудования_${sanitizeFileName(listData.name || 'Мероприятие')}_${formatDateForFilename(new Date())}.xlsx`
      
      // Генерируем бинарные данные
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      
      // Создаем Blob и сохраняем файл
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
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
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data')

      const fileName = `${sanitizeFileName(filename)}_${formatDateForFilename(new Date())}.xlsx`
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
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
