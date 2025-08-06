<template>
  <nav 
    :aria-label="ariaLabel" 
    class="breadcrumbs-nav"
    role="navigation"
  >
    <ol :class="breadcrumbsClass">
      <li 
        v-for="(item, index) in items" 
        :key="item.key || index"
        :class="getItemClass(index)"
      >
        <!-- Разделитель (не для первого элемента) -->
        <IconV2 
          v-if="index > 0"
          :name="separatorIcon" 
          size="xs"
          color="secondary"
          class="separator-icon"
          aria-hidden="true"
        />
        
        <!-- Элемент хлебной крошки -->
        <div 
          class="relative breadcrumb-wrapper"
          :class="{ 'has-submenu': item.submenu && !item.disabled }"
        >
          <component
            :is="getItemComponent(item, index)"
            v-bind="getItemProps(item, index)"
            :class="getItemContentClass(item, index)"
            @click="handleItemClick(item, index, $event)"
          >
            <!-- Иконка элемента -->
            <IconV2 
              v-if="item.icon" 
              :name="item.icon" 
              size="xs" 
              color="current"
              class="item-icon"
            />
            
            <!-- Текст элемента -->
            <span class="item-text">{{ item.label }}</span>
            
            <!-- Dropdown индикатор -->
            <IconV2 
              v-if="item.submenu && !item.disabled"
              name="chevron-down" 
              size="xs" 
              color="current"
              class="submenu-indicator ml-1"
            />
            
            <!-- Индикатор загрузки -->
            <SpinnerV2 
              v-if="item.loading" 
              size="xs" 
              class="item-spinner ml-1"
            />
          </component>
          
          <!-- Dropdown подменю -->
          <div 
            v-if="item.submenu && !item.disabled"
            class="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-48 z-50 breadcrumb-dropdown"
          >
            <button
              v-for="subitem in item.submenu"
              :key="subitem.href || subitem.label"
              @click="handleSubmenuClick(subitem, item, index, $event)"
              class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
              :class="{ 
                'bg-blue-50 text-blue-600': isSubmenuItemActive(subitem),
                'text-gray-500 cursor-not-allowed': subitem.disabled 
              }"
              :disabled="subitem.disabled"
            >
              <IconV2 
                v-if="subitem.icon" 
                :name="subitem.icon" 
                size="xs" 
                color="current"
              />
              {{ subitem.label }}
            </button>
          </div>
        </div>
      </li>
    </ol>
    
    <!-- Мобильная версия (свернутая) -->
    <div v-if="showMobileCollapsed" class="mobile-breadcrumbs">
      <ButtonV2
        variant="ghost"
        size="sm"
        @click="expandMobile"
        class="mobile-toggle"
      >
        <IconV2 name="more-horizontal" size="xs" />
        <span class="ml-1">{{ currentItem?.label }}</span>
      </ButtonV2>
    </div>
  </nav>
</template>

<script setup>
/**
 * Breadcrumbs v2 - умная навигационная цепочка
 * 
 * Возможности:
 * - Адаптивный дизайн с коллапсом на мобильных
 * - Поддержка кликабельных и некликабельных элементов
 * - Кастомные разделители и иконки
 * - Индикаторы загрузки
 * - Keyboard navigation
 * - Accessibility (ARIA)
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import IconV2 from '../atoms/Icon.vue'
import SpinnerV2 from '../atoms/Spinner.vue'
import ButtonV2 from '../atoms/Button.vue'

const props = defineProps({
  items: {
    type: Array,
    required: true,
    validator: (items) => items.every(item => 
      item && typeof item === 'object' && item.label
    )
  },
  separator: {
    type: String,
    default: 'chevron-right',
    validator: (value) => ['chevron-right', 'slash', 'arrow-right', 'minus'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'minimal', 'pills', 'underline'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  maxItems: {
    type: Number,
    default: 5
  },
  mobileBreakpoint: {
    type: Number,
    default: 3
  },
  ariaLabel: {
    type: String,
    default: 'Навигация по разделам'
  }
})

const emit = defineEmits([
  'item-click',
  'navigate'
])

const route = useRoute()
const isMobileExpanded = ref(false)

// Иконка разделителя
const separatorIcon = computed(() => {
  const separators = {
    'chevron-right': 'chevron-right',
    'slash': 'slash',
    'arrow-right': 'arrow-right', 
    'minus': 'minus'
  }
  return separators[props.separator]
})

// Обработанные элементы с коллапсом
const processedItems = computed(() => {
  if (props.items.length <= props.maxItems) {
    return props.items
  }
  
  // Коллапс средних элементов
  const first = props.items[0]
  const last = props.items[props.items.length - 1]
  const middle = props.items.slice(1, -1)
  
  return [
    first,
    { 
      label: '...', 
      collapsed: true, 
      items: middle,
      key: 'collapsed'
    },
    last
  ]
})

// Текущий активный элемент
const currentItem = computed(() => 
  props.items[props.items.length - 1]
)

// Показывать ли мобильную свернутую версию
const showMobileCollapsed = computed(() => 
  props.items.length > props.mobileBreakpoint && !isMobileExpanded.value
)

// Классы для контейнера
const breadcrumbsClass = computed(() => {
  const baseClasses = [
    'breadcrumbs-list',
    'flex', 'items-center', 'flex-wrap'
  ]
  
  // Размеры
  if (props.size === 'sm') {
    baseClasses.push('gap-1', 'text-xs')
  } else if (props.size === 'md') {
    baseClasses.push('gap-2', 'text-sm')
  } else if (props.size === 'lg') {
    baseClasses.push('gap-3', 'text-base')
  }
  
  // Варианты
  baseClasses.push(`breadcrumbs--${props.variant}`)
  
  // Скрыть на мобильных если показываем свернутую версию
  if (showMobileCollapsed.value) {
    baseClasses.push('hidden', 'sm:flex')
  }
  
  return baseClasses.join(' ')
})

// Классы для элемента списка
const getItemClass = (index) => {
  const classes = ['breadcrumb-item', 'flex', 'items-center']
  
  if (index === 0) classes.push('breadcrumb-item--first')
  if (index === processedItems.value.length - 1) {
    classes.push('breadcrumb-item--last', 'breadcrumb-item--current')
  }
  
  return classes.join(' ')
}

// Компонент для рендера элемента
const getItemComponent = (item, index) => {
  if (item.collapsed) return 'button'
  if (item.href || item.to || item.click) return 'button'
  return 'span'
}

// Props для элемента
const getItemProps = (item, index) => {
  const isLast = index === processedItems.value.length - 1
  const isClickable = !isLast && (item.href || item.to || item.click || item.collapsed)
  
  if (!isClickable) {
    return {
      'aria-current': isLast ? 'page' : undefined
    }
  }
  
  return {
    type: 'button',
    disabled: item.disabled || item.loading,
    'aria-current': isLast ? 'page' : undefined,
    tabindex: item.disabled ? -1 : 0
  }
}

// Классы для содержимого элемента
const getItemContentClass = (item, index) => {
  const isLast = index === processedItems.value.length - 1
  const isClickable = !isLast && (item.href || item.to || item.click || item.collapsed)
  
  const classes = ['breadcrumb-content', 'inline-flex', 'items-center', 'gap-1']
  
  // Базовые стили в зависимости от варианта
  if (props.variant === 'default') {
    if (isClickable) {
      classes.push('text-secondary', 'hover:text-primary', 'transition-colors')
    } else if (isLast) {
      classes.push('text-primary', 'font-medium')
    }
  } else if (props.variant === 'minimal') {
    if (isClickable) {
      classes.push('breadcrumb-minimal-clickable')
    } else if (isLast) {
      classes.push('text-secondary')
    }
  } else if (props.variant === 'pills') {
    classes.push('px-2', 'py-1', 'rounded-md')
    if (isClickable) {
      classes.push('breadcrumb-pills-clickable')
    } else if (isLast) {
      classes.push('bg-primary', 'text-white')
    }
  } else if (props.variant === 'underline') {
    classes.push('border-b', 'transition-all', 'breadcrumb-underline-base')
    if (isClickable) {
      classes.push('text-secondary', 'hover:text-primary', 'border-transparent', 'hover:border-primary')
    } else if (isLast) {
      classes.push('text-primary', 'border-primary', 'font-medium')
    }
  }
  
  // Состояния
  if (item.disabled) {
    classes.push('opacity-60', 'cursor-not-allowed')
  } else if (isClickable) {
    classes.push('cursor-pointer')
  } else {
    classes.push('cursor-default')
  }
  
  // Размеры
  if (props.size === 'sm') {
    classes.push('breadcrumb-size-sm')
  } else if (props.size === 'md') {
    classes.push('breadcrumb-size-md')
  } else if (props.size === 'lg') {
    classes.push('breadcrumb-size-lg')
  }
  
  return classes.join(' ')
}

// Обработчик клика
const handleItemClick = (item, index, event) => {
  if (item.disabled || item.loading) return
  
  const isLast = index === processedItems.value.length - 1
  if (isLast) return // Текущая страница не кликабельна
  
  if (item.collapsed) {
    // Показать все элементы
    isMobileExpanded.value = true
    return
  }
  
  emit('item-click', { item, index, event })
  
  if (item.click) {
    item.click(item, index, event)
  }
  
  if (item.href || item.to) {
    emit('navigate', { item, index, event })
  }
}

// Развернуть на мобильном
const expandMobile = () => {
  isMobileExpanded.value = true
}

// === SUBMENU УПРАВЛЕНИЕ ===
// Используем чистый CSS :hover, JavaScript только для кликов

// Обработка клика по элементу подменю
const handleSubmenuClick = (subitem, parentItem, parentIndex, event) => {
  event.preventDefault()
  event.stopPropagation()
  
  // CSS сам скроет dropdown при клике
  
  // Если элемент отключен, не делаем ничего
  if (subitem.disabled) {
    return
  }
  
  // Эмитим событие клика по подменю
  emit('item-click', {
    item: subitem,
    parentItem: parentItem,
    index: parentIndex,
    isSubmenu: true,
    event
  })
  
  // Эмитим событие навигации (для совместимости)
  if (subitem.href) {
    emit('navigate', {
      item: subitem,
      parentItem: parentItem,
      href: subitem.href
    })
  }
}

// Проверить активен ли элемент подменю
const isSubmenuItemActive = (subitem) => {
  if (!subitem.href) return false
  
  // Точное совпадение пути
  if (route.path === subitem.href) return true
  
  // Частичное совпадение для подразделов
  if (subitem.href !== '/' && route.path.startsWith(subitem.href)) {
    return true
  }
  
  return false
}
</script>

<style scoped>
.breadcrumbs-nav {
  width: 100%;
}

.breadcrumbs-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.breadcrumb-item {
  position: relative;
}

.separator-icon {
  margin-left: 0.25rem;
  margin-right: 0.25rem;
  flex-shrink: 0;
}

.item-icon {
  flex-shrink: 0;
}

.item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.item-spinner {
  flex-shrink: 0;
}

.submenu-indicator {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.submenu-indicator:hover {
  transform: rotate(180deg);
}

/* ПРАВИЛЬНАЯ логика для dropdown - чистый CSS без JavaScript */
.breadcrumb-wrapper {
  position: relative;
}

/* Dropdown скрыт по умолчанию */
.breadcrumb-dropdown {
  display: none;
  
  /* Улучшенная тень */
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Показываем dropdown при наведении на wrapper */
.breadcrumb-wrapper.has-submenu:hover .breadcrumb-dropdown {
  display: block;
  
  /* Анимация появления */
  animation: dropdown-fadeIn 0.15s ease-out;
}

/* Добавляем невидимую зону для плавного перехода */
.breadcrumb-wrapper.has-submenu::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 4px; /* Буферная зона */
  background: transparent;
  pointer-events: auto;
}

@keyframes dropdown-fadeIn {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-breadcrumbs {
  display: flex;
}

@media (min-width: 640px) {
  .mobile-breadcrumbs {
    display: none;
  }
}

.mobile-toggle {
  width: 100%;
  justify-content: flex-start;
}

/* Варианты стилей */
.breadcrumbs--default .breadcrumb-content:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(43, 45, 66, 0.3);
  border-radius: 0.25rem;
}

.breadcrumbs--minimal .breadcrumb-content:focus {
  outline: none;
}

.breadcrumbs--pills .breadcrumb-content:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(43, 45, 66, 0.3);
}

.breadcrumbs--underline .breadcrumb-content:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(43, 45, 66, 0.3);
  border-radius: 0.25rem;
}

/* Кастомные классы для проблемных стилей */
.breadcrumb-minimal-clickable {
  color: rgba(141, 153, 174, 0.7);
}
.breadcrumb-minimal-clickable:hover {
  color: #8D99AE;
}

.breadcrumb-pills-clickable {
  background-color: rgba(141, 153, 174, 0.1);
  color: #8D99AE;
  transition: all 0.2s;
}
.breadcrumb-pills-clickable:hover {
  background-color: rgba(141, 153, 174, 0.2);
  color: #2B2D42;
}

.breadcrumb-underline-base {
  padding-bottom: 0.125rem;
}

.breadcrumb-size-sm {
  min-height: 20px;
}
.breadcrumb-size-md {
  min-height: 24px;
}
.breadcrumb-size-lg {
  min-height: 28px;
}

/* Адаптивность */
@media (max-width: 640px) {
  .item-text {
    max-width: 100px;
  }
}
</style>