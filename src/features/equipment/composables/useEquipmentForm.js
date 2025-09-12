/**
 * useEquipmentForm - EPR System
 * 
 * Composable для работы с формой оборудования
 * Использует UI Kit v2 принципы
 */

import { ref, reactive } from 'vue'
import { useEquipmentStore } from '../store/equipment-store.js'
import { equipmentApi } from '../api/equipment-api.js'

export function useEquipmentForm() {
  const store = useEquipmentStore()
  
  // Form state
  const showForm = ref(false)
  const editingEquipment = ref(null)
  const formLoading = ref(false)
  const formError = ref(null)

  // Form data
  const formData = reactive({
    brand: '',
    model: '',
    serialnumber: '', // Исправлено: используем serialnumber как в API
    category: '',
    subcategory: '',
    status: 'available',
    location: '',
    description: '',
    specifications: '',
    purchase_date: '',
    warranty_expiry: '',
    notes: ''
  })

  // Form validation
  const validationErrors = reactive({})
  const isFormValid = ref(false)

  // Methods
  const openForm = (equipment = null) => {
    editingEquipment.value = equipment
    showForm.value = true
    
    if (equipment) {
      // Заполняем форму данными для редактирования
      Object.keys(formData).forEach(key => {
        if (equipment[key] !== undefined) {
          formData[key] = equipment[key]
        }
      })
    } else {
      // Очищаем форму для создания нового
      resetForm()
    }
  }

  const closeForm = () => {
    showForm.value = false
    editingEquipment.value = null
    resetForm()
    clearErrors()
  }

  const resetForm = () => {
    Object.keys(formData).forEach(key => {
      formData[key] = ''
    })
    formData.status = 'available'
  }

  const clearErrors = () => {
    formError.value = null
    Object.keys(validationErrors).forEach(key => {
      validationErrors[key] = null
    })
  }

  const validateForm = () => {
    clearErrors()
    let isValid = true

    // Обязательные поля
    if (!formData.brand?.trim()) {
      validationErrors.brand = 'Бренд обязателен'
      isValid = false
    }

    if (!formData.model?.trim()) {
      validationErrors.model = 'Модель обязательна'
      isValid = false
    }

    if (!formData.serialnumber?.trim()) {
      validationErrors.serialnumber = 'Серийный номер обязателен'
      isValid = false
    }

    if (!formData.category?.trim()) {
      validationErrors.category = 'Категория обязательна'
      isValid = false
    }

    // Проверка уникальности серийного номера
    const existingEquipment = store.equipments.find(e => 
      e.serialnumber === formData.serialnumber && 
      e.id !== editingEquipment.value?.id
    )
    
    if (existingEquipment) {
      validationErrors.serialnumber = 'Серийный номер уже существует'
      isValid = false
    }

    isFormValid.value = isValid
    return isValid
  }

  const submitForm = async () => {
    if (!validateForm()) {
      return false
    }

    formLoading.value = true
    formError.value = null

    try {
      const equipmentData = { ...formData }
      
      if (editingEquipment.value) {
        // Обновление
        await store.updateEquipment(editingEquipment.value.id, equipmentData)
      } else {
        // Создание
        await store.createEquipment(equipmentData)
      }

      closeForm()
      return true
    } catch (error) {
      formError.value = error.message || 'Ошибка сохранения оборудования'
      return false
    } finally {
      formLoading.value = false
    }
  }

  const deleteEquipment = async (id) => {
    if (!confirm('Удалить это оборудование?')) {
      return false
    }

    formLoading.value = true
    formError.value = null

    try {
      await store.deleteEquipment(id)
      closeForm()
      return true
    } catch (error) {
      formError.value = error.message || 'Ошибка удаления оборудования'
      return false
    } finally {
      formLoading.value = false
    }
  }

  return {
    // State
    showForm,
    editingEquipment,
    formLoading,
    formError,
    formData,
    validationErrors,
    isFormValid,

    // Methods
    openForm,
    closeForm,
    resetForm,
    clearErrors,
    validateForm,
    submitForm,
    deleteEquipment
  }
} 