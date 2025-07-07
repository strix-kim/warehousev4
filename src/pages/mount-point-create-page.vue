<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchEventById } from '@/features/event/eventApi'
import { addMountPoint } from '@/features/mount-point/mountPointApi' // TODO: реализовать если нет
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import { useUsedEquipmentIds } from '@/features/mount-point/use-used-equipment-ids'
import { filterAvailableEquipment } from '@/features/mount-point/filter-available-equipment'

// Получаем параметры маршрута
const route = useRoute()
const router = useRouter()
const eventId = route.params.eventId

// Состояния загрузки и ошибок
const isLoading = ref(true)
const hasError = ref(null)
const isSaving = ref(false)
const success = ref(false)

// Список id ответственных инженеров для события
const eventEngineers = ref([])

// Все пользователи (для сопоставления id → имя)
const userStore = useUserStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)
import { onMounted } from 'vue'
onMounted(() => {
  if (!users.value.length) userStore.loadUsers()
})

// Локальное состояние формы
const form = ref({
  name: '',
  duties: [], // массив обязанностей
  dutyInput: '', // текущее значение input для обязанности
  responsible_engineers: [],
  equipment_plan: [],
  equipment_final: [],
  equipment_fact: []
})

// Валидация
const validation = computed(() => {
  return {
    name: !form.value.name || form.value.name.length > 120,
    duties: form.value.duties.length === 0,
    engineers: form.value.responsible_engineers.length === 0
  }
})

// Загрузка инженеров события
async function loadEventEngineers() {
  isLoading.value = true
  hasError.value = null
  try {
    const event = await fetchEventById(eventId)
    eventEngineers.value = event.responsible_engineers || []
  } catch (e) {
    hasError.value = e.message || 'Ошибка загрузки мероприятия'
  } finally {
    isLoading.value = false
  }
}

// Добавление обязанности
function addDuty() {
  const val = form.value.dutyInput.trim()
  if (!val) return
  if (form.value.duties.includes(val)) {
    hasError.value = 'Обязанность уже добавлена'
    return
  }
  form.value.duties.push(val)
  form.value.dutyInput = ''
  hasError.value = null
}

// Удаление обязанности
function removeDuty(idx) {
  form.value.duties.splice(idx, 1)
}

// Сохранение точки монтажа
async function handleSave() {
  // Валидация
  if (validation.value.name || validation.value.duties || validation.value.engineers) {
    hasError.value = 'Заполните все обязательные поля'
    return
  }
  isSaving.value = true
  hasError.value = null
  try {
    const { data, error } = await addMountPoint({
      event_id: eventId,
      name: form.value.name,
      technical_duties: form.value.duties,
      responsible_engineers: form.value.responsible_engineers,
      equipment_plan: form.value.equipment_plan,
      equipment_final: form.value.equipment_final,
      equipment_fact: form.value.equipment_fact
    })
    if (error) throw error
    success.value = true
    // Получаем id новой точки и переходим к detail/edit
    const newId = data && data[0] && data[0].id
    if (newId) {
      router.push(`/mount-point-details/${newId}`)
    } else {
      router.push(`/events/${eventId}`)
    }
  } catch (e) {
    hasError.value = e.message || 'Ошибка сохранения точки монтажа'
  } finally {
    isSaving.value = false
  }
}

// При монтировании — загрузить инженеров
loadEventEngineers()

const search = ref('')
const selectedCategory = ref('')
const selectedSubcategory = ref('')

// Pinia store для оборудования
const equipmentStore = useEquipmentStore()
const { equipments, loading: isEquipmentLoading, error: equipmentError } = storeToRefs(equipmentStore)

// При монтировании — загрузить оборудование, если store пуст
if (!equipments.value.length) {
  equipmentStore.loadEquipments()
}

// Используем useUsedEquipmentIds
const { usedEquipmentIds, reload: reloadUsedEquipment } = useUsedEquipmentIds(eventId)

// Computed: все уникальные категории и подкатегории
const categories = computed(() => {
  const set = new Set(equipments.value.map(eq => eq.category).filter(Boolean))
  return Array.from(set)
})
const subcategories = computed(() => {
  if (!selectedCategory.value) return []
  const set = new Set(equipments.value.filter(eq => eq.category === selectedCategory.value).map(eq => eq.subcategory).filter(Boolean))
  return Array.from(set)
})

// Computed: фильтрованный список оборудования с учётом поиска, категории, подкатегории и usedEquipmentIds
const filteredEquipment = computed(() =>
  filterAvailableEquipment(
    equipments.value,
    usedEquipmentIds.value,
    form.value.equipment_plan,
    {
      category: selectedCategory.value,
      subcategory: selectedSubcategory.value,
      search: search.value
    }
  )
)

watch(selectedCategory, () => {
  selectedSubcategory.value = ''
})

// В onMounted/loadEventEngineers добавить loadEquipment()
// loadEquipment() // Удален
</script>

<template>
  <!-- Production: светлый SVG-паттерн на фоне, как на других страницах -->
  <div class="min-h-screen bg-gray-50 relative" style="background: #f8fafc url(data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='40' height='40' fill='none'/%3E%3Cpath d='M 40 0 L 0 0 0 40' stroke='%23e5e7eb' stroke-width='1'/%3E%3C/svg%3E); background-size: 40px 40px; background-repeat: repeat;">
    <div class="max-w-2xl sm:max-w-3xl mx-auto p-6 sm:p-10 bg-white bg-opacity-95 rounded-2xl shadow-lg mt-10 mb-10 text-gray-900">
      <h1 class="text-2xl font-bold mb-6 flex items-center gap-3">
        <!-- Иконка точки монтажа -->
        <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z"/><circle cx="12" cy="13" r="3"/></svg>
        Создать точку монтажа
      </h1>
      <div v-if="isLoading || isUsersLoading || isEquipmentLoading" class="flex justify-center items-center py-8">Загрузка...</div>
      <div v-else>
        <form @submit.prevent="handleSave" class="flex flex-col gap-2">
          <input v-model="form.name" type="text" placeholder="Название точки *" maxlength="120" class="p-2 border" />
          <div v-if="validation.name" class="text-red-600 text-xs">Название обязательно, не более 120 символов</div>
          <div>
            <div class="flex gap-2 mt-2">
              <input v-model="form.dutyInput" type="text" placeholder="Добавить обязанность" class="p-2 border flex-1" @keydown.enter.prevent="addDuty" />
              <button type="button" @click="addDuty" class="p-2 border">+</button>
            </div>
            <div v-if="form.duties.length === 0" class="text-red-600 text-xs mt-1">Добавьте хотя бы одну обязанность</div>
            <ul class="mt-2">
              <li v-for="(duty, idx) in form.duties" :key="duty" class="flex items-center gap-2">
                <span>{{ duty }}</span>
                <button type="button" @click="removeDuty(idx)" class="text-red-600">x</button>
              </li>
            </ul>
          </div>
          <div class="mt-2">
            <label class="block text-xs mb-1">Ответственные инженеры</label>
            <div v-if="eventEngineers.length === 0" class="text-gray-500">Нет доступных инженеров для выбора</div>
            <div v-else class="flex flex-col gap-1">
              <div v-for="id in eventEngineers" :key="id" class="flex items-center gap-2">
                <input type="checkbox" :id="'eng-' + id" :value="id" v-model="form.responsible_engineers" />
                <label :for="'eng-' + id" class="text-sm">{{ users.value.find(u => u.id === id)?.name || id }}</label>
              </div>
            </div>
            <div v-if="validation.engineers" class="text-red-600 text-xs mt-1">Выберите хотя бы одного инженера</div>
          </div>
          <div>
            <label class="block text-xs mb-1">Оборудование (план)</label>
            <div class="flex gap-2 mb-2">
              <select v-model="selectedCategory" class="p-2 border flex-1">
                <option value="">Все категории</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
              <select v-model="selectedSubcategory" class="p-2 border flex-1" :disabled="!selectedCategory">
                <option value="">Все подкатегории</option>
                <option v-for="sub in subcategories" :key="sub" :value="sub">{{ sub }}</option>
              </select>
            </div>
            <input v-model="search" type="text" placeholder="Поиск по модели, бренду, серийному номеру" class="p-2 border mb-2 w-full" />
            <div class="flex flex-col gap-1 max-h-40 overflow-y-auto">
              <div v-for="eq in filteredEquipment" :key="eq.id" class="flex items-center gap-2">
                <input type="checkbox" :id="'eq-' + eq.id" :value="eq.id" v-model="form.equipment_plan" />
                <label :for="'eq-' + eq.id" class="text-sm">{{ eq.model }} ({{ eq.brand }}) — SN: {{ eq.serial_number }}</label>
              </div>
              <div v-if="filteredEquipment.length === 0" class="text-gray-500">Нет доступного оборудования</div>
            </div>
          </div>
          <div v-if="hasError" class="text-red-600 text-center mt-2">{{ hasError }}</div>
          <div class="flex gap-2 mt-4">
            <button type="submit" :disabled="isSaving" class="p-2 border flex-1">Сохранить</button>
            <button type="button" @click="() => router.push(`/events/${eventId}`)" class="p-2 border flex-1">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template> 