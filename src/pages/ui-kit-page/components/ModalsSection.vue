<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🪟 Modal v2 - Enterprise Grade</h2>
    <BentoGrid columns="2" gap="6">
      <!-- Типы модальных окон -->
      <BentoCard title="Типы модальных окон">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <ButtonV2 variant="primary" size="sm" @click="openModal('basic')">Базовое окно</ButtonV2>
            <ButtonV2 variant="secondary" size="sm" @click="openModal('form')">Форма</ButtonV2>
            <ButtonV2 variant="warning" size="sm" @click="openModal('confirm')">Подтверждение</ButtonV2>
            <ButtonV2 variant="info" size="sm" @click="openModal('fullscreen')">Fullscreen</ButtonV2>
          </div>
          
          <div class="space-y-2 text-sm">
            <p class="text-success">✅ Focus trap & Keyboard navigation</p>
            <p class="text-success">✅ Accessibility (ARIA)</p>
            <p class="text-success">✅ Body scroll lock</p>
            <p class="text-success">✅ Анимации входа/выхода</p>
            <p class="text-success">✅ Адаптивные размеры</p>
          </div>
        </div>
      </BentoCard>

      <!-- Особенности Modal v2 -->
      <BentoCard title="Особенности Modal v2">
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <StatusBadgeV2 size="sm" label="Enterprise" variant="success" />
            <span class="text-sm text-secondary">Корпоративный уровень</span>
          </div>
          
          <div class="flex items-center gap-3">
            <StatusBadgeV2 size="sm" label="EPR System" variant="primary" />
            <span class="text-sm text-secondary">Для EPR системы</span>
          </div>
          
          <div class="flex items-center gap-3">
            <StatusBadgeV2 size="sm" label="A11Y" variant="info" />
            <span class="text-sm text-secondary">Полная доступность</span>
          </div>
        </div>
      </BentoCard>
    </BentoGrid>

    <!-- Модальные окна -->
    <!-- Базовое модальное окно -->
    <ModalV2 
      v-model="modals.basic" 
      title="Базовое модальное окно"
      size="md"
    >
      <p class="text-secondary">Это базовое модальное окно с заголовком и содержимым.</p>
      
      <template #actions>
        <div class="flex gap-3 justify-end">
          <ButtonV2 variant="ghost" @click="modals.basic = false">Отмена</ButtonV2>
          <ButtonV2 variant="primary" @click="modals.basic = false">Понятно</ButtonV2>
        </div>
      </template>
    </ModalV2>

    <!-- Форма -->
    <ModalV2 
      v-model="modals.form" 
      title="Создание оборудования"
      size="lg"
    >
      <div class="space-y-4">
        <InputV2 
          v-model="formData.name"
          label="Название оборудования"
          placeholder="Sony FX6, Canon C300..."
          required
        />
        
        <SelectV2
          v-model="formData.category"
          label="Категория"
          :options="[
            { value: 'cameras', label: 'Видеокамеры' },
            { value: 'audio', label: 'Аудио' },
            { value: 'lighting', label: 'Освещение' }
          ]"
          option-value="value"
          option-label="label"
          placeholder="Выберите категорию"
          required
        />
        
        <InputV2 
          v-model="formData.serial"
          label="Серийный номер"
          placeholder="FX6-123456"
        />
      </div>
      
      <template #actions>
        <div class="flex gap-3 justify-end">
          <ButtonV2 variant="ghost" @click="modals.form = false">Отмена</ButtonV2>
          <ButtonV2 variant="primary" @click="handleSaveForm">Создать</ButtonV2>
        </div>
      </template>
    </ModalV2>

    <!-- Подтверждение -->
    <ModalV2 
      v-model="modals.confirm" 
      title="Удалить оборудование?"
      size="sm"
      variant="danger"
    >
      <p class="text-secondary">Это действие нельзя отменить. Оборудование будет удалено навсегда.</p>
      
      <template #actions>
        <div class="flex gap-3 justify-end">
          <ButtonV2 variant="ghost" @click="modals.confirm = false">Отмена</ButtonV2>
          <ButtonV2 variant="error" @click="modals.confirm = false">Удалить</ButtonV2>
        </div>
      </template>
    </ModalV2>

    <!-- Fullscreen -->
    <ModalV2 
      v-model="modals.fullscreen" 
      title="Полноэкранное окно"
      size="fullscreen"
    >
      <div class="space-y-4">
        <p class="text-secondary">Это полноэкранное модальное окно для сложных форм или детального просмотра.</p>
        
        <BentoGrid columns="2" gap="4">
          <BentoCard title="Секция 1" size="1x1">
            <p class="text-secondary">Контент первой секции</p>
          </BentoCard>
          
          <BentoCard title="Секция 2" size="1x1">
            <p class="text-secondary">Контент второй секции</p>
          </BentoCard>
        </BentoGrid>
      </div>
      
      <template #actions>
        <div class="flex gap-3 justify-end">
          <ButtonV2 variant="ghost" @click="modals.fullscreen = false">Закрыть</ButtonV2>
          <ButtonV2 variant="primary" @click="modals.fullscreen = false">Сохранить</ButtonV2>
        </div>
      </template>
    </ModalV2>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { 
  BentoGrid, 
  BentoCard, 
  ButtonV2, 
  ModalV2, 
  StatusBadgeV2,
  InputV2,
  SelectV2
} from '@/shared/ui-v2'

// Состояния модальных окон
const modals = ref({
  basic: false,
  form: false,
  confirm: false,
  fullscreen: false
})

// Данные формы
const formData = ref({
  name: '',
  category: '',
  serial: ''
})

// Открытие модального окна
const openModal = (type) => {
  modals.value[type] = true
}

// Сохранение формы
const handleSaveForm = () => {
  console.log('Saving form:', formData.value)
  modals.value.form = false
  // Сброс формы
  formData.value = {
    name: '',
    category: '',
    serial: ''
  }
}
</script>