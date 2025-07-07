<script setup>
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMountPointById, updateMountPoint, deleteMountPoint } from '@/features/mount-point/mountPointApi' // TODO: реализовать fetchMountPointById если нет
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import { useEquipmentStore } from '@/stores/equipment-store'
import { useUsedEquipmentIds } from '@/features/mount-point/use-used-equipment-ids'
import { filterAvailableEquipment } from '@/features/mount-point/filter-available-equipment'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const userStore = useUserStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)

const isLoading = ref(true)
const hasError = ref(null)
const isEditing = ref(false)
const isSaving = ref(false)
const success = ref(false)

const mountPoint = ref(null)
const form = ref({ name: '', technical_duties: [], responsible_engineers: [], dutyInput: '', equipment_plan: [], equipment_final: [] })
const eventEngineers = ref([])
const search = ref('')
const eventId = ref(null)
const isEditingEquipment = ref(false)
const equipmentPlanDraft = ref([])
const showEquipmentModal = ref(false)
const showDeleteModal = ref(false)
const showFinalEquipmentModal = ref(false)
const finalEquipmentDraft = ref([])
const selectedCategory = ref('')
const selectedSubcategory = ref('')

// Загрузка точки монтажа и инженеров события
async function loadMountPoint() {
  isLoading.value = true
  hasError.value = null
  try {
    const data = await fetchMountPointById(id)
    mountPoint.value = data
    form.value = {
      name: data.name,
      technical_duties: [...(data.technical_duties || [])],
      responsible_engineers: [...(data.responsible_engineers || [])],
      dutyInput: '',
      equipment_plan: [...(data.equipment_plan || [])],
      equipment_final: [...(data.equipment_final || [])]
    }
    // Загрузить инженеров события
    const event = await fetchEventById(data.event_id)
    eventEngineers.value = event.responsible_engineers || []
    eventId.value = data.event_id
    await loadEquipments()
  } catch (e) {
    hasError.value = e.message || 'Ошибка загрузки точки монтажа'
  } finally {
    isLoading.value = false
  }
}

// Сохранение изменений
async function handleSave() {
  isSaving.value = true
  hasError.value = null
  try {
    await updateMountPoint(id, {
      name: form.value.name,
      technical_duties: form.value.technical_duties,
      responsible_engineers: form.value.responsible_engineers,
      equipment_plan: form.value.equipment_plan,
      equipment_final: form.value.equipment_final,
      equipment_fact: getEquipmentFact()
    })
    isEditing.value = false
    success.value = true
    await loadMountPoint()
  } catch (e) {
    hasError.value = e.message || 'Ошибка сохранения'
  } finally {
    isSaving.value = false
  }
}

// Переключение режима редактирования
function startEdit() {
  isEditing.value = true
}
function cancelEdit() {
  isEditing.value = false
  // Сбросить форму к исходным данным
  if (mountPoint.value) {
    form.value = {
      name: mountPoint.value.name,
      technical_duties: [...(mountPoint.value.technical_duties || [])],
      responsible_engineers: [...(mountPoint.value.responsible_engineers || [])],
      dutyInput: '',
      equipment_plan: [...(mountPoint.value.equipment_plan || [])],
      equipment_final: [...(mountPoint.value.equipment_final || [])]
    }
  }
}

// Добавление обязанности
function addDuty() {
  const val = form.value.dutyInput.trim()
  if (!val) return
  if (form.value.technical_duties.includes(val)) {
    hasError.value = 'Обязанность уже добавлена'
    return
  }
  form.value.technical_duties.push(val)
  form.value.dutyInput = ''
  hasError.value = null
}

// Удаление обязанности
function removeDuty(idx) {
  form.value.technical_duties.splice(idx, 1)
}

function openDeleteModal() {
  showDeleteModal.value = true
}
function closeDeleteModal() {
  showDeleteModal.value = false
}
async function handleDeleteConfirmed() {
  isSaving.value = true
  hasError.value = null
  try {
    await deleteMountPoint(id)
    router.push(`/events/${mountPoint.value.event_id}`)
  } catch (e) {
    hasError.value = e.message || 'Ошибка удаления точки монтажа'
  } finally {
    isSaving.value = false
    showDeleteModal.value = false
  }
}

// Pinia store для оборудования
const equipmentStore = useEquipmentStore()
const { equipments, loading: isEquipmentLoading, error: equipmentError } = storeToRefs(equipmentStore)

// При монтировании — загрузить оборудование, если store пуст
if (!equipments.value.length) {
  equipmentStore.loadEquipments()
}

// Используем useUsedEquipmentIds только если eventId определён
let usedEquipmentIds, reloadUsedEquipment
watchEffect(() => {
  if (eventId.value) {
    const result = useUsedEquipmentIds(eventId.value, id)
    usedEquipmentIds = result.usedEquipmentIds
    reloadUsedEquipment = result.reload
  }
})

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

// Computed: фильтрованный список оборудования для equipment_plan
const filteredEquipmentPlan = computed(() =>
  filterAvailableEquipment(
    equipments.value,
    usedEquipmentIds.value,
    equipmentPlanDraft.value,
    {
      category: selectedCategory.value,
      subcategory: selectedSubcategory.value,
      search: search.value
    }
  )
)

// Computed: фильтрованный список оборудования для equipment_final
const filteredEquipmentFinal = computed(() =>
  filterAvailableEquipment(
    equipments.value,
    usedEquipmentIds.value,
    finalEquipmentDraft.value,
    {
      category: selectedCategory.value,
      subcategory: selectedSubcategory.value,
      search: search.value,
      extraExclude: form.value.equipment_plan
    }
  )
)

watch(selectedCategory, () => {
  selectedSubcategory.value = ''
})

// Computed: сгруппировать выбранное оборудование по категориям и подкатегориям
const equipmentByCategorySubcategory = computed(() => {
  const map = {}
  for (const id of form.value.equipment_plan) {
    const eq = equipments.value.find(e => e.id === id)
    if (!eq) continue
    if (!map[eq.category]) map[eq.category] = {}
    if (!map[eq.category][eq.subcategory]) map[eq.category][eq.subcategory] = []
    map[eq.category][eq.subcategory].push(eq)
  }
  return map
})

// Computed: сгруппировать финальное оборудование по категориям и подкатегориям
const finalEquipmentByCategorySubcategory = computed(() => {
  const map = {}
  for (const id of form.value.equipment_final) {
    const eq = equipments.value.find(e => e.id === id)
    if (!eq) continue
    if (!map[eq.category]) map[eq.category] = {}
    if (!map[eq.category][eq.subcategory]) map[eq.category][eq.subcategory] = []
    map[eq.category][eq.subcategory].push(eq)
  }
  return map
})

// Computed: фактический список оборудования (объединение планового и финального, без дубликатов)
const actualEquipmentByCategorySubcategory = computed(() => {
  const ids = Array.from(new Set([
    ...form.value.equipment_plan,
    ...form.value.equipment_final
  ]))
  const map = {}
  for (const id of ids) {
    const eq = equipments.value.find(e => e.id === id)
    if (!eq) continue
    if (!map[eq.category]) map[eq.category] = {}
    if (!map[eq.category][eq.subcategory]) map[eq.category][eq.subcategory] = []
    map[eq.category][eq.subcategory].push(eq)
  }
  return map
})

function goToEvent() {
  if (mountPoint.value?.event_id) {
    router.push(`/events/${mountPoint.value.event_id}`)
  }
}

function openEquipmentModal() {
  reloadUsedEquipment()
  equipmentPlanDraft.value = [...form.value.equipment_plan]
  showEquipmentModal.value = true
}
function closeEquipmentModal() {
  showEquipmentModal.value = false
  equipmentPlanDraft.value = []
}
async function saveEditEquipment() {
  isSaving.value = true
  hasError.value = null
  try {
    await updateMountPoint(id, {
      equipment_plan: equipmentPlanDraft.value
    })
    showEquipmentModal.value = false
    await loadMountPoint()
  } catch (e) {
    hasError.value = e.message || 'Ошибка сохранения оборудования'
  } finally {
    isSaving.value = false
  }
}

function openFinalEquipmentModal() {
  reloadUsedEquipment()
  finalEquipmentDraft.value = [...form.value.equipment_final]
  showFinalEquipmentModal.value = true
}
function closeFinalEquipmentModal() {
  showFinalEquipmentModal.value = false
  finalEquipmentDraft.value = []
}
async function saveFinalEquipment() {
  isSaving.value = true
  hasError.value = null
  try {
    await updateMountPoint(id, {
      equipment_final: finalEquipmentDraft.value,
      equipment_fact: Array.from(new Set([
        ...form.value.equipment_plan,
        ...finalEquipmentDraft.value
      ]))
    })
    showFinalEquipmentModal.value = false
    await loadMountPoint()
  } catch (e) {
    hasError.value = e.message || 'Ошибка сохранения финального списка'
  } finally {
    isSaving.value = false
  }
}

// equipment_fact: вычисляемый список (объединение plan и final, без дубликатов)
function getEquipmentFact() {
  return Array.from(new Set([
    ...form.value.equipment_plan,
    ...form.value.equipment_final
  ]))
}

loadMountPoint()
onMounted(() => {
  if (!users.value.length) userStore.loadUsers()
})
</script>

<template>
  <!-- Production: светлый SVG-паттерн на фоне, как на других страницах -->
  <div class="min-h-screen bg-gray-50 relative" style="background: #f8fafc url(data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='40' height='40' fill='none'/%3E%3Cpath d='M 40 0 L 0 0 0 40' stroke='%23e5e7eb' stroke-width='1'/%3E%3C/svg%3E); background-size: 40px 40px; background-repeat: repeat;">
    <div class="max-w-2xl sm:max-w-3xl mx-auto p-6 sm:p-10 bg-white bg-opacity-95 rounded-2xl shadow-lg mt-10 mb-10 text-gray-900">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-lg font-bold">Точка монтажа</h1>
        <button @click="goToEvent" class="p-2 border rounded text-sm">К мероприятию</button>
      </div>
      <div v-if="isLoading || isUsersLoading || isEquipmentLoading" class="flex justify-center items-center py-8">Загрузка...</div>
      <div v-else-if="hasError || equipmentError" class="text-red-600 text-center">{{ hasError || equipmentError }}</div>
      <div v-else>
        <form @submit.prevent="handleSave" class="flex flex-col gap-2">
          <input v-model="form.name" :readonly="!isEditing" class="p-2 border" />
          <div>
            <label class="block text-xs mb-1">Технические обязанности</label>
            <div v-if="isEditing" class="flex gap-2 mt-2">
              <input v-model="form.dutyInput" type="text" placeholder="Добавить обязанность" class="p-2 border flex-1" @keydown.enter.prevent="addDuty" />
              <button type="button" @click="addDuty" class="p-2 border">+</button>
            </div>
            <ul class="mt-2">
              <li v-for="(duty, idx) in form.technical_duties" :key="duty" class="flex items-center gap-2">
                <span>{{ duty }}</span>
                <button v-if="isEditing" type="button" @click="removeDuty(idx)" class="text-red-600">x</button>
              </li>
            </ul>
          </div>
          <div>
            <label class="block text-xs mb-1">Ответственные инженеры</label>
            <div v-if="isEditing" class="flex flex-col gap-1">
              <div v-for="id in eventEngineers" :key="id" class="flex items-center gap-2">
                <input type="checkbox" :id="'eng-' + id" :value="id" v-model="form.responsible_engineers" />
                <label :for="'eng-' + id" class="text-sm">{{ users.find(u => u.id === id)?.name || id }}</label>
              </div>
            </div>
            <div v-else class="flex flex-col gap-1">
              <div v-for="id in form.responsible_engineers" :key="id" class="flex items-center gap-2">
                <input type="checkbox" :value="id" v-model="form.responsible_engineers" disabled />
                <span>{{ users.find(u => u.id === id)?.name || id }}</span>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-xs mb-1">Оборудование (план)</label>
            <div v-if="showEquipmentModal">
              <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl mx-auto relative">
                  <h2 class="text-lg font-bold mb-4">Редактировать оборудование</h2>
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
                  <div class="flex flex-col gap-1 max-h-80 overflow-y-auto">
                    <div v-for="eq in filteredEquipmentPlan" :key="eq.id" class="flex items-center gap-2">
                      <input type="checkbox" :id="'eq-' + eq.id" :value="eq.id" v-model="equipmentPlanDraft" />
                      <label :for="'eq-' + eq.id" class="text-sm">{{ eq.model }} ({{ eq.brand }}) — SN: {{ eq.serial_number }}</label>
                    </div>
                    <div v-if="filteredEquipmentPlan.length === 0" class="text-gray-500">Нет доступного оборудования</div>
                  </div>
                  <div class="flex gap-2 mt-4">
                    <button type="button" @click="saveEditEquipment" :disabled="isSaving" class="p-2 border flex-1">Сохранить</button>
                    <button type="button" @click="closeEquipmentModal" class="p-2 border flex-1">Отмена</button>
                  </div>
                  <button @click="closeEquipmentModal" class="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-2xl">×</button>
                </div>
              </div>
            </div>
            <div v-else>
              <div v-if="Object.keys(equipmentByCategorySubcategory).length === 0" class="text-gray-500">Нет выбранного оборудования</div>
              <div v-else>
                <div v-for="(subcats, cat) in equipmentByCategorySubcategory" :key="cat" class="mb-2">
                  <div class="font-semibold text-sm mb-1">{{ cat }}</div>
                  <div v-for="(items, subcat) in subcats" :key="subcat" class="ml-2 mb-1">
                    <div class="text-xs font-medium mb-1">{{ subcat }}</div>
                    <ul class="ml-4 list-disc">
                      <li v-for="eq in items" :key="eq.id">
                        {{ eq.model }} ({{ eq.brand }}) — SN: {{ eq.serial_number }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <button v-if="isEditing && !showEquipmentModal" type="button" @click="openEquipmentModal" class="p-2 border mt-2 text-sm">Редактировать оборудование</button>
            </div>
          </div>
          <div class="mt-6">
            <label class="block text-xs mb-1">Финальный список оборудования</label>
            <div v-if="showFinalEquipmentModal">
              <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl mx-auto relative">
                  <h2 class="text-lg font-bold mb-4">Сформировать финальный список оборудования</h2>
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
                  <div class="flex flex-col gap-1 max-h-80 overflow-y-auto">
                    <div v-for="eq in filteredEquipmentFinal" :key="eq.id" class="flex items-center gap-2">
                      <input type="checkbox" :id="'final-eq-' + eq.id" :value="eq.id" v-model="finalEquipmentDraft" />
                      <label :for="'final-eq-' + eq.id" class="text-sm">{{ eq.model }} ({{ eq.brand }}) — SN: {{ eq.serial_number }}</label>
                    </div>
                    <div v-if="filteredEquipmentFinal.length === 0" class="text-gray-500">Нет доступного оборудования</div>
                  </div>
                  <div class="flex gap-2 mt-4">
                    <button type="button" @click="saveFinalEquipment" :disabled="isSaving" class="p-2 border flex-1">Сохранить</button>
                    <button type="button" @click="closeFinalEquipmentModal" class="p-2 border flex-1">Отмена</button>
                  </div>
                  <button @click="closeFinalEquipmentModal" class="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-2xl">×</button>
                </div>
              </div>
            </div>
            <div v-else>
              <div v-if="Object.keys(finalEquipmentByCategorySubcategory).length === 0" class="text-gray-500">Финальный список не сформирован</div>
              <div v-else>
                <div v-for="(subcats, cat) in finalEquipmentByCategorySubcategory" :key="cat" class="mb-2">
                  <div class="font-semibold text-sm mb-1">{{ cat }}</div>
                  <div v-for="(items, subcat) in subcats" :key="subcat" class="ml-2 mb-1">
                    <div class="text-xs font-medium mb-1">{{ subcat }}</div>
                    <ul class="ml-4 list-disc">
                      <li v-for="eq in items" :key="eq.id">
                        {{ eq.model }} ({{ eq.brand }}) — SN: {{ eq.serial_number }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <button v-if="isEditing && !showFinalEquipmentModal" type="button" @click="openFinalEquipmentModal" class="p-2 border mt-2 text-sm">Сформировать финальный список оборудования</button>
            </div>
          </div>
          <div class="mt-8">
            <label class="block text-xs mb-1">Фактический список оборудования</label>
            <div class="backdrop-blur-lg bg-white/30 shadow-2xl rounded-2xl p-4">
              <div v-if="Object.keys(actualEquipmentByCategorySubcategory).length === 0" class="text-gray-500">Нет оборудования</div>
              <div v-else>
                <div v-for="(subcats, cat) in actualEquipmentByCategorySubcategory" :key="cat" class="mb-2">
                  <div class="font-semibold text-sm mb-1">{{ cat }}</div>
                  <div v-for="(items, subcat) in subcats" :key="subcat" class="ml-2 mb-1">
                    <div class="text-xs font-medium mb-1">{{ subcat }}</div>
                    <ul class="ml-4 list-disc">
                      <li v-for="eq in items" :key="eq.id">
                        {{ eq.model }} ({{ eq.brand }}) — SN: {{ eq.serial_number }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="hasError" class="text-red-600 text-center mt-2">{{ hasError }}</div>
          <div class="flex gap-2 mt-4">
            <button v-if="isEditing" type="submit" :disabled="isSaving" class="p-2 border flex-1">Сохранить</button>
            <button v-if="isEditing" type="button" @click="cancelEdit" class="p-2 border flex-1">Отмена</button>
            <template v-else>
              <button type="button" @click="startEdit" class="p-2 border flex-1">Редактировать</button>
              <button type="button" @click="openDeleteModal" class="p-2 border flex-1 text-red-600">Удалить</button>
            </template>
          </div>
        </form>
      </div>
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto relative">
          <h2 class="text-lg font-bold mb-4">Удалить точку монтажа?</h2>
          <p class="mb-4">Вы уверены, что хотите удалить эту точку монтажа? Это действие необратимо.</p>
          <div class="flex gap-2">
            <button @click="handleDeleteConfirmed" :disabled="isSaving" class="p-2 border flex-1 text-red-600">Да, удалить</button>
            <button @click="closeDeleteModal" class="p-2 border flex-1">Отмена</button>
          </div>
          <button @click="closeDeleteModal" class="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-2xl">×</button>
        </div>
      </div>
    </div>
  </div>
</template> 