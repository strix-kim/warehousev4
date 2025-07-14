<template>
  <!-- Карточка пользователя: только просмотр, фирменный стиль, адаптивность, accessibility -->
  <div
    class="bg-white rounded-2xl shadow-md border border-gray-200 p-8 min-w-[320px] flex flex-col gap-4 transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-blue-400"
    role="region"
    :aria-label="`Пользователь ${user.name}`"
    tabindex="0"
  >
    <!-- Аватар и имя -->
    <div class="flex items-center gap-4">
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
        :class="avatarBg"
        aria-label="Аватар пользователя"
      >
        {{ avatarText }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xl font-semibold text-gray-900 break-words leading-tight">{{ user.name }}</span>
          <span
            class="px-2 py-0.5 rounded text-xs font-medium"
            :class="roleBadgeClass"
            aria-label="Роль пользователя"
          >
            {{ user.role || 'Инженер' }}
          </span>
        </div>
        <div class="text-xs text-gray-500 truncate mt-1">{{ user.email }}</div>
      </div>
    </div>
    <!-- Только просмотр, без статуса и действий -->
  </div>
</template>

<script setup>
/**
 * UserCard.vue — карточка пользователя для просмотра информации об инженере
 * - Аватар (буква/emoji, цветной фон)
 * - Имя, роль (цветной бейдж), email
 * - Только просмотр, без статуса и действий
 * - Адаптивность, whitespace, aria-label, подробные комментарии
 * - Только Tailwind CSS
 */
import { computed } from 'vue'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

// Аватар: первая буква имени или emoji
const avatarText = computed(() => {
  if (props.user.avatar_emoji) return props.user.avatar_emoji
  if (props.user.name) return props.user.name.charAt(0).toUpperCase()
  return '👤'
})
// Цвет фона аватара по роли
const avatarBg = computed(() => {
  switch (props.user.role) {
    case 'admin': return 'bg-blue-100 text-blue-700'
    case 'manager': return 'bg-green-100 text-green-700'
    case 'guest': return 'bg-gray-100 text-gray-500'
    default: return 'bg-indigo-100 text-indigo-700'
  }
})
// Цвет бейджа роли
const roleBadgeClass = computed(() => {
  switch (props.user.role) {
    case 'admin': return 'bg-blue-100 text-blue-700'
    case 'manager': return 'bg-green-100 text-green-700'
    case 'guest': return 'bg-gray-100 text-gray-500'
    default: return 'bg-indigo-100 text-indigo-700'
  }
})
</script>

<!--
  UserCard.vue — карточка пользователя только для просмотра
  - Аватар, имя, роль, email
  - Адаптивность, whitespace, accessibility
  - Только Tailwind CSS, подробные комментарии
--> 