// src/app/router.js
// Маршрутизатор приложения. Здесь настраиваются все маршруты и lazy-загрузка страниц.
// Используется Vue Router 4 и динамические импорты для оптимизации загрузки.

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/shared/api/supabase'

// Lazy-загрузка страниц (feature-sliced: все страницы — в src/pages)
const HomePage = () => import('@/pages/home-page.vue')
const LoginPage = () => import('@/pages/login-page.vue')
const NotFoundPage = () => import('@/pages/not-found-page.vue')
const EquipmentPage = () => import('@/pages/equipment-page.vue')
const EventsPage = () => import('@/pages/events-page.vue')
const EventDetails = () => import('@/features/event/EventDetails.vue')
const ReportsPage = () => import('@/pages/reports-page.vue')
const ReportDetailsPage = () => import('@/pages/report-details-page.vue')
const UsersPage = () => import('@/pages/users-page.vue')

// Описание маршрутов приложения
export const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { public: true }, // публичный маршрут
  },
  {
    path: '/',
    name: 'home',
    component: HomePage,
    // Главная страница
  },
  {
    path: '/equipment',
    name: 'equipment',
    component: EquipmentPage,
    // Страница оборудования
  },
  {
    path: '/events',
    name: 'events',
    component: EventsPage,
    // Страница мероприятий
  },
  {
    path: '/events/:id',
    name: 'event-details',
    component: EventDetails,
    // Детали мероприятия (включает создание точек монтажа)
  },
  {
    path: '/mount-point/:id',
    name: 'mount-point-details',
    component: () => import('@/pages/mount-point-details-page.vue'),
    // Детали точки монтажа
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
})

// Асинхронный guard: если неавторизован — редирект на /login
router.beforeEach(async (to, from, next) => {
  if (to.meta.public) return next()
  const { data: { session } } = await supabase.auth.getSession()
  if (session && session.user) return next()
  next('/login')
}) 