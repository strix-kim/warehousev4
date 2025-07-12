<template>
  <!-- Секция дополнительной информации -->
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
      Дополнительная информация
    </h3>
    
    <div class="space-y-4">
      <!-- Техническое описание -->
      <FormField 
        label="Техническое описание" 
        :error="errors.tech_description"
        helper="Технические характеристики, особенности эксплуатации"
      >
        <textarea
          v-model="localData.tech_description"
          rows="4"
          class="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-y"
          :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': errors.tech_description }"
          placeholder="Например: Разрешение 4K, 4 входа HDMI, встроенный стример, поддержка H.264..."
          @blur="validateField('tech_description', localData.tech_description)"
        ></textarea>
        
        <!-- Счетчик символов -->
        <div class="flex justify-between items-center mt-2">
          <span class="text-xs text-gray-500">
            Необязательное поле
          </span>
          <span 
            class="text-xs"
            :class="characterCount.tech_description > 1000 ? 'text-red-500' : 'text-gray-500'"
          >
            {{ characterCount.tech_description }}/1000
          </span>
        </div>
      </FormField>
      
      <!-- Общее описание -->
      <FormField 
        label="Описание" 
        :error="errors.description"
        helper="Дополнительные заметки, особенности использования"
      >
        <textarea
          v-model="localData.description"
          rows="3"
          class="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-y"
          :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': errors.description }"
          placeholder="Например: Используется для прямых эфиров, требует калибровки перед каждым использованием..."
          @blur="validateField('description', localData.description)"
        ></textarea>
        
        <!-- Счетчик символов -->
        <div class="flex justify-between items-center mt-2">
          <span class="text-xs text-gray-500">
            Необязательное поле
          </span>
          <span 
            class="text-xs"
            :class="characterCount.description > 500 ? 'text-red-500' : 'text-gray-500'"
          >
            {{ characterCount.description }}/500
          </span>
        </div>
      </FormField>
    </div>
    
    <!-- Предварительный просмотр -->
    <div v-if="hasContent" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 class="text-sm font-medium text-gray-900 mb-3">Предварительный просмотр</h4>
      
      <div class="space-y-3">
        <div v-if="localData.tech_description?.trim()" class="prose prose-sm max-w-none">
          <h5 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
            Технические характеристики
          </h5>
          <p class="text-sm text-gray-600 whitespace-pre-wrap">
            {{ localData.tech_description }}
          </p>
        </div>
        
        <div v-if="localData.description?.trim()" class="prose prose-sm max-w-none">
          <h5 class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
            Дополнительная информация
          </h5>
          <p class="text-sm text-gray-600 whitespace-pre-wrap">
            {{ localData.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент для ввода дополнительной информации об оборудовании
 * Включает: техническое описание, общее описание с предварительным просмотром
 * Интегрирован с дизайн-системой и валидацией
 */
import { computed } from 'vue'
import FormField from '@/shared/ui/molecules/FormField.vue'

// Пропсы
const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  errors: {
    type: Object,
    default: () => ({})
  },
  validateField: {
    type: Function,
    default: () => {}
  }
})

// События
const emit = defineEmits(['update:modelValue'])

// Локальная копия данных для v-model
const localData = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Счетчики символов
const characterCount = computed(() => ({
  tech_description: (localData.value.tech_description || '').length,
  description: (localData.value.description || '').length
}))

// Проверка наличия контента для предварительного просмотра
const hasContent = computed(() => {
  return localData.value.tech_description?.trim() || localData.value.description?.trim()
})
</script> 