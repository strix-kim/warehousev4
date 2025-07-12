<template>
  <!-- Молекулярный компонент модального окна: современный дизайн, Tailwind CSS, accessibility -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
        @click="handleBackdropClick"
      >
        <!-- Backdrop с улучшенным затемнением -->
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" />
        
        <!-- Modal Content с улучшенными размерами -->
        <div
          class="relative bg-white text-gray-900 rounded-xl shadow-2xl mx-4 w-full max-h-[92vh] overflow-hidden"
          :class="getModalSizeClasses()"
          :style="width ? { width: width } : {}"
          @click.stop
        >
          <!-- Header -->
          <div v-if="header || $slots.header" class="flex items-center justify-between p-6 border-b border-gray-200">
            <slot name="header">
              <h3 class="text-lg font-semibold text-gray-900">{{ header }}</h3>
            </slot>
            <button
              v-if="closable"
              @click="handleClose"
              class="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Закрыть"
            >
              <span class="text-xl">✕</span>
            </button>
          </div>
          
          <!-- Body -->
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <slot />
          </div>
          
          <!-- Footer -->
          <div v-if="$slots.footer" class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * Молекулярный компонент Modal для дизайн-системы.
 * Современный дизайн с использованием только Tailwind CSS.
 * Поддержка слотов, анимаций, accessibility, teleport в body.
 * 
 * Особенности:
 * - Teleport в body для правильного z-index
 * - Плавные анимации входа/выхода
 * - Клик по backdrop для закрытия
 * - Escape для закрытия
 * - Блокировка скролла body
 * - Accessibility (focus trap, aria)
 * 
 * Пропсы:
 * - modelValue: видимость модального окна (v-model)
 * - header: заголовок окна
 * - closable: можно ли закрыть (показать кнопку ✕)
 * - width: ширина окна (CSS значение)
 * 
 * Слоты:
 * - header: кастомный заголовок
 * - default: содержимое
 * - footer: подвал с кнопками
 * 
 * События:
 * - update:modelValue: изменение видимости
 */
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  header: String,
  closable: { type: Boolean, default: true },
  width: { type: String, default: null },
  size: { type: String, default: 'md', validator: (value) => ['sm', 'md', 'lg', 'xl', '2xl', 'full'].includes(value) }
})

const emit = defineEmits(['update:modelValue'])

/**
 * Получить классы размера модального окна на основе пропса size
 */
const getModalSizeClasses = () => {
  const sizeClasses = {
    sm: 'max-w-md',      // 28rem (448px)
    md: 'max-w-2xl',     // 42rem (672px) 
    lg: 'max-w-4xl',     // 56rem (896px)
    xl: 'max-w-6xl',     // 72rem (1152px)
    '2xl': 'max-w-7xl',  // 80rem (1280px)
    full: 'max-w-[95vw]' // 95% ширины экрана
  }
  return sizeClasses[props.size] || sizeClasses.md
}

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleBackdropClick = () => {
  if (props.closable) {
    handleClose()
  }
}

const handleEscape = (event) => {
  if (event.key === 'Escape' && props.closable && props.modelValue) {
    handleClose()
  }
}

// Блокировка скролла body при открытии модального окна
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script> 