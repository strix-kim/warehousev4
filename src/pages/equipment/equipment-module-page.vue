<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 
          :items="breadcrumbs" 
          variant="minimal" 
          size="sm"
          @item-click="handleBreadcrumbClick"
          @navigate="handleBreadcrumbNavigate"
        />
        
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-3xl font-bold text-primary">Модуль оборудования</h1>
            <p class="text-base text-secondary mt-2">
              Управление оборудованием, создание и редактирование списков для мероприятий
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content в Bento Grid -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      <BentoGrid columns="auto" gap="6">
        
        <!-- Карточка: Управление оборудованием -->
        <BentoCard 
          title="Управление оборудованием" 
          size="2x2" 
          variant="primary"
          :interactive="true"
          @click="navigateToItems"
        >
          <div class="flex flex-col justify-between h-full">
            <div>
              <p class="text-accent/90 mb-4">
                Добавление, редактирование и удаление оборудования. 
                Поиск, фильтрация и сортировка по категориям.
              </p>
              
              <!-- Статистика -->
              <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-white/10 rounded-lg p-3 text-center">
                  <div class="text-2xl font-bold text-accent">{{ equipmentStats.total }}</div>
                  <div class="text-xs text-accent/70">Всего единиц</div>
                </div>
                <div class="bg-white/10 rounded-lg p-3 text-center">
                  <div class="text-2xl font-bold text-accent">{{ equipmentStats.categories }}</div>
                  <div class="text-xs text-accent/70">Категорий</div>
                </div>
              </div>
            </div>
            
            <div class="flex items-center justify-between">
              <span class="text-accent/80 text-sm">Перейти к управлению</span>
              <IconV2 name="arrow-right" size="sm" color="current" />
            </div>
          </div>
        </BentoCard>

        <!-- Карточка: Создание списков -->
        <BentoCard 
          title="Создание списков" 
          size="1x2" 
          variant="brand-red"
          :interactive="true"
          @click="navigateToCreateList"
        >
          <div class="flex flex-col justify-between h-full">
            <div>
              <p class="text-accent/90 mb-4">
                Создание новых списков оборудования: свободных или привязанных к точкам монтажа.
              </p>
              
              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <IconV2 name="list" size="xs" color="current" />
                  <span class="text-accent/80 text-sm">Свободные списки</span>
                </div>
                <div class="flex items-center gap-2">
                  <IconV2 name="link" size="xs" color="current" />
                  <span class="text-accent/80 text-sm">Привязка к точкам монтажа</span>
                </div>
              </div>
            </div>
            
            <div class="flex items-center justify-between mt-4">
              <span class="text-accent/80 text-sm">Создать список</span>
              <IconV2 name="plus" size="sm" color="current" />
            </div>
          </div>
        </BentoCard>

        <!-- Карточка: Просмотр списков -->
        <BentoCard 
          title="Списки оборудования" 
          size="1x2" 
          variant="secondary"
          :interactive="true"
          @click="navigateToLists"
        >
          <div class="flex flex-col justify-between h-full">
            <div>
              <p class="text-accent/90 mb-4">
                Просмотр, редактирование и управление существующими списками оборудования.
              </p>
              
              <!-- Статистика списков -->
              <div class="space-y-3">
                <div class="bg-white/10 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="text-accent/80 text-sm">Всего списков</span>
                    <span class="text-xl font-bold text-accent">{{ listsStats.total }}</span>
                  </div>
                </div>
                <div class="bg-white/10 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="text-accent/80 text-sm">Связанных</span>
                    <span class="text-xl font-bold text-accent">{{ listsStats.linked }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex items-center justify-between mt-4">
              <span class="text-accent/80 text-sm">Управление списками</span>
              <IconV2 name="list" size="sm" color="current" />
            </div>
          </div>
        </BentoCard>

        <!-- Карточка: Быстрые действия -->
        <BentoCard 
          title="Быстрые действия" 
          size="2x1" 
          variant="minimal"
        >
          <div class="flex items-center justify-between gap-4">
            <ButtonV2 
              variant="primary" 
              size="sm"
              @click="navigateToItems"
            >
              <template #icon>
                <IconV2 name="plus" size="xs" />
              </template>
              Добавить оборудование
            </ButtonV2>
            
            <ButtonV2 
              variant="secondary" 
              size="sm"
              @click="navigateToCreateList"
            >
              <template #icon>
                <IconV2 name="list-plus" size="xs" />
              </template>
              Создать список
            </ButtonV2>
            
            <ButtonV2 
              variant="ghost" 
              size="sm"
              @click="navigateToLists"
            >
              <template #icon>
                <IconV2 name="search" size="xs" />
              </template>
              Найти список
            </ButtonV2>
          </div>
        </BentoCard>

      </BentoGrid>
    </div>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
/**
 * Equipment Module Page - главная страница модуля оборудования
 * Содержит навигационные карточки к основным функциям модуля
 */

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

// UI Kit v2
import { 
  BentoGrid, 
  BentoCard, 
  BreadcrumbsV2, 
  ButtonV2, 
  IconV2,
  NotificationV2 
} from '@/shared/ui-v2'

// Equipment module
import { useEquipmentStore, useEquipmentStats } from '@/features/equipment'

const router = useRouter()
const equipmentStore = useEquipmentStore()

// === COMPOSABLES ===
const { 
  stats,
  loading: statsLoading,
  error: statsError,
  equipmentStats,
  listsStats,
  loadStats,
  clearError
} = useEquipmentStats()

// Notification system
const notificationSystem = ref(null)

// === BREADCRUMBS ===
const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { 
    label: 'Модуль оборудования', 
    disabled: true,
    submenu: [
      { label: '🔧 Управление оборудованием', href: '/equipment/items', icon: 'settings' },
      { label: '📋 Списки оборудования', href: '/equipment/lists', icon: 'list' },
      { label: '➕ Создать список', href: '/equipment/lists/create', icon: 'plus' }
    ]
  }
]

// === НАВИГАЦИЯ ===
const navigateToItems = () => {
  router.push('/equipment/items')
}

const navigateToCreateList = () => {
  router.push('/equipment/lists/create')
}

const navigateToLists = () => {
  router.push('/equipment/lists')
}

// === BREADCRUMBS НАВИГАЦИЯ ===
const handleBreadcrumbClick = (data) => {
  console.log('🧭 [Module] Клик по breadcrumb:', data.item.label)
  
  // Обрабатываем клики по submenu
  if (data.isSubmenu) {
    console.log('🧭 [Module] Переход по submenu:', data.item.href)
    if (data.item.href) {
      router.push(data.item.href)
    }
    return
  }
  
  // Обычные breadcrumbs
  if (data.item.href && !data.item.disabled) {
    router.push(data.item.href)
  }
}

const handleBreadcrumbNavigate = (data) => {
  console.log('🧭 [Module] Навигация по breadcrumb:', data.href)
  if (data.href) {
    router.push(data.href)
  }
}

// === ЗАГРУЗКА ДАННЫХ ===
const initializeModule = async () => {
  try {
    clearError() // Очищаем предыдущие ошибки
    await loadStats()
    
    console.log('✅ [Module] Статистика успешно загружена:', {
      equipment: equipmentStats.value,
      lists: listsStats.value
    })
    
  } catch (error) {
    console.error('❌ [Module] Ошибка инициализации модуля:', error)
    
    // Показываем ошибку пользователю через NotificationV2
    notificationSystem.value?.add({
      type: 'error',
      title: 'Ошибка загрузки',
      message: 'Не удалось загрузить статистику модуля. Попробуйте обновить страницу.',
      duration: 5000
    })
  }
}

// === ОБРАБОТКА ОШИБОК ===
// Отслеживаем изменения ошибок статистики
watch(statsError, (newError) => {
  if (newError && notificationSystem.value) {
    notificationSystem.value.add({
      type: 'error',
      title: 'Ошибка статистики',
      message: newError,
      duration: 5000
    })
  }
})

onMounted(() => {
  initializeModule()
})
</script>