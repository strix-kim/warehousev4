<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">📝 Form v2 - Enterprise Form System</h2>
    <BentoGrid columns="2" gap="6">
      <!-- Возможности Form v2 -->
      <BentoCard title="Возможности Form v2">
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">10+ типов полей</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Валидация в реальном времени</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Автосохранение</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Grid/Vertical layouts</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Кастомные правила</span>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadgeV2 size="xs" label="✓" variant="success" />
            <span class="text-sm text-secondary">Состояния Loading/Error</span>
          </div>
        </div>
      </BentoCard>

      <!-- Создание оборудования -->
      <BentoCard title="Создание оборудования">
        <FormV2 
          :model="formData"
          :rules="formRules"
          :loading="formLoading"
          layout="vertical"
          @submit="handleSubmit"
          @reset="handleReset"
        >
          <template #header>
            <div class="mb-4">
              <h2 class="text-lg font-semibold text-primary">Добавить новое оборудование</h2>
              <p class="text-sm text-secondary">Заполните информацию об оборудовании</p>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Основная информация -->
            <FormFieldV2 
              v-model="formData.name"
              name="name"
              label="Название оборудования"
              type="text"
              placeholder="Sony FX6, Canon C300..."
              required
              :error="formErrors.name"
            />

            <FormFieldV2 
              v-model="formData.category"
              name="category"
              label="Категория"
              type="select"
              :options="categoryOptions"
              placeholder="Выберите категорию"
              required
              :error="formErrors.category"
            />

            <FormFieldV2 
              v-model="formData.serialNumber"
              name="serialNumber"
              label="Серийный номер"
              type="text"
              placeholder="FX6-123456"
              help="Формат: буквы, цифры и дефисы"
              required
              :error="formErrors.serialNumber"
            />

            <FormFieldV2 
              v-model="formData.price"
              name="price"
              label="Цена (₽)"
              type="number"
              placeholder="0"
              required
              :error="formErrors.price"
            />

            <FormFieldV2 
              v-model="formData.description"
              name="description"
              label="Описание"
              type="textarea"
              placeholder="Описание"
              help="Укажите особенности, комплектацию, состояние"
              :error="formErrors.description"
            />

            <!-- Статус -->
            <FormFieldV2 
              v-model="formData.status"
              name="status"
              label="Статус"
              type="radio"
              :options="statusOptions"
              :error="formErrors.status"
            />

            <!-- Дополнительные опции -->
            <div class="space-y-3">
              <FormFieldV2 
                v-model="formData.hasWarranty"
                name="hasWarranty"
                label="Есть гарантия"
                type="checkbox"
                :error="formErrors.hasWarranty"
              />

              <FormFieldV2 
                v-model="formData.purchaseDate"
                name="purchaseDate"
                label="Дата покупки"
                type="date"
                placeholder="2023-12-01"
                help="Формат: YYYY-MM-DD"
                :error="formErrors.purchaseDate"
              />
            </div>
          </div>

          <template #actions>
            <div class="flex gap-3 justify-end pt-4">
              <ButtonV2 
                type="button" 
                variant="ghost" 
                @click="handleReset"
                :disabled="formLoading"
              >
                Сбросить
              </ButtonV2>
              <ButtonV2 
                type="submit" 
                variant="primary"
                :loading="formLoading"
                :disabled="!isFormValid"
              >
                Создать оборудование
              </ButtonV2>
            </div>
          </template>
        </FormV2>
      </BentoCard>
    </BentoGrid>

    <!-- Состояние формы -->
    <BentoCard title="Состояние формы:">
      <pre class="text-xs text-secondary bg-gray-100 p-3 rounded overflow-auto">{{ JSON.stringify(formData, null, 2) }}</pre>
    </BentoCard>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  BentoGrid, 
  BentoCard, 
  FormV2, 
  FormFieldV2,
  ButtonV2,
  StatusBadgeV2
} from '@/shared/ui-v2'

// Состояние формы
const formLoading = ref(false)
const formErrors = ref({})

// Данные формы
const formData = ref({
  name: '',
  category: '',
  location: '',
  serialNumber: '',
  purchaseDate: '',
  price: null,
  description: '',
  status: 'available',
  hasWarranty: false,
  tags: []
})

// Опции для селектов
const categoryOptions = [
  { value: 'cameras', label: 'Видеокамеры' },
  { value: 'audio', label: 'Аудио' },
  { value: 'lighting', label: 'Освещение' },
  { value: 'accessories', label: 'Аксессуары' }
]

const statusOptions = [
  { value: 'available', label: 'Доступно' },
  { value: 'in-use', label: 'В использовании' },
  { value: 'maintenance', label: 'На обслуживании' },
  { value: 'retired', label: 'Списано' }
]

// Правила валидации
const formRules = {
  name: [
    { required: true, message: 'Название обязательно' },
    { min: 3, message: 'Минимум 3 символа' }
  ],
  category: [
    { required: true, message: 'Выберите категорию' }
  ],
  serialNumber: [
    { required: true, message: 'Серийный номер обязателен' },
    { pattern: /^[A-Za-z0-9-]+$/, message: 'Только буквы, цифры и дефисы' }
  ],
  price: [
    { required: true, message: 'Укажите цену' },
    { type: 'number', min: 0, message: 'Цена должна быть положительной' }
  ]
}

// Валидация формы
const isFormValid = computed(() => {
  return formData.value.name && 
         formData.value.category && 
         formData.value.serialNumber && 
         formData.value.price > 0
})

// Обработчики
const handleSubmit = async () => {
  formLoading.value = true
  formErrors.value = {}
  
  try {
    // Симуляция отправки
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('Form submitted:', formData.value)
    
    // Сброс формы после успешной отправки
    handleReset()
  } catch (error) {
    console.error('Form submission error:', error)
  } finally {
    formLoading.value = false
  }
}

const handleReset = () => {
  formData.value = {
    name: '',
    category: '',
    location: '',
    serialNumber: '',
    purchaseDate: '',
    price: null,
    description: '',
    status: 'available',
    hasWarranty: false,
    tags: []
  }
  formErrors.value = {}
}
</script>