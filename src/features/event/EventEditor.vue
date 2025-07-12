<template>
  <!--
    EventEditor.vue — современное модальное окно для добавления/редактирования мероприятия
    МИГРИРОВАНО: полностью переписан на Tailwind CSS, синяя цветовая схема
    Архитектурная роль: форма редактирования мероприятий, интегрирована с дизайн-системой
    Поддерживает: валидацию, loading состояния, accessibility, responsive design
  -->
  <Modal 
    v-model="modalValue" 
    size="lg"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-blue-600 stroke-current stroke-2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 font-mono tracking-wide">
          {{ isEdit ? 'Редактировать мероприятие' : 'Создать мероприятие' }}
        </h2>
      </div>
    </template>

    <template #default>
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Основная информация -->
        <div class="py-5 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono tracking-wide">Основная информация</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Название мероприятия -->
            <div class="md:col-span-2">
              <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
                Название мероприятия *
              </label>
              <input
                id="name"
                v-model="form.name"
                required
                type="text"
                placeholder="Название мероприятия"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Название мероприятия"
              />
            </div>
            
            <!-- Организатор -->
            <div>
              <label for="organizer" class="block text-sm font-medium text-gray-700 mb-2">
                Организатор *
              </label>
              <input
                id="organizer"
                v-model="form.organizer"
                required
                type="text"
                placeholder="Название организации"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Организатор"
              />
            </div>
            
            <!-- Локация -->
            <div>
              <label for="location" class="block text-sm font-medium text-gray-700 mb-2">
                Локация *
              </label>
              <input
                id="location"
                v-model="form.location"
                required
                type="text"
                placeholder="Место проведения"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Локация"
              />
            </div>
          </div>
        </div>
        
        <!-- Календарный план -->
        <div class="py-5 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono tracking-wide">Календарный план</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Дата начала мероприятия -->
            <div>
              <label for="start_date" class="block text-sm font-medium text-gray-700 mb-2">
                Дата начала мероприятия *
              </label>
              <input
                id="start_date"
                v-model="form.start_date"
                required
                type="date"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Дата начала мероприятия"
              />
            </div>
            
            <!-- Дата окончания мероприятия -->
            <div>
              <label for="end_date" class="block text-sm font-medium text-gray-700 mb-2">
                Дата окончания мероприятия
              </label>
              <input
                id="end_date"
                v-model="form.end_date"
                type="date"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Дата окончания мероприятия"
              />
            </div>
            
            <!-- Дата начала монтажа -->
            <div>
              <label for="setup_date" class="block text-sm font-medium text-gray-700 mb-2">
                Дата начала монтажа
              </label>
              <input
                id="setup_date"
                v-model="form.setup_date"
                type="date"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Дата начала монтажа"
              />
              <p class="text-xs text-gray-500 mt-1">Когда начинается подготовка</p>
            </div>
            
            <!-- Дата окончания демонтажа -->
            <div>
              <label for="teardown_date" class="block text-sm font-medium text-gray-700 mb-2">
                Дата окончания демонтажа
              </label>
              <input
                id="teardown_date"
                v-model="form.teardown_date"
                type="date"
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white transition-colors duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Дата окончания демонтажа"
              />
              <p class="text-xs text-gray-500 mt-1">Когда завершается разборка</p>
            </div>
          </div>
        </div>
        
        <!-- Дополнительная информация -->
        <div class="py-5 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono tracking-wide">Дополнительная информация</h3>
          <div class="space-y-4">
            <!-- Описание -->
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
                Описание мероприятия
              </label>
              <textarea
                id="description"
                v-model="form.description"
                rows="3"
                placeholder="Краткое описание мероприятия, его цели и особенности..."
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm leading-relaxed text-gray-900 bg-white transition-colors duration-200 resize-vertical placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Описание мероприятия"
              ></textarea>
            </div>
            
            <!-- Техническое задание -->
            <div>
              <label for="technical_task" class="block text-sm font-medium text-gray-700 mb-2">
                Техническое задание
              </label>
              <textarea
                id="technical_task"
                v-model="form.technical_task"
                rows="4"
                placeholder="Технические требования, особенности оборудования, требования к звуку, видео..."
                class="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm leading-relaxed text-gray-900 bg-white transition-colors duration-200 resize-vertical placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                aria-label="Техническое задание"
              ></textarea>
            </div>
          </div>
        </div>
        
        <!-- Ответственные инженеры -->
        <div class="py-5">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono tracking-wide">Ответственные инженеры</h3>
          <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div v-if="isUsersLoading" class="flex items-center justify-center py-8">
              <Spinner class="h-6 w-6 text-blue-600" />
              <span class="ml-2 text-gray-600">Загрузка списка инженеров...</span>
            </div>
            <div v-else-if="users.length === 0" class="text-center py-8 text-gray-500">
              Список инженеров пуст
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              <label 
                v-for="user in users" 
                :key="user.id"
                class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer transition-colors duration-200 hover:border-blue-500 hover:shadow-sm"
              >
                <input
                  type="checkbox"
                  :value="user.id"
                  v-model="form.responsible_engineers"
                  class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  :aria-label="`Инженер ${user.name}`"
                />
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-gray-900">{{ user.name }}</span>
                  <span class="text-xs text-gray-500 ml-2">({{ user.role }})</span>
                </div>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Ошибка -->
        <div v-if="hasError" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="text-sm font-medium text-red-800">{{ hasError }}</span>
          </div>
        </div>
        
        <!-- Действия -->
        <div class="flex flex-col sm:flex-row gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            @click="onClose"
            class="sm:w-auto w-full"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            :loading="isLoading"
            :disabled="isLoading"
            class="sm:w-auto w-full"
          >
            {{ isEdit ? 'Сохранить изменения' : 'Создать мероприятие' }}
          </Button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<script setup>
/**
 * EventEditor — современная форма для добавления/редактирования мероприятия
 * МИГРИРОВАНО: полностью переписан на Tailwind CSS с синей цветовой схемой
 * Все бизнес-правила, edge-cases, loading/error, ролевые ограничения, подробные комментарии
 */
import { ref, computed, watch, defineEmits, onMounted } from 'vue'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import Button from '@/shared/ui/atoms/Button.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import Modal from '@/shared/ui/molecules/Modal.vue'
import { addEvent, updateEvent } from './eventApi'

// Пропсы: event (для редактирования), visible (v-model), onSubmit, onClose
const props = defineProps({
  event: Object,
  visible: Boolean,
  onSubmit: Function,
  onClose: Function
})

const emit = defineEmits(['update:visible'])

// Управление видимостью модалки через v-model
const modalValue = computed({
  get: () => props.visible,
  set: (val) => {
    emit('update:visible', val)
    if (!val) props.onClose && props.onClose()
  }
})

const isEdit = computed(() => !!props.event)
const form = ref({
  name: '',
  organizer: '',
  location: '',
  description: '',
  technical_task: '',
  setup_date: '',
  start_date: '',
  end_date: '',
  teardown_date: '',
  responsible_engineers: []
})

const userStore = useUserStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)
const isLoading = ref(false)
const hasError = ref(null)

// При редактировании заполняем форму
watch(() => props.event, (val) => {
  if (val) {
    form.value = {
      name: val.name || '',
      organizer: val.organizer || '',
      location: val.location || '',
      description: val.description || '',
      technical_task: val.technical_task || '',
      setup_date: val.setup_date || '',
      start_date: val.start_date || '',
      end_date: val.end_date || '',
      teardown_date: val.teardown_date || '',
      responsible_engineers: Array.isArray(val.responsible_engineers) ? [...val.responsible_engineers] : []
    }
  } else {
    form.value = {
      name: '', organizer: '', location: '', description: '', technical_task: '',
      setup_date: '', start_date: '', end_date: '', teardown_date: '', responsible_engineers: []
    }
  }
}, { immediate: true })

onMounted(() => {
  if (!users.value.length) userStore.loadUsers()
})

function validate() {
  if (!form.value.name.trim()) return 'Название обязательно'
  if (!form.value.organizer.trim()) return 'Организатор обязателен'
  if (!form.value.location.trim()) return 'Локация обязательна'
  if (!form.value.start_date) return 'Дата начала мероприятия обязательна'
  return null
}

/**
 * Подготавливает данные формы для отправки в API
 * Очищает пустые строки для полей дат, чтобы избежать ошибок PostgreSQL
 */
function prepareFormData() {
  const data = { ...form.value }
  
  // Очищаем пустые строки для полей дат - PostgreSQL не принимает пустые строки для типа date
  const dateFields = ['setup_date', 'start_date', 'end_date', 'teardown_date']
  dateFields.forEach(field => {
    if (data[field] === '') {
      data[field] = null
    }
  })
  
  return data
}

async function handleSubmit() {
  const err = validate()
  if (err) {
    hasError.value = err
    return
  }
  isLoading.value = true
  hasError.value = null
  try {
    const formData = prepareFormData()
    if (isEdit.value) {
      await updateEvent(props.event.id, formData)
    } else {
      await addEvent(formData)
    }
    if (props.onSubmit) props.onSubmit()
  } catch (e) {
    hasError.value = e.message || 'Ошибка сохранения'
  } finally {
    isLoading.value = false
  }
}
</script> 