<template>
  <!--
    EventTabs.vue — современные вкладки для переключения между активными и архивными мероприятиями
    Архитектурная роль: UI компонент навигации, интегрирован с дизайн-системой
    Поддерживает: анимации, accessibility, responsive design, счетчики
    ИСПРАВЛЕНО: использует только Tailwind CSS, синюю цветовую схему
  -->
  <div class="w-full mb-8">
    <div class="relative flex bg-white/90 border border-gray-200 rounded-xl p-1 shadow-sm backdrop-blur-sm">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="[
          'relative flex flex-1 items-center justify-center gap-2 px-4 py-3 border-none bg-transparent rounded-lg',
          'text-sm font-semibold cursor-pointer transition-all duration-200 z-10 min-h-[48px]',
          'hover:text-gray-800 hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          modelValue === tab.key 
            ? 'text-blue-600 font-bold' 
            : 'text-gray-600'
        ]"
        :aria-selected="modelValue === tab.key"
        :aria-label="`Переключиться на ${tab.label.toLowerCase()}`"
        @click="handleTabClick(tab.key)"
      >
        <!-- Иконка вкладки -->
        <div class="flex items-center justify-center transition-transform duration-200"
             :class="{ 'scale-110': modelValue === tab.key }">
          <svg 
            v-if="tab.key === 'active'"
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none"
            class="stroke-current stroke-2"
          >
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg 
            v-else
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none"
            class="stroke-current stroke-2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
          </svg>
        </div>
        
        <!-- Текст вкладки -->
        <span class="font-mono tracking-wide hidden sm:inline">{{ tab.label }}</span>
        
        <!-- Счетчик записей -->
        <span 
          v-if="tab.count !== undefined" 
          :class="[
            'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full',
            'text-xs font-bold transition-all duration-200',
            modelValue === tab.key 
              ? 'bg-blue-100 text-blue-600' 
              : 'bg-gray-100 text-gray-600'
          ]"
          :aria-label="`${tab.count} мероприятий`"
        >
          {{ tab.count }}
        </span>
      </button>
      
      <!-- Индикатор активной вкладки -->
      <div 
        class="absolute top-1 bottom-1 left-1 bg-white rounded-lg shadow-lg transition-transform duration-300 ease-out z-0"
        :class="`w-[calc(50%-0.125rem)]`"
        :style="`transform: translateX(${activeTabIndex * 100}%)`"
        aria-hidden="true"
      ></div>
    </div>
  </div>
</template>

<script setup>
/**
 * EventTabs — компонент вкладок для навигации между типами мероприятий
 * Интегрирован с дизайн-системой, поддерживает анимации и accessibility
 * ИСПРАВЛЕНО: только Tailwind CSS, синяя цветовая схема
 */
import { computed } from 'vue'

// Пропсы
const props = defineProps({
  /** Активная вкладка */
  modelValue: {
    type: String,
    default: 'active'
  },
  /** Конфигурация вкладок */
  tabs: {
    type: Array,
    default: () => [
      { key: 'active', label: 'Активные', count: 0 },
      { key: 'archived', label: 'Архивные', count: 0 }
    ]
  }
})

// События
const emit = defineEmits(['update:modelValue'])

// Локальные состояния
const activeTabIndex = computed(() => 
  props.tabs.findIndex(tab => tab.key === props.modelValue)
)

// Обработчики
const handleTabClick = (tabKey) => {
  if (tabKey !== props.modelValue) {
    emit('update:modelValue', tabKey)
  }
}
</script> 