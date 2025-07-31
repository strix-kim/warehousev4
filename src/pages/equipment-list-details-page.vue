<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEquipmentListsStore } from '@/stores/equipment-lists-store'
import { storeToRefs } from 'pinia'
import { supabase } from '@/shared/api/supabase'
import html2pdf from 'html2pdf.js'

const route = useRoute()
const listId = route.params.id
const equipmentListsStore = useEquipmentListsStore()

// Получаем реактивные данные
const { lists, loading, error } = storeToRefs(equipmentListsStore)

// Получить список по id из store
const currentList = computed(() => lists.value.find(l => String(l.id) === String(listId)))

// Локальные состояния для оборудования
const equipments = ref([])
const isEquipmentsLoading = ref(true)

// Загружаем оборудование для списка
async function loadEquipmentsForList(listData) {
  isEquipmentsLoading.value = true
  try {
    if (!listData?.equipment_ids || listData.equipment_ids.length === 0) {
      equipments.value = []
      isEquipmentsLoading.value = false
      return
    }

    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .in('id', listData.equipment_ids)

    if (error) throw error
    equipments.value = data || []
  } catch (e) {
    console.error('Ошибка загрузки оборудования:', e)
  } finally {
    isEquipmentsLoading.value = false
  }
}

// Группируем оборудование по категориям
const equipmentByCategory = computed(() => {
  const grouped = {}
  equipments.value.forEach(item => {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  })
  return grouped
})

// Плоский список для нумерации
const flatEquipmentList = computed(() => {
  const flat = []
  Object.values(equipmentByCategory.value).forEach(categoryItems => {
    categoryItems.forEach(item => {
      flat.push(item)
    })
  })
  return flat
})

const totalEquipment = computed(() => equipments.value.length)
const isAllLoaded = computed(() => !loading.value && !isEquipmentsLoading.value)
const hasData = computed(() => equipments.value && equipments.value.length > 0)
const isEmpty = computed(() => !loading.value && !isEquipmentsLoading.value && !hasData.value)

// Динамическое создание страниц
const pages = computed(() => {
  if (!hasData.value) return []
  
  const pagesArray = []
  
  // Страница 1: Заголовок и основная информация
  pagesArray.push({
    id: 1,
    type: 'header',
    title: 'Список оборудования',
    content: {
      listName: currentList.value?.name || 'Не указано',
      totalEquipment: totalEquipment.value,
      date: new Date().toLocaleDateString('ru-RU'),
      listId: listId,
      // Добавляем информацию о мероприятии
      eventName: currentList.value?.event?.name || 'Не указано',
      location: currentList.value?.event?.location || 'Не указано',
      eventStartDate: currentList.value?.event?.start_date || 'Не указано',
      installationStartDate: currentList.value?.event?.installation_start_date || 'Не указано'
    }
  })
  
  // Страницы с таблицей оборудования (динамически создаются)
  const tablePages = generateTablePages()
  pagesArray.push(...tablePages)
  
  // Страница со сводкой по категориям (после всех табличных страниц)
  if (Object.keys(equipmentByCategory.value).length > 0) {
    pagesArray.push({
      id: pagesArray.length + 1,
      type: 'summary',
      title: 'Сводка по категориям',
      content: {
        categories: equipmentByCategory.value
      }
    })
  }
  
  // Страница с подписями (последняя)
  pagesArray.push({
    id: pagesArray.length + 1,
    type: 'signature',
    title: 'Подписи',
    content: {
      date: new Date().toLocaleDateString('ru-RU')
    }
  })
  
  return pagesArray
})

// Ref для контента PDF
const pdfContent = ref(null)

// Функция скачивания PDF
function downloadPDF() {
  if (!pdfContent.value) return
  
  // Формируем имя файла в нужном порядке
  const eventName = currentList.value?.event?.name || 'Мероприятие'
  const fileName = `${eventName} - Список оборудования - ${new Date().toLocaleDateString('ru-RU')}.pdf`
  
  html2pdf()
    .set({
      margin: 0, // Убираем margin
      filename: fileName,
      image: { 
        type: 'jpeg', 
        quality: 0.98 // Оптимальное качество
      },
      html2canvas: { 
        scale: 1.5, // Увеличиваем масштаб для качества
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true,
        precision: 8
      }
    })
    .from(pdfContent.value)
    .save()
}

// Вспомогательные функции для таблицы
function getEquipmentNotes(equipment) {
  // Приоритет: description, затем tech_description
  if (equipment.description && equipment.description.trim()) {
    return equipment.description.trim()
  }
  if (equipment.tech_description && equipment.tech_description.trim()) {
    return equipment.tech_description.trim()
  }
  return null
}

function getTotalQuantity() {
  return flatEquipmentList.value.reduce((total, equipment) => {
    return total + (equipment.quantity || 0)
  }, 0)
}

function getCategoryTotalQuantity(categoryItems) {
  return categoryItems.reduce((total, equipment) => {
    return total + (equipment.quantity || 0)
  }, 0)
}

function getAverageQuantity() {
  if (flatEquipmentList.value.length === 0) return 0
  const total = getTotalQuantity()
  return Math.round((total / flatEquipmentList.value.length) * 10) / 10
}

function getCategoryPercentage(categoryItems) {
  if (flatEquipmentList.value.length === 0) return 0;
  const total = getTotalQuantity();
  const categoryTotal = getCategoryTotalQuantity(categoryItems);
  return total > 0 ? Math.round((categoryTotal / total) * 100) : 0;
}

// Функции для пагинации таблицы
function splitEquipmentIntoPages(equipmentList, itemsPerPage = 15) {
  const pages = []
  for (let i = 0; i < equipmentList.length; i += itemsPerPage) {
    pages.push(equipmentList.slice(i, i + itemsPerPage))
  }
  return pages
}

function generateTablePages() {
  if (!flatEquipmentList.value.length) return []
  
  const itemsPerPage = 12 // Уменьшено с 15 до 12 для лучшего размещения
  const equipmentPages = splitEquipmentIntoPages(flatEquipmentList.value, itemsPerPage)
  
  return equipmentPages.map((pageEquipment, pageIndex) => ({
    id: 2 + pageIndex, // Начинаем с 2, так как 1 - это заголовок
    type: 'table',
    title: `Оборудование (стр. ${pageIndex + 1})`,
    content: {
      equipment: pageEquipment,
      pageNumber: pageIndex + 1,
      totalPages: equipmentPages.length,
      startIndex: pageIndex * itemsPerPage + 1,
      endIndex: Math.min((pageIndex + 1) * itemsPerPage, flatEquipmentList.value.length)
    }
  }))
}

onMounted(async () => {
  if (!currentList.value) {
    await equipmentListsStore.loadLists()
  }

  if (currentList.value) {
    await loadEquipmentsForList(currentList.value)
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900 print:bg-white print:text-black">
    <div class="max-w-3xl mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-lg border border-gray-200 print:shadow-none print:border-none">
      <!-- Кнопка экспорта в PDF (только на экране, скрыта при печати) -->
      <button
        @click="downloadPDF"
        class="mb-6 px-4 py-2 rounded bg-purple-600 text-white font-semibold shadow hover:bg-purple-700 transition-colors print:hidden flex items-center gap-2"
        aria-label="Скачать PDF списка оборудования"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Скачать PDF
      </button>

      <!-- Состояния загрузки и ошибок -->
      <div v-if="!isAllLoaded" class="flex justify-center py-12 print:hidden">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p class="mt-4 text-gray-600">Загрузка списка оборудования...</p>
        </div>
      </div>

      <div v-else-if="error" class="text-center py-12 print:hidden">
        <div class="text-red-600 mb-4">Ошибка загрузки</div>
        <div class="text-gray-600">{{ error }}</div>
      </div>

      <div v-else-if="isEmpty" class="text-center py-12 print:hidden">
        <div class="text-gray-600 mb-4">Список пуст</div>
        <div class="text-gray-500">В данном списке нет оборудования</div>
      </div>

      <!-- Весь контент обёрнут в ref -->
      <div v-else-if="hasData" ref="pdfContent" class="pdf-pages-container">
        <!-- Динамические страницы -->
        <div 
          v-for="page in pages" 
          :key="page.id"
          :class="`page-container page-${page.id} page-type-${page.type}`"
        >
          <!-- Страница 1: Заголовок -->
          <div v-if="page.type === 'header'" class="page-content">
            <!-- Large Centered Logo -->
            <div class="logo-section mb-4">
              <div class="flex justify-center">
                <img src="/logo.png" alt="ARGO-MEDIA Logo" class="w-48 h-48 object-contain" />
              </div>
            </div>

            <!-- Company Name -->
            <div class="company-name-section mb-4">
              <div class="text-center">
                <h1 class="text-2xl font-bold text-gray-800 mb-2 tracking-wide">ООО «ARGO-MEDIA»</h1>
                <div class="w-16 h-0.5 bg-gray-800 mx-auto rounded-full"></div>
              </div>
            </div>

            <!-- Company Details -->
            <div class="company-details-section mb-6">
              <div class="bg-gray-100 rounded-lg p-3 border border-gray-300">
                <div class="text-center text-xs text-gray-700 leading-tight space-y-1">
                  <div>Адрес: г.Ташкент, Яшнабадский район, ул. Алимкент, пр.1, д. 33/1</div>
                  <div>телефон: (+99890) 175-55-89</div>
                  <div>р/с 2020 8000 8055 5124 2001 в ЧАКБ «ORIENT FINANS»</div>
                  <div>МФО: 01071, ИНН: 309 737 673, ОКЭД: 62090</div>
                </div>
              </div>
            </div>

            <!-- Document Title -->
            <div class="document-title-section mb-6">
              <div class="text-center">
                <div class="text-xs uppercase tracking-widest text-gray-600 mb-2">Официальный документ</div>
                <h2 class="text-3xl font-black text-gray-900 mb-1 tracking-tight">СПИСОК ОБОРУДОВАНИЯ</h2>
                <h3 class="text-xl font-bold text-gray-700 tracking-wide">ДЛЯ МЕРОПРИЯТИЯ</h3>
              </div>
            </div>

            <!-- Event Information Section -->
            <div class="event-info-section mb-4">
              <div class="bg-white border border-gray-400 rounded-lg p-4 shadow-sm">
                <div class="flex items-center mb-3">
                  <div class="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center mr-2">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 class="text-base font-bold text-gray-800">Информация о мероприятии</h2>
                </div>
                <div class="space-y-2">
                  <div class="flex justify-between items-center py-1 border-b border-gray-200">
                    <span class="font-semibold text-gray-700 text-xs">Название мероприятия:</span>
                    <span class="text-gray-900 font-medium text-xs max-w-xs text-right">{{ page.content.eventName || 'Не указано' }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1 border-b border-gray-200">
                    <span class="font-semibold text-gray-700 text-xs">Локация:</span>
                    <span class="text-gray-900 font-medium text-xs max-w-xs text-right">{{ page.content.location || 'Не указано' }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1 border-b border-gray-200">
                    <span class="font-semibold text-gray-700 text-xs">Дата начала монтажных работ:</span>
                    <span class="text-gray-900 font-medium text-xs">{{ page.content.installationStartDate || 'Не указано' }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1">
                    <span class="font-semibold text-gray-700 text-xs">Дата начала мероприятия:</span>
                    <span class="text-gray-900 font-medium text-xs">{{ page.content.eventStartDate || 'Не указано' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Status Badge -->
            <div class="flex justify-center mb-4">
              <div class="bg-gray-800 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide border border-gray-600">
                ДОКУМЕНТ ПОДГОТОВЛЕН
              </div>
            </div>

            <!-- Page Footer -->
            <div class="mt-auto pt-4 border-t border-gray-300">
              <div class="text-center text-xs text-gray-500">
                Страница {{ page.id }} из {{ pages.length }}
              </div>
            </div>
          </div>

          <!-- Страница 2: Таблица оборудования -->
          <div v-if="page.type === 'table'" class="page-content">
            <!-- Table Header -->
            <div class="table-header mb-3">
              <h2 class="text-xl font-bold text-gray-900 text-center mb-1">СПИСОК ОБОРУДОВАНИЯ</h2>
              <div class="text-center text-xs text-gray-600">
                Позиции {{ page.content.startIndex }}-{{ page.content.endIndex }} из {{ flatEquipmentList.length }}
                <span v-if="page.content.totalPages > 1" class="ml-2">
                  (Страница {{ page.content.pageNumber }} из {{ page.content.totalPages }})
                </span>
              </div>
            </div>

            <!-- Equipment Table -->
            <div class="equipment-table-container">
              <table class="w-full border-collapse text-xs">
                <!-- Table Header -->
                <thead>
                  <tr class="bg-gray-100 border-b border-gray-300">
                    <th class="text-left py-2 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide w-8">№</th>
                    <th class="text-left py-2 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide w-16">Категория</th>
                    <th class="text-left py-2 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide w-16">Подкатегория</th>
                    <th class="text-left py-2 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide w-16">Бренд</th>
                    <th class="text-left py-2 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide">Модель</th>
                    <th class="text-center py-2 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide w-12">Кол-во</th>
                  </tr>
                </thead>
                
                <!-- Table Body -->
                <tbody>
                  <tr 
                    v-for="(equipment, index) in page.content.equipment" 
                    :key="equipment.id"
                    class="border-b border-gray-200 hover:bg-gray-50"
                  >
                    <!-- Порядковый номер -->
                    <td class="py-1 px-2 text-xs font-medium text-gray-900 text-center">
                      {{ index + page.content.startIndex }}
                    </td>
                    
                    <!-- Категория -->
                    <td class="py-1 px-2 text-xs text-gray-700 font-medium">
                      {{ equipment.category || '—' }}
                    </td>
                    
                    <!-- Подкатегория -->
                    <td class="py-1 px-2 text-xs text-gray-700">
                      {{ equipment.subcategory || '—' }}
                    </td>
                    
                    <!-- Бренд -->
                    <td class="py-1 px-2 text-xs text-gray-700 font-medium">
                      {{ equipment.brand || '—' }}
                    </td>
                    
                    <!-- Модель -->
                    <td class="py-1 px-2 text-xs text-gray-900 font-semibold">
                      {{ equipment.model || '—' }}
                    </td>
                    
                    <!-- Количество -->
                    <td class="py-1 px-2 text-xs text-gray-900 font-bold text-center">
                      {{ equipment.quantity || 0 }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Table Summary -->
            <div class="table-summary mt-4">
              <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div class="grid grid-cols-2 gap-4 text-xs">
                  <div class="text-center">
                    <div class="font-bold text-gray-900 text-base">{{ page.content.endIndex - page.content.startIndex + 1 }}</div>
                    <div class="text-gray-600">Позиций на странице</div>
                  </div>
                  <div class="text-center">
                    <div class="font-bold text-gray-900 text-base">{{ page.content.startIndex }}-{{ page.content.endIndex }}</div>
                    <div class="text-gray-600">Показано из {{ flatEquipmentList.length }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page Footer -->
            <div class="mt-auto pt-3 border-t border-gray-200">
              <div class="text-center text-xs text-gray-500">
                Страница {{ page.id }} из {{ pages.length }}
              </div>
            </div>
          </div>

          <!-- Страница сводки по категориям -->
          <div v-if="page.type === 'summary'" class="page-content">
            <!-- Summary Header -->
            <div class="summary-header mb-4">
              <h2 class="text-xl font-bold text-gray-900 text-center mb-1">СВОДКА ПО КАТЕГОРИЯМ</h2>
              <div class="text-center text-xs text-gray-600">
                Статистика оборудования
              </div>
            </div>

            <!-- Overall Statistics -->
            <div class="overall-statistics mb-4">
              <div class="bg-gray-100 rounded-lg p-3 border border-gray-300">
                <div class="grid grid-cols-4 gap-2 text-xs">
                  <div class="text-center">
                    <div class="font-bold text-gray-900 text-lg">{{ Object.keys(page.content.categories).length }}</div>
                    <div class="text-gray-600">Категорий</div>
                  </div>
                  <div class="text-center">
                    <div class="font-bold text-gray-900 text-lg">{{ flatEquipmentList.length }}</div>
                    <div class="text-gray-600">Позиций</div>
                  </div>
                  <div class="text-center">
                    <div class="font-bold text-gray-900 text-lg">{{ getTotalQuantity() }}</div>
                    <div class="text-gray-600">Единиц</div>
                  </div>
                  <div class="text-center">
                    <div class="font-bold text-gray-900 text-lg">{{ getAverageQuantity() }}</div>
                    <div class="text-gray-600">Среднее</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Category Distribution Chart -->
            <div class="category-chart mb-4">
              <h3 class="text-base font-bold text-gray-800 mb-3 text-center">Распределение по категориям</h3>
              <div class="space-y-3">
                <div 
                  v-for="(categoryItems, categoryName) in page.content.categories" 
                  :key="categoryName"
                  class="category-bar"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-700">{{ categoryName }}</span>
                    <span class="text-xs font-bold text-gray-900">{{ getCategoryTotalQuantity(categoryItems) }} ед.</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      class="bg-gray-800 h-2 rounded-full"
                      :style="{ width: getCategoryPercentage(categoryItems) + '%' }"
                    ></div>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ categoryItems.length }} позиций • {{ getCategoryPercentage(categoryItems) }}%
                  </div>
                </div>
              </div>
            </div>

            <!-- Page Footer -->
            <div class="mt-auto pt-3 border-t border-gray-200">
              <div class="text-center text-xs text-gray-500">
                Страница {{ page.id }} из {{ pages.length }}
              </div>
            </div>
          </div>

          <!-- Страница подписей -->
          <div v-if="page.type === 'signature'" class="page-content flex flex-col h-full">
            <!-- Document Footer -->
            <div class="document-footer flex flex-col h-full">
              <!-- Top spacing -->
              <div class="flex-1"></div>

              <!-- Date Section -->
              <div class="date-section mb-8">
                <div class="text-center">
                  <div class="text-sm text-gray-600">Дата составления: {{ page.content.date }}</div>
                </div>
              </div>

              <!-- Middle spacing -->
              <div class="flex-1"></div>

              <!-- Signature Section -->
              <div class="signature-section mb-8">
                <div class="border-t border-gray-400 pt-6">
                  <div class="flex justify-between items-end">
                    <!-- Company Info -->
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-800 mb-2">ООО «ARGO-MEDIA»</div>
                      <div class="text-xs text-gray-600">
                        г.Ташкент, Яшнабадский район,<br>
                        ул. Алимкент, пр.1, д. 33/1
                      </div>
                    </div>

                    <!-- Signature -->
                    <div class="flex-1 text-right">
                      <div class="text-sm text-gray-700 mb-3">Директор</div>
                      <div class="border-b-2 border-gray-600 w-40 h-8 mb-2"></div>
                      <div class="text-sm font-bold text-gray-900">Шарапова С.Ш.</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom spacing -->
              <div class="flex-1"></div>

              <!-- Contact Information -->
              <div class="contact-section mb-8">
                <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div class="text-center">
                    <div class="text-sm font-medium text-gray-800 mb-2">Контактная информация</div>
                    <div class="text-sm text-gray-900">
                      Тел. исполнителя: +998 90 176 55 99
                    </div>
                  </div>
                </div>
              </div>

              <!-- Document Footer -->
              <div class="footer-info pt-4 border-t border-gray-300">
                <div class="text-center text-xs text-gray-500">
                  <div>Документ подготовлен с помощью Argo Media EPR System</div>
                  <div class="mt-1">Страница {{ page.id }} из {{ pages.length }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Контейнер для всех страниц */
.pdf-pages-container {
  width: 100%;
  max-width: 210mm;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Отдельная страница */
.page-container {
  /* A4 размеры: 210mm x 297mm */
  width: 100%;
  max-width: 210mm;
  height: 260mm; /* Уменьшена высота для гарантии одной страницы */
  margin: 0 auto;
  
  /* Flexbox для правильного распределения контента */
  display: flex;
  flex-direction: column;
  
  /* Отступы для контента */
  padding: 20mm;
  box-sizing: border-box;
  
  /* Фон и границы */
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 20px;
  
  /* Для печати */
  page-break-inside: avoid;
  break-inside: avoid;
  page-break-after: always; /* Принудительный разрыв после каждой страницы */
}

/* Последняя страница не должна разрываться */
.page-container:last-child {
  page-break-after: avoid;
  margin-bottom: 0;
}

/* Контент страницы */
.page-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Стили для печати */
@media print {
  .pdf-pages-container {
    max-width: none;
    margin: 0;
    gap: 0;
  }
  
  .page-container {
    /* Убираем границы и тени для печати */
    border: none;
    border-radius: 0;
    box-shadow: none;
    margin-bottom: 0;
    
    /* Точные размеры A4 для печати */
    width: 210mm;
    height: 260mm; /* Соответствует экранной высоте */
    max-height: 260mm;
    
    /* Убираем отступы для печати */
    padding: 0;
    margin: 0;
    
    /* Принудительные разрывы страниц */
    page-break-after: always;
    page-break-before: auto;
  }
  
  /* Внутренние отступы для контента в печати */
  .page-content {
    padding: 15mm;
    height: 100%;
    box-sizing: border-box;
  }
  
  .page-container:last-child {
    page-break-after: avoid;
  }
  
  /* Убираем padding у основного контейнера для печати */
  .max-w-3xl {
    padding: 0 !important;
    margin: 0 !important;
  }
}

/* Адаптивность для экранов */
@media (max-width: 640px) {
  .page-container {
    /* Для мобильных устройств */
    max-height: none;
    height: auto;
    width: 100%;
    padding: 16px;
    margin-bottom: 16px;
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .page-container {
    /* Для планшетов */
    max-height: 250mm;
    height: 250mm;
    padding: 18mm;
  }
}
</style> 