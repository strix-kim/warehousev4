<template>
  <!-- Модальное окно для добавления/редактирования оборудования -->
  <Modal 
    :model-value="show" 
    size="lg"
    @update:model-value="handleClose"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">
          {{ formTitle }}
        </h2>
        

      </div>
    </template>
    
    <template #default>
      <div class="space-y-8">
        <!-- Основная информация -->
        <EquipmentFormBasicInfo
          v-model="formData"
          :errors="errors"
          :validate-field="validateField"
        />
        
        <!-- Категоризация -->
        <EquipmentFormTechnicalInfo
          v-model="formData"
          :errors="errors"
          :categories="categories"
          :subcategories-map="subcategoriesMap"
          :validate-field="validateField"
          :on-category-change="handleCategoryChange"
        />
        
        <!-- Дополнительная информация -->
        <EquipmentFormAdditionalInfo
          v-model="formData"
          :errors="errors"
          :validate-field="validateField"
        />
        
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
                Ошибка сохранения
              </h3>
              <p class="mt-1 text-sm text-red-700">
                {{ submitError }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="space-y-3">
        <!-- Информация о черновике (сверху от кнопок) -->
        <div v-if="!isEdit && isDirty" class="flex items-center justify-center">
          <div class="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border">
            <svg class="inline w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            Черновик автоматически сохранен
          </div>
        </div>
        
        <!-- Кнопки действий -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <!-- Кнопка сброса (только для редактирования) -->
            <Button
              v-if="isEdit && isDirty"
              label="Сбросить"
              variant="secondary"
              size="sm"
              @click="resetForm"
              :disabled="loading"
            />
          </div>
          
          <div class="flex items-center space-x-3">
            <!-- Кнопка отмены -->
            <Button
              label="Отмена"
              variant="secondary"
              @click="handleClose"
              :disabled="loading"
            />
            
            <!-- Кнопка сохранения -->
            <Button
              :label="isEdit ? 'Сохранить изменения' : 'Добавить оборудование'"
              variant="primary"
              @click="handleSubmit"
              :disabled="!canSave || loading"
            />
          </div>
        </div>
      </div>
    </template>
  </Modal>
  <Modal v-if="showCloseConfirm" :model-value="showCloseConfirm" @update:modelValue="showCloseConfirm = $event" header="Подтверждение закрытия">
    <div class="p-4 text-center">
      <div class="text-lg font-semibold mb-2">Есть несохранённые изменения</div>
      <div class="text-gray-600 mb-4">Вы уверены, что хотите закрыть форму? Все несохранённые данные будут потеряны.</div>
      <div class="flex justify-center gap-4 mt-6">
        <Button label="Отмена" variant="secondary" @click="cancelClose" />
        <Button label="Закрыть без сохранения" variant="danger" @click="confirmClose" />
      </div>
    </div>
  </Modal>
</template>

<script setup>
/**
 * Основной компонент модального окна для добавления/редактирования оборудования
 * Объединяет все подкомпоненты формы, управляет состоянием и валидацией
 * Интегрирован с дизайн-системой, Pinia store и автосохранением
 */
import { ref, watch } from 'vue'
import Modal from '@/shared/ui/molecules/Modal.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import EquipmentFormBasicInfo from './EquipmentFormBasicInfo.vue'
import EquipmentFormTechnicalInfo from './EquipmentFormTechnicalInfo.vue'
import EquipmentFormAdditionalInfo from './EquipmentFormAdditionalInfo.vue'
import { useEquipmentForm } from '../composables/useEquipmentForm'

// Пропсы
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  initialData: {
    type: Object,
    default: null
  },
  categories: {
    type: Array,
    default: () => []
  },
  subcategoriesMap: {
    type: Object,
    default: () => ({})
  }
})

// События
const emit = defineEmits(['close', 'success'])

// Состояние для ошибок отправки
const submitError = ref('')

const showCloseConfirm = ref(false)

// Используем composable для управления формой
const {
  formData,
  loading,
  isDirty,
  errors,
  canSave,
  hasUnsavedChanges,
  formTitle,
  validateField,
  handleCategoryChange,
  handleSubmit: submitForm,
  resetForm,
  canClose,
  initializeForm,
  updateParams
} = useEquipmentForm(props.isEdit, props.initialData)

// Следим за открытием и сменой данных для инициализации формы
watch(
  () => [props.show, props.isEdit, props.initialData],
  ([show, isEdit, initialData], [prevShow, prevIsEdit, prevInitialData]) => {
    // Обновляем параметры в composable при изменении props
    if (show && (!prevShow || isEdit !== prevIsEdit || initialData !== prevInitialData)) {
      updateParams(isEdit, initialData)
    }
  },
  { immediate: false }
)

// Обработка отправки формы
const handleSubmit = async () => {
  submitError.value = ''
  
  const result = await submitForm()
  
  if (result.success) {
    emit('success', result.data)
    emit('close')
  } else {
    submitError.value = result.error
  }
}

// Обработка закрытия модального окна
const handleClose = () => {
  if (canClose()) {
    submitError.value = ''
    emit('close')
  } else if (hasUnsavedChanges.value) {
    showCloseConfirm.value = true
  }
}

const confirmClose = () => {
  showCloseConfirm.value = false
  submitError.value = ''
  emit('close')
}

const cancelClose = () => {
  showCloseConfirm.value = false
}
</script> 