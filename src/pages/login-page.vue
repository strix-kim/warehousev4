<script setup>
/**
 * LoginPage — UI Kit v2 + Bento минималистичный дизайн
 * Современная страница авторизации в едином стиле проекта
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/store/auth-store'

// UI Kit v2 компоненты
import { 
  ButtonV2,
  InputV2,
  NotificationV2,
  IconV2,
  SpinnerV2
} from '@/shared/ui-v2'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const isOnline = ref(navigator.onLine)
const router = useRouter()
const authStore = useAuthStore()
const notificationSystem = ref(null)

// Обработчики статуса сети
function updateOnlineStatus() {
  isOnline.value = navigator.onLine
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  
  console.log('🔐 Login page: монтирован (auth logic в auth-store.js)')
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

// Логика входа с NotificationV2
async function handleLogin() {
  if (!email.value || !password.value) {
    notificationSystem.value?.warning('Заполните все поля для входа', {
      title: 'Неполные данные',
      duration: 3000
    })
    return
  }
  
  isLoading.value = true
  
  try {
    console.log('🔐 Login: попытка входа через auth store')
    
    // Используем централизованный метод авторизации из auth store
    await authStore.login(email.value, password.value)
    
    // Если мы дошли сюда, значит логин прошел успешно
    notificationSystem.value?.success('Вход выполнен успешно', {
      title: 'Добро пожаловать!',
      duration: 2000
    })
    
    console.log('✅ Login: успешный вход через auth store, перенаправляем')
    
    // Небольшая задержка для показа уведомления, затем перенаправление
    // Мгновенная навигация без дополнительного клика
    await router.replace({ name: 'home' })
  } catch (e) {
    console.error('❌ Login: ошибка авторизации:', e)
    
    // Обработка различных типов ошибок
    const message = e.message?.toLowerCase() || ''
    
    if (!isOnline.value) {
      notificationSystem.value?.error('Нет соединения с интернетом', {
        title: 'Проблема с сетью',
        description: 'Проверьте подключение и попробуйте снова',
        duration: 5000
      })
    } else if (message.includes('invalid') || message.includes('wrong') || message.includes('incorrect')) {
      notificationSystem.value?.error('Неверный email или пароль', {
        title: 'Ошибка входа',
        duration: 4000
      })
    } else {
      notificationSystem.value?.error(e.message || 'Ошибка авторизации', {
        title: 'Проблема с входом',
        duration: 4000
      })
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
  <div class="min-h-screen bg-accent flex items-center justify-center p-4">
    <div class="w-full sm:w-96">
      <!-- Логотип и брендинг -->
      <div class="text-center mb-8">
        <img 
          src="/logo.png" 
          alt="Argo Media EPR System" 
          class="w-32 h-32 mx-auto object-contain mb-6"
        />
        <h1 class="text-3xl font-bold text-primary mb-2">EPR System</h1>
        <p class="text-base text-secondary">
          Управление видеооборудованием и мероприятиями
        </p>
      </div>

      <!-- Форма входа -->
      <BentoCard size="1x1" variant="default" class="shadow-lg">
        <div class="text-center mb-6">
          <h2 class="text-xl font-semibold text-primary">Вход в систему</h2>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-6" role="form" aria-label="Форма входа в систему">
          <!-- Email поле -->
          <div class="space-y-2">
            <label for="email-input" class="block text-sm font-medium text-primary">
              Email адрес
            </label>
            <InputV2
              id="email-input"
              v-model="email"
              type="email"
              placeholder="example@company.com"
              :disabled="isLoading"
              autocomplete="username"
              aria-describedby="email-error"
              required
            >
                          <template #icon>
              <IconV2 name="mail" size="sm" color="secondary" />
            </template>
            </InputV2>
          </div>

          <!-- Password поле -->
          <div class="space-y-2">
            <label for="password-input" class="block text-sm font-medium text-primary">
              Пароль
            </label>
            <InputV2
              id="password-input"
              v-model="password"
              type="password"
              placeholder="Введите ваш пароль"
              :disabled="isLoading"
              autocomplete="current-password"
              aria-describedby="password-error"
              required
            >
              <template #icon>
                <IconV2 name="lock" size="sm" color="secondary" />
              </template>
            </InputV2>
          </div>

          <!-- Offline индикатор -->
          <div 
            v-if="!isOnline" 
            class="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3"
            role="alert"
            aria-live="polite"
          >
            <IconV2 name="wifi-off" size="sm" color="warning" />
            <div>
              <p class="text-sm font-medium text-primary">Нет соединения</p>
              <p class="text-xs text-secondary">Проверьте подключение к интернету</p>
            </div>
          </div>

          <!-- Кнопка входа -->
          <ButtonV2
            type="submit"
            variant="primary"
            size="lg"
            :disabled="!isFormValid || isLoading || !isOnline"
            class="w-full"
            aria-describedby="submit-help"
          >
            <template v-if="isLoading" #icon>
              <SpinnerV2 size="sm" />
            </template>
            <template v-else #icon>
              <IconV2 name="log-in" size="sm" />
            </template>
            {{ isLoading ? 'Выполняется вход...' : 'Войти в систему' }}
          </ButtonV2>
        </form>

        <!-- Помощь и поддержка -->
        <div class="mt-8 pt-6 border-t border-secondary/20">
          <p class="text-center text-sm text-secondary">
            Проблемы со входом? 
            <br>
            <span class="font-medium">Обратитесь к администратору системы</span>
          </p>
        </div>
      </BentoCard>
    </div>

    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>
