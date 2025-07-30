<script setup>
/**
 * LoginPage — современная страница авторизации
 * Светлая тема, минималистичный дизайн, улучшенная адаптивность
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/shared/api/supabase'
import Layout from '@/shared/ui/templates/Layout.vue'
import FormField from '@/shared/ui/molecules/FormField.vue'
import Input from '@/shared/ui/atoms/Input.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import OfflineState from '@/shared/ui/templates/OfflineState.vue'

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref(null)
const isOnline = ref(navigator.onLine)
const router = useRouter()

// Обработчики статуса сети
function updateOnlineStatus() {
  isOnline.value = navigator.onLine
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  
  // Редирект после успешного входа
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      router.push('/')
    }
  })
  
  return () => subscription?.unsubscribe()
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

// Логика входа
async function handleLogin() {
  if (!email.value || !password.value) return
  
  isLoading.value = true
  error.value = null
  
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    
    if (authError) {
      // Пользовательские сообщения об ошибках
      const message = authError.message?.toLowerCase() || ''
      if ([400, 401].includes(authError.status) || message.includes('invalid')) {
        error.value = 'Неверный email или пароль'
      } else {
        error.value = authError.message || 'Ошибка авторизации'
      }
    }
  } catch (e) {
    if (!isOnline.value) {
      error.value = 'Нет соединения с интернетом'
    } else {
      error.value = 'Неизвестная ошибка. Попробуйте позже.'
    }
  } finally {
    isLoading.value = false
  }
}

// Валидация формы
const isFormValid = computed(() => {
  return email.value.trim() !== '' && password.value.trim() !== ''
})
</script>

<template>
  <!-- Современная страница логина: фирменная svg-иконка, центрирование, без лишнего скролла -->
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="w-full max-w-md space-y-6 px-4">
      <!-- Логотип и заголовок -->
      <div class="flex flex-col items-center">
        <!-- Логотип Argo Media -->
        <img 
          src="/logo.png" 
          alt="Argo Media Logo" 
          class="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 mb-4 object-contain max-w-full"
        />
        <h1 class="text-xl font-bold text-gray-900">EPR System</h1>
        <h2 class="mt-2 text-center text-2xl font-bold text-gray-900">Вход в систему</h2>
        <p class="mt-1 text-center text-sm text-gray-600">
          Управление видеооборудованием и мероприятиями
        </p>
      </div>
      <!-- Форма входа -->
      <div class="bg-white py-6 px-4 shadow-sm rounded-xl border border-gray-200 sm:px-6">
        <form class="space-y-4" @submit.prevent="handleLogin">
          <!-- Поле email -->
          <FormField label="Email" id="email">
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="your@email.com"
              :disabled="isLoading"
              autocomplete="username"
              required
              :variant="error && error.includes('email') ? 'error' : 'default'"
            />
          </FormField>
          <!-- Поле пароля -->
          <FormField label="Пароль" id="password">
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="Введите пароль"
              :disabled="isLoading"
              autocomplete="current-password"
              required
              :variant="error && error.includes('пароль') ? 'error' : 'default'"
            />
          </FormField>
          <!-- Состояния ошибок -->
          <OfflineState 
            v-if="!isOnline" 
            message="Нет соединения с интернетом"
            description="Проверьте подключение и попробуйте снова"
            class="mb-4"
          />
          <ErrorState 
            v-else-if="error" 
            :message="error"
            description="Проверьте правильность введенных данных"
            class="mb-4"
          />
          <!-- Кнопка входа -->
          <Button
            type="submit"
            :disabled="!isFormValid || isLoading || !isOnline"
            :label="isLoading ? 'Вход...' : 'Войти'"
            variant="primary"
            size="lg"
            class="w-full"
          />
        </form>
        <!-- Дополнительная информация -->
        <div class="mt-4">
          <div class="text-center">
            <p class="text-xs text-gray-500">
              Возникли проблемы? Обратитесь к администратору
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 