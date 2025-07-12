<template>
  <!--
    EquipmentDetailsModal.vue — модальное окно деталей оборудования
    Архитектурная роль: просмотр полной информации с действиями редактирования/удаления
    Использует существующий Modal.vue, соответствует дизайн-системе проекта
    Поддерживает: полная информация, статусы, действия, responsive design
  -->
  <Modal 
    :model-value="modelValue" 
    @update:modelValue="handleClose"
    :header="equipment ? `${equipment.model} - ${equipment.brand}` : 'Информация об оборудовании'"
    size="xl"
  >
    <!-- Основное содержимое -->
    <div v-if="equipment" class="space-y-6">
              <!-- Основная информация -->
        <div class="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Основная информация</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Модель</label>
              <div class="text-sm font-medium text-gray-900">{{ equipment.model }}</div>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</label>
              <div class="text-sm font-medium text-gray-900">{{ equipment.brand }}</div>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Серийный номер</label>
              <div class="text-xs font-mono bg-gray-50 px-2 py-1 rounded border">{{ equipment.serial_number }}</div>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Количество</label>
              <div class="text-sm font-semibold text-blue-600">{{ equipment.quantity }} шт.</div>
            </div>
        </div>
      </div>

              <!-- Статус и локация -->
        <div class="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Статус и размещение</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</label>
              <div class="text-sm font-medium text-gray-900">
                <span 
                  class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border"
                  :class="getStatusConfig(equipment.status).classes"
                >
                  <span v-if="getStatusConfig(equipment.status).icon" class="mr-1.5">{{ getStatusConfig(equipment.status).icon }}</span>
                  {{ getStatusConfig(equipment.status).label }}
                </span>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Локация</label>
              <div class="text-sm font-medium text-gray-900">{{ equipment.location }}</div>
            </div>
          </div>
        </div>

              <!-- Категоризация -->
        <div class="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Категоризация</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</label>
              <div class="text-sm font-medium text-gray-900">{{ equipment.category }}</div>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Подкатегория</label>
              <div class="text-sm font-medium text-gray-900">{{ equipment.subcategory }}</div>
            </div>
          </div>
        </div>

              <!-- Описания -->
        <div v-if="equipment.tech_description || equipment.description" class="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Дополнительная информация</h3>
          <div class="space-y-4">
            <div v-if="equipment.tech_description" class="space-y-2">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Техническое описание</label>
              <div class="text-sm text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-lg border">{{ equipment.tech_description }}</div>
            </div>
            <div v-if="equipment.description" class="space-y-2">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Описание</label>
              <div class="text-sm text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-lg border">{{ equipment.description }}</div>
            </div>
          </div>
        </div>

              <!-- Метаинформация -->
        <div class="bg-gray-50 rounded-lg p-4 -mx-2">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Информация о записи</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div v-if="equipment.created_at" class="text-center">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Создано</label>
              <div class="text-xs text-gray-700 mt-1">{{ formatDate(equipment.created_at) }}</div>
            </div>
            <div v-if="equipment.updated_at" class="text-center">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Обновлено</label>
              <div class="text-xs text-gray-700 mt-1">{{ formatDate(equipment.updated_at) }}</div>
            </div>
            <div v-if="equipment.id" class="text-center">
              <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">ID</label>
              <div class="text-xs text-gray-700 mt-1">{{ equipment.id }}</div>
            </div>
          </div>
        </div>
    </div>

    <!-- Состояние загрузки -->
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <Spinner class="h-8 w-8 text-red-600 mx-auto mb-3" />
      <p class="text-gray-600">Загрузка информации...</p>
    </div>

    <!-- Подвал с действиями -->
    <template #footer>
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
        <Button
          label="Закрыть"
          @click="handleClose"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        />
        <div class="flex items-center gap-3">
          <Button
            label="Редактировать"
            @click="handleEdit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            :disabled="!equipment"
          />
          <Button
            label="Удалить"
            @click="handleDelete"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            :disabled="!equipment"
          />
        </div>
      </div>
    </template>
  </Modal>

  <!-- Модальное окно подтверждения удаления -->
  <Modal 
    :model-value="showDeleteConfirm"
    @update:modelValue="(value) => showDeleteConfirm = value"
    header="Подтверждение удаления"
    width="28rem"
  >
    <div class="delete-confirmation">
      <div class="warning-icon">⚠️</div>
      <h3 class="warning-title">Удалить оборудование?</h3>
      <p class="warning-text">
        Вы действительно хотите удалить <strong>{{ equipment?.model }}</strong>?
        Это действие нельзя отменить.
      </p>
    </div>

    <template #footer>
      <div class="confirm-actions">
        <Button
          label="Отмена"
          @click="showDeleteConfirm = false"
          class="btn-secondary"
        />
        <Button
          label="Удалить"
          @click="confirmDelete"
          class="btn-danger"
          :loading="deleting"
        />
      </div>
    </template>
  </Modal>
</template>

<script setup>
/**
 * EquipmentDetailsModal.vue — модальное окно с деталями оборудования
 * Интегрирован с существующим Modal.vue из дизайн-системы
 * Поддерживает редактирование, удаление, responsive design
 */
import { ref, computed } from 'vue'
import Modal from '@/shared/ui/molecules/Modal.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'

// Props
const props = defineProps({
  /** Видимость модального окна */
  modelValue: {
    type: Boolean,
    default: false
  },
  /** Объект оборудования для отображения */
  equipment: {
    type: Object,
    default: null
  }
})

// Events
const emit = defineEmits(['update:modelValue', 'edit', 'delete'])

// Локальные состояния
const showDeleteConfirm = ref(false)
const deleting = ref(false)

/**
 * Конфигурация статусов оборудования
 */
  const getStatusConfig = (status) => {
    const statusConfigs = {
      operational: {
        label: 'Работает',
        classes: 'bg-green-100 text-green-800 border-green-200',
        icon: '✅'
      },
      broken: {
        label: 'Сломано',
        classes: 'bg-red-100 text-red-800 border-red-200',
        icon: '❌'
      },
      in_repair: {
        label: 'В ремонте',
        classes: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '🔧'
      }
    }
    return statusConfigs[status] || {
      label: status || 'Неизвестно',
      classes: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: '' // Убираем иконку для неизвестных статусов
    }
  }

/**
 * Форматирование даты
 */
const formatDate = (dateString) => {
  if (!dateString) return '—'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return dateString
  }
}

/**
 * Обработчики событий
 */
const handleClose = () => {
  emit('update:modelValue', false)
}

const handleEdit = () => {
  if (props.equipment) {
    emit('edit', props.equipment)
  }
}

const handleDelete = () => {
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  if (!props.equipment) return
  
  deleting.value = true
  try {
    await emit('delete', props.equipment)
    showDeleteConfirm.value = false
    handleClose()
  } catch (error) {
    console.error('Ошибка удаления:', error)
  } finally {
    deleting.value = false
  }
}
</script>

 