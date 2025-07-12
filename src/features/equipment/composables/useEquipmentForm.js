/**
 * Composable для управления формой оборудования
 * Интегрируется с Pinia store, валидацией и автосохранением
 */
import { ref, computed, watch } from 'vue'
import { useEquipmentStore } from '@/stores/equipment-store'
import { useFormValidation } from '@/shared/composables/useFormValidation'
import { useLocalStorage } from '@/shared/composables/useLocalStorage'
import { 
  equipmentValidationRules, 
  getInitialFormData, 
  hasFormChanges 
} from '../utils/equipmentValidationRules'

export function useEquipmentForm(isEdit = false, initialData = null) {
  const equipmentStore = useEquipmentStore()
  
  // Используем ref для более надежного отслеживания параметров
  const isEditRef = ref(isEdit)
  const initialDataRef = ref(initialData)
  
  // Основное состояние формы
  const formData = ref(getInitialFormData(initialData))
  const loading = ref(false)
  const isDirty = ref(false)
  const originalData = ref(initialData ? { ...initialData } : null)
  
  // Валидация
  const { errors, validateField, validateForm, clearErrors, hasErrors } = useFormValidation(equipmentValidationRules)
  
  // Реактивный ключ для автосохранения черновиков
  const draftKey = computed(() => 
    `equipment-form-draft-${isEditRef.value ? initialDataRef.value?.id || 'new' : 'new'}`
  )
  
  // Автосохранение черновиков (только для новых записей)
  const { save: saveDraft, load: loadDraft, clear: clearDraft } = useLocalStorage(draftKey)
  
  // Computed свойства
  const canSave = computed(() => {
    return !loading.value && 
           formData.value.model?.trim() && 
           formData.value.brand?.trim() && 
           formData.value.serial_number?.trim() &&
           formData.value.category?.trim() &&
           formData.value.subcategory?.trim() &&
           formData.value.location?.trim() &&
           !hasErrors()
  })
  
  const hasUnsavedChanges = computed(() => {
    return isDirty.value && hasFormChanges(formData.value, originalData.value)
  })
  
  const formTitle = computed(() => {
    return isEditRef.value ? 'Редактировать оборудование' : 'Добавить оборудование'
  })
  
  // Функция для обновления параметров извне
  const updateParams = (newIsEdit, newInitialData) => {
    isEditRef.value = newIsEdit
    initialDataRef.value = newInitialData
    
    // Переинициализируем форму с новыми данными
    initializeForm()
  }
  
  // Методы
  
  /**
   * Инициализация формы
   */
  const initializeForm = () => {
    if (isEditRef.value && initialDataRef.value) {
      formData.value = getInitialFormData(initialDataRef.value)
      originalData.value = { ...initialDataRef.value }
      isDirty.value = false
    } else {
      // Попытка загрузить черновик для новых записей
      const draft = loadDraft()
      if (draft && Object.keys(draft).length > 0) {
        formData.value = { ...getInitialFormData(), ...draft }
        isDirty.value = true
      } else {
        formData.value = getInitialFormData()
        isDirty.value = false
      }
      originalData.value = null
    }
    clearErrors()
  }
  
  /**
   * Валидация отдельного поля с задержкой
   */
  const validateFieldDebounced = (fieldName, value) => {
    // Небольшая задержка для лучшего UX
    setTimeout(() => {
      validateField(fieldName, value)
    }, 300)
  }
  
  /**
   * Обработка изменения категории
   */
  const handleCategoryChange = () => {
    // Сбрасываем подкатегорию при смене категории
    formData.value.subcategory = ''
    validateField('category', formData.value.category)
  }
  
  /**
   * Сохранение формы
   */
  const handleSubmit = async () => {
    // Валидация всей формы
    if (!validateForm(formData.value)) {
      return { success: false, error: 'Пожалуйста, исправьте ошибки в форме' }
    }
    
    loading.value = true
    try {
      let result
      
      if (isEditRef.value && initialDataRef.value?.id) {
        // Обновление существующего оборудования
        result = await equipmentStore.updateEquipmentById(initialDataRef.value.id, formData.value)
      } else {
        // Создание нового оборудования
        result = await equipmentStore.createEquipment(formData.value)
      }
      
      if (result.success) {
        // Очищаем черновик после успешного сохранения
        clearDraft()
        isDirty.value = false
        originalData.value = { ...formData.value }
        
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.error || 'Ошибка сохранения' }
      }
    } catch (error) {
      console.error('Ошибка сохранения оборудования:', error)
      return { success: false, error: error.message || 'Произошла ошибка при сохранении' }
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Сохранение черновика
   */
  const handleSaveDraft = () => {
    if (!isEditRef.value && hasUnsavedChanges.value) {
      saveDraft(formData.value)
    }
  }
  
  /**
   * Сброс формы
   */
  const resetForm = () => {
    formData.value = getInitialFormData(isEditRef.value ? initialDataRef.value : null)
    clearErrors()
    isDirty.value = false
    if (!isEditRef.value) {
      clearDraft()
    }
  }
  
  /**
   * Проверка на наличие несохраненных изменений перед закрытием
   */
  const canClose = () => {
    return !hasUnsavedChanges.value
  }
  
  // Автосохранение черновиков при изменениях (только для новых записей)
  watch(formData, (newData) => {
    if (!isEditRef.value) {
      isDirty.value = true
      // Автосохранение с задержкой
      setTimeout(() => {
        if (hasUnsavedChanges.value) {
          handleSaveDraft()
        }
      }, 1000)
    } else {
      isDirty.value = hasFormChanges(newData, originalData.value)
    }
  }, { deep: true })
  
  // Инициализация при создании
  initializeForm()
  
  return {
    // Состояние
    formData,
    loading,
    isDirty,
    errors,
    
    // Computed
    canSave,
    hasUnsavedChanges,
    formTitle,
    
    // Методы
    validateField: validateFieldDebounced,
    handleCategoryChange,
    handleSubmit,
    handleSaveDraft,
    resetForm,
    canClose,
    initializeForm,
    clearErrors,
    updateParams
  }
} 