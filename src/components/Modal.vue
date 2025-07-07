<template>
  <teleport to="body">
    <!-- Оверлей с затемнением -->
    <transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40"
        @mousedown.self="close"
      >
        <!-- Модальное окно -->
        <div
          :class="modalClass"
          @mousedown.stop
        >
          <!-- Header: слот или заголовок -->
          <div v-if="$slots.header || title" class="mb-4 flex items-center justify-between min-h-[2.5rem]">
            <slot name="header">
              <div class="text-lg font-semibold text-gray-900">{{ title }}</div>
            </slot>
            <!-- Кнопка закрытия -->
            <button
              type="button"
              class="ml-2 text-gray-400 hover:text-red-500 focus:outline-none"
              @click="close"
              aria-label="Закрыть модальное окно"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Содержимое модального окна -->
          <div class="flex-1">
            <slot />
          </div>
          <!-- Footer: слот для кнопок действий -->
          <div v-if="$slots.footer" class="mt-6">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue'

// Props:
// - modelValue: управление видимостью модального окна (v-model)
// - title: необязательный заголовок
// - size: размер модального окна ('sm' | 'md' | 'lg' | 'xl')
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg', 'xl'].includes(v)
  }
})
const emit = defineEmits(['update:modelValue'])

// Классы для размеров модального окна
const sizeMap = {
  sm: 'modal-sm',
  md: 'modal-md',
  lg: 'modal-lg',
  xl: 'modal-xl'
}
const modalClass = [
  'modal-window p-6',
  sizeMap[props.size] || sizeMap.md
]

// Закрытие модального окна
function close() {
  emit('update:modelValue', false)
}

// Закрытие по Esc
function onKeydown(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// Автоматический фокус при открытии (можно доработать при необходимости)
watch(() => props.modelValue, (val) => {
  if (val) {
    // Можно добавить фокус на первый интерактивный элемент
  }
})

/*
  Универсальный компонент Modal.vue для всех сценариев (добавление, редактирование, подтверждение и т.д.).
  - Минимализм: светлый фон, border, строгая тень, аккуратные скругления.
  - Слоты: header (заголовок/действия), default (контент), footer (кнопки).
  - Проп size: sm, md, lg, xl (ширина окна).
  - Закрытие по кнопке, клику вне окна, Esc.
  - Для управления видимостью используйте v-model.
*/
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/*
  modal-window — production-стиль модального окна: фиксированная/адаптивная ширина, margin по бокам, строгая тень, скругления, фон, border.
  modal-sm, modal-md, modal-lg, modal-xl — размеры окна.
*/
.modal-window {
  width: 100%;
  max-width: 600px;
  margin: 0 24px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 32px 0 rgba(16,16,16,0.08);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  position: relative;
}
.modal-sm { max-width: 380px; }
.modal-md { max-width: 600px; }
.modal-lg { max-width: 900px; }
.modal-xl { max-width: 1200px; }
@media (max-width: 700px) {
  .modal-window {
    max-width: 98vw;
    margin: 0 2vw;
    padding: 12px 0;
  }
}
</style> 