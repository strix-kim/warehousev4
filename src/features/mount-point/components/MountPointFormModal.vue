<!--
  MountPointFormModal - модальная форма для создания/редактирования точки монтажа
  Современный дизайн, валидация, интеграция с Pinia store
  Поддержка технических заданий и назначения инженеров
-->
<template>
  <Modal 
    v-model="isVisible" 
    size="lg"
  >
    <template #header>
      <h2 class="text-xl font-semibold text-gray-900">
        {{ isEdit ? 'Редактировать точку монтажа' : 'Создать точку монтажа' }}
      </h2>
    </template>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Основная информация -->
      <div class="space-y-4">
        <h3 class="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Основная информация
        </h3>
        
        <!-- Название точки -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
            Название точки монтажа *
          </label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            maxlength="120"
            placeholder="Например: Основная сцена, Зал А, Фойе..."
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500/20': errors.name }"
          />
          <p v-if="errors.name" class="mt-1 text-sm text-red-600">{{ errors.name }}</p>
        </div>

        <!-- Локация -->
        <div>
          <label for="location" class="block text-sm font-medium text-gray-700 mb-2">
            Локация
          </label>
          <input
            id="location"
            v-model="form.location"
            type="text"
            maxlength="100"
            placeholder="Например: Главный зал, Фойе, Сцена..."
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <!-- Дата начала работы -->
        <div>
          <label for="start_date" class="block text-sm font-medium text-gray-700 mb-2">
            Дата начала работы
          </label>
          <input
            id="start_date"
            v-model="form.start_date"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
      
      <!-- Технические задания -->
      <div class="space-y-4">
        <h3 class="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Технические задания
        </h3>
        
        <!-- Добавление нового задания -->
        <div class="flex gap-2">
          <input
            v-model="newDutyTitle"
            type="text"
            placeholder="Добавить техническое задание..."
            class="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 bg-white transition-colors duration-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            @keydown.enter.prevent="addDuty"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            @click="addDuty"
            :disabled="!newDutyTitle.trim()"
          >
            Добавить
          </Button>
        </div>
        
        <!-- Список заданий с статусами -->
        <div v-if="form.technical_duties.length > 0" class="space-y-3">
          <div
            v-for="(duty, index) in form.technical_duties"
            :key="duty.id || index"
            class="p-4 bg-gray-50 border border-gray-200 rounded-lg"
          >
            <div class="flex items-start gap-3 mb-3">
              <div class="flex-1">
                <input
                  v-model="duty.title"
                  type="text"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Название задания"
                />
              </div>
              <button
                type="button"
                @click="removeDuty(index)"
                class="w-6 h-6 text-gray-400 hover:text-red-600 transition-colors duration-200 flex-shrink-0 mt-1"
              >
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <!-- Статус всегда 'в работе', не редактируется -->
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Статус:</span>
              <span class="text-xs font-medium text-yellow-700">В работе</span>
              <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
            </div>
          </div>
        </div>
        
        <p v-if="errors.technical_duties" class="text-sm text-red-600">{{ errors.technical_duties }}</p>
      </div>
      
      <!-- Ответственные инженеры -->
      <div class="space-y-4">
        <h3 class="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Ответственные инженеры *
        </h3>
        
        <!-- Загрузка пользователей -->
        <div v-if="isUsersLoading" class="flex items-center justify-center py-8">
          <Spinner class="h-6 w-6 text-blue-600" />
          <span class="ml-2 text-gray-600">Загрузка списка инженеров...</span>
        </div>
        
        <!-- Список инженеров для выбора -->
        <div v-else-if="availableEngineers.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
          <label 
            v-for="engineer in availableEngineers" 
            :key="engineer.id"
            class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer transition-colors duration-200 hover:border-blue-500 hover:shadow-sm"
            :class="{ 'border-blue-500 bg-blue-50': form.responsible_engineers.includes(engineer.id) }"
          >
            <input
              type="checkbox"
              :value="engineer.id"
              v-model="form.responsible_engineers"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium text-gray-900">{{ engineer.name }}</span>
              <span class="text-xs text-gray-500 ml-2">({{ engineer.role }})</span>
            </div>
          </label>
        </div>
        
        <div v-else class="text-center py-8 text-gray-500">
          Нет доступных инженеров для назначения
        </div>
        
        <p v-if="errors.responsible_engineers" class="text-sm text-red-600">{{ errors.responsible_engineers }}</p>
      </div>
      
      <!-- Ошибка -->
      <div v-if="submitError" class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-sm font-medium text-red-800">{{ submitError }}</span>
        </div>
      </div>
      
      <!-- Действия -->
      <div class="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          @click="isVisible = false; emit('close')"
          class="sm:w-auto w-full"
        >
          Отмена
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          class="sm:w-auto w-full"
        >
          {{ isEdit ? 'Сохранить изменения' : 'Создать точку монтажа' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>

<script setup>
/**
 * MountPointFormModal - модальная форма для создания/редактирования точки монтажа
 * Поддерживает валидацию, добавление технических заданий, назначение инженеров
 * Интегрируется с Pinia store для управления данными
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useUserStore } from '@/stores/user-store'
import { useMountPointStore } from '@/stores/mount-point-store'
import { storeToRefs } from 'pinia'
import Modal from '@/shared/ui/molecules/Modal.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'

// Пропсы
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  eventId: {
    type: String,
    required: true
  },
  mountPoint: {
    type: Object,
    default: null
  },
  event: {
    type: Object,
    default: null
  }
})

// События
const emit = defineEmits(['update:visible', 'success', 'submit', 'close'])

// Локальная реактивная переменная для v-model
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Stores
const userStore = useUserStore()
const mountPointStore = useMountPointStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)

// Локальное состояние
const form = ref({
  name: '',
  location: '',
  start_date: '',
  technical_duties: [],
  responsible_engineers: []
})

const newDutyTitle = ref('')
const errors = ref({})
const submitError = ref('')
const isSubmitting = ref(false)

// Вычисляемые свойства
const isEdit = computed(() => !!props.mountPoint)

// Доступные инженеры — только те, кто назначен на выбранное мероприятие и имеет подходящую роль
const availableEngineers = computed(() => {
  if (!props.event?.responsible_engineers) return []
  return users.value.filter(user =>
    props.event.responsible_engineers.includes(user.id) &&
    ['video_engineer', 'technician', 'manager', 'admin'].includes(user.role)
  )
})

// Наблюдатели
watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm()
    clearErrors()
  }
})

watch(() => props.mountPoint, (newVal) => {
  if (newVal && props.visible) {
    resetForm()
  }
}, { immediate: true })

// Методы
function resetForm() {
  if (props.mountPoint) {
    // Режим редактирования
    form.value = {
      name: props.mountPoint.name || '',
      location: props.mountPoint.location || '',
      start_date: props.mountPoint.start_date || '',
      technical_duties: ensureTechnicalDutiesFormat(props.mountPoint.technical_duties || []),
      responsible_engineers: [...(props.mountPoint.responsible_engineers || [])]
    }
  } else {
    // Режим создания
    form.value = {
      name: '',
      location: '',
      start_date: '',
      technical_duties: [],
      responsible_engineers: []
    }
  }
}

function clearErrors() {
  errors.value = {}
  submitError.value = ''
}

// Вспомогательные функции
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function ensureTechnicalDutiesFormat(duties) {
  if (!Array.isArray(duties)) return []
  
  return duties.map(duty => {
    // Если это уже объект с нужной структурой
    if (typeof duty === 'object' && duty.title && duty.status) {
      return {
        id: duty.id || generateId(),
        title: duty.title,
        status: duty.status
      }
    }
    // Если это старый формат (просто строка)
    if (typeof duty === 'string') {
      return {
        id: generateId(),
        title: duty,
        status: 'в работе'
      }
    }
    // Fallback
    return {
      id: generateId(),
      title: String(duty),
      status: 'в работе'
    }
  })
}

// В функции addDuty всегда присваиваем статус 'в работе'
function addDuty() {
  const title = newDutyTitle.value.trim()
  if (!title) return
  
  if (form.value.technical_duties.some(duty => duty.title === title)) {
    submitError.value = 'Такое техническое задание уже добавлено'
    return
  }
  
  const newDuty = {
    id: crypto.randomUUID(),
    title,
    status: 'в работе'
  }
  
  form.value.technical_duties.push(newDuty)
  newDutyTitle.value = ''
  submitError.value = ''
}

function removeDuty(index) {
  form.value.technical_duties.splice(index, 1)
}

function validateForm() {
  const newErrors = {}
  
  if (!form.value.name.trim()) {
    newErrors.name = 'Название точки монтажа обязательно'
  } else if (form.value.name.trim().length > 120) {
    newErrors.name = 'Название не должно превышать 120 символов'
  }
  
  if (form.value.technical_duties.length === 0) {
    newErrors.technical_duties = 'Добавьте хотя бы одно техническое задание'
  } else {
    // Проверяем, что все задания имеют название
    const hasEmptyTitles = form.value.technical_duties.some(duty => !duty.title?.trim())
    if (hasEmptyTitles) {
      newErrors.technical_duties = 'Все технические задания должны иметь название'
    }
  }
  
  if (form.value.responsible_engineers.length === 0) {
    newErrors.responsible_engineers = 'Назначьте хотя бы одного ответственного инженера'
  }
  
  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

async function handleSubmit() {
  clearErrors()
  
  if (!validateForm()) {
    return
  }
  
  isSubmitting.value = true
  
  try {
    const formData = {
      ...form.value,
      name: form.value.name.trim(),
      location: form.value.location?.trim() || null,
      start_date: form.value.start_date || null,
      technical_duties: form.value.technical_duties.map(duty => ({
        id: duty.id,
        title: duty.title.trim(),
        status: duty.status
      })),
      event_id: props.eventId
    }
    
    // Отправляем данные родительскому компоненту для обработки
    emit('submit', formData)
    
  } catch (err) {
    submitError.value = err.message || 'Ошибка валидации данных'
  } finally {
    isSubmitting.value = false
  }
}

// Инициализация
onMounted(() => {
  if (!users.value.length) {
    userStore.loadUsers()
  }
})
</script> 