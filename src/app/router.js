// src/app/router.js
// Маршрутизатор приложения. Здесь настраиваются все маршруты и lazy-загрузка страниц.
// Используется Vue Router 4 и динамические импорты для оптимизации загрузки.

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/app/store/auth-store'

// Lazy-загрузка страниц (feature-sliced: все страницы — в src/pages)
const HomePage = () => import('@/pages/home-page-v2.vue')
const LoginPage = () => import('@/pages/login-page.vue')
const NotFoundPage = () => import('@/pages/not-found-page.vue')
const UIKitPage = () => import('@/pages/ui-kit-page.vue')
const EquipmentModulePage = () => import('@/pages/equipment/equipment-module-page.vue')
const EquipmentItemsPage = () => import('@/pages/equipment/equipment-items-page.vue')
const EquipmentListsPage = () => import('@/pages/equipment/equipment-lists-page.vue')
const EquipmentListsCreatePage = () => import('@/pages/equipment/equipment-lists-create-page.vue')
const EquipmentListsCreateAbstractPage = () => import('@/pages/equipment/equipment-lists-create-abstract-page.vue')
const EquipmentListsViewPage = () => import('@/pages/equipment/equipment-lists-view-page.vue')
const UtilitiesModulePage = () => import('@/pages/utilities/utilities-module-page.vue')
const EventsModulePage = () => import('@/pages/events/events-module-page.vue')
const EventDetails = () => import('@/features/events/EventDetails.vue')
const ReportsPage = () => import('@/pages/reports/reports-page.vue')
const ReportDetailsPage = () => import('@/pages/reports/report-details-page.vue')
const UsersPage = () => import('@/pages/users/users-page.vue')
const FinalEquipmentSelectionPage = () => import('@/pages/final-equipment-selection-page.vue')

// Описание маршрутов приложения
export const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { public: true }, // публичный маршрут
  },
  {
    path: '/utilities',
    name: 'utilities-module',
    component: UtilitiesModulePage,
    // Главная страница модуля утилит
  },
  {
    path: '/',
    name: 'home',
    component: HomePage,
    // Главная страница
  },
  {
    path: '/ui-kit',
    name: 'ui-kit',
    component: UIKitPage,
    meta: { public: true }, // доступно без авторизации для демонстрации
    // Страница демонстрации UI Kit v2
  },
      // Модуль оборудования
    {
      path: '/equipment',
      name: 'equipment-module',
      component: EquipmentModulePage,
      // Главная страница модуля оборудования
    },
    {
      path: '/equipment/items',
      name: 'equipment-items',
      component: EquipmentItemsPage,
      // Управление оборудованием (CRUD)
    },
    {
      path: '/equipment/lists',
      name: 'equipment-lists',
      component: EquipmentListsPage,
      // Просмотр списков оборудования
    },
    {
      path: '/equipment/lists/create',
      name: 'equipment-lists-create',
      component: EquipmentListsCreatePage,
      // Создание нового списка оборудования (конкретные единицы)
    },
    {
      path: '/equipment/lists/create-abstract',
      name: 'equipment-lists-create-abstract',
      component: EquipmentListsCreateAbstractPage,
      // Создание нового списка оборудования (по типам)
    },
    {
      path: '/equipment/lists/edit-abstract/:id',
      name: 'equipment-lists-edit-abstract',
      component: EquipmentListsCreateAbstractPage,
      props: true,
      // Редактирование списка оборудования (по типам)
    },
    {
      path: '/equipment/lists/:id',
      name: 'equipment-lists-view',
      component: EquipmentListsViewPage,
      props: true,
      // Просмотр деталей списка оборудования
    },
    {
      path: '/equipment/lists/edit/:id',
      name: 'equipment-lists-edit',
      component: EquipmentListsCreatePage,
      props: true,
      // Редактирование существующего списка оборудования (та же страница!)
    },
  {
    path: '/events',
    name: 'events-module',
    component: EventsModulePage,
    // Главная страница модуля мероприятий
  },
  // Удалено: список мероприятий /events/list
  {
    path: '/events/:id',
    name: 'event-details',
    component: EventDetails,
    // Детали мероприятия (включает создание точек монтажа)
  },
  {
    path: '/mount-point/:id',
    name: 'mount-point-details',
    component: () => import('@/pages/mount-points/mount-point-details-page.vue'),
    // Детали точки монтажа
  },
  {
    path: '/mount-point/:mountPointId/final-equipment-selection/:eventId',
    name: 'final-equipment-selection',
    component: FinalEquipmentSelectionPage,
    // Страница выбора итогового оборудования для точки монтажа
  },
  {
    path: '/reports',
    name: 'reports',
    component: ReportsPage,
    // Список отчётов
  },
  {
    path: '/report-details/:id',
    name: 'report-details',
    component: ReportDetailsPage,
    // Просмотр отчёта по id
  },
  {
    path: '/users',
    name: 'users',
    component: UsersPage,
    // Страница пользователей
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    // Страница 404 для всех несуществующих маршрутов
  },
]

// Создание экземпляра роутера
export const router = createRouter({
  history: createWebHistory(),
  routes,
  // Настройка поведения скролла при навигации
  scrollBehavior(to, from, savedPosition) {
    // Якорные ссылки - плавный скролл к элементу
    if (to.hash) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            el: to.hash,
            behavior: 'smooth'
          })
        }, 100)
      })
    }
    
    // Кнопка "Назад" - восстанавливаем позицию
    if (savedPosition) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(savedPosition)
        }, 100)
      })
    }
    
    // Новая страница - принудительный скролл наверх
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Дополнительная проверка
        if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
          document.documentElement.scrollTop = 0
        }
        resolve({ top: 0, left: 0, behavior: 'auto' })
      }, 50)
    })
  }
})

// Оптимизированный guard: используем auth store без дублирования API вызовов
// Дополнительная гарантия скролла наверх (для случаев, когда scrollBehavior не срабатывает)
router.afterEach((to, from) => {
  // Только для переходов без якорей
  if (!to.hash) {
    // Немедленный скролл
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    
    // Дополнительные проверки с задержками (критично для некоторых случаев)
    const delays = [50, 150, 300]
    delays.forEach(delay => {
      setTimeout(() => {
        if (window.scrollY > 0 || document.documentElement.scrollTop > 0 || document.body.scrollTop > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
          document.documentElement.scrollTop = 0
          document.body.scrollTop = 0
        }
      }, delay)
    })
  }
})

router.beforeEach(async (to, from, next) => {
  // Публичные страницы - пропускаем проверку
  if (to.meta.public) {
    return next()
  }
  
  try {
    const authStore = useAuthStore()
    
    // Если store ещё не инициализирован — инициализируем прямо здесь
    if (!authStore.isInitialized) {
      try {
        await authStore.init()
      } catch (err) {
        console.error('Router: ошибка инициализации auth store', err)
      }
    }
    
    // Проверяем аутентификацию через store
    if (authStore.isAuthenticated) {
      return next()
    }
    
    // Предотвращаем бесконечные редиректы
    if (to.path === '/login') {
      return next()
    }
    
    next('/login')
  } catch (error) {
    console.error('Router: ошибка проверки аутентификации:', error)
    next('/login')
  }
}) 