<template>
  <div :class="tabsContainerClass">
    <!-- Tabs Navigation -->
    <div :class="tabsListClass" role="tablist" :aria-orientation="orientation">
      <button
        v-for="(tab, index) in tabs"
        :key="getTabKey(tab, index)"
        :class="getTabButtonClass(index)"
        :aria-selected="activeIndex === index"
        :aria-controls="`panel-${getTabKey(tab, index)}`"
        :id="`tab-${getTabKey(tab, index)}`"
        role="tab"
        :disabled="tab.disabled"
        @click="handleTabClick(index)"
        @keydown="handleKeydown($event, index)"
      >
        <!-- Tab Icon -->
        <IconV2
          v-if="tab.icon"
          :name="tab.icon"
          :size="iconSize"
          :class="getTabIconClass(index)"
        />
        
        <!-- Tab Label -->
        <span :class="getTabLabelClass(index)">{{ getTabLabel(tab) }}</span>
        
        <!-- Tab Badge -->
        <StatusBadgeV2
          v-if="tab.badge"
          :label="tab.badge.label"
          :variant="tab.badge.variant"
          size="xs"
          :class="getTabBadgeClass(index)"
        />
        
        <!-- Close Button -->
        <button
          v-if="tab.closable && !tab.disabled"
          type="button"
          :class="closeButtonClass"
          @click.stop="handleTabClose(index)"
          :aria-label="`Закрыть ${getTabLabel(tab)}`"
        >
          <IconV2 name="x" size="xs" />
        </button>
      </button>
      
      <!-- Add Tab Button -->
      <button
        v-if="addable"
        type="button"
        :class="addButtonClass"
        @click="handleAddTab"
        aria-label="Добавить вкладку"
      >
        <IconV2 name="plus" :size="iconSize" />
      </button>
      
      <!-- Mobile Dropdown Trigger -->
      <button
        v-if="isMobile && tabs.length > 3"
        type="button"
        :class="mobileDropdownClass"
        @click="showMobileDropdown = !showMobileDropdown"
        aria-label="Показать все вкладки"
      >
        <IconV2 name="chevron-down" size="sm" />
      </button>
    </div>
    
    <!-- Mobile Dropdown Menu -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showMobileDropdown && isMobile"
        :class="mobileMenuClass"
        class="tabs-container"
      >
        <button
          v-for="(tab, index) in tabs"
          :key="`mobile-${getTabKey(tab, index)}`"
          :class="getMobileTabClass(index)"
          @click="handleMobileTabClick(index)"
        >
          <IconV2 v-if="tab.icon" :name="tab.icon" size="sm" />
          <span>{{ getTabLabel(tab) }}</span>
          <StatusBadgeV2
            v-if="tab.badge"
            :label="tab.badge.label"
            :variant="tab.badge.variant"
            size="xs"
          />
        </button>
      </div>
    </Transition>

    <!-- Tab Panels -->
    <div :class="panelsContainerClass">
      <div
        v-for="(tab, index) in tabs"
        :key="`panel-${getTabKey(tab, index)}`"
        v-show="activeIndex === index"
        :class="tabPanelClass"
        :id="`panel-${getTabKey(tab, index)}`"
        :aria-labelledby="`tab-${getTabKey(tab, index)}`"
        role="tabpanel"
        :tabindex="activeIndex === index ? 0 : -1"
      >
        <!-- Custom Panel Content -->
        <slot
          :name="tab.slot || `panel-${index}`"
          :tab="tab"
          :index="index"
          :is-active="activeIndex === index"
        >
          <!-- Default Panel Content -->
          <div v-if="tab.content" v-html="tab.content" />
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * TabsV2 - Smart Tabs System для warehouse системы
 * Поддержка keyboard navigation, мобильная адаптация, closable tabs
 */
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import IconV2 from '../atoms/Icon.vue'
import StatusBadgeV2 from '../atoms/StatusBadge.vue'

const props = defineProps({
  // Tabs data
  tabs: {
    type: Array,
    required: true,
    default: () => []
    // [{ label: 'Tab', value: 'tab1', icon?: 'icon', badge?: {label, variant}, content?: 'html', slot?: 'slot-name', disabled?: false, closable?: false }]
  },
  
  // Active tab
  modelValue: {
    type: [String, Number],
    default: null
  },
  
  // Tab config keys
  labelKey: {
    type: String,
    default: 'label'
  },
  valueKey: {
    type: String,
    default: 'value'
  },
  
  // Styling
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'pills', 'underline', 'minimal'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  
  // Behavior
  orientation: {
    type: String,
    default: 'horizontal',
    validator: (value) => ['horizontal', 'vertical'].includes(value)
  },
  addable: {
    type: Boolean,
    default: false
  },
  scrollable: {
    type: Boolean,
    default: true
  },
  
  // Mobile
  mobileBreakpoint: {
    type: Number,
    default: 768
  }
})

const emit = defineEmits(['update:modelValue', 'tab-click', 'tab-close', 'tab-add'])

// State
const activeIndex = ref(0)
const showMobileDropdown = ref(false)
const isMobile = ref(false)

// Computed
const tabsContainerClass = computed(() => {
  const baseClasses = ['w-full']
  
  if (props.orientation === 'vertical') {
    baseClasses.push('flex flex-row gap-4')
  }
  
  return baseClasses
})

const tabsListClass = computed(() => {
  const baseClasses = [
    'flex transition-all duration-200',
    'relative'
  ]
  
  // Orientation
  if (props.orientation === 'horizontal') {
    baseClasses.push('flex-row')
    if (props.scrollable) {
      baseClasses.push('overflow-x-auto scrollbar-thin scrollbar-thumb-secondary/30')
    }
  } else {
    baseClasses.push('flex-col flex-shrink-0 w-48')
  }
  
  // Variant specific classes
  const variantClasses = {
    default: 'border-b border-secondary/20',
    pills: 'bg-secondary/5 p-1 rounded-lg',
    underline: 'border-b border-secondary/20',
    minimal: ''
  }
  baseClasses.push(variantClasses[props.variant] || variantClasses.default)
  
  return baseClasses
})

const iconSize = computed(() => {
  const sizes = {
    sm: 'xs',
    md: 'sm',
    lg: 'sm'
  }
  return sizes[props.size] || 'sm'
})

const closeButtonClass = computed(() => [
  'ml-2 p-0.5 rounded text-secondary/60 hover:text-error hover:bg-error/10',
  'transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-error/30'
])

const addButtonClass = computed(() => {
  const baseClasses = [
    'flex items-center justify-center ml-2 transition-colors duration-150',
    'text-secondary hover:text-primary focus:outline-none'
  ]
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  if (props.variant === 'pills') {
    baseClasses.push('rounded-md hover:bg-primary/10')
  }
  
  return baseClasses
})

const mobileDropdownClass = computed(() => [
  'md:hidden ml-2 p-2 text-secondary hover:text-primary',
  'transition-colors duration-150'
])

const mobileMenuClass = computed(() => [
  'absolute top-full left-0 right-0 mt-1 z-50',
  'bg-accent border border-secondary/20 rounded-lg shadow-lg',
  'backdrop-blur-sm py-1 md:hidden'
])

const panelsContainerClass = computed(() => {
  const baseClasses = ['mt-4']
  
  if (props.orientation === 'vertical') {
    baseClasses.push('flex-1')
  }
  
  return baseClasses
})

const tabPanelClass = computed(() => [
  'focus:outline-none'
])

// Methods
const getTabLabel = (tab) => {
  return typeof tab === 'string' ? tab : tab[props.labelKey] || ''
}

const getTabValue = (tab) => {
  return typeof tab === 'string' ? tab : tab[props.valueKey] || tab
}

const getTabKey = (tab, index) => {
  const value = getTabValue(tab)
  return value !== null && value !== undefined ? value : index
}

const getTabButtonClass = (index) => {
  const baseClasses = [
    'relative flex items-center gap-2 transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-primary/30',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ]
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  // Variant specific classes
  const isActive = activeIndex.value === index
  
  if (props.variant === 'default' || props.variant === 'underline') {
    if (isActive) {
      baseClasses.push('text-primary border-b-2 border-primary')
    } else {
      baseClasses.push('text-secondary hover:text-primary border-b-2 border-transparent')
    }
  } else if (props.variant === 'pills') {
    baseClasses.push('rounded-md')
    if (isActive) {
      baseClasses.push('bg-primary text-white shadow-sm')
    } else {
      baseClasses.push('text-secondary hover:text-primary hover:bg-primary/10')
    }
  } else if (props.variant === 'minimal') {
    if (isActive) {
      baseClasses.push('text-primary bg-primary/5')
    } else {
      baseClasses.push('text-secondary hover:text-primary hover:bg-primary/5')
    }
    baseClasses.push('rounded-md')
  }
  
  return baseClasses
}

const getTabIconClass = (index) => {
  const isActive = activeIndex.value === index
  return isActive ? 'text-current' : 'text-current opacity-70'
}

const getTabLabelClass = (index) => {
  return 'truncate'
}

const getTabBadgeClass = (index) => {
  return 'ml-1'
}

const getMobileTabClass = (index) => {
  const baseClasses = [
    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors duration-150',
    'hover:bg-primary/5 focus:outline-none focus:bg-primary/5'
  ]
  
  if (activeIndex.value === index) {
    baseClasses.push('text-primary bg-primary/10')
  } else {
    baseClasses.push('text-secondary')
  }
  
  return baseClasses
}

const handleTabClick = (index) => {
  if (props.tabs[index]?.disabled) return
  
  activeIndex.value = index
  const tabValue = getTabValue(props.tabs[index])
  
  emit('update:modelValue', tabValue)
  emit('tab-click', { tab: props.tabs[index], index, value: tabValue })
}

const handleMobileTabClick = (index) => {
  handleTabClick(index)
  showMobileDropdown.value = false
}

const handleTabClose = (index) => {
  const tab = props.tabs[index]
  const tabValue = getTabValue(tab)
  
  emit('tab-close', { tab, index, value: tabValue })
}

const handleAddTab = () => {
  emit('tab-add')
}

const handleKeydown = (event, index) => {
  let newIndex = index
  
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault()
      newIndex = index > 0 ? index - 1 : props.tabs.length - 1
      break
      
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      newIndex = index < props.tabs.length - 1 ? index + 1 : 0
      break
      
    case 'Home':
      event.preventDefault()
      newIndex = 0
      break
      
    case 'End':
      event.preventDefault()
      newIndex = props.tabs.length - 1
      break
      
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleTabClick(index)
      return
      
    default:
      return
  }
  
  // Skip disabled tabs
  while (props.tabs[newIndex]?.disabled && newIndex !== index) {
    if (newIndex < index) {
      newIndex = newIndex > 0 ? newIndex - 1 : props.tabs.length - 1
    } else {
      newIndex = newIndex < props.tabs.length - 1 ? newIndex + 1 : 0
    }
  }
  
  if (!props.tabs[newIndex]?.disabled) {
    handleTabClick(newIndex)
  }
}

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < props.mobileBreakpoint
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.tabs-container')) {
    showMobileDropdown.value = false
  }
}

// Initialize active tab
const initializeActiveTab = () => {
  if (props.modelValue !== null && props.modelValue !== undefined) {
    const index = props.tabs.findIndex(tab => getTabValue(tab) === props.modelValue)
    if (index !== -1) {
      activeIndex.value = index
    }
  } else {
    // Если modelValue не задан, выбираем первый не-disabled таб
    const firstEnabledIndex = props.tabs.findIndex(tab => !tab.disabled)
    if (firstEnabledIndex !== -1) {
      activeIndex.value = firstEnabledIndex
    }
  }
}

// Watch for external value changes
watch(() => props.modelValue, () => {
  initializeActiveTab()
})

watch(() => props.tabs, () => {
  // Reset to first tab if current active tab no longer exists
  if (activeIndex.value >= props.tabs.length) {
    activeIndex.value = 0
    if (props.tabs.length > 0) {
      const tabValue = getTabValue(props.tabs[0])
      emit('update:modelValue', tabValue)
    }
  }
}, { deep: true })

// Lifecycle
onMounted(() => {
  initializeActiveTab()
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Smooth scrolling for horizontal tabs */
.overflow-x-auto {
  scroll-behavior: smooth;
}

/* Hide scrollbar on mobile */
@media (max-width: 767px) {
  .overflow-x-auto {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .overflow-x-auto::-webkit-scrollbar {
    display: none;
  }
}

/* Custom scrollbar for webkit browsers */
.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(141, 153, 174, 0.3);
  border-radius: 2px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(141, 153, 174, 0.5);
}
</style>