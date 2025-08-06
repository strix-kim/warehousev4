<template>
  <!-- ✅ Модальная форма оборудования - UI Kit v2 -->
  <ModalV2
    v-model="show"
    :title="editingEquipment ? 'Редактировать оборудование' : 'Добавить оборудование'"
    :description="editingEquipment ? 'Обновите информацию об оборудовании' : 'Заполните информацию о новом оборудовании'"
    size="lg"
    variant="default"
    :loading="formLoading"
    :persistent="false"
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
          <InputV2
            v-model="formData.brand"
            label="Бренд *"
            placeholder="Введите бренд"
            :error="validationErrors.brand"
          />
          
          <InputV2
            v-model="formData.model"
            label="Модель *"
            placeholder="Введите модель"
            :error="validationErrors.model"
          />
          
          <InputV2
            v-model="formData.serialnumber"
            label="Серийный номер *"
            placeholder="Введите серийный номер"
            :error="validationErrors.serialnumber"
          />
          
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
            @click="handleClose"
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
            @click="handleSubmit"
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

// UI Kit v2
import { 
  ModalV2,
  InputV2,
  SelectV2,
  FormFieldV2,
  ButtonV2,
  IconV2
} from '@/shared/ui-v2'

// Equipment module
import { useEquipmentStore } from '@/features/equipment'
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

// === ДАННЫЕ ФОРМЫ ===
const formData = reactive({
  brand: '',
  model: '',
  serialnumber: '',
  type: '',
  subtype: '',
  location: '',
  technicalspecification: '',
  lengthinmeters: '',
  count: 1,
  availability: EQUIPMENT_STATUSES.AVAILABLE,
  description: ''
})

// === ВАЛИДАЦИЯ ===
const validationErrors = reactive({})

const isFormValid = computed(() => {
  return formData.brand?.trim() && 
         formData.model?.trim() && 
         formData.serialnumber?.trim() && 
         formData.type?.trim() && 
         formData.availability?.trim() &&
         Object.keys(validationErrors).length === 0
})

// === ОПЦИИ ДЛЯ СЕЛЕКТОВ ===
const categoryOptions = computed(() => getCategoryOptions())

const subcategoryOptions = computed(() => {
  if (!formData.type) return []
  return getSubcategoryOptions(formData.type)
})

const statusOptions = computed(() => getStatusOptions())

// === МЕТОДЫ ===

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
    } else {
      formData[key] = ''
    }
  })
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

  // Проверка уникальности серийного номера
  const existingEquipment = equipmentStore.equipments.find(e => 
    e.serialnumber === formData.serialnumber && 
    e.id !== editingEquipment.value?.id
  )
  
  if (existingEquipment) {
    validationErrors.serialnumber = 'Серийный номер уже существует'
    isValid = false
  }

  return isValid
}

// Обработчики
const handleCategoryChange = (category) => {
  formData.subtype = '' // Сбрасываем подкатегорию при смене категории
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  formLoading.value = true
  formError.value = null

  try {
    const equipmentData = { ...formData }
    
    if (editingEquipment.value) {
      // Обновление
      await equipmentStore.updateEquipment(editingEquipment.value.id, equipmentData)
    } else {
      // Создание
      await equipmentStore.createEquipment(equipmentData)
    }

    emit('saved')
    handleClose()
  } catch (error) {
    formError.value = error.message || 'Ошибка сохранения оборудования'
  } finally {
    formLoading.value = false
  }
}

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
</script>