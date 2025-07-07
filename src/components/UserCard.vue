<script setup>
// UserCard.vue — атомарный компонент карточки пользователя
// Назначение: отображение ключевой информации о пользователе в production-UI
// Используется на странице пользователей и в других списках
// Все стили — только Tailwind, строгий минимализм, максимальная читаемость
// Props: user (объект)
import { computed } from 'vue'
const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})
// Цвет бейджа роли (production-UI: admin — красный, engineer — синий, user — серый)
const roleBadgeClass = computed(() => {
  switch (props.user.role) {
    case 'admin': return 'bg-red-100 text-red-700 border-red-300'
    case 'engineer': return 'bg-blue-100 text-blue-700 border-blue-300'
    default: return 'bg-gray-100 text-gray-700 border-gray-300'
  }
})
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-2 transition hover:shadow-md focus-within:ring-2 focus-within:ring-blue-400" tabindex="0" aria-label="Карточка пользователя">
    <div class="flex items-center gap-4 mb-2">
      <!-- Аватар с инициалами -->
      <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500 border border-gray-200 select-none">
        <span>{{ user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?' }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-lg text-gray-900 truncate" :title="user.name">{{ user.name || 'Без имени' }}</div>
        <div class="text-xs text-gray-400 truncate">ID: {{ user.id }}</div>
      </div>
      <span :class="'px-3 py-1 rounded-full border text-xs font-semibold ' + roleBadgeClass" aria-label="Роль пользователя">{{ user.role || '—' }}</span>
    </div>
    <div class="text-sm text-gray-700"><span class="font-medium">Email:</span> {{ user.email || '—' }}</div>
    <div class="text-sm text-gray-700"><span class="font-medium">Телефон:</span> {{ user.phone || '—' }}</div>
    <div class="text-sm text-gray-700"><span class="font-medium">Организация:</span> {{ user.organization || '—' }}</div>
  </div>
</template>

<!--
  Intent: атомарная карточка пользователя для production-UI.
  Особенности:
  - Белый фон, строгая рамка, крупный акцент на имени и роли.
  - Бейдж роли с цветом по типу (admin — красный, engineer — синий, user — серый).
  - Только ключевые поля: имя, email, телефон, организация, роль.
  - Максимальная читаемость, адаптивность, accessibility (tabindex, aria-label).
  - Использовать в production-сетках, списках, модалях.
  Edge-cases: если нет имени — "Без имени", если нет email/телефона/организации — "—".
--> 