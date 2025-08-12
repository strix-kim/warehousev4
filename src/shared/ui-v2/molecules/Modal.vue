<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 overflow-hidden"
        role="dialog"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
        aria-modal="true"
        @click="handleBackdropClick"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
        <!-- Modal Container - улучшенная адаптивность -->
        <div class="flex min-h-full items-center justify-center p-2 sm:p-4 lg:p-6">
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-4"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-4"
          >
            <div
              v-if="modelValue"
              :class="[modalClasses]"
              class="relative bg-accent rounded-2xl shadow-2xl border border-secondary/20 flex flex-col max-h-[90vh] w-full max-w-5xl mx-2"
              @click.stop
              ref="modalRef"
            >
              <!-- Header -->
              <header
                v-if="$slots.header || title || shouldShowCloseButton"
                class="flex items-center justify-between p-4 sm:p-6 border-b border-secondary/10 flex-shrink-0"
              >
                <div class="flex-1 min-w-0">
                  <slot name="header">
                    <h2 v-if="title" :id="titleId" class="text-lg sm:text-xl font-semibold text-primary leading-tight">
                      {{ title }}
                    </h2>
                  </slot>
                </div>
                
                <!-- Close Button -->
                <button
                  v-if="shouldShowCloseButton"
                  @click="requestClose"
                  class="ml-4 p-2 text-secondary hover:text-primary hover:bg-secondary/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Закрыть модальное окно"
                >
                  <!-- X иконка для закрытия -->
                  <svg 
                    class="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      stroke-linecap="round" 
                      stroke-linejoin="round" 
                      stroke-width="2" 
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </header>

              <!-- Body -->
              <div class="flex-1 overflow-hidden">
                <div :class="[bodyClasses]" class="h-full">
                  <slot name="default">
                    <p v-if="description" :id="descriptionId" class="text-secondary">
                      {{ description }}
                    </p>
                  </slot>
                </div>
              </div>

              <!-- Footer -->
              <footer
                v-if="$slots.footer || $slots.actions || showDefaultActions"
                class="p-4 sm:p-6 border-t border-secondary/10 flex-shrink-0"
              >
                <div class="flex items-center justify-end gap-3">
                  <slot name="footer">
                    <slot name="actions">
                      <div v-if="showDefaultActions" class="flex gap-3">
                        <ButtonV2
                          variant="ghost"
                          size="md"
                          @click="handleCancel"
                          :disabled="loading"
                        >
                          {{ cancelText }}
                        </ButtonV2>
                        <ButtonV2
                          :variant="confirmVariant"
                          size="md"
                          @click="handleConfirm"
                          :loading="loading"
                          :disabled="loading"
                        >
                          {{ confirmText }}
                        </ButtonV2>
                      </div>
                    </slot>
                  </slot>
                </div>
              </footer>

              <!-- Close Confirmation Overlay -->
              <div
                v-if="showCloseConfirm"
                class="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4"
              >
                <div class="w-[min(100vw-2rem,56rem)] rounded-xl border border-secondary/20 bg-white shadow-xl p-4 sm:p-5 mx-2">
                  <div class="text-primary font-medium mb-2">{{ confirmCloseTitle }}</div>
                  <div class="text-sm text-secondary mb-4">{{ confirmCloseMessage }}</div>
                  <div class="flex justify-end gap-2">
                    <ButtonV2 variant="ghost" size="sm" @click="showCloseConfirm = false">{{ confirmCloseCancelText }}</ButtonV2>
                    <ButtonV2 variant="danger" size="sm" @click="confirmForcedClose">{{ confirmCloseConfirmText }}</ButtonV2>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * Modal v2 - Enterprise Grade Modal для warehouse системы
 * Полнофункциональный модальный компонент с accessibility, анимациями, focus trap
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import IconV2 from '../atoms/Icon.vue'
import ButtonV2 from '../atoms/Button.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg', 'xl', 'fullscreen'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'primary', 'success', 'warning', 'error', 'danger'].includes(value)
  },
  persistent: {
    type: Boolean,
    default: false
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  showDefaultActions: {
    type: Boolean,
    default: false
  },
  confirmText: {
    type: String,
    default: 'Подтвердить'
  },
  cancelText: {
    type: String,
    default: 'Отмена'
  },
  confirmVariant: {
    type: String,
    default: 'primary'
  },
  loading: {
    type: Boolean,
    default: false
  },
  scrollable: {
    type: Boolean,
    default: true
  },
  /**
   * Режим, при котором закрытие (крестик, backdrop, Escape, Cancel) требует подтверждения.
   */
  requireCloseConfirm: {
    type: Boolean,
    default: false
  },
  confirmCloseTitle: {
    type: String,
    default: 'Подтвердите закрытие'
  },
  confirmCloseMessage: {
    type: String,
    default: 'Несохранённые изменения могут быть потеряны. Вы действительно хотите закрыть?'
  },
  confirmCloseConfirmText: {
    type: String,
    default: 'Да, закрыть'
  },
  confirmCloseCancelText: {
    type: String,
    default: 'Остаться'
  }
})

const emit = defineEmits(['update:modelValue', 'close', 'confirm', 'cancel'])

// Refs
const modalRef = ref(null)
const previousActiveElement = ref(null)

// IDs для accessibility
const titleId = computed(() => `modal-title-${Math.random().toString(36).substring(2, 9)}`)
const descriptionId = computed(() => `modal-desc-${Math.random().toString(36).substring(2, 9)}`)

// Сопоставления состояний
const isPersistent = computed(() => props.persistent)
const shouldShowCloseButton = computed(() => props.showCloseButton)
const showCloseConfirm = ref(false)

// Размеры модального окна
const modalClasses = computed(() => {
  const sizeClasses = {
    sm: 'w-full max-w-md sm:max-w-lg modal-min-width-sm',
    md: 'w-full max-w-lg sm:max-w-xl modal-min-width-md',
    lg: 'w-full max-w-2xl sm:max-w-3xl modal-min-width-lg',
    xl: 'w-full max-w-4xl sm:max-w-5xl modal-min-width-xl',
    fullscreen: 'w-full h-full max-w-none max-h-none m-0 rounded-none'
  }
  
  const variantClasses = {
    default: '',
    primary: 'border-primary/30',
    success: 'border-[var(--color-success)]/30',
    warning: 'border-[var(--color-warning)]/30', 
    error: 'border-[var(--color-error)]/30'
  }
  
  return [
    sizeClasses[props.size],
    variantClasses[props.variant]
  ]
})

// Классы для body с учетом скроллинга
const bodyClasses = computed(() => {
  return props.scrollable 
    ? 'p-4 sm:p-6 lg:px-8 modal-content-scrollable' 
    : 'p-4 sm:p-6 lg:px-8 modal-content-hidden'
})

// Методы
const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const requestClose = () => {
  if (props.requireCloseConfirm) {
    showCloseConfirm.value = true
    return
  }
  handleClose()
}

const handleBackdropClick = () => {
  if (!isPersistent.value) {
    requestClose()
  }
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  if (!isPersistent.value) {
    requestClose()
  }
}

// Keyboard handling
const handleKeydown = (event) => {
  if (event.key === 'Escape' && !isPersistent.value) {
    requestClose()
  }
  
  // Focus trap
  if (event.key === 'Tab') {
    trapFocus(event)
  }
}

const confirmForcedClose = () => {
  showCloseConfirm.value = false
  handleClose()
}

// Focus trap implementation
const trapFocus = (event) => {
  if (!modalRef.value) return
  
  const focusableElements = modalRef.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  
  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  
  if (event.shiftKey) {
    if (document.activeElement === firstElement) {
      lastElement?.focus()
      event.preventDefault()
    }
  } else {
    if (document.activeElement === lastElement) {
      firstElement?.focus()
      event.preventDefault()
    }
  }
}

// Body scroll lock
const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
  document.body.style.paddingRight = getScrollbarWidth() + 'px'
}

const unlockBodyScroll = () => {
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
}

const getScrollbarWidth = () => {
  return window.innerWidth - document.documentElement.clientWidth
}

// Focus management
const manageFocus = () => {
  if (props.modelValue) {
    // Сохраняем текущий активный элемент
    previousActiveElement.value = document.activeElement
    
    // Фокусируемся на модальном окне
    nextTick(() => {
      const focusableElement = modalRef.value?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusableElement?.focus()
    })
    
    // Блокируем скролл body
    lockBodyScroll()
    
    // Добавляем обработчик клавиатуры
    document.addEventListener('keydown', handleKeydown)
  } else {
    // Возвращаем фокус на предыдущий элемент
    if (previousActiveElement.value) {
      previousActiveElement.value.focus()
    }
    
    // Разблокируем скролл body
    unlockBodyScroll()
    
    // Удаляем обработчик клавиатуры
    document.removeEventListener('keydown', handleKeydown)
  }
}

// Watchers
watch(() => props.modelValue, manageFocus)

// Cleanup
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  unlockBodyScroll()
})

// Expose public methods for parent components (e.g., to trigger close with confirmation)
defineExpose({
  requestClose
})
</script>

<style scoped>
/* Дополнительные стили для smooth анимаций */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

/* ✅ Расширенные минимальные ширины модальных окон */
.modal-min-width-sm {
  min-width: 500px !important;  /* Увеличено с 400px */
}

.modal-min-width-md {
  min-width: 650px !important;  /* Увеличено с 500px */
}

.modal-min-width-lg {
  min-width: 800px !important;  /* Увеличено с 600px */
}

.modal-min-width-xl {
  min-width: 1000px !important; /* Увеличено с 800px */
}

/* ✅ Планшеты (641px-1024px): умеренные размеры */
@media (min-width: 641px) and (max-width: 1024px) {
  .modal-min-width-sm {
    min-width: 450px !important;
  }
  
  .modal-min-width-md {
    min-width: 550px !important;
  }
  
  .modal-min-width-lg {
    min-width: 650px !important;
  }
  
  .modal-min-width-xl {
    min-width: 750px !important;
  }
}

/* ✅ Мобильные устройства (до 640px): увеличенные размеры */
@media (max-width: 640px) {
  .modal-min-width-sm,
  .modal-min-width-md,
  .modal-min-width-lg,
  .modal-min-width-xl {
    min-width: 380px !important; /* Увеличено с 320px */
    margin-left: 12px !important;
    margin-right: 12px !important;
    max-width: calc(100vw - 24px) !important; /* Не больше экрана */
  }
}

/* ✅ Очень маленькие экраны (до 480px) */
@media (max-width: 480px) {
  .modal-min-width-sm,
  .modal-min-width-md,
  .modal-min-width-lg,
  .modal-min-width-xl {
    min-width: 340px !important;
    margin-left: 8px !important;
    margin-right: 8px !important;
    max-width: calc(100vw - 16px) !important;
  }
}

/* ✅ Улучшенное отображение скролла для всех устройств */
.modal-content-scrollable {
  max-height: calc(82vh - 140px) !important; /* Увеличено для десктопа */
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding-bottom: 20px !important; /* Дополнительный отступ внизу */
  
  /* Стилизация скроллбара */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.modal-content-scrollable::-webkit-scrollbar {
  width: 6px;
}

.modal-content-scrollable::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.modal-content-scrollable::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.modal-content-scrollable::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.modal-content-hidden {
  overflow: hidden !important;
}

/* ✅ Адаптивная высота скролла - улучшенная */
@media (min-height: 1080px) {
  .modal-content-scrollable {
    max-height: calc(82vh - 140px) !important; /* Больше места на очень высоких экранах */
  }
}

@media (min-height: 900px) and (max-height: 1079px) {
  .modal-content-scrollable {
    max-height: calc(80vh - 120px) !important; /* Больше места на высоких экранах */
  }
}

@media (max-height: 800px) {
  .modal-content-scrollable {
    max-height: calc(75vh - 100px) !important; /* Средние экраны */
  }
}

@media (max-height: 700px) {
  .modal-content-scrollable {
    max-height: calc(70vh - 80px) !important; /* Низкие экраны */
  }
}

@media (max-height: 500px) {
  .modal-content-scrollable {
    max-height: calc(60vh - 60px) !important; /* Очень низкие экраны */
  }
}

/* ✅ Дополнительные улучшения для desktop */
@media (min-width: 1024px) {
  .modal-content-scrollable {
    /* Больше места на десктопе */
    padding-left: 32px !important;
    padding-right: 32px !important;
  }
  
  /* Убираем лишние ограничения высоты на больших экранах */
  @media (min-height: 768px) {
    .modal-content-scrollable {
      max-height: calc(85vh - 140px) !important;
    }
  }
}
</style>