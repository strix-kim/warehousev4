# Warehouse v4 — Production-ready Vue 3 + Supabase

## Архитектура и структура
- Feature-sliced: `src/app`, `src/pages`, `src/features`, `src/entities`, `src/shared`
- Production-стандарты: Vite, Pinia, Tailwind CSS v4, Supabase, RLS, RBAC
- Весь UI строится на компонентах из `src/shared/ui` (UI Kit, атомарный дизайн)
- Все бизнес-логика и доступ — только через сервисы/хуки, никаких прямых запросов из UI

## Роли пользователей
- **admin** — администрирование пользователей и ролей, все права
- **manager** — полный доступ, включая удаление оборудования
- **technician** — работает с техникой, управляет мероприятиями (без удаления)
- **video_engineer** — создаёт мероприятия, управляет точками монтажа, формирует списки оборудования

## Seed-данные (пример)
- Пользователь (admin): admin@example.com
- Пользователь (manager): manager@example.com
- Пользователь (technician): tech@example.com
- Пользователь (video_engineer): engineer@example.com
- Пароли задаются при регистрации через Supabase Auth
- После регистрации id из Auth должен быть скопирован в таблицу users (ручная синхронизация)

## Инструкция по регистрации и ручной синхронизации users/Auth
1. Зарегистрируйте пользователя через Supabase Auth (email+пароль)
2. Получите его id (auth.uid()) в Supabase Dashboard → Authentication → Users
3. В таблице users обновите id для этого email на полученный uuid
4. Назначьте нужную роль (admin, manager, technician, video_engineer)

## Production-стандарты
- Только Vite, Pinia, Tailwind CSS v4, Supabase
- Все состояния (isLoading, hasError, offline, forbidden, empty, stale) реализованы в UI
- Все бизнес-правила и доступ — только через сервисы/хуки
- RLS и RBAC на уровне Supabase, UI не показывает данные без прав
- Подробные комментарии на русском языке во всех хуках, сервисах, компонентах
- Все компоненты и хуки — только именованные экспорты
- Строгая структура feature-sliced
- Все UI-компоненты — только из `src/shared/ui` (atoms, molecules, organisms, templates)

## Чек-лист для тестирования (ручное и автоматическое)
- [ ] CRUD для всех сущностей (users, equipments, events, mount_points, reports)
- [ ] Проверка ролей: admin, manager, technician, video_engineer (UI и права)
- [ ] UI-состояния: loading, error, forbidden (403), offline, empty, stale
- [ ] Edge-cases: session expired (401), race-condition, forbidden actions
- [ ] Проверка RLS: пользователь видит только свои данные, нет доступа к чужим
- [ ] Проверка seed-данных: все тестовые пользователи и сущности отображаются
- [ ] Проверка production-стандартов: структура, комментарии, хуки, сервисы

---

> Для новых разработчиков: ознакомьтесь с архитектурой, seed-данными, ролями и production-стандартами перед началом работы. Все вопросы и доработки — только через PR и code-review.
