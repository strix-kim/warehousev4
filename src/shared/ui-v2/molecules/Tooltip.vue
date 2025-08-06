<template>
  <div class="relative inline-block" ref="triggerRef">
    <!-- Элемент, при наведении на который показывается tooltip -->
    <div
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
      class="inline-block"
    >
      <slot></slot>
    </div>

    <!-- Tooltip (телепортируется в body) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-95 transform"
        enter-to-class="opacity-100 scale-100 transform"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 scale-100 transform"
        leave-to-class="opacity-0 scale-95 transform"
      >
        <div
          v-if="visible"
          ref="tooltipRef"
          :style="tooltipStyles"
          :class="[
            'absolute z-[60] px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none max-w-xs break-words',
            positionClass
          ]"
          role="tooltip"
          :aria-hidden="!visible"
        >
          <!-- Содержимое tooltip -->
          <div class="relative">
            {{ content }}
            <!-- Стрелка -->
            <div
              :class="[
                'absolute w-2 h-2 bg-gray-900 transform rotate-45',
                arrowClass
              ]"
            ></div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * TooltipV2 - всплывающие подсказки с телепортом для EPR System
 */
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  position: {
    type: String,
    default: 'top',
    validator: (value) => ['top', 'bottom', 'left', 'right'].includes(value)
  },
  delay: {
    type: Number,
    default: 500
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

// Refs
const triggerRef = ref(null)
const tooltipRef = ref(null)
const visible = ref(false)
const tooltipStyles = ref({})
let showTimeout = null
let hideTimeout = null

// Показать tooltip с задержкой
const show = () => {
  if (props.disabled) return
  
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  
  showTimeout = setTimeout(() => {
    visible.value = true
    nextTick(() => {
      calculatePosition()
    })
  }, props.delay)
}

// Скрыть tooltip
const hide = () => {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }
  
  hideTimeout = setTimeout(() => {
    visible.value = false
  }, 100)
}

// Вычисление позиции
const calculatePosition = () => {
  if (!triggerRef.value || !tooltipRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const tooltipRect = tooltipRef.value.getBoundingClientRect()
  const spacing = 8

  let top, left

  switch (props.position) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - spacing
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      break
    case 'bottom':
      top = triggerRect.bottom + spacing
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      break
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
      left = triggerRect.left - tooltipRect.width - spacing
      break
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
      left = triggerRect.right + spacing
      break
  }

  // Проверка границ экрана
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  }

  if (left < 8) left = 8
  if (left + tooltipRect.width > viewport.width - 8) {
    left = viewport.width - tooltipRect.width - 8
  }
  if (top < 8) top = 8
  if (top + tooltipRect.height > viewport.height - 8) {
    top = viewport.height - tooltipRect.height - 8
  }

  tooltipStyles.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`
  }
}

// Computed классы для позиционирования и стрелки
const positionClass = computed(() => {
  return `tooltip-${props.position}`
})

const arrowClass = computed(() => {
  switch (props.position) {
    case 'top':
      return 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2'
    case 'bottom':
      return 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2'
    case 'left':
      return 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2'
    case 'right':
      return 'right-full top-1/2 -translate-y-1/2 translate-x-1/2'
    default:
      return ''
  }
})

// Очистка таймеров при размонтировании
onUnmounted(() => {
  if (showTimeout) clearTimeout(showTimeout)
  if (hideTimeout) clearTimeout(hideTimeout)
})
</script>

<style scoped>
/* Дополнительные стили для tooltip */
.tooltip-top {
  transform-origin: bottom center;
}

.tooltip-bottom {
  transform-origin: top center;
}

.tooltip-left {
  transform-origin: right center;
}

.tooltip-right {
  transform-origin: left center;
}
</style>