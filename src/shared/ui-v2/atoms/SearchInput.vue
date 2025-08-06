<template>
  <div :class="searchContainerClass" ref="searchContainer">
    <!-- Search Input -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <IconV2 
          :name="searchIcon" 
          :size="iconSize" 
          class="text-secondary transition-colors duration-200"
          :class="{ 'text-primary': isFocused }"
        />
      </div>
      
      <input
        ref="inputRef"
        v-model="localValue"
        :type="inputType"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="inputClass"
        :autocomplete="autocomplete"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
        @keyup.esc="handleEscape"
      />
      
      <!-- Clear Button -->
      <button
        v-if="clearable && localValue && !disabled"
        type="button"
        @click="handleClear"
        :class="clearButtonClass"
        :title="clearText"
      >
        <IconV2 name="x" :size="iconSize" />
      </button>
      
      <!-- Loading Spinner -->
      <div
        v-if="loading"
        class="absolute inset-y-0 right-3 flex items-center pointer-events-none"
        :class="{ 'right-10': clearable && localValue }"
      >
        <SpinnerV2 :size="iconSize === 'sm' ? 'xs' : 'sm'" variant="primary" />
      </div>
    </div>

    <!-- Results Dropdown с Teleport для избежания обрезания -->
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
          v-if="showResults && (filteredResults.length > 0 || showNoResults)"
          ref="dropdownRef"
          :class="resultsClass"
          :style="dropdownStyle"
        >
        <!-- Results List -->
        <div v-if="filteredResults.length > 0" class="py-1">
          <!-- Group Headers -->
          <template v-for="(group, groupIndex) in groupedResults" :key="`group-${groupIndex}`">
            <div 
              v-if="group.title && groupedResults.length > 1"
              class="px-3 py-2 text-xs font-medium text-secondary uppercase tracking-wide border-b border-secondary/10"
            >
              {{ group.title }}
            </div>
            
            <!-- Group Items -->
            <div
              v-for="(result, index) in group.items"
              :key="getResultKey(result, index)"
              @click="handleSelect(result)"
              @mouseenter="hoveredIndex = result._originalIndex"
              :class="getResultItemClass(result._originalIndex)"
            >
              <!-- Custom Result Template -->
              <slot
                name="result"
                :result="result"
                :index="result._originalIndex"
                :query="localValue"
                :is-highlighted="hoveredIndex === result._originalIndex"
              >
                <!-- Default Result Template -->
                <div class="flex items-center gap-3">
                  <!-- Result Icon -->
                  <div v-if="result.icon" class="flex-shrink-0">
                    <IconV2 :name="result.icon" size="sm" class="text-secondary" />
                  </div>
                  
                  <!-- Result Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span 
                        class="font-medium text-primary truncate"
                        v-html="highlightMatch(getResultLabel(result), localValue)"
                      />
                      <StatusBadgeV2
                        v-if="result.badge"
                        :label="result.badge.label"
                        :variant="result.badge.variant"
                        size="xs"
                      />
                    </div>
                    <div 
                      v-if="result.description || getResultDescription(result)" 
                      class="text-xs text-secondary truncate mt-0.5"
                      v-html="highlightMatch(result.description || getResultDescription(result), localValue)"
                    />
                  </div>
                  
                  <!-- Result Meta -->
                  <div v-if="result.meta" class="flex-shrink-0 text-xs text-secondary">
                    {{ result.meta }}
                  </div>
                </div>
              </slot>
            </div>
          </template>
        </div>

        <!-- No Results -->
        <div v-else-if="showNoResults" class="px-3 py-4 text-center">
          <IconV2 name="search" size="md" class="text-secondary/50 mb-2" />
          <p class="text-sm text-secondary">{{ noResultsText }}</p>
          <slot name="no-results" :query="localValue" />
        </div>

        <!-- Footer Actions -->
        <div v-if="$slots.footer" class="border-t border-secondary/10 p-2">
          <slot name="footer" :query="localValue" :results="filteredResults" />
        </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Backdrop для мобильных устройств -->
    <Teleport to="body">
      <div
        v-if="showResults && isMobile"
        class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998]"
        @click="handleBlur"
      />
    </Teleport>
  </div>
</template>

<script setup>
/**
 * SearchInput v2 - Smart Search System для EPR System
 * Умный поиск с автокомплитом, группировкой, подсветкой совпадений
 */
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import IconV2 from './Icon.vue'
import SpinnerV2 from './Spinner.vue'
import StatusBadgeV2 from './StatusBadge.vue'

const props = defineProps({
  // Value
  modelValue: {
    type: String,
    default: ''
  },
  
  // Input config
  placeholder: {
    type: String,
    default: 'Поиск...'
  },
  type: {
    type: String,
    default: 'search',
    validator: (value) => ['search', 'text'].includes(value)
  },
  autocomplete: {
    type: String,
    default: 'off'
  },
  
  // Search behavior
  debounceDelay: {
    type: Number,
    default: 300
  },
  minSearchLength: {
    type: Number,
    default: 1
  },
  maxResults: {
    type: Number,
    default: 10
  },
  
  // Results data
  results: {
    type: Array,
    default: () => []
    // [{ label: 'Text', value: 'val', description?: 'Desc', icon?: 'icon', badge?: {label, variant}, meta?: 'Meta' }]
  },
  resultLabelKey: {
    type: String,
    default: 'label'
  },
  resultValueKey: {
    type: String,
    default: 'value'
  },
  resultDescriptionKey: {
    type: String,
    default: 'description'
  },
  
  // Grouping
  groupBy: {
    type: String,
    default: ''
  },
  groupLabels: {
    type: Object,
    default: () => ({})
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
    validator: (value) => ['default', 'minimal', 'filled'].includes(value)
  },
  
  // States
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  
  // Features
  clearable: {
    type: Boolean,
    default: true
  },
  highlightMatches: {
    type: Boolean,
    default: true
  },
  
  // Texts
  clearText: {
    type: String,
    default: 'Очистить поиск'
  },
  noResultsText: {
    type: String,
    default: 'Ничего не найдено'
  },
  
  // Advanced
  filterFunction: {
    type: Function,
    default: null
  },
  sortFunction: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'search', 'select', 'clear', 'focus', 'blur'])

// Refs
const searchContainer = ref(null)
const inputRef = ref(null)
const dropdownRef = ref(null)

// State
const localValue = ref(props.modelValue)
const isFocused = ref(false)
const showResults = ref(false)
const hoveredIndex = ref(-1)
const searchTimeout = ref(null)
const isMobile = ref(false)
const dropdownPosition = ref({ top: 0, left: 0, width: 0 })

// Computed
const searchContainerClass = computed(() => {
  const baseClasses = ['relative w-full']
  // Добавляем отступ для focus ring чтобы он не обрезался
  baseClasses.push('p-1', '-m-1')
  // Добавляем более высокий z-index для родительского контейнера
  if (showResults.value) {
    baseClasses.push('z-[9998]')
  }
  return baseClasses
})

const inputClass = computed(() => {
  const baseClasses = [
    'w-full rounded-lg border shadow-sm transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 bg-accent/50 backdrop-blur-sm',
    'pl-10' // Space for search icon
  ]
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm pr-8',
    md: 'px-3 py-2.5 text-sm sm:text-base pr-10',
    lg: 'px-4 py-3 text-base sm:text-lg pr-12'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  // Variant classes
  const variantClasses = {
    default: 'border-secondary/30 focus:ring-primary/30',
    minimal: 'border-transparent bg-secondary/5 focus:ring-primary/30 focus:border-primary/30',
    filled: 'border-secondary/20 bg-secondary/10 focus:ring-primary/30'
  }
  baseClasses.push(variantClasses[props.variant] || variantClasses.default)
  
  // State classes
  if (props.error) {
    baseClasses.push('border-error focus:ring-error/30')
  }
  
  if (props.disabled) {
    baseClasses.push('opacity-60 cursor-not-allowed bg-gray-100')
  }
  
  // Clear button space
  if (props.clearable && localValue.value) {
    const clearSpaceClasses = {
      sm: 'pr-16',
      md: 'pr-20',
      lg: 'pr-24'
    }
    baseClasses.push(clearSpaceClasses[props.size] || clearSpaceClasses.md)
  }
  
  return baseClasses
})

const clearButtonClass = computed(() => {
  const baseClasses = [
    'absolute inset-y-0 right-3 flex items-center',
    'text-secondary hover:text-primary transition-colors duration-200',
    'focus:outline-none focus:text-primary'
  ]
  
  if (props.loading) {
    baseClasses.push('right-10')
  }
  
  return baseClasses
})

const resultsClass = computed(() => {
  const baseClasses = [
    'fixed',
    'bg-accent border border-secondary/20 rounded-lg shadow-lg',
    'backdrop-blur-sm',
    'max-h-96 overflow-y-auto',
    'z-[9999]'
  ]
  
  if (isMobile.value) {
    baseClasses.push('bottom-4 left-4 right-4 max-h-[60vh]')
  }
  
  return baseClasses
})

const dropdownStyle = computed(() => {
  if (isMobile.value) {
    return {}
  }
  
  return {
    top: `${dropdownPosition.value.top}px`,
    left: `${dropdownPosition.value.left}px`,
    width: `${dropdownPosition.value.width}px`
  }
})

const iconSize = computed(() => {
  const sizes = {
    sm: 'sm',
    md: 'sm',
    lg: 'md'
  }
  return sizes[props.size] || 'sm'
})

const searchIcon = computed(() => {
  return props.loading ? 'search' : 'search'
})

const inputType = computed(() => {
  return props.type === 'search' ? 'search' : 'text'
})

const filteredResults = computed(() => {
  if (!localValue.value || localValue.value.length < props.minSearchLength) {
    return []
  }
  
  let results = [...props.results]
  
  // Custom filter function
  if (props.filterFunction) {
    results = results.filter(item => props.filterFunction(item, localValue.value))
  } else {
    // Default filter
    const query = localValue.value.toLowerCase()
    results = results.filter(item => {
      const label = getResultLabel(item).toLowerCase()
      const description = getResultDescription(item).toLowerCase()
      return label.includes(query) || description.includes(query)
    })
  }
  
  // Custom sort function
  if (props.sortFunction) {
    results = results.sort((a, b) => props.sortFunction(a, b, localValue.value))
  } else {
    // Default sort by relevance
    results = results.sort((a, b) => {
      const query = localValue.value.toLowerCase()
      const aLabel = getResultLabel(a).toLowerCase()
      const bLabel = getResultLabel(b).toLowerCase()
      
      const aStartsWith = aLabel.startsWith(query)
      const bStartsWith = bLabel.startsWith(query)
      
      if (aStartsWith && !bStartsWith) return -1
      if (!aStartsWith && bStartsWith) return 1
      
      return aLabel.localeCompare(bLabel)
    })
  }
  
  // Add original indices for tracking
  results = results.slice(0, props.maxResults).map((item, index) => ({
    ...item,
    _originalIndex: index
  }))
  
  return results
})

const groupedResults = computed(() => {
  if (!props.groupBy) {
    return [{ title: '', items: filteredResults.value }]
  }
  
  const groups = {}
  
  filteredResults.value.forEach(item => {
    const groupKey = item[props.groupBy] || 'other'
    if (!groups[groupKey]) {
      groups[groupKey] = {
        title: props.groupLabels[groupKey] || groupKey,
        items: []
      }
    }
    groups[groupKey].items.push(item)
  })
  
  return Object.values(groups)
})

const showNoResults = computed(() => {
  return localValue.value && 
         localValue.value.length >= props.minSearchLength && 
         filteredResults.value.length === 0 && 
         !props.loading
})

// Methods
const getResultLabel = (result) => {
  return typeof result === 'string' ? result : result[props.resultLabelKey] || ''
}

const getResultDescription = (result) => {
  return typeof result === 'string' ? '' : result[props.resultDescriptionKey] || ''
}

const getResultValue = (result) => {
  return typeof result === 'string' ? result : result[props.resultValueKey] || result
}

const getResultKey = (result, index) => {
  return `result-${getResultValue(result)}-${index}`
}

const getResultItemClass = (index) => {
  const baseClasses = [
    'px-3 py-2 cursor-pointer transition-colors duration-150',
    'hover:bg-primary/8 focus:bg-primary/8',
    'text-primary'
  ]
  
  if (hoveredIndex.value === index) {
    baseClasses.push('bg-primary/12')
  }
  
  return baseClasses
}

const highlightMatch = (text, query) => {
  if (!props.highlightMatches || !query || !text) {
    return text
  }
  
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark class="bg-primary/20 text-primary font-medium">$1</mark>')
}

// Methods
const updateDropdownPosition = () => {
  if (!inputRef.value || isMobile.value) return
  
  // Используем позицию input'а, а не всего контейнера
  const rect = inputRef.value.getBoundingClientRect()
  dropdownPosition.value = {
    top: rect.bottom + window.scrollY + 4, // 4px отступ
    left: rect.left + window.scrollX,
    width: rect.width
  }
}

const handleInput = (event) => {
  const value = event.target.value
  localValue.value = value
  
  emit('update:modelValue', value)
  
  // Debounced search
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    emit('search', value)
  }, props.debounceDelay)
  
  // Show results if we have enough characters
  if (value.length >= props.minSearchLength) {
    updateDropdownPosition()
    showResults.value = true
    hoveredIndex.value = -1
  } else {
    showResults.value = false
  }
}

const handleFocus = () => {
  isFocused.value = true
  
  if (localValue.value.length >= props.minSearchLength) {
    updateDropdownPosition()
    showResults.value = true
  }
  
  emit('focus')
}

const handleBlur = () => {
  // Delay to allow for click events on results
  setTimeout(() => {
    isFocused.value = false
    showResults.value = false
    hoveredIndex.value = -1
    emit('blur')
  }, 150)
}

const handleSelect = (result) => {
  const value = getResultValue(result)
  localValue.value = getResultLabel(result)
  
  emit('update:modelValue', localValue.value)
  emit('select', { result, value, label: getResultLabel(result) })
  
  showResults.value = false
  inputRef.value?.blur()
}

const handleClear = () => {
  localValue.value = ''
  emit('update:modelValue', '')
  emit('clear')
  
  showResults.value = false
  inputRef.value?.focus()
}

const handleKeydown = (event) => {
  if (!showResults.value || filteredResults.value.length === 0) {
    return
  }
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      hoveredIndex.value = Math.min(hoveredIndex.value + 1, filteredResults.value.length - 1)
      break
      
    case 'ArrowUp':
      event.preventDefault()
      hoveredIndex.value = Math.max(hoveredIndex.value - 1, 0)
      break
      
    case 'Enter':
      event.preventDefault()
      if (hoveredIndex.value >= 0 && filteredResults.value[hoveredIndex.value]) {
        handleSelect(filteredResults.value[hoveredIndex.value])
      }
      break
      
    case 'Tab':
      showResults.value = false
      break
  }
}

const handleEscape = () => {
  showResults.value = false
  inputRef.value?.blur()
}

const focus = () => {
  inputRef.value?.focus()
}

const blur = () => {
  inputRef.value?.blur()
}

// Detect mobile
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const handleResize = () => {
  updateIsMobile()
  if (showResults.value) {
    updateDropdownPosition()
  }
}

const handleClickOutside = (event) => {
  if (searchContainer.value && !searchContainer.value.contains(event.target)) {
    showResults.value = false
  }
}

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
  localValue.value = newValue
})

// Expose methods
defineExpose({
  focus,
  blur,
  clear: handleClear
})

// Lifecycle
onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', updateDropdownPosition)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', updateDropdownPosition)
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(searchTimeout.value)
})
</script>

<style scoped>
/* Search-specific styles */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

mark {
  background: transparent;
}

/* Smooth scrolling for results */
.overflow-y-auto {
  scroll-behavior: smooth;
}

/* Mobile optimizations */
@media (max-width: 767px) {
  .search-results-mobile {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
    top: auto;
  }
}
</style>