<template>
  <div class="relative w-full" v-bind="$attrs">
    <!-- Лейбл -->
    <label v-if="label" :for="selectId" class="block text-sm font-medium text-primary mb-2">
      {{ label }}
      <span v-if="required" class="text-[var(--color-error)] ml-1">*</span>
    </label>

    <!-- Кнопка селектора -->
    <button
      :id="selectId"
      ref="triggerButton"
      type="button"
      :class="buttonClasses"
      :disabled="disabled"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <!-- Отображаемое значение / Пилюли для multiple -->
      <span class="flex-1 min-w-0 text-left text-primary">
        <template v-if="multiple && hasSelection">
          <span class="flex items-center gap-1 overflow-hidden">
            <span
              v-for="(label, idx) in visibleChipLabels"
              :key="`chip-${idx}-${label}`"
              class="inline-flex items-center max-w-[8rem] truncate px-2 py-0.5 rounded-full border border-secondary/30 bg-accent text-xs text-primary"
              title="label"
            >
              {{ label }}
            </span>
            <span v-if="hiddenChipsCount > 0" class="inline-flex items-center px-2 py-0.5 rounded-full border border-secondary/30 bg-accent text-xs text-secondary">
              +{{ hiddenChipsCount }}
            </span>
          </span>
        </template>
        <template v-else>
          <span class="block truncate" :class="{ 'text-secondary': !hasSelection }">
            {{ displayText }}
          </span>
        </template>
      </span>
      
      <!-- Кнопка очистки -->
      <button
        v-if="clearable && hasSelection && !disabled"
        type="button"
        class="mr-1 inline-flex items-center justify-center rounded hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20"
        @click.stop="clearSelection"
        :aria-label="'Очистить'"
        title="Очистить"
      >
        <IconV2 name="x" size="sm" color="secondary" />
      </button>

      <!-- Иконка -->
      <IconV2 
        :name="isOpen ? 'chevron-up' : 'chevron-down'" 
        size="sm" 
        color="secondary" 
        class="flex-shrink-0 transition-transform duration-200"
      />
    </button>

    <!-- Подсказка -->
    <p v-if="hint && !error" class="mt-1 text-xs text-secondary">
      {{ hint }}
    </p>

    <!-- Ошибка -->
    <p v-if="error" class="mt-1 text-xs text-[var(--color-error)]">
      {{ error }}
    </p>
  </div>

  <!-- Выпадающий список (телепортируется в body) -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="dropdown"
      :style="dropdownStyles"
      class="fixed z-50 bg-white rounded-lg shadow-lg border border-secondary/20 py-1 max-h-60 overflow-auto min-w-48"
      role="listbox"
      :id="listboxId"
      :aria-labelledby="selectId"
    >
      <!-- Поиск (только если searchable) -->
      <div v-if="searchable" class="px-2 pb-1">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Поиск..."
          class="w-full px-2 py-1 text-sm border border-secondary/20 rounded bg-accent focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
      <!-- Выбрать все -->
      <div v-if="multiple && showSelectAll" class="px-3 py-2 text-sm text-primary/80 flex items-center gap-2 border-b border-secondary/10">
        <button type="button" class="px-2 py-1 rounded border border-secondary/30 hover:bg-accent" @click.stop="selectAll">
          Выбрать все
        </button>
        <span class="text-xs text-secondary">(макс. {{ Number.isFinite(maxSelected) ? maxSelected : '∞' }})</span>
      </div>
      <!-- Опции -->
      <div
        v-for="option in filteredOptions"
        :key="getOptionValue(option)"
        :class="optionClasses(option)"
        role="option"
        :aria-selected="isSelected(option)"
        :id="`${selectId}-option-${getOptionValue(option)}`"
        @click="selectOption(option)"
      >
        <span class="flex-1">{{ getOptionLabel(option) }}</span>
        
        <!-- Чекмарк для выбранной опции (или чекбоксы при multiple) -->
        <template v-if="multiple">
          <input type="checkbox" :checked="isSelected(option)" class="ml-2" @change.stop="selectOption(option)" />
        </template>
        <template v-else>
          <IconV2
            v-if="isSelected(option)"
            name="check"
            size="sm"
            color="primary"
            class="ml-2 flex-shrink-0"
          />
        </template>
      </div>

      <!-- Сообщение о пустых опциях -->
      <div
        v-if="filteredOptions.length === 0"
        class="px-3 py-6 text-center text-secondary text-sm"
      >
        Нет доступных опций
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * SelectV2 - упрощенный селект для UI Kit v2
 * УПРОЩЕНО: убран поиск, мульти-селект, сложная логика
 * ФОКУС: надежность, простота, производительность
 */
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { computePosition, autoUpdate, offset, flip, shift, size } from '@floating-ui/dom'
import IconV2 from './Icon.vue'

// Генерация уникального ID
let selectIdCounter = 0
const generateId = () => `select-v2-${++selectIdCounter}`

const props = defineProps({
  modelValue: {
    type: [String, Number, Object],
    default: null
  },
  options: {
    type: Array,
    default: () => []
  },
  optionValue: {
    type: String,
    default: 'value'
  },
  optionLabel: {
    type: String,
    default: 'label'
  },
  placeholder: {
    type: String,
    default: 'Выберите опцию...'
  },
  label: {
    type: String,
    default: ''
  },
  hint: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  // Новая поддержка
  multiple: {
    type: Boolean,
    default: false
  },
  searchable: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: true
  },
  // Управляемое открытие (опционально)
  open: {
    type: Boolean,
    default: null
  },
  // Лимит выбора при multiple
  maxSelected: {
    type: Number,
    default: Infinity
  },
  // Показать «Выбрать все» (только multiple)
  showSelectAll: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur', 'update:open'])

// Локальное состояние
const isOpen = ref(false)
const triggerButton = ref(null)
const dropdown = ref(null)
const selectId = ref(generateId())
const searchQuery = ref('')
const listboxId = computed(() => `${selectId.value}-listbox`)

// Размеры
const sizeClasses = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-sm', 
  lg: 'h-12 text-base'
}

// Computed стили
const buttonClasses = computed(() => [
  'w-full flex items-center justify-between px-3 py-2 bg-white border rounded-lg',
  'transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20',
  'focus-visible:ring-2 focus-visible:ring-primary/30',
  {
    'border-[var(--color-error)] ring-1 ring-[var(--color-error)]/20': props.error,
    'border-secondary/30 hover:border-secondary/50': !props.error && !props.disabled && !isOpen.value,
    'border-primary ring-2 ring-primary/20': isOpen.value && !props.error,
    'border-secondary/20 bg-accent text-secondary cursor-not-allowed': props.disabled
  },
  sizeClasses[props.size]
])

const optionClasses = (option) => [
  'px-3 py-2 cursor-pointer hover:bg-accent flex items-center justify-between transition-colors duration-150',
  {
    'opacity-50 cursor-not-allowed': isOptionDisabled(option),
    'bg-primary/10 text-primary font-medium': isSelected(option) && !isOptionDisabled(option),
    'text-primary': !isSelected(option)
  }
]

// Позиционирование dropdown
const dropdownStyles = ref({})

let cleanupAutoUpdate
const updateDropdownPosition = async () => {
  if (!isOpen.value) return
  const triggerEl = triggerButton.value
  const dropdownEl = dropdown.value
  if (!triggerEl || !dropdownEl) return
  // Защита от ранних вызовов, когда ref ещё не Element
  if (!(triggerEl instanceof HTMLElement) || !(dropdownEl instanceof HTMLElement)) return
  if (cleanupAutoUpdate) {
    cleanupAutoUpdate()
    cleanupAutoUpdate = undefined
  }
  cleanupAutoUpdate = autoUpdate(triggerEl, dropdownEl, async () => {
    const { x, y, rects } = await computePosition(triggerEl, dropdownEl, {
      placement: 'bottom-start',
      middleware: [
        offset(4),
        flip(),
        shift({ padding: 8 }),
        size({
          // rects из аргументов apply, а не из внешней области (во избежание TDZ)
          apply({ availableHeight, rects: applyRects, elements }) {
            if (!elements.floating) return
            elements.floating.style.maxHeight = `${Math.min(availableHeight, 240)}px`
            elements.floating.style.minWidth = `${applyRects.reference.width}px`
          }
        })
      ]
    })
    const referenceWidth = (rects && rects.reference && rects.reference.width) 
      ? rects.reference.width 
      : (triggerEl.getBoundingClientRect ? triggerEl.getBoundingClientRect().width : undefined)
    dropdownStyles.value = {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      ...(referenceWidth ? { width: `${referenceWidth}px` } : {}),
      zIndex: 50
    }
  })
}

// Фильтрация опций при searchable
const filteredOptions = computed(() => {
  if (!props.searchable || !searchQuery.value) return props.options
  const q = searchQuery.value.toLowerCase()
  return props.options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(q))
})

// Утилиты для работы с опциями
const getOptionValue = (option) => {
  if (typeof option === 'object' && option !== null) {
    return option[props.optionValue]
  }
  return option
}

const getOptionLabel = (option) => {
  if (typeof option === 'object' && option !== null) {
    return option[props.optionLabel] || option[props.optionValue] || String(option)
  }
  return String(option)
}

const isSelected = (option) => {
  const optionVal = getOptionValue(option)
  const modelVal = props.modelValue

  if (props.multiple) {
    const arr = Array.isArray(modelVal) ? modelVal : []
    return arr.includes(optionVal)
  }

  if (typeof modelVal === 'object' && modelVal !== null) {
    return getOptionValue(modelVal) === optionVal
  }
  return modelVal === optionVal
}

// Отображаемый текст
const displayText = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }
  if (props.multiple) {
    const arr = Array.isArray(props.modelValue) ? props.modelValue : []
    const labels = arr
      .map(val => props.options.find(opt => getOptionValue(opt) === val))
      .filter(Boolean)
      .map(opt => getOptionLabel(opt))
    return labels.length ? labels.join(', ') : props.placeholder
  }
  const selectedOption = props.options.find(option => isSelected(option))
  if (selectedOption) return getOptionLabel(selectedOption)
  return String(props.modelValue)
})

const hasSelection = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.length > 0
  }
  return props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== ''
})

// Ограниченный список лейблов для отображения как «пилюль»
const MAX_VISIBLE_CHIPS = 3
const selectedLabels = computed(() => {
  if (!props.multiple) return []
  const values = Array.isArray(props.modelValue) ? props.modelValue : []
  return values
    .map((val) => props.options.find((opt) => getOptionValue(opt) === val))
    .filter(Boolean)
    .map((opt) => getOptionLabel(opt))
})
const visibleChipLabels = computed(() => selectedLabels.value.slice(0, MAX_VISIBLE_CHIPS))
const hiddenChipsCount = computed(() => Math.max(selectedLabels.value.length - MAX_VISIBLE_CHIPS, 0))

// Методы
const toggle = () => {
  if (props.disabled) return
  
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

const open = () => {
  isOpen.value = true
  emit('update:open', true)
  emit('focus')
  nextTick(() => {
    updateDropdownPosition()
  })
}

const close = () => {
  isOpen.value = false
  emit('update:open', false)
  emit('blur')
  if (cleanupAutoUpdate) {
    cleanupAutoUpdate()
    cleanupAutoUpdate = undefined
  }
}

const selectOption = (option) => {
  if (isOptionDisabled(option)) return
  const value = getOptionValue(option)
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = current.indexOf(value)
    if (idx === -1) {
      if (current.length >= props.maxSelected) return
      current.push(value)
    }
    else current.splice(idx, 1)
    emit('update:modelValue', current)
    emit('change', current)
  } else {
    emit('update:modelValue', value)
    emit('change', value)
    close()
  }
}

const clearSelection = () => {
  if (props.multiple) {
    emit('update:modelValue', [])
    emit('change', [])
  } else {
    emit('update:modelValue', null)
    emit('change', null)
  }
}

// Выбрать все (для multiple)
const selectAll = () => {
  if (!props.multiple) return
  const allValues = filteredOptions.value
    .filter((opt) => !isOptionDisabled(opt))
    .map((opt) => getOptionValue(opt))
  const limited = allValues.slice(0, Number.isFinite(props.maxSelected) ? props.maxSelected : allValues.length)
  emit('update:modelValue', limited)
  emit('change', limited)
}

// Disabled-опции
const isOptionDisabled = (option) => {
  return typeof option === 'object' && option !== null && option.disabled === true
}

// Контролируемое открытие
watch(() => props.open, (val) => {
  if (val === null || val === undefined) return
  if (val) open()
  else close()
})

// Keyboard navigation
const handleKeydown = (event) => {
  if (props.disabled) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      toggle()
      break
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault()
        close()
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) {
        open()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) {
        open()
      }
      break
  }
}

// Click outside handler
const handleClickOutside = (event) => {
  if (!isOpen.value) return
  
  const triggerEl = triggerButton.value
  const dropdownEl = dropdown.value
  
  if (
    triggerEl && !triggerEl.contains(event.target) &&
    dropdownEl && !dropdownEl.contains(event.target)
  ) {
    close()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  window.addEventListener('resize', updateDropdownPosition)
  window.addEventListener('scroll', updateDropdownPosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
  if (cleanupAutoUpdate) cleanupAutoUpdate()
})

// Expose for template refs
defineOptions({
  inheritAttrs: false
})

defineExpose({
  open,
  close,
  toggle,
  focus: () => triggerButton.value?.focus()
})
</script>

<style scoped>
/* Кастомные стили для accessibility */
.focus-visible\:ring-2:focus-visible {
  outline: 2px solid transparent;
  outline-offset: 2px;
}
</style>