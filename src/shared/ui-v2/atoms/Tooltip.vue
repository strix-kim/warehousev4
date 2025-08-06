<template>
  <div 
    :class="tooltipContainerClass"
    ref="tooltipContainer"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <!-- Trigger Element -->
    <slot :tooltip-id="tooltipId" />

    <!-- Tooltip using Teleport -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isVisible"
          ref="tooltipRef"
          :id="tooltipId"
          :class="tooltipClass"
          :style="tooltipStyle"
          role="tooltip"
          :aria-hidden="!isVisible"
        >
          <!-- Tooltip Arrow -->
          <div
            v-if="showArrow"
            :class="arrowClass"
            :style="arrowStyle"
          />
          
          <!-- Tooltip Content -->
          <div :class="contentClass">
            <!-- Custom Content Slot -->
            <slot name="content" :close="hide">
              <!-- Default Text Content -->
              <div v-if="content" v-html="content" />
              
              <!-- Rich Content -->
              <div v-else-if="title || description">
                <div v-if="title" :class="titleClass">{{ title }}</div>
                <div v-if="description" :class="descriptionClass">{{ description }}</div>
              </div>
            </slot>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * TooltipV2 - Smart Tooltip System для warehouse системы
 * Поддержка hover/focus, автопозиционирование, rich content
 */
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  // Content
  content: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  
  // Behavior
  trigger: {
    type: String,
    default: 'hover',
    validator: (value) => ['hover', 'focus', 'click', 'manual'].includes(value)
  },
  placement: {
    type: String,
    default: 'top',
    validator: (value) => [
      'top', 'top-start', 'top-end',
      'bottom', 'bottom-start', 'bottom-end',
      'left', 'left-start', 'left-end',
      'right', 'right-start', 'right-end'
    ].includes(value)
  },
  delay: {
    type: Number,
    default: 100
  },
  hideDelay: {
    type: Number,
    default: 100
  },
  
  // Styling
  variant: {
    type: String,
    default: 'dark',
    validator: (value) => ['dark', 'light', 'error', 'warning', 'success', 'info'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  maxWidth: {
    type: String,
    default: '320px'
  },
  
  // Features
  showArrow: {
    type: Boolean,
    default: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  interactive: {
    type: Boolean,
    default: false
  },
  
  // Accessibility
  describedBy: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['show', 'hide'])

// Refs
const tooltipContainer = ref(null)
const tooltipRef = ref(null)

// State
const isVisible = ref(false)
const tooltipPosition = ref({ top: 0, left: 0 })
const arrowPosition = ref({ top: 0, left: 0 })
const showTimeout = ref(null)
const hideTimeout = ref(null)

// Computed
const tooltipId = computed(() => `tooltip-${Math.random().toString(36).substring(2, 9)}`)

const tooltipContainerClass = computed(() => [
  'inline-block'
])

const tooltipClass = computed(() => {
  const baseClasses = [
    'fixed z-[10000] rounded-lg shadow-lg backdrop-blur-sm',
    'pointer-events-none'
  ]
  
  // Make interactive if needed
  if (props.interactive) {
    baseClasses.push('pointer-events-auto')
  }
  
  // Variant classes
  const variantClasses = {
    dark: 'bg-gray-900 text-white border border-gray-700',
    light: 'bg-accent text-primary border border-secondary/20',
    error: 'bg-error text-white border border-error',
    warning: 'bg-warning text-white border border-warning',
    success: 'bg-success text-white border border-success',
    info: 'bg-info text-white border border-info'
  }
  baseClasses.push(variantClasses[props.variant] || variantClasses.dark)
  
  return baseClasses
})

const tooltipStyle = computed(() => ({
  top: `${tooltipPosition.value.top}px`,
  left: `${tooltipPosition.value.left}px`,
  maxWidth: props.maxWidth
}))

const contentClass = computed(() => {
  const baseClasses = ['relative']
  
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  return baseClasses
})

const titleClass = computed(() => [
  'font-medium mb-1'
])

const descriptionClass = computed(() => [
  'text-sm opacity-90'
])

const arrowClass = computed(() => {
  const baseClasses = ['absolute w-2 h-2 transform rotate-45']
  
  // Variant classes for arrow
  const variantClasses = {
    dark: 'bg-gray-900 border-gray-700',
    light: 'bg-accent border-secondary/20',
    error: 'bg-error border-error',
    warning: 'bg-warning border-warning',
    success: 'bg-success border-success',
    info: 'bg-info border-info'
  }
  baseClasses.push(variantClasses[props.variant] || variantClasses.dark)
  
  // Position classes based on placement
  if (props.placement.startsWith('top')) {
    baseClasses.push('border-r border-b')
  } else if (props.placement.startsWith('bottom')) {
    baseClasses.push('border-l border-t')
  } else if (props.placement.startsWith('left')) {
    baseClasses.push('border-r border-t')
  } else if (props.placement.startsWith('right')) {
    baseClasses.push('border-l border-b')
  }
  
  return baseClasses
})

const arrowStyle = computed(() => ({
  top: `${arrowPosition.value.top}px`,
  left: `${arrowPosition.value.left}px`
}))

// Methods
const calculatePosition = () => {
  if (!tooltipContainer.value || !tooltipRef.value) return
  
  const trigger = tooltipContainer.value
  const tooltip = tooltipRef.value
  
  const triggerRect = trigger.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let top = 0
  let left = 0
  let arrowTop = 0
  let arrowLeft = 0
  
  const offset = 8 // Distance from trigger
  const arrowSize = 8 // Arrow size
  
  // Calculate base position
  switch (props.placement) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - offset
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      arrowTop = tooltipRect.height
      arrowLeft = tooltipRect.width / 2 - arrowSize / 2
      break
      
    case 'top-start':
      top = triggerRect.top - tooltipRect.height - offset
      left = triggerRect.left
      arrowTop = tooltipRect.height
      arrowLeft = 16
      break
      
    case 'top-end':
      top = triggerRect.top - tooltipRect.height - offset
      left = triggerRect.right - tooltipRect.width
      arrowTop = tooltipRect.height
      arrowLeft = tooltipRect.width - 24
      break
      
    case 'bottom':
      top = triggerRect.bottom + offset
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      arrowTop = -arrowSize / 2
      arrowLeft = tooltipRect.width / 2 - arrowSize / 2
      break
      
    case 'bottom-start':
      top = triggerRect.bottom + offset
      left = triggerRect.left
      arrowTop = -arrowSize / 2
      arrowLeft = 16
      break
      
    case 'bottom-end':
      top = triggerRect.bottom + offset
      left = triggerRect.right - tooltipRect.width
      arrowTop = -arrowSize / 2
      arrowLeft = tooltipRect.width - 24
      break
      
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
      left = triggerRect.left - tooltipRect.width - offset
      arrowTop = tooltipRect.height / 2 - arrowSize / 2
      arrowLeft = tooltipRect.width
      break
      
    case 'left-start':
      top = triggerRect.top
      left = triggerRect.left - tooltipRect.width - offset
      arrowTop = 16
      arrowLeft = tooltipRect.width
      break
      
    case 'left-end':
      top = triggerRect.bottom - tooltipRect.height
      left = triggerRect.left - tooltipRect.width - offset
      arrowTop = tooltipRect.height - 24
      arrowLeft = tooltipRect.width
      break
      
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
      left = triggerRect.right + offset
      arrowTop = tooltipRect.height / 2 - arrowSize / 2
      arrowLeft = -arrowSize / 2
      break
      
    case 'right-start':
      top = triggerRect.top
      left = triggerRect.right + offset
      arrowTop = 16
      arrowLeft = -arrowSize / 2
      break
      
    case 'right-end':
      top = triggerRect.bottom - tooltipRect.height
      left = triggerRect.right + offset
      arrowTop = tooltipRect.height - 24
      arrowLeft = -arrowSize / 2
      break
  }
  
  // Adjust for viewport boundaries
  if (left < 0) {
    left = 8
  } else if (left + tooltipRect.width > viewportWidth) {
    left = viewportWidth - tooltipRect.width - 8
  }
  
  if (top < 0) {
    top = 8
  } else if (top + tooltipRect.height > viewportHeight) {
    top = viewportHeight - tooltipRect.height - 8
  }
  
  // Add scroll offset
  top += scrollY
  left += scrollX
  
  tooltipPosition.value = { top, left }
  arrowPosition.value = { top: arrowTop, left: arrowLeft }
}

const show = () => {
  if (props.disabled || isVisible.value) return
  
  clearTimeout(hideTimeout.value)
  
  if (props.delay > 0) {
    showTimeout.value = setTimeout(() => {
      isVisible.value = true
      nextTick(() => {
        calculatePosition()
        emit('show')
      })
    }, props.delay)
  } else {
    isVisible.value = true
    nextTick(() => {
      calculatePosition()
      emit('show')
    })
  }
}

const hide = () => {
  if (!isVisible.value) return
  
  clearTimeout(showTimeout.value)
  
  if (props.hideDelay > 0) {
    hideTimeout.value = setTimeout(() => {
      isVisible.value = false
      emit('hide')
    }, props.hideDelay)
  } else {
    isVisible.value = false
    emit('hide')
  }
}

const handleMouseEnter = () => {
  if (props.trigger === 'hover') {
    show()
  }
}

const handleMouseLeave = () => {
  if (props.trigger === 'hover') {
    hide()
  }
}

const handleFocus = () => {
  if (props.trigger === 'focus' || props.trigger === 'hover') {
    show()
  }
}

const handleBlur = () => {
  if (props.trigger === 'focus' || props.trigger === 'hover') {
    hide()
  }
}

const handleClick = () => {
  if (props.trigger === 'click') {
    if (isVisible.value) {
      hide()
    } else {
      show()
    }
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Escape' && isVisible.value) {
    hide()
  }
}

const handleResize = () => {
  if (isVisible.value) {
    calculatePosition()
  }
}

const handleScroll = () => {
  if (isVisible.value) {
    calculatePosition()
  }
}

// Expose methods
defineExpose({
  show,
  hide,
  isVisible: computed(() => isVisible.value)
})

// Lifecycle
onMounted(() => {
  if (props.trigger === 'click') {
    tooltipContainer.value?.addEventListener('click', handleClick)
  }
  
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  clearTimeout(showTimeout.value)
  clearTimeout(hideTimeout.value)
  
  if (props.trigger === 'click') {
    tooltipContainer.value?.removeEventListener('click', handleClick)
  }
  
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Custom arrow positioning */
.tooltip-arrow {
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.1));
}
</style>