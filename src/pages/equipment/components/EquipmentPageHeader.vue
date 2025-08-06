<template>
  <div class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <BreadcrumbsV2 
        :items="breadcrumbs" 
        variant="minimal" 
        size="sm" 
        @item-click="handleBreadcrumbClick"
        @navigate="handleBreadcrumbNavigate"
      />
      
      <!-- ✅ Header с primary action кнопкой -->
      <div class="flex justify-between items-center mt-4">
        <div>
          <h1 class="text-2xl font-bold text-primary">{{ title }}</h1>
          <p class="text-sm text-secondary mt-1">
            {{ description }}
          </p>
        </div>
        
        <!-- ✅ Адаптивная кнопка добавления -->
        <ButtonV2 
          variant="primary"
          size="lg"
          @click="handleAddEquipment"
          :title="'Добавить оборудование'"
          class="flex items-center gap-2"
        >
          <template #icon>
            <IconV2 name="plus" size="sm" />
          </template>
          <!-- Текст скрывается на мобильных -->
          <span class="hidden sm:inline">Добавить оборудование</span>
        </ButtonV2>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * EquipmentPageHeader - EPR System
 * 
 * Компонент заголовка страницы оборудования с breadcrumbs
 * Использует UI Kit v2
 */

import { BreadcrumbsV2, ButtonV2, IconV2 } from '@/shared/ui-v2'
import { useRouter } from 'vue-router'

// Props
const props = defineProps({
  title: {
    type: String,
    default: 'Оборудование EPR'
  },
  description: {
    type: String,
    default: 'Управление видеооборудованием и техникой'
  },
  breadcrumbs: {
    type: Array,
    default: () => [
      { 
        label: 'Главная', 
        href: '/', 
        icon: 'home'
      },
      { 
        label: 'Модуль оборудования', 
        href: '/equipment',
        submenu: [
          { label: '🔧 Управление оборудованием', href: '/equipment/items', icon: 'settings' },
          { label: '📋 Списки оборудования', href: '/equipment/lists', icon: 'list' },
          { label: '➕ Создать список', href: '/equipment/lists/create', icon: 'plus' }
        ]
      },
      { 
        label: 'Управление оборудованием', 
        disabled: true 
      }
    ]
  }
})

// Emits
const emit = defineEmits(['breadcrumb-click', 'add-equipment'])

// Router
const router = useRouter()

// Methods
const handleBreadcrumbClick = (data) => {
  console.log('🧭 [Header] Клик по breadcrumb:', data.item.label)
  
  // Обрабатываем клики по submenu
  if (data.isSubmenu) {
    console.log('🧭 [Header] Переход по submenu:', data.item.href)
    if (data.item.href) {
      router.push(data.item.href)
    }
    return
  }
  
  // Проверяем, что элемент кликабелен и имеет ссылку
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
  
  // Эмитим событие для родительского компонента
  emit('breadcrumb-click', data)
}

const handleBreadcrumbNavigate = (data) => {
  console.log('🧭 [Header] Навигация по breadcrumb:', data.href)
  if (data.href) {
    router.push(data.href)
  }
}

const handleAddEquipment = () => {
  console.log('➕ [Header] Добавить оборудование')
  emit('add-equipment')
}
</script>