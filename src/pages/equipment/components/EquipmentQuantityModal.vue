<template>
  <ModalV2
    v-model="isOpen"
    :title="modalTitle"
    size="md"
  >
    <!-- Default слот - контент модального окна -->
    <div class="space-y-4">
        <!-- Информация об оборудовании -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm text-secondary mb-1">Модель</div>
          <div class="font-medium text-primary">{{ equipment?.model || '—' }}</div>
          
          <div class="text-sm text-secondary mt-2 mb-1">Бренд</div>
          <div class="text-primary">{{ equipment?.brand || '—' }}</div>
          
          <div class="text-sm text-secondary mt-2 mb-1">Категория</div>
          <div class="text-primary">{{ equipment?.type || '—' }}</div>
          
          <div class="text-sm text-secondary mt-2 mb-1">Доступно единиц</div>
          <div class="text-lg font-bold text-primary">{{ equipment?.available_count || 0 }} шт</div>
        </div>

        <!-- Поле ввода количества -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            Количество для добавления в список
          </label>
          
          <div class="flex items-center gap-3">
            <ButtonV2
              variant="secondary"
              size="md"
              @click="decrementQuantity"
              :disabled="quantity <= 1"
            >
              <template #icon>
                <IconV2 name="minus" size="sm" />
              </template>
            </ButtonV2>

            <InputV2
              v-model.number="quantity"
              type="number"
              :min="1"
              placeholder="Количество"
              class="w-32 text-center"
              @blur="validateQuantity"
            />

            <ButtonV2
              variant="secondary"
              size="md"
              @click="incrementQuantity"
            >
              <template #icon>
                <IconV2 name="plus" size="sm" />
              </template>
            </ButtonV2>
          </div>

          <p v-if="quantityError" class="text-sm text-error mt-1">
            {{ quantityError }}
          </p>
        </div>

        <!-- Подсказка -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div class="flex gap-2">
            <IconV2 name="info" size="sm" color="info" />
            <p class="text-sm text-blue-700">
              Укажите необходимое количество. Вы можете указать любое число, даже если оно превышает доступное количество в базе.
            </p>
          </div>
        </div>
      </div>

    <!-- Слот для кнопок действий -->
    <template #actions>
      <div class="flex gap-3 justify-end">
        <ButtonV2
          variant="ghost"
          size="md"
          @click="handleClose"
        >
          Отмена
        </ButtonV2>

        <ButtonV2
          variant="primary"
          size="md"
          @click="handleConfirm"
          :disabled="!isValidQuantity"
        >
          <template #icon>
            <IconV2 name="plus" size="sm" />
          </template>
          Добавить
        </ButtonV2>
      </div>
    </template>
  </ModalV2>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ModalV2, ButtonV2, InputV2, IconV2 } from '@/shared/ui-v2'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  equipment: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'confirm'])

// Внутреннее состояние для v-model ModalV2
const isOpen = computed({
  get: () => props.show,
  set: (value) => {
    if (!value) {
      emit('close')
    }
  }
})

// Состояние
const quantity = ref(1)
const quantityError = ref('')

// Вычисляемые свойства
const modalTitle = computed(() => {
  return props.equipment 
    ? `Добавить: ${props.equipment.brand} ${props.equipment.model}`
    : 'Добавить оборудование'
})

const isValidQuantity = computed(() => {
  return quantity.value >= 1 && !quantityError.value
})

// Методы
const validateQuantity = () => {
  quantityError.value = ''
  
  if (!quantity.value || quantity.value < 1) {
    quantity.value = 1
    quantityError.value = 'Минимальное количество - 1'
    return false
  }
  
  // Проверяем, что значение является числом
  if (isNaN(quantity.value)) {
    quantity.value = 1
    quantityError.value = 'Введите корректное число'
    return false
  }
  
  return true
}

const incrementQuantity = () => {
  quantity.value++
  quantityError.value = ''
}

const decrementQuantity = () => {
  if (quantity.value > 1) {
    quantity.value--
    quantityError.value = ''
  }
}

const handleClose = () => {
  quantity.value = 1
  quantityError.value = ''
  emit('close')
}

const handleConfirm = () => {
  if (validateQuantity()) {
    emit('confirm', {
      equipment: props.equipment,
      quantity: quantity.value
    })
    handleClose()
  }
}

// Сбрасываем количество при открытии модалки
watch(() => props.show, (newValue) => {
  if (newValue) {
    quantity.value = 1
    quantityError.value = ''
  }
})
</script>

