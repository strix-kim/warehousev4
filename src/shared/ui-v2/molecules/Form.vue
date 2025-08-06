<template>
  <form 
    :class="formClasses"
    @submit.prevent="handleSubmit"
    novalidate
  >
    <!-- Form Header -->
    <div v-if="$slots.header || title" class="mb-6">
      <slot name="header">
        <h2 v-if="title" class="text-xl font-semibold text-primary mb-2">{{ title }}</h2>
        <p v-if="description" class="text-secondary">{{ description }}</p>
      </slot>
    </div>

    <!-- Form Fields -->
    <div :class="fieldsLayoutClass">
      <slot :form-data="formData" :errors="errors" :validate="validateField" :set-field="setField"></slot>
    </div>

    <!-- Global Form Errors -->
    <div v-if="globalError" class="mt-6 p-4 bg-error/10 border border-error/20 rounded-lg">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h4 class="text-sm font-medium text-error mb-1">Ошибка отправки формы</h4>
          <p class="text-sm text-error/80">{{ globalError }}</p>
        </div>
      </div>
    </div>

    <!-- Form Actions -->
    <div v-if="($slots.actions || showDefaultActions) && showActions" class="mt-6 pt-6 border-t border-secondary/10">
      <slot name="actions" :is-valid="isValid" :is-loading="loading" :submit="handleSubmit" :reset="resetForm">
        <div v-if="showDefaultActions" class="flex flex-col sm:flex-row gap-3 justify-end">
          <ButtonV2
            variant="ghost"
            type="button"
            @click="resetForm"
            :disabled="loading"
          >
            {{ resetText }}
          </ButtonV2>
          <ButtonV2
            :variant="submitVariant"
            type="submit"
            :loading="loading"
            :disabled="!isValid || loading"
          >
            {{ submitText }}
          </ButtonV2>
        </div>
      </slot>
    </div>
  </form>
</template>

<script setup>
/**
 * Form v2 - Enterprise Form System для EPR System
 * Универсальная система форм с валидацией, состояниями, автосохранением
 */
import { computed, reactive, ref, watch, onMounted } from 'vue'
import ButtonV2 from '../atoms/Button.vue'

const props = defineProps({
  // Form config
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  
  // Initial data
  modelValue: {
    type: Object,
    default: () => ({})
  },
  
  // Validation
  validationRules: {
    type: Object,
    default: () => ({})
    // { fieldName: [{ rule: 'required', message: 'Field is required' }] }
  },
  
  // Layout
  layout: {
    type: String,
    default: 'vertical',
    validator: (value) => ['vertical', 'horizontal', 'grid', 'inline'].includes(value)
  },
  columns: {
    type: Number,
    default: 1,
    validator: (value) => value >= 1 && value <= 4
  },
  
  // Behavior
  validateOnChange: {
    type: Boolean,
    default: true
  },
  autoSave: {
    type: Boolean,
    default: false
  },
  autoSaveDelay: {
    type: Number,
    default: 2000
  },
  
  // States
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  
  // Actions
  showActions: {
    type: Boolean,
    default: true
  },
  showDefaultActions: {
    type: Boolean,
    default: true
  },
  submitText: {
    type: String,
    default: 'Сохранить'
  },
  resetText: {
    type: String,
    default: 'Сбросить'
  },
  submitVariant: {
    type: String,
    default: 'primary'
  }
})

const emit = defineEmits(['update:modelValue', 'submit', 'reset', 'change', 'auto-save'])

// Form state
const formData = reactive({ ...props.modelValue })
const errors = reactive({})
const globalError = ref('')
const touched = reactive({})
const autoSaveTimer = ref(null)

// Computed
const formClasses = computed(() => {
  const baseClasses = ['w-full']
  
  if (props.disabled) {
    baseClasses.push('opacity-60 pointer-events-none')
  }
  
  return baseClasses
})

const fieldsLayoutClass = computed(() => {
  const layouts = {
    vertical: 'space-y-4',
    horizontal: 'space-y-4',
    grid: `grid gap-4 grid-cols-1 ${props.columns > 1 ? `md:grid-cols-${Math.min(props.columns, 2)} lg:grid-cols-${props.columns}` : ''}`,
    inline: 'flex flex-wrap gap-4'
  }
  
  return layouts[props.layout] || layouts.vertical
})

const isValid = computed(() => {
  return Object.keys(errors).length === 0 && hasRequiredFields()
})

// Validation rules
const validationRuleHandlers = {
  required: (value, rule) => {
    const isEmpty = value === null || value === undefined || value === '' || 
                   (Array.isArray(value) && value.length === 0)
    return isEmpty ? rule.message || 'Поле обязательно для заполнения' : null
  },
  
  minLength: (value, rule) => {
    if (!value) return null
    return value.length < rule.value ? 
      rule.message || `Минимальная длина: ${rule.value} символов` : null
  },
  
  maxLength: (value, rule) => {
    if (!value) return null
    return value.length > rule.value ? 
      rule.message || `Максимальная длина: ${rule.value} символов` : null
  },
  
  email: (value, rule) => {
    if (!value) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return !emailRegex.test(value) ? 
      rule.message || 'Введите корректный email' : null
  },
  
  number: (value, rule) => {
    if (!value) return null
    return isNaN(Number(value)) ? 
      rule.message || 'Введите корректное число' : null
  },
  
  min: (value, rule) => {
    if (!value) return null
    return Number(value) < rule.value ? 
      rule.message || `Минимальное значение: ${rule.value}` : null
  },
  
  max: (value, rule) => {
    if (!value) return null
    return Number(value) > rule.value ? 
      rule.message || `Максимальное значение: ${rule.value}` : null
  },
  
  pattern: (value, rule) => {
    if (!value) return null
    const regex = new RegExp(rule.value)
    return !regex.test(value) ? 
      rule.message || 'Неверный формат' : null
  },
  
  custom: (value, rule) => {
    if (typeof rule.validator === 'function') {
      return rule.validator(value, formData) || null
    }
    return null
  }
}

// Methods
const validateField = (fieldName, value = formData[fieldName]) => {
  const rules = props.validationRules[fieldName] || []
  let error = null
  
  for (const rule of rules) {
    const handler = validationRuleHandlers[rule.rule]
    if (handler) {
      error = handler(value, rule)
      if (error) break
    }
  }
  
  if (error) {
    errors[fieldName] = error
  } else {
    delete errors[fieldName]
  }
  
  return error
}

const validateAllFields = () => {
  Object.keys(props.validationRules).forEach(fieldName => {
    validateField(fieldName)
  })
}

const hasRequiredFields = () => {
  const requiredFields = Object.keys(props.validationRules).filter(fieldName => {
    return props.validationRules[fieldName].some(rule => rule.rule === 'required')
  })
  
  return requiredFields.every(fieldName => {
    const value = formData[fieldName]
    return value !== null && value !== undefined && value !== '' && 
           (!Array.isArray(value) || value.length > 0)
  })
}

const setField = (fieldName, value) => {
  formData[fieldName] = value
  touched[fieldName] = true
  
  if (props.validateOnChange) {
    validateField(fieldName, value)
  }
  
  emit('update:modelValue', { ...formData })
  emit('change', { field: fieldName, value, formData: { ...formData } })
  
  // Auto-save
  if (props.autoSave) {
    clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = setTimeout(() => {
      emit('auto-save', { ...formData })
    }, props.autoSaveDelay)
  }
}

const handleSubmit = () => {
  // Validate all fields
  validateAllFields()
  
  // Mark all fields as touched
  Object.keys(props.validationRules).forEach(fieldName => {
    touched[fieldName] = true
  })
  
  if (isValid.value) {
    globalError.value = ''
    emit('submit', { ...formData })
  } else {
    globalError.value = 'Пожалуйста, исправьте ошибки в форме'
  }
}

const resetForm = () => {
  // Reset form data
  Object.keys(formData).forEach(key => {
    delete formData[key]
  })
  Object.assign(formData, { ...props.modelValue })
  
  // Reset validation state
  Object.keys(errors).forEach(key => {
    delete errors[key]
  })
  Object.keys(touched).forEach(key => {
    delete touched[key]
  })
  
  globalError.value = ''
  
  emit('update:modelValue', { ...formData })
  emit('reset', { ...formData })
}

const setError = (fieldName, error) => {
  if (error) {
    errors[fieldName] = error
  } else {
    delete errors[fieldName]
  }
}

const setGlobalError = (error) => {
  globalError.value = error
}

const clearErrors = () => {
  Object.keys(errors).forEach(key => {
    delete errors[key]
  })
  globalError.value = ''
}

// Watch for external model changes
watch(() => props.modelValue, (newValue) => {
  Object.assign(formData, newValue)
}, { deep: true })

// Expose methods for parent components
defineExpose({
  validate: validateAllFields,
  validateField,
  setField,
  setError,
  setGlobalError,
  clearErrors,
  resetForm,
  isValid,
  formData,
  errors
})

// Initialize
onMounted(() => {
  Object.assign(formData, { ...props.modelValue })
})
</script>

<style scoped>
/* Form-specific styles */
.form-field-error {
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
</style>