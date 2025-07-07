<script setup>
// LoginPage — страница логина с Supabase Auth (email+пароль)
// Обрабатывает все UI-состояния: idle, loading, error401, error500, offline
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/shared/api/supabase'
import Button from '@/components/Button.vue'

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref(null)
const router = useRouter()

// Реактивный статус онлайн/оффлайн
const isOnline = ref(window.navigator.onLine)
function updateOnlineStatus() {
  isOnline.value = window.navigator.onLine
}
onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})
onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})

// Редирект после успешного входа через onAuthStateChange
let authListener = null
onMounted(() => {
  authListener = supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session)
    if (event === 'SIGNED_IN' && session) {
      router.push('/')
      console.log('Session in guard:', session)
    }
  })
})
onUnmounted(() => {
  if (authListener && typeof authListener.unsubscribe === 'function') {
    authListener.unsubscribe()
  }
})

async function login() {
  isLoading.value = true
  error.value = null
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (authError) {
      if (authError.status === 401) {
        error.value = 'Неверный логин или пароль'
      } else {
        error.value = 'Ошибка сервера. Попробуйте позже.'
      }
      return
    }
    // Редирект теперь через onAuthStateChange
  } catch (e) {
    if (!isOnline.value) {
      error.value = 'Нет соединения с интернетом'
    } else {
      error.value = 'Неизвестная ошибка'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <form @submit.prevent="login" class="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-sm flex flex-col gap-4 text-gray-900">
      <h2 class="text-xl font-bold mb-2">Вход</h2>
      <input v-model="email" type="email" required placeholder="Email" class="w-full px-3 py-2 rounded border border-gray-300" />
      <input v-model="password" type="password" required placeholder="Пароль" class="w-full px-3 py-2 rounded border border-gray-300" />
      <div v-if="error" class="text-red-500 text-center font-semibold">{{ error }}</div>
      <Button type="submit" :loading="isLoading">Войти</Button>
    </form>
  </div>
</template>

<!--
  Все состояния (isLoading, error, offline) реализованы по ui_states_prompt.yaml.
  После успешного входа — редирект на Dashboard.
--> 