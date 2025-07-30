<template>
  <header class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-7xl mx-auto">
      <div class="flex justify-between items-center h-20 px-4 sm:px-6 lg:px-8">
        <!-- Логотип с изображением -->
        <div 
          class="flex items-center gap-3 cursor-pointer select-none hover:opacity-80 transition"
          @click="handleLogoClick"
          tabindex="0"
          @keydown.enter="handleLogoClick"
          aria-label="На главную"
        >
          <img 
            src="/logo.png" 
            alt="Argo Media Logo" 
            class="w-12 h-12 object-contain"
            @error="showFallbackIcon = true"
            v-show="!showFallbackIcon"
          />
          <!-- Fallback иконка если изображение не загрузится -->
          <Icon 
            v-show="showFallbackIcon"
            name="Box" 
            set="lucide" 
            size="lg" 
            class="text-blue-500 w-12 h-12"
          />
          <div>
            <h1 class="text-xl font-bold text-gray-900">Argo Media</h1>
            <span class="text-sm text-gray-500 hidden sm:block">EPR System</span>
          </div>
        </div>
        <!-- Desktop навигация -->
        <nav class="hidden lg:flex items-center gap-1">
          <Button
            v-for="item in menu"
            :key="item.route"
            :label="item.label"
            :variant="isCurrentRoute(item.route) ? 'primary' : 'ghost'"
            size="sm"
            @click="handleNavigate(item.route)"
            :class="{
              'text-blue-600 bg-blue-50': isCurrentRoute(item.route),
              'text-gray-700 hover:text-gray-900 hover:bg-gray-100': !isCurrentRoute(item.route)
            }"
          />
        </nav>
        <!-- Desktop профиль и выход -->
        <div class="hidden lg:flex items-center gap-3">
          <div v-if="email" class="flex items-center gap-3">
            <div class="text-right">
              <p class="text-sm font-medium text-gray-900">{{ userName }}</p>
              <p class="text-xs text-gray-500">{{ email }}</p>
            </div>
            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Icon name="User" set="lucide" size="md" class="text-blue-500" />
            </div>
          </div>
          <Button
            label="Выйти"
            variant="secondary"
            size="sm"
            @click="handleLogout"
          />
        </div>
        <!-- Mobile кнопка меню -->
        <button
          @click="toggleMobileMenu"
          class="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <Icon :name="isMobileMenuOpen ? 'X' : 'Menu'" set="lucide" size="md" />
        </button>
      </div>
      <!-- Mobile меню -->
      <div v-if="isMobileMenuOpen" class="lg:hidden bg-white border-t border-gray-200">
        <div class="px-4 py-3 space-y-1">
          <Button
            v-for="item in menu"
            :key="item.route"
            :label="item.label"
            :variant="isCurrentRoute(item.route) ? 'primary' : 'ghost'"
            size="md"
            class="w-full justify-start"
            @click="handleMobileNavigate(item.route)"
          />
          <div v-if="email" class="pt-4 border-t border-gray-200 mt-4">
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
              <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Icon name="User" set="lucide" size="lg" class="text-blue-500" />
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ userName }}</p>
                <p class="text-xs text-gray-500">{{ email }}</p>
              </div>
            </div>
            <Button
              label="Выйти"
              variant="secondary"
              size="md"
              class="w-full mt-3"
              @click="handleLogout"
            />
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from '../atoms/Button.vue'
import Icon from '../atoms/Icon.vue'

const props = defineProps({
  menu: { type: Array, required: true },
  email: String,
  userName: { type: String, default: 'Пользователь' }
})

const emit = defineEmits(['navigate', 'logout'])

const route = useRoute()
const router = useRouter()
const isMobileMenuOpen = ref(false)
const showFallbackIcon = ref(false)

const isCurrentRoute = (routePath) => {
  return route.path === routePath || (routePath === '/' && route.path === '/home')
}

const handleNavigate = (path) => {
  emit('navigate', path)
}

const handleLogout = () => {
  emit('logout')
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const handleMobileNavigate = (path) => {
  isMobileMenuOpen.value = false
  handleNavigate(path)
}

// Новый обработчик для клика по лого
const handleLogoClick = () => {
  router.push('/')
}
</script> 