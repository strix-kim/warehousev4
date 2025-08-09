<template>
  <div :class="fieldContainerClass">
    <!-- Label -->
    <label 
      v-if="label" 
      :for="fieldId" 
      :class="labelClass"
    >
      <span class="inline-flex items-center gap-2">
        <IconV2 v-if="labelIcon" :name="labelIcon" size="xs" class="text-secondary" />
        <span>{{ label }}</span>
      </span>
      <span v-if="required" class="text-error ml-1">*</span>
    </label>

    <!-- Field Content -->
    <div class="relative">
      <!-- Input Field -->
      <InputV2
        v-if="type === 'input' || type === 'text' || type === 'email' || type === 'password' || type === 'number' || type === 'date'"
        :id="fieldId"
        :model-value="modelValue"
        @update:model-value="handleChange"
        :type="type === 'input' ? 'text' : type"
        :placeholder="placeholder"
        :disabled="disabled"
        :size="size"
        :error="error"
        :show-error="false"
        :prefix-icon="prefixIcon"
        :suffix-icon="suffixIcon"
        @blur="handleBlur"
      />

      <!-- Textarea -->
      <textarea
        v-else-if="type === 'textarea'"
        :id="fieldId"
        :value="modelValue"
        @input="handleChange"
        @blur="handleBlur"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows"
        :class="textareaClass"
      />

      <!-- Select -->
      <SelectV2
        v-else-if="type === 'select'"
        :id="fieldId"
        :model-value="modelValue"
        @update:model-value="handleChange"
        :options="options"
        :placeholder="placeholder"
        :disabled="disabled"
        :size="size"
        :searchable="searchable"
        :multiple="multiple"
        @blur="handleBlur"
      />

      <!-- Checkbox -->
      <div v-else-if="type === 'checkbox'" class="flex items-center gap-2">
        <input
          :id="fieldId"
          type="checkbox"
          :checked="modelValue"
          @change="handleChange"
          @blur="handleBlur"
          :disabled="disabled"
          class="rounded border-secondary/30 text-primary focus:ring-primary/30"
        />
        <label v-if="checkboxLabel" :for="fieldId" class="text-sm text-primary cursor-pointer">
          {{ checkboxLabel }}
        </label>
      </div>

      <!-- Radio Group -->
      <div v-else-if="type === 'radio'" class="space-y-2">
        <div 
          v-for="option in options" 
          :key="getOptionValue(option)"
          class="flex items-center gap-2"
        >
          <input
            :id="`${fieldId}-${getOptionValue(option)}`"
            type="radio"
            :value="getOptionValue(option)"
            :checked="modelValue === getOptionValue(option)"
            @change="handleChange"
            @blur="handleBlur"
            :disabled="disabled"
            class="text-primary focus:ring-primary/30"
          />
          <label 
            :for="`${fieldId}-${getOptionValue(option)}`" 
            class="text-sm text-primary cursor-pointer"
          >
            {{ getOptionLabel(option) }}
          </label>
        </div>
      </div>

      <!-- File Upload -->
      <div v-else-if="type === 'file'" class="space-y-2">
        <input
          :id="fieldId"
          type="file"
          @change="handleFileChange"
          @blur="handleBlur"
          :disabled="disabled"
          :accept="accept"
          :multiple="multiple"
          class="block w-full text-sm text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-accent hover:file:bg-primary/90"
        />
        <div v-if="modelValue" class="text-xs text-secondary">
          {{ Array.isArray(modelValue) ? `${modelValue.length} файлов выбрано` : modelValue.name || 'Файл выбран' }}
        </div>
      </div>

      <!-- Custom Slot -->
      <div v-else-if="type === 'custom'">
        <slot 
          :field-id="fieldId" 
          :model-value="modelValue" 
          :handle-change="handleChange"
          :handle-blur="handleBlur"
          :disabled="disabled"
          :error="error"
        />
      </div>
    </div>

    <!-- Help Text -->
    <p v-if="hint && !error" class="mt-1 text-xs text-secondary">{{ hint }}</p>

    <!-- Error Message -->
    <p v-if="error" class="mt-1 text-xs text-error">{{ error }}</p>
  </div>
</template>

<script setup>
/**
 * FormField v2 - Универсальное поле формы
 * Обертка для всех типов полей с единообразным API
 */
import { computed } from 'vue'
import IconV2 from '../atoms/Icon.vue'
import InputV2 from '../atoms/Input.vue'
import SelectV2 from '../atoms/Select.vue'

const props = defineProps({
  // Field config
  modelValue: {
    type: [String, Number, Boolean, Array, Object, File],
    default: null
  },
  // Label icon
  labelIcon: {
    type: String,
    default: ''
  },
  prefixIcon: {
    type: String,
    default: ''
  },
  suffixIcon: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'input',
    validator: (value) => [
      'input', 'text', 'email', 'password', 'number', 'date', 'textarea', 
      'select', 'checkbox', 'radio', 'file', 'custom'
    ].includes(value)
  },
  
  // Labels and placeholders
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  checkboxLabel: {
    type: String,
    default: ''
  },
  
  // Validation
  required: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  
  // Styling
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  layout: {
    type: String,
    default: 'vertical',
    validator: (value) => ['vertical', 'horizontal'].includes(value)
  },
  
  // States
  disabled: {
    type: Boolean,
    default: false
  },
  
  // Select/Radio options
  options: {
    type: Array,
    default: () => []
  },
  optionLabel: {
    type: String,
    default: 'label'
  },
  optionValue: {
    type: String,
    default: 'value'
  },
  
  // Select specific
  searchable: {
    type: Boolean,
    default: false
  },
  multiple: {
    type: Boolean,
    default: false
  },
  
  // Textarea specific
  rows: {
    type: Number,
    default: 4
  },
  
  // File specific
  accept: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'blur'])

// Computed
const fieldId = computed(() => `field-${Math.random().toString(36).substring(2, 9)}`)

const fieldContainerClass = computed(() => {
  const baseClasses = ['w-full']
  
  if (props.layout === 'horizontal') {
    baseClasses.push('flex items-center gap-4')
  } else {
    baseClasses.push('space-y-1')
  }
  
  return baseClasses
})

const labelClass = computed(() => {
  const baseClasses = ['block text-sm font-medium text-primary']
  
  if (props.layout === 'horizontal') {
    baseClasses.push('min-w-[120px] mb-0')
  } else {
    baseClasses.push('mb-1')
  }
  
  return baseClasses
})

const textareaClass = computed(() => {
  const baseClasses = [
    'w-full rounded-lg border shadow-sm transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 bg-accent/50 backdrop-blur-sm'
  ]
  
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm sm:text-base',
    lg: 'px-4 py-3 text-base sm:text-lg'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  // State classes
  if (props.error) {
    baseClasses.push('border-error focus:ring-error/30')
  } else {
    baseClasses.push('border-secondary/30 focus:ring-primary/30')
  }
  
  if (props.disabled) {
    baseClasses.push('opacity-60 cursor-not-allowed bg-gray-100')
  }
  
  return baseClasses
})

// Methods
const getOptionValue = (option) => {
  return typeof option === 'object' ? option[props.optionValue] : option
}

const getOptionLabel = (option) => {
  return typeof option === 'object' ? option[props.optionLabel] : option
}

const handleChange = (event) => {
  let value
  
  if (props.type === 'checkbox') {
    value = event.target ? event.target.checked : event
  } else if (props.type === 'radio') {
    value = event.target ? event.target.value : event
  } else if (props.type === 'textarea') {
    value = event.target ? event.target.value : event
  } else {
    value = event.target ? event.target.value : event
  }
  
  emit('update:modelValue', value)
  emit('change', value)
}

const handleFileChange = (event) => {
  const files = event.target.files
  const value = props.multiple ? Array.from(files) : files[0]
  
  emit('update:modelValue', value)
  emit('change', value)
}

const handleBlur = (event) => {
  emit('blur', event)
}
</script>