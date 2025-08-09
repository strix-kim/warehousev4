<template>
  <div :class="dropdownContainerClass" ref="dropdownContainer">
    <!-- Trigger Element -->
    <div ref="triggerRef">
      <slot
        name="trigger"
        :is-open="isOpen"
        :toggle="toggle"
        :close="close"
      >
        <!-- Default Trigger Button -->
        <ButtonV2
          :variant="triggerVariant"
          :size="triggerSize"
          :disabled="disabled"
          @click="toggle"
          :aria-expanded="isOpen"
          aria-haspopup="menu"
          :aria-controls="menuId"
          :aria-label="triggerLabel"
        >
          <span v-if="triggerText">{{ triggerText }}</span>
          <IconV2 :name="triggerIcon" :size="iconSize" />
        </ButtonV2>
      </slot>
    </div>

    <!-- Dropdown Menu using Teleport -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 scale-95 translate-y-1"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-1"
      >
        <div
          v-if="isOpen"
          ref="menuRef"
          :class="menuClass"
          :style="menuStyle"
          role="menu"
          :id="menuId"
          :aria-orientation="orientation"
          @keydown="handleMenuKeydown"
        >
          <!-- Menu Header -->
          <div v-if="$slots.header || title" :class="headerClass">
            <slot name="header">
              <h3 v-if="title" class="text-sm font-medium text-primary">{{ title }}</h3>
            </slot>
          </div>

          <!-- Menu Items -->
          <div :class="itemsContainerClass">
            <template v-for="(item, index) in items" :key="getItemKey(item, index)">
              <!-- Divider -->
              <div
                v-if="item.type === 'divider'"
                :class="dividerClass"
                role="separator"
              />
              
              <!-- Group Header -->
              <div
                v-else-if="item.type === 'header'"
                :class="groupHeaderClass"
              >
                {{ getItemLabel(item) }}
              </div>
              
              <!-- Menu Item -->
              <div
                v-else
                :class="getItemClass(item, index)"
                :role="item.href ? 'none' : 'menuitem'"
                :tabindex="item.disabled ? -1 : 0"
                :aria-disabled="item.disabled"
                @click="handleItemClick(item, index)"
                @keydown="handleItemKeydown($event, item, index)"
                @mouseenter="focusedIndex = index"
              >
                <!-- Item as Link -->
                <a
                  v-if="item.href"
                  :href="item.href"
                  :target="item.target"
                  :class="itemLinkClass"
                  role="menuitem"
                >
                  <div class="flex items-center gap-3">
                    <IconV2
                      v-if="item.icon"
                      :name="item.icon"
                      :size="iconSize"
                      :class="getItemIconClass(item)"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium truncate">{{ getItemLabel(item) }}</div>
                      <div v-if="item.description" class="text-xs text-secondary truncate mt-0.5">
                        {{ item.description }}
                      </div>
                    </div>
                    <div v-if="item.shortcut" class="text-xs text-secondary font-mono">
                      {{ item.shortcut }}
                    </div>
                  </div>
                </a>
                
                <!-- Item as Button -->
                <div v-else class="flex items-center gap-3">
                  <IconV2
                    v-if="item.icon"
                    :name="item.icon"
                    :size="iconSize"
                    :class="getItemIconClass(item)"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{{ getItemLabel(item) }}</div>
                    <div v-if="item.description" class="text-xs text-secondary truncate mt-0.5">
                      {{ item.description }}
                    </div>
                  </div>
                  <div v-if="item.shortcut" class="text-xs text-secondary font-mono">
                    {{ item.shortcut }}
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Menu Footer -->
          <div v-if="$slots.footer" :class="footerClass">
            <slot name="footer" :close="close" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Backdrop for mobile -->
    <Teleport to="body">
      <div
        v-if="isOpen && isMobile"
        class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998]"
        @click="close"
      />
    </Teleport>
  </div>
</template>

<script setup>
/**
 * DropdownV2 - Smart Dropdown Menu для warehouse системы
 * Поддержка keyboard navigation, позиционирование, группировка элементов
 */
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { computePosition, autoUpdate, offset, flip, shift, size } from '@floating-ui/dom'
import ButtonV2 from '../atoms/Button.vue'
import IconV2 from '../atoms/Icon.vue'

const props = defineProps({
  // Menu items
  items: {
    type: Array,
    default: () => []
    // [{ label: 'Item', value: 'item1', icon?: 'icon', href?: 'url', target?: '_blank', disabled?: false, type?: 'item|divider|header', description?: 'text', shortcut?: 'Ctrl+S' }]
  },
  
  // Item config
  labelKey: {
    type: String,
    default: 'label'
  },
  valueKey: {
    type: String,
    default: 'value'
  },
  
  // Trigger config
  triggerText: {
    type: String,
    default: ''
  },
  triggerIcon: {
    type: String,
    default: 'chevron-down'
  },
  triggerVariant: {
    type: String,
    default: 'ghost'
  },
  triggerSize: {
    type: String,
    default: 'md'
  },
  triggerLabel: {
    type: String,
    default: 'Открыть меню'
  },
  
  // Menu config
  title: {
    type: String,
    default: ''
  },
  placement: {
    type: String,
    default: 'bottom-start',
    validator: (value) => [
      'top', 'top-start', 'top-end',
      'bottom', 'bottom-start', 'bottom-end',
      'left', 'left-start', 'left-end',
      'right', 'right-start', 'right-end'
    ].includes(value)
  },
  
  // Styling
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'minimal'].includes(value)
  },
  width: {
    type: String,
    default: 'auto', // 'auto', 'trigger', '200px', etc.
  },
  maxHeight: {
    type: String,
    default: '320px'
  },
  
  // Behavior
  disabled: {
    type: Boolean,
    default: false
  },
  closeOnSelect: {
    type: Boolean,
    default: true
  },
  orientation: {
    type: String,
    default: 'vertical',
    validator: (value) => ['vertical', 'horizontal'].includes(value)
  },
  
  // Mobile
  mobileBreakpoint: {
    type: Number,
    default: 768
  }
})

const emit = defineEmits(['select', 'open', 'close'])

// Refs
const dropdownContainer = ref(null)
const triggerRef = ref(null)
const menuRef = ref(null)
const menuId = computed(() => `dropdown-menu-${Math.random().toString(36).slice(2, 9)}`)

// State
const isOpen = ref(false)
const focusedIndex = ref(-1)
const menuPosition = ref({ top: 0, left: 0 })
const isMobile = ref(false)

// Computed
const dropdownContainerClass = computed(() => [
  'relative inline-block'
])

const menuClass = computed(() => {
  const baseClasses = [
    'fixed z-[9999] rounded-lg shadow-lg border backdrop-blur-sm',
    'focus:outline-none'
  ]
  
  // Variant classes
  if (props.variant === 'default') {
    baseClasses.push('bg-accent border-secondary/20')
  } else {
    baseClasses.push('bg-accent/95 border-secondary/10')
  }
  
  // Mobile specific
  if (isMobile.value) {
    baseClasses.push('left-4 right-4 bottom-4')
  }
  
  return baseClasses
})

const menuStyle = computed(() => {
  if (isMobile.value) {
    return {
      maxHeight: '60vh'
    }
  }
  
  return {
    top: `${menuPosition.value.top}px`,
    left: `${menuPosition.value.left}px`,
    width: props.width === 'auto' ? 'auto' : 
           props.width === 'trigger' ? `${menuPosition.value.width}px` : 
           props.width,
    maxHeight: props.maxHeight
  }
})

const headerClass = computed(() => [
  'px-3 py-2 border-b border-secondary/10'
])

const itemsContainerClass = computed(() => [
  'py-1 overflow-y-auto'
])

const footerClass = computed(() => [
  'px-3 py-2 border-t border-secondary/10'
])

const dividerClass = computed(() => [
  'my-1 border-t border-secondary/10'
])

const groupHeaderClass = computed(() => [
  'px-3 py-2 text-xs font-medium text-secondary uppercase tracking-wide'
])

const iconSize = computed(() => {
  const sizes = {
    sm: 'xs',
    md: 'sm',
    lg: 'sm'
  }
  return sizes[props.size] || 'sm'
})

const itemLinkClass = computed(() => [
  'block w-full text-left focus:outline-none'
])

// Methods
const getItemLabel = (item) => {
  return typeof item === 'string' ? item : item[props.labelKey] || ''
}

const getItemValue = (item) => {
  return typeof item === 'string' ? item : item[props.valueKey] || item
}

const getItemKey = (item, index) => {
  const value = getItemValue(item)
  return value !== null && value !== undefined ? value : index
}

const getItemClass = (item, index) => {
  const baseClasses = [
    'transition-colors duration-150 cursor-pointer',
    'focus:outline-none'
  ]
  
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  // State classes
  if (item.disabled) {
    baseClasses.push('opacity-50 cursor-not-allowed text-secondary')
  } else if (focusedIndex.value === index) {
    baseClasses.push('bg-primary/10 text-primary')
  } else {
    baseClasses.push('text-primary hover:bg-primary/5')
  }
  
  // Variant classes
  if (item.variant === 'danger') {
    baseClasses.push('text-error hover:bg-error/5')
  }
  
  return baseClasses
}

const getItemIconClass = (item) => {
  const baseClasses = ['flex-shrink-0']
  
  if (item.variant === 'danger') {
    baseClasses.push('text-error')
  } else {
    baseClasses.push('text-secondary')
  }
  
  return baseClasses
}

let cleanupAutoUpdate
const updateMenuPosition = async () => {
  if (!triggerRef.value || !menuRef.value || isMobile.value) return
  if (cleanupAutoUpdate) {
    cleanupAutoUpdate()
    cleanupAutoUpdate = undefined
  }
  cleanupAutoUpdate = autoUpdate(triggerRef.value, menuRef.value, async () => {
    const { x, y, placement, middlewareData, rects } = await computePosition(triggerRef.value, menuRef.value, {
      placement: props.placement.replace('-start', '-start').replace('-end', '-end'),
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 8 }),
        size({
          apply({ availableHeight, elements }) {
            elements.floating.style.maxHeight = `${Math.min(availableHeight, parseInt(props.maxHeight))}px`
          }
        })
      ]
    })
    menuPosition.value = { top: y, left: x, width: rects.reference.width }
  })
}

const toggle = () => {
  if (props.disabled) return
  
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

const open = () => {
  if (props.disabled || isOpen.value) return
  
  isOpen.value = true
  focusedIndex.value = -1
  
  nextTick(() => {
    updateMenuPosition()
    emit('open')
  })
}

const close = () => {
  if (!isOpen.value) return
  
  isOpen.value = false
  focusedIndex.value = -1
  emit('close')
}

const handleItemClick = (item, index) => {
  if (item.disabled || item.type === 'divider' || item.type === 'header') return
  
  const value = getItemValue(item)
  emit('select', { item, index, value })
  
  if (props.closeOnSelect && !item.href) {
    close()
  }
}

const handleMenuKeydown = (event) => {
  const enabledItems = props.items.filter((item, index) => 
    !item.disabled && item.type !== 'divider' && item.type !== 'header'
  )
  
  if (enabledItems.length === 0) return
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveFocus(1)
      break
      
    case 'ArrowUp':
      event.preventDefault()
      moveFocus(-1)
      break
      
    case 'Home':
      event.preventDefault()
      focusFirstItem()
      break
      
    case 'End':
      event.preventDefault()
      focusLastItem()
      break
      
    case 'Escape':
      event.preventDefault()
      close()
      break
      
    case 'Tab':
      close()
      break
  }
}

const handleItemKeydown = (event, item, index) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleItemClick(item, index)
      break
  }
}

const moveFocus = (direction) => {
  const enabledIndices = props.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.disabled && item.type !== 'divider' && item.type !== 'header')
    .map(({ index }) => index)
  
  if (enabledIndices.length === 0) return
  
  let currentIndex = enabledIndices.indexOf(focusedIndex.value)
  
  if (currentIndex === -1) {
    focusedIndex.value = direction > 0 ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1]
  } else {
    const nextIndex = currentIndex + direction
    if (nextIndex >= 0 && nextIndex < enabledIndices.length) {
      focusedIndex.value = enabledIndices[nextIndex]
    } else if (direction > 0) {
      focusedIndex.value = enabledIndices[0]
    } else {
      focusedIndex.value = enabledIndices[enabledIndices.length - 1]
    }
  }
}

const focusFirstItem = () => {
  const firstEnabledIndex = props.items.findIndex(item => 
    !item.disabled && item.type !== 'divider' && item.type !== 'header'
  )
  if (firstEnabledIndex !== -1) {
    focusedIndex.value = firstEnabledIndex
  }
}

const focusLastItem = () => {
  for (let i = props.items.length - 1; i >= 0; i--) {
    const item = props.items[i]
    if (!item.disabled && item.type !== 'divider' && item.type !== 'header') {
      focusedIndex.value = i
      break
    }
  }
}

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < props.mobileBreakpoint
}

const handleResize = () => {
  updateIsMobile()
  if (isOpen.value) {
    updateMenuPosition()
  }
}

const handleClickOutside = (event) => {
  if (dropdownContainer.value && !dropdownContainer.value.contains(event.target)) {
    close()
  }
}

// Expose methods
defineExpose({
  open,
  close,
  toggle,
  isOpen: computed(() => isOpen.value)
})

// Lifecycle
onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', updateMenuPosition)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', updateMenuPosition)
  document.removeEventListener('click', handleClickOutside)
  if (cleanupAutoUpdate) cleanupAutoUpdate()
})
</script>

<style scoped>
/* Smooth transitions */
.transition-colors {
  transition-property: color, background-color;
}
</style>