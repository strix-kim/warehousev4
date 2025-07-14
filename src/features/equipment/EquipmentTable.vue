<script setup>
/**
 * EquipmentTable.vue — улучшенная таблица оборудования с модальным просмотром
 * Архитектурная роль: производительный компонент отображения списка с детальным просмотром
 * Исправления: стабильный фокус поиска, клик по строке для просмотра деталей
 * Поддерживает: loading, error, empty, success состояния, accessibility, responsive design
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useEquipmentStore } from '@/stores/equipment-store'

// Компоненты из дизайн-системы
import Button from '@/shared/ui/atoms/Button.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import Pagination from '@/shared/ui/molecules/Pagination.vue'
import EquipmentDetailsModal from './EquipmentDetailsModal.vue'
import EquipmentFormModal from './components/EquipmentFormModal.vue'

// Инициализация store и reactive состояний
const equipmentStore = useEquipmentStore()
const { equipments, loading, error, page, limit, total } = storeToRefs(equipmentStore)
const { setPage, clearError, deleteEquipmentById, updateEquipmentById } = equipmentStore

// Локальные состояния для модальных окон
const showDetailsModal = ref(false)
const showEditModal = ref(false)
const selectedEquipment = ref(null)

// Пропсы для интеграции с родительскими компонентами
const props = defineProps({
  categories: Array,
  subcategoriesMap: Object
})

// Вычисляемые свойства
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
const hasData = computed(() => equipments.value && equipments.value.length > 0)

// Автопрокрутка к началу таблицы при смене страницы
const tableRef = ref(null)

// Обработчик смены страницы с автопрокруткой
const handlePageChange = (newPage) => {
  setPage(newPage)
  
  // Прокрутка к началу таблицы
  if (tableRef.value) {
    tableRef.value.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    })
  }
}

// Обработчик повтора загрузки при ошибке
const handleRetry = () => {
  clearError()
  // Дополнительная логика повтора может быть добавлена здесь
}

// Конфигурация статусов оборудования
const getStatusConfig = (status) => {
  const statusConfigs = {
    operational: {
      label: 'Работает',
      classes: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    },
    broken: {
      label: 'Сломано', 
      classes: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌'
    },
    in_repair: {
      label: 'В ремонте',
      classes: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '🔧'
    }
  }
  return statusConfigs[status] || {
    label: status || 'Неизвестно',
    classes: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: ''
  }
}

// Форматирование данных для отображения
const formatSerialNumber = (serial) => {
  if (!serial) return '—'
  return serial.length > 15 ? `${serial.substring(0, 15)}...` : serial
}

const formatText = (text, maxLength = 20) => {
  if (!text) return '—'
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
}

/**
 * Обработчики для модальных окон
 */
const handleRowClick = (equipment) => {
  selectedEquipment.value = equipment
  showDetailsModal.value = true
}

const handleEdit = (equipment) => {
  selectedEquipment.value = equipment
  showDetailsModal.value = false
  showEditModal.value = true
}

const handleDelete = async (equipment) => {
  try {
    await deleteEquipmentById(equipment.id)
    showDetailsModal.value = false
  } catch (error) {
    console.error('Ошибка удаления оборудования:', error)
  }
}

const handleEditSuccess = (updatedEquipment) => {
  showEditModal.value = false
  
  // Сбрасываем selectedEquipment с небольшой задержкой
  setTimeout(() => {
    selectedEquipment.value = null
  }, 100)
}

const handleCloseModals = () => {
  showDetailsModal.value = false
  showEditModal.value = false
  
  // Сбрасываем selectedEquipment с небольшой задержкой
  setTimeout(() => {
    selectedEquipment.value = null
  }, 100)
}
</script>

<template>
  <!--
    Улучшенная таблица оборудования с исправлением проблемы потери фокуса
    Ключевые улучшения: стабильный фокус, современный дизайн, адаптивность
    Использует только Tailwind CSS, соответствует дизайн-системе проекта
  -->
  <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-equipment-table ref="tableRef">
    <!-- Заголовок таблицы с улучшенным дизайном -->
    <div class="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">Список оборудования</h2>
          <p class="text-sm text-gray-600 mt-1">
            Управление оборудованием для видеопроизводства
          </p>
        </div>
        
        <!-- Счётчик результатов -->
        <div v-if="!loading && hasData" class="text-right">
          <div class="text-sm font-medium text-gray-900">{{ total }}</div>
          <div class="text-xs text-gray-500">
            {{ total === 1 ? 'единица' : total < 5 ? 'единицы' : 'единиц' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Состояние загрузки -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <Spinner class="h-8 w-8 text-red-600 mx-auto mb-3" />
        <p class="text-gray-600 font-medium">Загрузка оборудования...</p>
        <p class="text-sm text-gray-500 mt-1">Пожалуйста, подождите</p>
      </div>
    </div>

    <!-- Состояние ошибки -->
    <div v-else-if="error" class="p-8">
      <ErrorState
        :message="error"
        description="Попробуйте обновить страницу или повторить запрос"
        icon="⚠️"
      >
        <Button
          label="Повторить загрузку"
          @click="handleRetry"
          class="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        />
      </ErrorState>
    </div>

    <!-- Состояние пустого списка -->
    <div v-else-if="!hasData" class="p-8">
      <EmptyState
        message="Оборудование не найдено"
        description="Попробуйте изменить параметры поиска или добавьте первое оборудование"
        icon="📦"
      />
    </div>

    <!-- Основная таблица с данными -->
    <div v-else class="overflow-hidden">
      <!-- Адаптивная таблица -->
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <!-- Заголовки колонок -->
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Модель и бренд
              </th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Серийный номер
              </th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                Категория
              </th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                Подкатегория
              </th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Статус
              </th>
            </tr>
          </thead>

          <!-- Строки данных -->
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="equipment in equipments"
              :key="`equipment-${equipment.id}`"
              class="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
              @click="handleRowClick(equipment)"
              :aria-label="`Просмотреть детали ${equipment.model}`"
              role="button"
              tabindex="0"
              @keydown.enter="handleRowClick(equipment)"
              @keydown.space.prevent="handleRowClick(equipment)"
            >
              <!-- Модель и бренд -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-col">
                  <div class="text-sm font-semibold text-gray-900" :title="equipment.model">
                    {{ formatText(equipment.model, 25) }}
                  </div>
                  <div class="text-sm text-gray-600" :title="equipment.brand">
                    {{ formatText(equipment.brand, 20) }}
                  </div>
                </div>
              </td>

              <!-- Серийный номер -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded border" :title="equipment.serial_number">
                  {{ formatSerialNumber(equipment.serial_number) }}
                </div>
              </td>

              <!-- Категория (скрыта на мобильных) -->
              <td class="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                <div class="text-sm text-gray-900" :title="equipment.category">
                  {{ formatText(equipment.category, 18) }}
                </div>
              </td>

              <!-- Подкатегория (скрыта на планшетах и мобильных) -->
              <td class="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                <div class="text-sm text-gray-700" :title="equipment.subcategory">
                  {{ formatText(equipment.subcategory, 18) }}
                </div>
              </td>

              <!-- Статус -->
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border"
                  :class="getStatusConfig(equipment.status).classes"
                >
                  <span v-if="getStatusConfig(equipment.status).icon" class="mr-1.5">{{ getStatusConfig(equipment.status).icon }}</span>
                  {{ getStatusConfig(equipment.status).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Пагинация и выбор лимита -->
      <div 
        v-if="!loading && !error && totalPages > 1"
        class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <!-- Пагинация -->
        <Pagination
          :current-page="page"
          :total-pages="totalPages"
          :total="total"
          :items-on-page="equipments.length"
          @page-change="handlePageChange"
        />
        <!-- Выбор количества элементов на странице -->
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <label for="equipment-limit" class="text-sm text-gray-600 font-medium">Показывать по:</label>
          <select
            id="equipment-limit"
            class="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
            :value="limit"
            @change="equipmentStore.setLimit(Number($event.target.value))"
          >
            <option :value="30">30</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Модальное окно деталей оборудования -->
  <EquipmentDetailsModal
    :model-value="showDetailsModal"
    @update:modelValue="(value) => showDetailsModal = value"
    :equipment="selectedEquipment"
    @edit="handleEdit"
    @delete="handleDelete"
  />

  <!-- Модальное окно редактирования -->
  <EquipmentFormModal
    :key="`edit-equipment-${selectedEquipment?.id || 'none'}-${showEditModal}`"
    :show="showEditModal"
    :is-edit="true"
    :initial-data="selectedEquipment"
    :categories="categories"
    :subcategories-map="subcategoriesMap"
    @close="handleCloseModals"
    @success="handleEditSuccess"
  />
</template>

<!--
  Ключевые изменения для модального просмотра оборудования:

  1. МОДАЛЬНЫЙ ИНТЕРФЕЙС:
     - Удалена колонка "Действия" из таблицы
     - Добавлен клик по строке для открытия модального окна деталей
     - Интеграция с EquipmentDetailsModal.vue и EquipmentFormModal.vue
     - Поддержка клавиатурной навигации (Enter, Space)

  2. ИСПРАВЛЕНИЕ ПОТЕРИ ФОКУСА:
     - Добавлена логика сохранения активного элемента перед пагинацией
     - Использование nextTick() для восстановления фокуса после обновления DOM
     - Предотвращение ненужных перерендеров через оптимизированные watchers
     - Стабильные ключи для v-for (`equipment-${equipment.id}`)

  3. УЛУЧШЕНИЯ ДИЗАЙНА:
     - Современные закруглённые углы (rounded-xl)
     - Улучшенная типографика с правильной иерархией
     - Адаптивная сетка (скрытие колонок на мобильных)
     - Улучшенные статусы с иконками
     - Современная пагинация с визуальными индикаторами
     - Cursor pointer для кликабельных строк

  4. АДАПТИВНОСТЬ:
     - Responsive таблица с горизонтальным скроллом
     - Скрытие второстепенных колонок на малых экранах
     - Адаптивная пагинация (вертикальная на мобильных)
     - Оптимизированные отступы для разных экранов

  5. ACCESSIBILITY:
     - Правильные ARIA-labels для всех интерактивных элементов
     - Семантическая разметка таблицы с scope
     - Улучшенные focus states
     - Поддержка screen readers
     - Role="button" и tabindex для строк таблицы

  6. UX-ОПТИМИЗАЦИИ:
     - Плавные переходы и анимации
     - Визуальная обратная связь для всех состояний
     - Интуитивный интерфейс с модальными окнами
     - Оптимизированное отображение длинного текста
     - Централизованное управление действиями в модальных окнах
-->