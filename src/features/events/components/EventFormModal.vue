<template>
  <!--
    EventFormModal.vue — современное модальное окно для создания мероприятия
    Архитектурная роль: форма создания мероприятий, интегрирована с дизайн-системой
    Поддерживает: валидацию, loading состояния, accessibility, responsive design
    ИСПРАВЛЕНО: использует только Tailwind CSS, синюю цветовую схему
  -->
  <Modal 
    v-model="showModal" 
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
        <h2 class="text-xl font-semibold text-gray-900">
          Создать новое мероприятие
        </h2>
      </div>
    </template>
    
    <template #default>
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Основная информация -->
        <div class="py-5 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono">Основная информация</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Название мероприятия -->
            <FormField 
              label="Название мероприятия" 
              :error="errors.name"
              required
              class="md:col-span-2"
            >
              <Input
                v-model="formData.name"
                placeholder="Например: Международная конференция по ИТ"
                :variant="errors.name ? 'error' : 'default'"
                @blur="validateField('name')"
              />
            </FormField>
            
            <!-- Организатор -->
            <FormField 
              label="Организатор" 
              :error="errors.organizer"
              required
            >
              <Input
                v-model="formData.organizer"
                placeholder="Название организации"
                :variant="errors.organizer ? 'error' : 'default'"
                @blur="validateField('organizer')"
              />
            </FormField>
            
            <!-- Локация -->
            <FormField 
              label="Локация" 
              :error="errors.location"
              required
            >
              <Input
                v-model="formData.location"
                placeholder="Место проведения"
                :variant="errors.location ? 'error' : 'default'"
                @blur="validateField('location')"
              />
            </FormField>
          </div>
        </div>
        
        <!-- Даты -->
        <div class="py-5 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono">Календарный план</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Дата начала мероприятия -->
            <FormField 
              label="Дата начала мероприятия" 
              :error="errors.start_date"
              required
            >
              <Input
                v-model="formData.start_date"
                type="date"
                :variant="errors.start_date ? 'error' : 'default'"
                @blur="validateField('start_date')"
              />
            </FormField>
            
            <!-- Дата окончания мероприятия -->
            <FormField 
              label="Дата окончания мероприятия" 
              :error="errors.end_date"
            >
              <Input
                v-model="formData.end_date"
                type="date"
                :variant="errors.end_date ? 'error' : 'default'"
                @blur="validateField('end_date')"
              />
            </FormField>
            
            <!-- Дата начала монтажа -->
            <FormField 
              label="Дата начала монтажа" 
              :error="errors.setup_date"
              helper="Когда начинается подготовка"
            >
              <Input
                v-model="formData.setup_date"
                type="date"
                :variant="errors.setup_date ? 'error' : 'default'"
                @blur="validateField('setup_date')"
              />
            </FormField>
            
            <!-- Дата окончания демонтажа -->
            <FormField 
              label="Дата окончания демонтажа" 
              :error="errors.teardown_date"
              helper="Когда завершается разборка"
            >
              <Input
                v-model="formData.teardown_date"
                type="date"
                :variant="errors.teardown_date ? 'error' : 'default'"
                @blur="validateField('teardown_date')"
              />
            </FormField>
          </div>
        </div>
        
        <!-- Дополнительная информация -->
        <div class="py-5 border-b border-gray-100">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono">Дополнительная информация</h3>
          <div class="space-y-4">
            <!-- Описание -->
            <FormField 
              label="Описание мероприятия" 
              :error="errors.description"
            >
              <textarea
                v-model="formData.description"
                rows="3"
                :class="[
                  'w-full border border-gray-300 rounded-lg px-4 py-3 text-sm leading-relaxed text-gray-900 bg-white',
                  'transition-colors duration-200 resize-vertical placeholder:text-gray-500',
                  'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                  { 'border-red-300 focus:border-red-500 focus:ring-red-500/20': errors.description }
                ]"
                placeholder="Краткое описание мероприятия, его цели и особенности..."
                @blur="validateField('description')"
              ></textarea>
            </FormField>
            
            <!-- Техническое задание -->
            <FormField 
              label="Техническое задание" 
              :error="errors.technical_task"
            >
              <textarea
                v-model="formData.technical_task"
                rows="4"
                :class="[
                  'w-full border border-gray-300 rounded-lg px-4 py-3 text-sm leading-relaxed text-gray-900 bg-white',
                  'transition-colors duration-200 resize-vertical placeholder:text-gray-500',
                  'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                  { 'border-red-300 focus:border-red-500 focus:ring-red-500/20': errors.technical_task }
                ]"
                placeholder="Технические требования, особенности оборудования, требования к звуку, видео..."
                @blur="validateField('technical_task')"
              ></textarea>
            </FormField>
          </div>
        </div>
        
        <!-- Ответственные инженеры -->
        <div class="py-5">
          <h3 class="text-base font-semibold text-gray-900 mb-4 font-mono">Ответственные инженеры</h3>
          <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div v-if="usersLoading" class="flex items-center justify-center py-8">
              <Spinner class="h-6 w-6 text-blue-600" />
              <span class="ml-2 text-gray-600">Загрузка списка инженеров...</span>
            </div>
            <div v-else-if="users.length === 0" class="text-center py-8 text-gray-500">
              Список инженеров пуст
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label 
                v-for="user in users" 
                :key="user.id"
                class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer transition-colors duration-200 hover:border-blue-500 hover:shadow-sm"
              >
                <input
                  type="checkbox"
                  :value="user.id"
                  v-model="formData.responsible_engineers"
                  class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <div class="flex-1 flex flex-col gap-0.5">
                  <span class="text-sm font-medium text-gray-900">{{ user.name }}</span>
                  <span class="text-xs text-gray-600 capitalize">{{ user.role }}</span>
                </div>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Общие ошибки -->
        <div v-if="submitError" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">
                Ошибка создания мероприятия
              </h3>
              <p class="mt-1 text-sm text-red-700">
                {{ submitError }}
              </p>
            </div>
          </div>
        </div>
      </form>
    </template>
    
    <template #footer>
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500">
          * — обязательные поля
        </div>
        
        <div class="flex items-center space-x-3">
          <!-- Кнопка отмены -->
          <Button
            label="Отмена"
            variant="secondary"
            @click="handleClose"
            :disabled="loading"
          />
          
          <!-- Кнопка создания -->
          <Button
            label="Создать мероприятие"
            variant="primary"
            @click="handleSubmit"
            :disabled="!canSave || loadingCreate"
            :loading="loadingCreate"
          />
          
          <!-- Отображение ошибок создания -->
          <div v-if="createError || submitError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div class="text-red-700 text-sm">
              {{ createError || submitError }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
/**
 * EventFormModal — модальное окно для создания нового мероприятия
 * Интегрирован с дизайн-системой, валидацией и управлением состоянием
 * ИСПРАВЛЕНО: только Tailwind CSS, синяя цветовая схема
 */
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/app/store/user-store'
import { useEventStore } from '@/features/events/store/event-store'
import Modal from '@/shared/ui/molecules/Modal.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import Input from '@/shared/ui/atoms/Input.vue'
import FormField from '@/shared/ui/molecules/FormField.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'

// Пропсы
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

// События
const emit = defineEmits(['update:show', 'success', 'close'])

// Stores
const userStore = useUserStore()
const eventStore = useEventStore()
const { users, loading: usersLoading } = storeToRefs(userStore)
const { loadingCreate, createError } = storeToRefs(eventStore)

// Состояние формы
const formData = ref(getInitialFormData())
const loading = ref(false)
const errors = ref({})
const submitError = ref('')

// Computed свойства
const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const canSave = computed(() => {
  return formData.value.name?.trim() && 
         formData.value.organizer?.trim() && 
         formData.value.location?.trim() &&
         formData.value.start_date &&
         !Object.keys(errors.value).some(key => errors.value[key])
})

// Методы
function getInitialFormData() {
  return {
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
  }
}

function validateField(fieldName) {
  const value = formData.value[fieldName]
  
  // Очищаем предыдущую ошибку
  errors.value[fieldName] = null
  
  switch (fieldName) {
    case 'name':
      if (!value?.trim()) {
        errors.value.name = 'Название мероприятия обязательно'
      } else if (value.length < 3) {
        errors.value.name = 'Название должно содержать минимум 3 символа'
      } else if (value.length > 200) {
        errors.value.name = 'Название не должно превышать 200 символов'
      }
      break
      
    case 'organizer':
      if (!value?.trim()) {
        errors.value.organizer = 'Организатор обязателен'
      } else if (value.length > 100) {
        errors.value.organizer = 'Название организатора не должно превышать 100 символов'
      }
      break
      
    case 'location':
      if (!value?.trim()) {
        errors.value.location = 'Локация обязательна'
      } else if (value.length > 150) {
        errors.value.location = 'Название локации не должно превышать 150 символов'
      }
      break
      
    case 'start_date':
      if (!value) {
        errors.value.start_date = 'Дата начала мероприятия обязательна'
      }
      break
      
    case 'end_date':
      if (value && formData.value.start_date && new Date(value) < new Date(formData.value.start_date)) {
        errors.value.end_date = 'Дата окончания не может быть раньше даты начала'
      }
      break
      
    case 'setup_date':
      if (value && formData.value.start_date && new Date(value) > new Date(formData.value.start_date)) {
        errors.value.setup_date = 'Дата начала монтажа не может быть позже даты начала мероприятия'
      }
      break
      
    case 'teardown_date':
      const endDate = formData.value.end_date || formData.value.start_date
      if (value && endDate && new Date(value) < new Date(endDate)) {
        errors.value.teardown_date = 'Дата окончания демонтажа не может быть раньше даты окончания мероприятия'
      }
      break
  }
}

function validateForm() {
  // Валидируем все обязательные поля
  validateField('name')
  validateField('organizer')
  validateField('location')
  validateField('start_date')
  validateField('end_date')
  validateField('setup_date')
  validateField('teardown_date')
  
  return !Object.keys(errors.value).some(key => errors.value[key])
}

async function handleSubmit() {
  if (!validateForm()) return
  
  // Очищаем предыдущие ошибки
  eventStore.clearError('createError')
  submitError.value = ''
  
  try {
    await eventStore.createEvent(formData.value)
    
    // Успешное создание
    emit('success')
    emit('update:show', false)
    resetForm()
  } catch (error) {
    // Ошибка уже сохранена в createError store
    submitError.value = error.message || 'Произошла ошибка при создании мероприятия'
  }
}

function handleClose() {
  emit('update:show', false)
  emit('close')
}

function resetForm() {
  formData.value = getInitialFormData()
  errors.value = {}
  submitError.value = ''
}

// Следим за изменениями даты начала для валидации связанных дат
watch(() => formData.value.start_date, () => {
  if (formData.value.end_date) validateField('end_date')
  if (formData.value.setup_date) validateField('setup_date')
})

watch(() => formData.value.end_date, () => {
  if (formData.value.teardown_date) validateField('teardown_date')
})

// Загружаем пользователей при монтировании
onMounted(() => {
  if (!users.value.length) {
    userStore.loadUsers()
  }
})

// Сбрасываем форму при закрытии
watch(() => props.show, (newShow) => {
  if (!newShow) {
    resetForm()
  }
})
</script> 