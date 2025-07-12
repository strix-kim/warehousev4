<template>
  <!-- Секция основной информации об оборудовании -->
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
      Основная информация
    </h3>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Модель оборудования -->
      <FormField 
        label="Модель" 
        :error="errors.model"
        helper="Полное название модели оборудования"
        required
      >
        <Input
          v-model="localData.model"
          placeholder="Например, Blackmagic ATEM Mini Pro"
          :variant="errors.model ? 'error' : 'default'"
          @blur="validateField('model', localData.model)"
        />
      </FormField>
      
      <!-- Бренд -->
      <FormField 
        label="Бренд" 
        :error="errors.brand"
        helper="Производитель оборудования"
        required
      >
        <Input
          v-model="localData.brand"
          placeholder="Например, Blackmagic Design"
          :variant="errors.brand ? 'error' : 'default'"
          @blur="validateField('brand', localData.brand)"
        />
      </FormField>
      
      <!-- Серийный номер -->
      <FormField 
        label="Серийный номер" 
        :error="errors.serial_number"
        helper="Уникальный идентификатор устройства"
        required
      >
        <Input
          v-model="localData.serial_number"
          placeholder="Например, BM-001-2023"
          :variant="errors.serial_number ? 'error' : 'default'"
          @blur="validateField('serial_number', localData.serial_number)"
        />
      </FormField>
      
      <!-- Количество -->
      <FormField 
        label="Количество" 
        :error="errors.quantity"
        helper="Количество единиц оборудования"
        required
      >
        <Input
          v-model.number="localData.quantity"
          type="number"
          min="1"
          max="1000"
          placeholder="1"
          :variant="errors.quantity ? 'error' : 'default'"
          @blur="validateField('quantity', localData.quantity)"
        />
      </FormField>
      
      <!-- Статус -->
      <FormField 
        label="Статус" 
        :error="errors.status"
        helper="Текущее состояние оборудования"
        required
      >
        <select
          v-model="localData.status"
          class="block w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
          :class="{ 'border-red-300 focus:border-red-500 focus:ring-red-500': errors.status }"
          @change="validateField('status', localData.status)"
        >
          <option value="operational">Работает</option>
          <option value="broken">Сломано</option>
          <option value="in_repair">В ремонте</option>
        </select>
      </FormField>
      
      <!-- Локация -->
      <FormField 
        label="Локация" 
        :error="errors.location"
        helper="Выберите существующую локацию или добавьте новую"
        required
      >
        <LocationSelect
          v-model="localData.location"
          placeholder="Выберите локацию или введите новую"
          :variant="errors.location ? 'error' : 'default'"
          @update:model-value="validateField('location', localData.location)"
        />
      </FormField>
    </div>
  </div>
</template>

<script setup>
/**
 * Компонент для ввода основной информации об оборудовании
 * Включает: модель, бренд, серийный номер, количество, статус, локацию
 * Интегрирован с дизайн-системой и валидацией
 */
import { computed } from 'vue'
import FormField from '@/shared/ui/molecules/FormField.vue'
import Input from '@/shared/ui/atoms/Input.vue'
import LocationSelect from '../ui/LocationSelect.vue'

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


</script> 