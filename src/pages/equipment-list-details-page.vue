<script setup>
/**
 * Страница детального просмотра списка оборудования
 * Абсолютная аналогия с функционалом отчетов
 */
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEquipmentListsStore } from '@/stores/equipment-lists-store'
import { storeToRefs } from 'pinia'
import html2pdf from 'html2pdf.js'
import { supabase } from '@/shared/api/supabase'

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

// Загружаем оборудование для списка - аналогично отчетам
async function loadEquipmentsForList(listData) {
  isEquipmentsLoading.value = true
  try {
    if (!listData?.equipment_ids || listData.equipment_ids.length === 0) {
      equipments.value = []
      isEquipmentsLoading.value = false
      return
    }
    
    // Прямое обращение к Supabase - как в отчетах
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

// Группировка оборудования по категориям
const equipmentByCategory = computed(() => {
  const grouped = {}
  equipments.value.forEach(equipment => {
    const category = equipment.category || 'Без категории'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(equipment)
  })
  return grouped
})

const totalEquipment = computed(() => equipments.value.length)

const typeLabels = {
  security: 'Список оборудования для охраны',
  report: 'Отчет по оборудованию',
  custom: 'Кастомный список'
}

// Функция скачивания PDF - абсолютная аналогия с отчетами
const listContent = ref(null)

function downloadPDF() {
  if (!listContent.value) return
  
  // Создаем копию элемента для изоляции стилей
  const elementClone = listContent.value.cloneNode(true)
  
  // Добавляем изолированные стили без @import
  const style = document.createElement('style')
  style.textContent = `
         /* Базовые стили для PDF без @import */
     body { 
       font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; 
       margin: 0; 
       padding: 0; 
       color: #000; 
       background: #fff; 
     }
    * { box-sizing: border-box; }
    
    /* Скрываем элементы для печати */
    .print\\:hidden { display: none !important; }
    .print\\:bg-white { background-color: #fff !important; }
    .print\\:text-black { color: #000 !important; }
    .print\\:shadow-none { box-shadow: none !important; }
    .print\\:border-none { border: none !important; }
    
    /* Основные классы Tailwind */
    .min-h-screen { min-height: 100vh; }
    .bg-white { background-color: #fff; }
    .text-gray-900 { color: #111827; }
    .print\\:bg-white { background-color: #fff !important; }
    .print\\:text-black { color: #000 !important; }
    
    .max-w-3xl { max-width: 48rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .p-6 { padding: 1.5rem; }
    .sm\\:p-12 { padding: 3rem; }
    .bg-white { background-color: #fff; }
    .rounded-2xl { border-radius: 1rem; }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    .border { border-width: 1px; }
    .border-gray-200 { border-color: #e5e7eb; }
    .print\\:shadow-none { box-shadow: none !important; }
    .print\\:border-none { border: none !important; }
    
    .mb-6 { margin-bottom: 1.5rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .rounded { border-radius: 0.25rem; }
    .bg-purple-600 { background-color: #9333ea; }
    .text-white { color: #fff; }
    .font-semibold { font-weight: 600; }
    .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
    .hover\\:bg-purple-700:hover { background-color: #7c3aed; }
    .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .print\\:hidden { display: none !important; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .gap-2 { gap: 0.5rem; }
    
    .w-5 { width: 1.25rem; }
    .h-5 { height: 1.25rem; }
    .fill-none { fill: none; }
    .stroke-currentColor { stroke: currentColor; }
    .stroke-linecap-round { stroke-linecap: round; }
    .stroke-linejoin-round { stroke-linejoin: round; }
    .stroke-width-2 { stroke-width: 2; }
    
    .mb-8 { margin-bottom: 2rem; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .text-xs { font-size: 0.75rem; }
    .uppercase { text-transform: uppercase; }
    .tracking-widest { letter-spacing: 0.1em; }
    .text-gray-400 { color: #9ca3af; }
    .mb-2 { margin-bottom: 0.5rem; }
    .text-2xl { font-size: 1.5rem; }
    .font-extrabold { font-weight: 800; }
    .mb-2 { margin-bottom: 0.5rem; }
    .text-center { text-align: center; }
    .text-sm { font-size: 0.875rem; }
    .text-gray-700 { color: #374151; }
    .mb-2 { margin-bottom: 0.5rem; }
    .text-base { font-size: 1rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .text-gray-500 { color: #6b7280; }
    .text-xs { font-size: 0.75rem; }
    .mt-2 { margin-top: 0.5rem; }
    .font-semibold { font-weight: 600; }
    
    .border-t { border-top-width: 1px; }
    .border-gray-200 { border-color: #e5e7eb; }
    .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
    
    .text-xl { font-size: 1.25rem; }
    .font-bold { font-weight: 700; }
    .mb-4 { margin-bottom: 1rem; }
    .text-gray-500 { color: #6b7280; }
    .mb-8 { margin-bottom: 2rem; }
    .flex-col { flex-direction: column; }
    .gap-6 { gap: 1.5rem; }
    .border { border-width: 1px; }
    .border-gray-200 { border-color: #e5e7eb; }
    .rounded-xl { border-radius: 0.75rem; }
    .p-5 { padding: 1.25rem; }
    .bg-gray-50 { background-color: #f9fafb; }
    .print\\:bg-white { background-color: #fff !important; }
    .gap-3 { gap: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .text-lg { font-size: 1.125rem; }
    .font-semibold { font-weight: 600; }
    .text-gray-500 { color: #6b7280; }
    
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .justify-between { justify-content: space-between; }
    .p-3 { padding: 0.75rem; }
    .bg-white { background-color: #fff; }
    .rounded-lg { border-radius: 0.5rem; }
    .border-gray-100 { border-color: #f3f4f6; }
    .flex-1 { flex: 1 1 0%; }
    .font-medium { font-weight: 500; }
    .text-gray-600 { color: #4b5563; }
    .text-gray-500 { color: #6b7280; }
    .ml-4 { margin-left: 1rem; }
    .inline-flex { display: inline-flex; }
    .items-center { align-items: center; }
    .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
    .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
    .rounded-full { border-radius: 9999px; }
    .text-xs { font-size: 0.75rem; }
    .font-medium { font-weight: 500; }
    .border { border-width: 1px; }
    
    
    
         .w-5 { width: 1.25rem; }
     .h-5 { height: 1.25rem; }
    
    .mt-16 { margin-top: 4rem; }
    .items-end { align-items: flex-end; }
    .print\\:items-start { align-items: flex-start !important; }
    .text-gray-500 { color: #6b7280; }
    .mb-2 { margin-bottom: 0.5rem; }
    .h-8 { height: 2rem; }
    .border-b { border-bottom-width: 1px; }
    .border-gray-400 { border-color: #9ca3af; }
    .w-64 { width: 16rem; }
  `
  elementClone.appendChild(style)
  
  html2pdf()
    .set({
      margin: 0.5,
      filename: `${currentList.value?.name || 'equipment-list'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    })
    .from(elementClone)
    .save()
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}



const isAllLoaded = computed(() => !loading.value && !isEquipmentsLoading.value)

onMounted(async () => {
  // Если списка нет в store — загружаем все списки
  if (!currentList.value) {
    await equipmentListsStore.loadLists()
  }
  
  // Загружаем оборудование для списка
  if (currentList.value) {
    await loadEquipmentsForList(currentList.value)
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900 print:bg-white print:text-black">
    <div class="max-w-3xl mx-auto p-6 sm:p-12 bg-white rounded-2xl shadow-lg border border-gray-200 print:shadow-none print:border-none">
      <!-- Кнопка экспорта в PDF (только на экране, скрыта при печати) -->
      <button
        @click="downloadPDF"
        class="mb-6 px-4 py-2 rounded bg-purple-600 text-white font-semibold shadow hover:bg-purple-700 transition-colors print:hidden flex items-center gap-2"
        aria-label="Скачать PDF списка"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Скачать PDF
      </button>

      <!-- Весь список обёрнут в ref -->
      <div ref="listContent">
        <!-- Официальная шапка списка -->
        <div class="mb-8 flex flex-col items-center">
          <div class="text-xs uppercase tracking-widest text-gray-400 mb-2">
            {{ typeLabels[currentList?.type] || 'Список оборудования' }}
          </div>
          <h1 class="text-2xl font-extrabold mb-2 text-center">{{ currentList?.name || 'Список оборудования' }}</h1>
          <div class="text-sm text-gray-700 text-center mb-2">ООО ARGO MEDIA</div>
          <div v-if="currentList?.description" class="text-base text-gray-700 text-center mb-1">
            {{ currentList.description }}
          </div>
          <div class="text-sm text-gray-500 text-center mb-1">
            Создан: {{ formatDate(currentList?.created_at) }}
          </div>
          <div v-if="currentList?.events?.name" class="text-sm text-gray-500 text-center mb-1">
            Мероприятие: {{ currentList.events.name }}
          </div>
          <div class="text-xs text-gray-400 text-center mb-1">
            ID списка: {{ currentList?.id }}
          </div>
          <div class="text-xs text-gray-700 text-center mt-2">
            <span class="font-semibold">Всего единиц:</span>
            <span>{{ totalEquipment }}</span>
          </div>
        </div>

        <div class="border-t border-gray-200 my-8"></div>

        <!-- Секция оборудования -->
        <div>
          <h2 class="text-xl font-bold mb-4">Оборудование</h2>
          <div v-if="!isAllLoaded" class="text-gray-500 mb-8">Загрузка...</div>
          <div v-else-if="totalEquipment === 0" class="text-gray-500 mb-8">Список пуст</div>
          <div v-else class="flex flex-col gap-6">
            <div 
              v-for="(equipment, category) in equipmentByCategory" 
              :key="category" 
              class="border border-gray-200 rounded-xl p-5 bg-gray-50 print:bg-white"
            >
              <div class="flex items-center gap-3 mb-4">
                <div class="text-lg font-semibold">{{ category }}</div>
                <div class="text-sm text-gray-500">
                  ({{ equipment.length }} {{ equipment.length === 1 ? 'единица' : equipment.length < 5 ? 'единицы' : 'единиц' }})
                </div>
              </div>
              
              <div class="space-y-3">
                                 <div 
                   v-for="(item, index) in equipment" 
                   :key="item.id"
                   class="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100"
                 >
                   <div class="flex-1">
                     <div class="font-medium">{{ item.brand }} {{ item.model }}</div>
                     <div class="text-sm text-gray-600">{{ item.subcategory }}</div>
                     <div class="text-xs text-gray-500">
                       Серийный номер: {{ item.serial_number || 'Не указан' }}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Место для подписи -->
        <div class="mt-16 flex flex-col items-end print:items-start">
          <div class="text-xs text-gray-500 mb-2">Ответственный за список:</div>
          <div class="h-8 border-b border-gray-400 w-64"></div>
        </div>
      </div>
    </div>
  </div>
</template> 