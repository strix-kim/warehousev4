<script setup>
// EquipmentTable.vue — теперь использует Pinia store useEquipmentStore для централизованного состояния и CRUD
import { computed, ref, watch, onMounted } from 'vue'
import { useEquipmentStore } from '@/stores/equipment-store'
import Button from '@/components/Button.vue'
import UiStateEmpty from '@/components/UiStateEmpty.vue'
import UiStateForbidden from '@/components/UiStateForbidden.vue'
import UiStateOffline from '@/components/UiStateOffline.vue'
import EquipmentEditor from './EquipmentEditor.vue'
import Modal from '@/components/Modal.vue'
import Table from '@/components/Table.vue'
import Spinner from '@/components/Spinner.vue'
import { storeToRefs } from 'pinia'

// Получаем данные, состояния и методы из Pinia store
const equipmentStore = useEquipmentStore()
const {
  equipments,
  loading,
  error,
  filters,
  page,
  limit,
  total
} = storeToRefs(equipmentStore)

// Методы store
const { setFilter, setPage, canEdit, canDelete, createEquipment, updateEquipmentById, deleteEquipmentById, loadEquipments } = equipmentStore

// Загрузка оборудования при монтировании
onMounted(() => {
  loadEquipments()
})

// Адаптивный режим: mobile/table
const isMobile = computed(() => window.innerWidth < 768)

// Категории, подкатегории, локации (пример, можно заменить на динамические)
const categories = ref([
  'Аудиооборудование',
  'Видеотехника',
  'Кабельная продукция и коммутация',
  'Компьютерное и сетевое оборудование',
  'Электропитание',
  'Транспортировочные и кейс-системы',
  'Разное / Служебное',
  'Системы синхронного перевода'
])
const subcategoriesMap = ref({
  'Аудиооборудование': [
    'Микрофоны (проводные, беспроводные, головные, петличные)',
    'Радиосистемы',
    'Микшерные пульты (аналоговые/цифровые)',
    'Акустические системы',
    'Усилители мощности',
    'DI-боксы',
    'Аудиоинтерфейсы',
    'Процессоры эффектов (ревербераторы, эквалайзеры)',
    'Мониторные колонки (фронт, side, back)',
    'Наушники',
    'MIDI-контроллеры',
    'Радиосистемы',
    'Активные акустические системы',
    'Пульт делегата',
    'Штативы для колонок'
  ],
  'Видеотехника': [
    'Видеокамеры (ENG, PTZ, DSLR)',
    'Видеомикшеры (switcher\'ы)',
    'Захват видео (capture-карты)',
    'Видеорекордеры',
    'Видеоинтерфейсы (конвертеры HDMI/SDI)',
    'Мониторы (режиссёрские, трансляционные)',
    'Видеопроцессоры',
    'Проекторы',
    'Экраны (разборные, натяжные, LED-панели)',
    'Аксессуары для камер',
    'PTZ-контроллер',
    'ТВ'
  ],
  'Кабельная продукция и коммутация': [
    'Аудиокабели (XLR, Jack, RCA, SpeakON и т.д.)',
    'Видеокабели (HDMI, SDI, VGA, DVI)',
    'Световые кабели (DMX, powerCON и т.п.)',
    'Патч-панели, мультикоры, сплиттеры',
    'Кабельные протекторы',
    'Адаптеры и переходники',
    'SFP-модуль',
    'Видеокабели и коммутация'
  ],
  'Компьютерное и сетевое оборудование': [
    'Ноутбуки',
    'Медиа-серверы',
    'Плееры (например, для воспроизведения видео и звука)',
    'Wi-Fi роутеры, коммутаторы',
    'Программное обеспечение (лицензии)',
    'USB-интерфейсы, HDMI-сплиттеры, контроллеры',
    'Компьютеры',
    'Периферия',
    'Wi-Fi трансмиттеры',
    'Мониторы',
    'Портативные мониторы',
    'Внешние устройства хранения данных'
  ],
  'Электропитание': [
    'Удлинители',
    'Сетевые фильтры',
    'Стабилизаторы напряжения',
    'Резервные источники питания (ИБП)',
    'Пауэр-дистрибьюторы',
    'Аккумуляторы, зарядные станции',
    'UPS',
    'Аккумуляторные батареи'
  ],
  'Транспортировочные и кейс-системы': [
    'Кейсы (rack-case, flight-case)',
    'Боксы для хранения кабеля',
    'Катушки, стойки, сумки, рюкзаки',
    'Чек-листы и инвентарные бирки',
    'Таймеры, часы',
    'Термальный принтер',
    'Транспортировочные и кейс-системы'
  ],
  'Разное / Служебное': [
    'Инструменты (отвёртки, кабель-тайи, тестеры)',
    'Лестницы, стремянки',
    'Пульты дистанционного управления',
    'Расходники (скотч, изолента, батарейки)'
  ],
  'Системы синхронного перевода': [
    'Стол переводчика',
    'Кейс для зарядки и хранения инфракрасных приемников',
    'Приемники синхронного перевода',
    'Периферийное оборудование для конференц-систем',
    'Сетевой расширитель для конференц-систем',
    'Видеовходной блок',
    'Беспроводная точка доступа с Dante',
    'Беспроводная точка доступа',
    'Мультимедийный процессор',
    'Беспроводной конференц-пульт',
    'Аудиопроцессоры',
    'Цифровой контроллер конференц-системы',
    'Проводной конференц-пульт',
    'ИК-передатчик'
  ]
})
const locations = ref(['Склад 1', 'Склад 2', 'Площадка', 'В ремонте'])

// Модалка редактора
const showEditor = ref(false)
const isEdit = ref(false)
const editingEquipment = ref(null)

// Проверка прав на добавление оборудования теперь через глобальную роль
const canAdd = computed(() => canEdit())

// Состояние для подтверждения удаления
const showDeleteConfirm = ref(false)
const deletingEquipment = ref(null)

// Сообщение об успехе
const successMessage = ref('')
let successTimeout = null
function showSuccess(msg) {
  successMessage.value = msg
  if (successTimeout) clearTimeout(successTimeout)
  successTimeout = setTimeout(() => { successMessage.value = '' }, 2500)
}

function openAdd() {
  isEdit.value = false
  editingEquipment.value = null
  showEditor.value = true
}
function openEdit(item) {
  isEdit.value = true
  editingEquipment.value = { ...item }
  showEditor.value = true
}
function closeEditor() {
  showEditor.value = false
}
async function submitEditor(data) {
  if (isEdit.value) {
    await updateEquipmentById(data.id, data)
    showSuccess('Оборудование успешно обновлено')
  } else {
    await createEquipment(data)
    showSuccess('Оборудование успешно добавлено')
  }
  showEditor.value = false
}
function openDelete(item) {
  deletingEquipment.value = item
  showDeleteConfirm.value = true
}
function closeDelete() {
  showDeleteConfirm.value = false
  deletingEquipment.value = null
}
async function confirmDelete() {
  if (deletingEquipment.value) {
    await deleteEquipmentById(deletingEquipment.value.id)
    showSuccess('Оборудование успешно удалено')
    closeDelete()
  }
}

// Универсальный computed для выбранной категории
const selectedCategory = computed(() => {
  return filters.value ? filters.value.category : filters.category
})

const availableSubcategories = computed(() => {
  return selectedCategory.value ? subcategoriesMap.value[selectedCategory.value] || [] : []
})

// Сброс подкатегории при смене категории (на любую)
watch(selectedCategory, (newCategory, oldCategory) => {
  if (newCategory !== oldCategory) {
    setFilter('subcategory', '')
  }
})

function resetFilters() {
  setFilter('search', '')
  setFilter('brand', '')
  setFilter('category', '')
  setFilter('subcategory', '')
  setFilter('status', '')
  setFilter('location', '')
  loadEquipments()
}

const isAnyFilterActive = computed(() => {
  const f = filters.value ? filters.value : filters
  return f.search || f.brand || f.category || f.subcategory || f.status || f.location
})

const totalAll = ref(null)

onMounted(async () => {
  // Получаем общее количество оборудования без фильтров
  // const { data, count, error } = await supabase
  //   .from('equipments')
  //   .select('id', { count: 'exact', head: true })
  // if (!error) totalAll.value = count
})

// SVG-иконки Lucide (inline, чтобы не тянуть зависимости)
const iconPlus = `<svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5 inline-block mr-1 -mt-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4'/></svg>`
const iconEdit = `<svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5 inline-block' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm-2 6h6'/></svg>`
const iconDelete = `<svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5 inline-block' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'/></svg>`
</script>

<template>
  <div class="bg-white/80 border border-gray-200 rounded-2xl p-8 w-full text-gray-900 shadow-xl backdrop-blur-md">
    <div class="flex justify-between items-center mb-10">
      <h1 class="text-3xl font-bold text-gray-900 font-mono tracking-widest">Оборудование</h1>
      <Button @click="openAdd" class="bg-red-600 hover:bg-red-700 text-white font-mono px-5 py-2 rounded-lg shadow transition text-base flex items-center gap-2">
        <span v-html="iconPlus"></span>Добавить оборудование
      </Button>
    </div>
    <!-- Фильтры -->
    <section class="filters-panel">
      <div class="filters-row">
        <input v-model="filters.search" @input="setFilter('search', filters.search)" type="text" placeholder="Поиск по всем полям..."
          class="filter-field filter-search" />
        <select v-model="filters.category" @change="setFilter('category', filters.category)" class="filter-field">
          <option value="">Все категории</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="filters.subcategory" @change="setFilter('subcategory', filters.subcategory)" :disabled="!selectedCategory" class="filter-field">
          <option value="">Все подкатегории</option>
          <option v-for="sub in availableSubcategories" :key="sub" :value="sub" v-if="selectedCategory">{{ sub }}</option>
        </select>
        <select v-model="filters.status" @change="setFilter('status', filters.status)" class="filter-field">
          <option value="">Все статусы</option>
          <option value="operational">Рабочее</option>
          <option value="broken">Сломано</option>
          <option value="in_repair">В ремонте</option>
        </select>
        <select v-model="filters.location" @change="setFilter('location', filters.location)" class="filter-field">
          <option value="">Все локации</option>
          <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
        </select>
        <div class="filters-actions">
          <Button @click="loadEquipments" class="filter-action">Обновить</Button>
          <Button @click="resetFilters" variant="secondary" class="filter-action secondary">Сбросить</Button>
        </div>
      </div>
    </section>
    <!-- SVG-фирменная линия-разделитель под фильтрами -->
    <div class="w-full flex justify-center mb-8">
      <svg height="8" width="100%" viewBox="0 0 400 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="4" x2="400" y2="4" stroke="#ef4444" stroke-width="2" stroke-dasharray="8 8" opacity="0.18" />
        <circle cx="0" cy="4" r="2" fill="#ef4444" opacity="0.3" />
        <circle cx="400" cy="4" r="2" fill="#ef4444" opacity="0.3" />
      </svg>
    </div>
    <div v-if="totalAll !== null" class="mb-2 text-gray-900 text-base font-semibold">
      Всего оборудования: {{ totalAll }}
    </div>
    <div v-if="isAnyFilterActive && !loading" class="mb-2 text-gray-700 text-sm">
      Найдено: {{ total }}
    </div>
    <!-- SVG-фирменная линия-разделитель под заголовком таблицы -->
    <div class="w-full flex justify-center mb-2">
      <svg height="6" width="100%" viewBox="0 0 400 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="3" x2="400" y2="3" stroke="#ef4444" stroke-width="2" stroke-dasharray="12 8" opacity="0.12" />
      </svg>
    </div>
    <div class="table-scroll-x">
      <Table>
        <template #head>
          <th style="max-width:220px;width:18%;overflow:hidden;text-overflow:ellipsis;">Модель</th>
          <th>Бренд</th>
          <th>Серийный номер</th>
          <th>Статус</th>
          <th class="text-center">Действия</th>
        </template>
        <tr v-for="item in equipments" :key="item.id">
          <td style="max-width:220px;width:18%;overflow:hidden;text-overflow:ellipsis;">{{ item.model }}</td>
          <td>{{ item.brand }}</td>
          <td>{{ item.serial_number }}</td>
          <td>
            <span v-if="item.status === 'operational'" class="status-badge operational">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>Рабочее
            </span>
            <span v-else-if="item.status === 'broken'" class="status-badge broken">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>Сломано
            </span>
            <span v-else-if="item.status === 'in_repair'" class="status-badge in-repair">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>В ремонте
            </span>
            <span v-else class="status-badge other">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>{{ item.status || '—' }}
            </span>
          </td>
          <td class="text-center">
            <button @click="openEdit(item)" class="action-btn" title="Редактировать">
              <span v-html="iconEdit"></span>
            </button>
            <button @click="openDelete(item)" class="action-btn" title="Удалить">
              <span v-html="iconDelete"></span>
            </button>
          </td>
        </tr>
      </Table>
    </div>
    <div v-if="loading" class="text-center mt-6"><Spinner /></div>
    <div v-if="error" class="text-red-500 text-center mt-4">{{ error }}</div>
    <div v-if="!loading && equipments.length === 0" class="text-gray-500 text-center mt-4">Нет данных</div>
    <!-- Пагинация -->
    <div v-if="total > limit" class="flex items-center justify-center gap-6 mt-12">
      <div class="w-full flex justify-center mb-4">
        <svg height="6" width="100%" viewBox="0 0 400 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="3" x2="400" y2="3" stroke="#ef4444" stroke-width="2" stroke-dasharray="12 8" opacity="0.12" />
        </svg>
      </div>
      <button
        class="px-4 py-2 rounded-xl bg-white/80 shadow backdrop-blur-lg border border-gray-300 text-gray-900 text-base font-mono font-semibold disabled:opacity-50 transition"
        :disabled="page === 1"
        @click="setPage(page - 1)"
      >Назад</button>
      <span class="text-gray-700 text-lg font-semibold font-mono">
        Страница {{ page }} из {{ Math.ceil(total / limit) }}
      </span>
      <button
        class="px-4 py-2 rounded-xl bg-white/80 shadow backdrop-blur-lg border border-gray-300 text-gray-900 text-base font-mono font-semibold disabled:opacity-50 transition"
        :disabled="page === Math.ceil(total / limit)"
        @click="setPage(page + 1)"
      >Вперёд</button>
    </div>
    <!-- Модалка добавления/редактирования -->
    <EquipmentEditor
      v-model="showEditor"
      :isEdit="isEdit"
      :equipment="editingEquipment"
      :categories="categories"
      :subcategoriesMap="subcategoriesMap"
      @close="closeEditor"
      @submit="submitEditor"
    />
    <!-- Модалка подтверждения удаления -->
    <Modal v-model="showDeleteConfirm">
      <div class="flex flex-col items-center gap-4 p-2">
        <div class="text-lg font-semibold text-gray-900 text-center">Удалить оборудование?</div>
        <div class="text-gray-700 text-center">Вы уверены, что хотите удалить <span class="font-bold">{{ deletingEquipment?.model }}</span>? Это действие необратимо.</div>
        <div class="flex gap-2 mt-2">
          <Button @click="closeDelete">Отмена</Button>
          <Button @click="confirmDelete">Удалить</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
/*
  filters-panel, filters-row, filter-field, filter-action — современный минималистичный UI для фильтров оборудования.
  Все стили реализованы на чистом CSS (без Tailwind-утилит) для совместимости с Tailwind v4 и production-UI.
  Особенности: tech-look, фирменный акцент, адаптивность, accessibility, единый стиль для всех элементов.
*/
.filters-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(255,255,255,0.7);
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px 0 rgba(16,16,16,0.04);
  margin-bottom: 32px;
}
.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  width: 100%;
}
.filter-field {
  height: 44px;
  min-width: 160px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255,255,255,0.95);
  font-size: 16px;
  font-family: 'JetBrains Mono', monospace;
  padding: 0 16px;
  transition: box-shadow 0.2s, border-color 0.2s;
  color: #1f2937;
}
.filter-field:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px #fecaca;
}
.filter-field:disabled {
  opacity: 0.5;
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}
.filter-search {
  flex: 2 1 240px;
  min-width: 200px;
}
.filters-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.filter-action {
  height: 44px;
  min-width: 120px;
  border-radius: 8px;
  font-size: 16px;
  font-family: 'JetBrains Mono', monospace;
  background: #ef4444;
  color: #fff;
  border: none;
  transition: background 0.2s;
  cursor: pointer;
  padding: 0 24px;
  font-weight: 600;
  box-shadow: 0 1px 4px 0 rgba(16,16,16,0.04);
}
.filter-action:hover {
  background: #dc2626;
}
.filter-action.secondary {
  background: #f3f4f6;
  color: #1f2937;
}
.filter-action.secondary:hover {
  background: #e5e7eb;
}
@media (max-width: 767px) {
  .filters-row, .filters-actions {
    flex-direction: column;
    width: 100%;
    gap: 12px;
  }
  .filter-field, .filter-action {
    width: 100%;
    min-width: 0;
  }
  .filters-actions {
    margin-left: 0;
  }
}
/*
  table-eq, status-badge, action-btn, table-scroll-x — production-таблица с единым tech/minimal стилем, без Tailwind-утилит.
  Особенности: строгая сетка, выравнивание, адаптивность, фирменные акценты, accessibility.
*/
.table-eq {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 800px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  background: rgba(255,255,255,0.98);
  border-radius: 16px;
  overflow: hidden;
}
.table-eq th, .table-eq td {
  padding: 18px 20px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.table-eq th {
  background: rgba(243,244,246,0.7);
  font-weight: 700;
  font-size: 16px;
  color: #1f2937;
  letter-spacing: 0.04em;
}
.table-eq tr:last-child td {
  border-bottom: none;
}
.table-eq tr:hover {
  background: #fef2f2;
  box-shadow: 0 2px 8px 0 rgba(239,68,68,0.04);
  transition: background 0.2s, box-shadow 0.2s;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}
.status-badge.operational {
  background: #dcfce7;
  color: #166534;
}
.status-badge.broken {
  background: #fee2e2;
  color: #991b1b;
}
.status-badge.in-repair {
  background: #fef9c3;
  color: #92400e;
}
.status-badge.other {
  background: #e5e7eb;
  color: #374151;
}
.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  transition: background 0.15s;
  cursor: pointer;
  margin: 0 2px;
}
.action-btn:hover {
  background: #f3f4f6;
}
@media (max-width: 900px) {
  .table-eq {
    min-width: 600px;
    font-size: 14px;
  }
}
@media (max-width: 600px) {
  .table-eq {
    min-width: 480px;
    font-size: 13px;
  }
}
.table-scroll-x {
  width: 100%;
  overflow-x: auto;
}
</style>

<!--
  Все стили и дизайн соответствуют новым стандартам: светлый, читаемый glassmorphism, минимализм, mobile-first, акценты только по смыслу.
  Подробные комментарии на русском языке объясняют назначение и реализацию каждого блока.
-->