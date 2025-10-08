<template>
  <!-- ✅ Модальная форма оборудования - UI Kit v2 -->
  <ModalV2
    ref="modalRef"
    v-model="show"
    :title="editingEquipment ? 'Редактировать оборудование' : 'Добавить оборудование'"
    :description="editingEquipment ? 'Обновите информацию об оборудовании' : 'Заполните информацию о новом оборудовании'"
    size="lg"
    variant="default"
    :loading="formLoading"
    :persistent="false"
    :require-close-confirm="shouldConfirmClose"
    confirm-close-title="Подтвердите закрытие"
    confirm-close-message="Несохранённые изменения будут потеряны. Вы действительно хотите закрыть форму?"
    confirm-close-confirm-text="Да, закрыть"
    confirm-close-cancel-text="Остаться"
    scrollable
    @close="handleClose"
  >
    <!-- ✅ Содержимое формы -->
    <div class="space-y-6 pb-6">
      <!-- Error Message -->
      <div v-if="formError" class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center gap-2">
          <IconV2 name="alert-circle" size="sm" color="error" />
          <span class="text-sm text-red-700">{{ formError }}</span>
        </div>
      </div>

      <!-- Основная информация -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-semibold text-primary mb-4">Основная информация</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-2">Бренд *</label>
            <SearchInputV2
              v-model="formData.brand"
              placeholder="Начните вводить бренд"
              :results="brandSuggestions"
              :loading="brandLoading"
              :min-search-length="3"
              :max-results="7"
              @search="handleBrandSearch"
              @select="handleBrandSelect"
              @clear="handleBrandClear"
            />
            <p v-if="validationErrors.brand" class="text-error text-sm mt-1">{{ validationErrors.brand }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-2">Модель *</label>
            <SearchInputV2
              v-model="formData.model"
              placeholder="Начните вводить модель"
              :results="modelSuggestions"
              :loading="modelLoading"
              :min-search-length="3"
              :max-results="7"
              @search="handleModelSearch"
              @select="handleModelSelect"
              @clear="handleModelClear"
            />
            <p v-if="validationErrors.model" class="text-error text-sm mt-1">{{ validationErrors.model }}</p>
          </div>
          
          <div class="space-y-3">
            <!-- Checkbox для автогенерации -->
            <FormFieldV2
              v-model="autoGenerateSerial"
              type="checkbox"
              checkbox-label="Автогенерировать серийный номер"
              helper-text="Создаст уникальный серийный номер в формате AUTO-ДДММГГ-ЧЧММСС"
            />
            
            <!-- Поле серийного номера -->
            <InputV2
              v-model="formData.serialnumber"
              label="Серийный номер *"
              :placeholder="autoGenerateSerial ? 'Номер сгенерируется автоматически' : 'Введите серийный номер'"
              :error="validationErrors.serialnumber"
              :disabled="autoGenerateSerial"
              :helper-text="autoGenerateSerial ? 'Формат: AUTO-ДДММГГ-ЧЧММСС (например, AUTO-251208-143022)' : 'Уникальный серийный номер оборудования'"
            />
          </div>
          
          <SelectV2
            v-model="formData.type"
            label="Категория *"
            placeholder="Выберите категорию"
            :options="categoryOptions"
            :error="validationErrors.type"
            @update:model-value="handleCategoryChange"
          />
          
          <SelectV2
            v-model="formData.subtype"
            label="Подкатегория *"
            placeholder="Выберите подкатегорию"
            :options="subcategoryOptions"
            :disabled="!formData.type"
            :error="validationErrors.subtype"
          />
          
          <SelectV2
            v-model="formData.availability"
            label="Статус *"
            placeholder="Выберите статус"
            :options="statusOptions"
            :error="validationErrors.availability"
          />
        </div>
      </div>

      <!-- Местоположение и количество -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-semibold text-primary mb-4">Местоположение и количество</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputV2
            v-model="formData.location"
            label="Местоположение"
            placeholder="Укажите местоположение"
            :error="validationErrors.location"
          />
          
          <InputV2
            v-model="formData.count"
            label="Количество"
            placeholder="1"
            type="number"
            min="1"
            :error="validationErrors.count"
          />
          
          <InputV2
            v-model="formData.lengthinmeters"
            label="Длина (метры)"
            placeholder="Для кабелей и проводов"
            type="number"
            step="0.1"
          />
        </div>
      </div>

      <!-- Дополнительная информация -->
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <h3 class="text-lg font-semibold text-primary mb-4">Дополнительная информация</h3>
        <div class="space-y-4">
                      <FormFieldV2
              v-model="formData.technicalspecification"
              label="Технические характеристики"
              placeholder="Укажите основные технические характеристики"
              type="textarea"
              :rows="3"
            />
            
            <FormFieldV2
              v-model="formData.description"
              label="Описание"
              placeholder="Краткое описание оборудования"
              type="textarea"
              :rows="2"
            />
        </div>
      </div>
    </div>

    <!-- ✅ Footer с кнопками -->
    <template #footer>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
        <!-- Левая сторона: Удаление (на мобильных вверху) -->
        <div class="flex justify-center sm:justify-start">
          <ButtonV2
            v-if="editingEquipment"
            variant="danger"
            size="sm"
            class="w-full sm:w-auto"
            :loading="formLoading"
            @click="handleDelete"
          >
            <template #icon>
              <IconV2 name="trash-2" size="xs" />
            </template>
            Удалить
          </ButtonV2>
        </div>
        
        <!-- Правая сторона: Основные действия -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <ButtonV2
            variant="ghost"
            size="sm"
            class="w-full sm:w-auto"
            @click="handleRequestClose"
            :disabled="formLoading"
          >
            Отмена
          </ButtonV2>
          
          <ButtonV2
            variant="secondary"
            size="sm"
            class="w-full sm:w-auto"
            @click="handleReset"
            :disabled="formLoading"
          >
            Сбросить
          </ButtonV2>
          
          <ButtonV2
            variant="primary"
            size="sm"
            class="w-full sm:w-auto"
            :loading="formLoading"
            :disabled="!isFormValid || formLoading"
            @click="debouncedHandleSubmit"
          >
            <template #icon>
              <IconV2 name="save" size="xs" />
            </template>
            {{ editingEquipment ? 'Обновить' : 'Создать' }}
          </ButtonV2>
        </div>
      </div>
    </template>
  </ModalV2>
</template>

<script setup>
/**
 * EquipmentFormModal - EPR System
 * 
 * Модальная форма добавления/редактирования оборудования
 * Использует UI Kit v2 и современные паттерны
 */

import { ref, reactive, computed, watch, nextTick } from 'vue'
import { debounce } from 'lodash-es'

// UI Kit v2
import { 
  ModalV2,
  InputV2,
  SearchInputV2,
  SelectV2,
  FormFieldV2,
  ButtonV2,
  IconV2
} from '@/shared/ui-v2'

// Equipment module
import { useEquipmentStore } from '@/features/equipment'
import { equipmentApi } from '@/features/equipment/api/equipment-api.js'
import { 
  EQUIPMENT_CATEGORIES, 
  getCategoryOptions, 
  getSubcategoryOptions,
  EQUIPMENT_STATUSES,
  getStatusOptions
} from '@/features/equipment'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  equipment: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'saved', 'deleted', 'close'])

// === STORE ===
const equipmentStore = useEquipmentStore()

// === СОСТОЯНИЕ ===
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const editingEquipment = computed(() => props.equipment)
const formLoading = ref(false)
const formError = ref(null)
const modalRef = ref(null)

// === ДАННЫЕ ФОРМЫ ===
const formData = reactive({
  brand: '',
  model: '',
  serialnumber: '',
  type: '',
  subtype: '',
  location: 'Офис',
  technicalspecification: '',
  lengthinmeters: '',
  count: 1,
  availability: EQUIPMENT_STATUSES.AVAILABLE,
  description: ''
})

// === АВТОГЕНЕРАЦИЯ СЕРИЙНОГО НОМЕРА ===
const autoGenerateSerial = ref(false)

// === ВАЛИДАЦИЯ ===
const validationErrors = reactive({})

// === ПОДСКАЗКИ ДЛЯ ПОЛЕЙ ===
const brandSuggestions = ref([])
const brandLoading = ref(false)
const modelSuggestions = ref([])
const modelLoading = ref(false)

// Флаг наличия несохранённых изменений
const hasUnsavedChanges = computed(() => {
  if (!editingEquipment.value) {
    // Создание: считаем изменённым, если есть хоть одно заполненное обязательное поле
    return !!(formData.brand || formData.model || formData.serialnumber || formData.type || formData.subtype || formData.location || formData.description || formData.technicalspecification || formData.count !== 1 || formData.lengthinmeters)
  }
  // Редактирование: сравниваем текущие значения с исходными
  const original = editingEquipment.value || {}
  return Object.keys(formData).some((key) => {
    return (formData[key] ?? '') !== (original[key] ?? (key === 'count' ? 1 : ''))
  })
})

// Требовать подтверждение закрытия только если есть несохранённые изменения
const shouldConfirmClose = computed(() => hasUnsavedChanges.value)

const isFormValid = computed(() => {
  const hasRequiredFields = formData.brand?.trim() && 
                           formData.model?.trim() && 
                           (autoGenerateSerial.value || formData.serialnumber?.trim()) && // серийник не нужен если автогенерация
                           formData.type?.trim() && 
                           formData.availability?.trim()
  
  const hasNoErrors = Object.keys(validationErrors).length === 0
  
  const isValid = hasRequiredFields && hasNoErrors
  
  console.log('🔍 [FormModal] Form validation check:', {
    hasRequiredFields,
    hasNoErrors,
    isValid,
    autoGenerate: autoGenerateSerial.value,
    errors: Object.keys(validationErrors),
    serialnumber: formData.serialnumber
  })
  
  return isValid
})

// === ОПЦИИ ДЛЯ СЕЛЕКТОВ ===
const categoryOptions = computed(() => getCategoryOptions())

const subcategoryOptions = computed(() => {
  if (!formData.type) return []
  return getSubcategoryOptions(formData.type)
})

const statusOptions = computed(() => getStatusOptions())

// === МЕТОДЫ ===

// Генерация автоматического серийного номера
const generateSerialNumber = () => {
  const now = new Date()
  const dateStr = now.getFullYear().toString().slice(-2) + // 24 (для 2024)
                  String(now.getMonth() + 1).padStart(2, '0') + // 01-12
                  String(now.getDate()).padStart(2, '0') // 01-31
  const timeStr = String(now.getHours()).padStart(2, '0') +
                  String(now.getMinutes()).padStart(2, '0') +
                  String(now.getSeconds()).padStart(2, '0')
  
  return `AUTO-${dateStr}-${timeStr}`
}

// Инициализация формы
const initializeForm = () => {
  console.log('🔄 [FormModal] Initializing form, editing:', !!editingEquipment.value, editingEquipment.value?.id)
  clearErrors()
  
  if (editingEquipment.value && Object.keys(editingEquipment.value).length > 0) {
    // Заполняем форму данными для редактирования
    console.log('📝 [FormModal] Filling form with equipment data:', editingEquipment.value)
    
    Object.keys(formData).forEach(key => {
      if (editingEquipment.value[key] !== undefined) {
        formData[key] = editingEquipment.value[key] || ''
      }
    })
    
    // Убеждаемся что числовые поля корректно заполнены
    if (typeof editingEquipment.value.count === 'number') {
      formData.count = editingEquipment.value.count
    } else if (editingEquipment.value.count) {
      formData.count = parseInt(editingEquipment.value.count) || 1
    }
    
    if (typeof editingEquipment.value.lengthinmeters === 'number') {
      formData.lengthinmeters = editingEquipment.value.lengthinmeters
    } else if (editingEquipment.value.lengthinmeters) {
      formData.lengthinmeters = parseFloat(editingEquipment.value.lengthinmeters) || ''
    }
    
    console.log('✅ [FormModal] Form filled:', formData)
  } else {
    // Очищаем форму для создания нового
    console.log('🆕 [FormModal] Resetting form for new equipment')
    resetForm()
  }
}

// Сброс формы
const resetForm = () => {
  console.log('🧹 [FormModal] Resetting form to defaults')
  Object.keys(formData).forEach(key => {
    if (key === 'count') {
      formData[key] = 1
    } else if (key === 'availability') {
      formData[key] = EQUIPMENT_STATUSES.AVAILABLE
    } else if (key === 'location') {
      formData[key] = 'Офис'
    } else {
      formData[key] = ''
    }
  })
  autoGenerateSerial.value = false
  clearErrors()
}

// Очистка ошибок
const clearErrors = () => {
  formError.value = null
  Object.keys(validationErrors).forEach(key => {
    delete validationErrors[key]
  })
}

// Валидация формы
const validateForm = () => {
  clearErrors()
  let isValid = true

  // Обязательные поля
  const requiredFields = {
    brand: 'Бренд обязателен',
    model: 'Модель обязательна',
    serialnumber: 'Серийный номер обязателен',
    type: 'Категория обязательна',
    subtype: 'Подкатегория обязательна',
    availability: 'Статус обязателен'
  }

  Object.entries(requiredFields).forEach(([field, message]) => {
    if (!formData[field]?.trim()) {
      validationErrors[field] = message
      isValid = false
    }
  })

  // Проверка количества
  if (formData.count < 1) {
    validationErrors.count = 'Количество должно быть больше 0'
    isValid = false
  }

  // Проверка уникальности серийного номера (только если не автогенерируется)
  if (!autoGenerateSerial.value && formData.serialnumber?.trim()) {
    const existingEquipment = equipmentStore.equipments.find(e => 
      e.serialnumber === formData.serialnumber && 
      e.id !== editingEquipment.value?.id
    )
    
    if (existingEquipment) {
      validationErrors.serialnumber = 'Серийный номер уже существует'
      isValid = false
    }
  }

  return isValid
}

// Обработчики
const handleCategoryChange = (category) => {
  formData.subtype = '' // Сбрасываем подкатегорию при смене категории
}

const handleSubmit = async () => {
  console.log('🚀 [FormModal] Starting submit process...')
  
  if (!validateForm()) {
    console.log('❌ [FormModal] Validation failed, aborting submit')
    return
  }

  console.log('✅ [FormModal] Validation passed, proceeding with submit')
  console.log('📄 [FormModal] Form data:', formData)
  
  // Проверяем, не выполняется ли уже запрос
  if (formLoading.value) {
    console.log('⚠️ [FormModal] Submit already in progress, ignoring')
    return
  }

  formLoading.value = true
  formError.value = null
  console.log('🔄 [FormModal] Set loading state to true')

  try {
    const equipmentData = { ...formData }
    
    // Генерируем серийный номер если включена автогенерация
    if (autoGenerateSerial.value) {
      equipmentData.serialnumber = generateSerialNumber()
      console.log('🤖 [FormModal] Auto-generated serial number:', equipmentData.serialnumber)
    }
    
    console.log('📦 [FormModal] Prepared equipment data:', equipmentData)
    
    if (editingEquipment.value) {
      // Обновление
      console.log('📝 [FormModal] Updating existing equipment:', editingEquipment.value.id)
      await equipmentStore.updateEquipment(editingEquipment.value.id, equipmentData)
      console.log('✅ [FormModal] Equipment updated successfully')
    } else {
      // Создание
      console.log('➕ [FormModal] Creating new equipment')
      const result = await equipmentStore.createEquipment(equipmentData)
      console.log('✅ [FormModal] Equipment created successfully:', result)
    }

    console.log('📢 [FormModal] Emitting saved event')
    emit('saved')
    console.log('🚪 [FormModal] Closing modal')
    handleClose()
  } catch (error) {
    console.error('❌ [FormModal] Submit error:', error)
    console.error('❌ [FormModal] Error stack:', error.stack)
    formError.value = error.message || 'Ошибка сохранения оборудования'
    console.log('🚨 [FormModal] Set form error:', formError.value)
  } finally {
    console.log('🏁 [FormModal] Submit process finished, setting loading to false')
    formLoading.value = false
  }
}

// Создаем debounced версию для защиты от повторных нажатий
const debouncedHandleSubmit = debounce(handleSubmit, 300, { 
  leading: true, 
  trailing: false 
})

const handleDelete = async () => {
  if (!editingEquipment.value) return
  
  // Эмитим событие для показа модалки подтверждения
  emit('deleted', editingEquipment.value)
}

const handleReset = () => {
  resetForm()
}

const handleClose = () => {
  console.log('❌ [FormModal] Closing modal')
  show.value = false
  emit('close')
}

// Запрос закрытия с учётом подтверждения
const handleRequestClose = () => {
  if (shouldConfirmClose.value) {
    modalRef.value?.requestClose?.()
  } else {
    handleClose()
  }
}

// === ОБРАБОТЧИКИ АВТОКОМПЛИТА ===
const handleBrandSearch = async (query) => {
  if (!query || query.trim().length < 3) {
    brandSuggestions.value = []
    return
  }
  brandLoading.value = true
  try {
    const items = await equipmentApi.getBrandSuggestions(query, 7)
    brandSuggestions.value = items.map(text => ({ label: text, value: text, icon: 'package' }))
  } catch (e) {
    brandSuggestions.value = []
  } finally {
    brandLoading.value = false
  }
}

const handleBrandSelect = ({ value }) => {
  formData.brand = value
}

const handleBrandClear = () => {
  brandSuggestions.value = []
}

const handleModelSearch = async (query) => {
  if (!query || query.trim().length < 3) {
    modelSuggestions.value = []
    return
  }
  modelLoading.value = true
  try {
    const items = await equipmentApi.getModelSuggestions(query, formData.brand || null, 7)
    modelSuggestions.value = items.map(text => ({ label: text, value: text, icon: 'package' }))
  } catch (e) {
    modelSuggestions.value = []
  } finally {
    modelLoading.value = false
  }
}

const handleModelSelect = ({ value }) => {
  formData.model = value
}

const handleModelClear = () => {
  modelSuggestions.value = []
}

// === WATCHERS ===
watch(() => show.value, (newValue) => {
  if (newValue) {
    // Используем nextTick для корректного timing
    nextTick(() => {
      initializeForm()
    })
  }
})

watch(() => props.equipment, (newEquipment, oldEquipment) => {
  // Инициализируем только если модальное окно открыто и equipment действительно изменился
  if (show.value && newEquipment !== oldEquipment) {
    console.log('🔄 [FormModal] Equipment prop changed, re-initializing')
    nextTick(() => {
      initializeForm()
    })
  }
}, { 
  deep: true,
  flush: 'post' // Выполняем после DOM обновлений
})

// Мониторинг состояния store для диагностики
watch(() => equipmentStore.loading, (newLoading, oldLoading) => {
  if (newLoading !== oldLoading) {
    console.log('🔍 [FormModal] Store loading state changed:', { 
      from: oldLoading, 
      to: newLoading,
      modalLoading: formLoading.value 
    })
  }
})

watch(() => equipmentStore.error, (newError) => {
  if (newError) {
    console.error('🚨 [FormModal] Store error detected:', newError)
  }
})

// === АВТОМАТИЧЕСКАЯ ОЧИСТКА ОШИБОК ВАЛИДАЦИИ ===
// При изменении ключевых полей очищаем соответствующие ошибки
watch(() => formData.brand, () => {
  if (validationErrors.brand) {
    console.log('🧹 [FormModal] Clearing brand validation error')
    delete validationErrors.brand
  }
})

watch(() => formData.model, () => {
  if (validationErrors.model) {
    console.log('🧹 [FormModal] Clearing model validation error')
    delete validationErrors.model
  }
})

watch(() => formData.serialnumber, (newValue) => {
  if (validationErrors.serialnumber) {
    console.log('🧹 [FormModal] Clearing serialnumber validation error for:', newValue)
    delete validationErrors.serialnumber
  }
})

watch(() => formData.type, () => {
  if (validationErrors.type) {
    console.log('🧹 [FormModal] Clearing type validation error')
    delete validationErrors.type
  }
})

watch(() => formData.subtype, () => {
  if (validationErrors.subtype) {
    console.log('🧹 [FormModal] Clearing subtype validation error')
    delete validationErrors.subtype
  }
})

watch(() => formData.availability, () => {
  if (validationErrors.availability) {
    console.log('🧹 [FormModal] Clearing availability validation error')
    delete validationErrors.availability
  }
})

watch(() => formData.count, () => {
  if (validationErrors.count) {
    console.log('🧹 [FormModal] Clearing count validation error')
    delete validationErrors.count
  }
})

// === WATCHER ДЛЯ АВТОГЕНЕРАЦИИ ===
watch(autoGenerateSerial, (newValue) => {
  if (newValue) {
    // При включении автогенерации - генерируем номер для предпросмотра
    formData.serialnumber = generateSerialNumber()
    console.log('🤖 [FormModal] Auto-generation enabled, generated:', formData.serialnumber)
    
    // Очищаем ошибки серийного номера
    if (validationErrors.serialnumber) {
      delete validationErrors.serialnumber
    }
  } else {
    // При выключении автогенерации - очищаем поле
    formData.serialnumber = ''
    console.log('🔄 [FormModal] Auto-generation disabled, cleared serial number')
  }
})
</script>