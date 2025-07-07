// src/shared/api/supabase.js
// Сервис-абстракция для работы с Supabase API.
// Здесь инициализируется клиент Supabase и описываются все методы для работы с backend.
// Используйте только именованные экспорты. Не импортируйте supabase напрямую в компоненты или хуки!

import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

// URL и ключ Supabase должны храниться в переменных окружения (например, .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Экземпляр клиента Supabase для работы с REST и realtime API.
 * Не используйте напрямую, только через сервисные функции ниже.
 */
export const supabase = createClient(supabaseUrl, supabaseKey)

// Реактивная сессия для глобального доступа
export const supabaseSession = ref(null)

// Инициализация сессии при старте
supabase.auth.getSession().then(({ data }) => {
  supabaseSession.value = data.session
})

// Подписка на изменения сессии
supabase.auth.onAuthStateChange((event, session) => {
  supabaseSession.value = session
})

/**
 * Пример: получить список пользователей из таблицы 'users'.
 * Все бизнес-методы должны быть асинхронными и обрабатывать ошибки.
 */
export async function fetchUsers() {
  // isLoading, hasError, success — состояния должны обрабатываться в хуках/компонентах
  const { data, error } = await supabase.from('users').select('*')
  if (error) {
    // В реальном проекте — логировать ошибку и пробрасывать наверх
    throw error
  }
  return data
}

// Здесь добавляйте другие методы для работы с Supabase (CRUD, аутентификация, и т.д.) 