import { createApp } from 'vue'
// Подключение основного файла стилей с Tailwind CSS v4 и кастомной темой
import './assets/main.css'
import App from './App.vue'
// Импорт Pinia — современного хранилища состояний для Vue 3
import { createPinia } from 'pinia'
// Импорт роутера (feature-sliced: src/app/router.js)
import { router } from './app/router'


// Создаём экземпляр приложения и подключаем Pinia и роутер
const app = createApp(App)
app.use(createPinia())
app.use(router) // Подключение роутера обязательно для работы маршрутизации

// Инициализация auth-store теперь происходит в App.vue для предотвращения мигания контента

app.mount('#app')
