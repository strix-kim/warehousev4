# Обновление документации проекта warehousev4

## Анализ папки `/promt` и внесенные изменения

### Проведенный анализ

Была проанализирована папка `/promt` с оригинальной документацией проекта и выявлены расхождения с текущим состоянием кодовой базы. Основные проблемы:

1. **Устаревшие названия таблиц** - в документации `equipment`, `event`, в коде `equipments`, `events`
2. **Новые компоненты и структура** - добавлены новые UI компоненты, изменена архитектура features
3. **Отсутствующие поля** - добавлены `is_archived`, `created_at`, `updated_at` в схему БД
4. **Новые технологии** - обновлены версии Vue, Tailwind, добавлены новые зависимости

### Обновленные файлы

#### 1. `architecture_prompt.yaml`
**Изменения:**
- ✅ Исправлены названия сущностей: `equipment` → `equipments`, `event` → `events`
- ✅ Добавлен полный технологический стек с версиями
- ✅ Детализирована структура модулей с актуальными компонентами
- ✅ Обновлены API endpoints с новыми методами (архивирование, статистика)
- ✅ Добавлены архитектурные паттерны и принципы

#### 2. `data_schema_prompt.yaml.yaml`
**Изменения:**
- ✅ Исправлены названия таблиц: `equipment` → `equipments`, `event` → `events`
- ✅ Добавлены недостающие поля: `is_archived`, `created_at`, `updated_at`
- ✅ Обновлены RLS политики с правильными именами таблиц
- ✅ Дополнена JSON-схема новыми полями
- ✅ Исправлены внешние ключи и связи между таблицами

#### 3. `ui_states_prompt.yaml`
**Изменения:**
- ✅ Обновлены названия компонентов согласно текущей структуре
- ✅ Добавлены новые страницы: `home-page`, `mount-point-create-page`
- ✅ Актуализированы UI компоненты из `src/shared/ui`
- ✅ Дополнены состояния для модальных окон и новых features
- ✅ Добавлена секция с описанием UI компонентов для реализации состояний

#### 4. `fsm_tests_prompt.yaml`
**Изменения:**
- ✅ Обновлены тестируемые модули согласно текущей архитектуре
- ✅ Добавлены FSM для новых компонентов: `EquipmentDetailsModal`, `mount-point-create-page`
- ✅ Расширены сценарии с учетом архивирования мероприятий
- ✅ Добавлены тесты для RBAC и RLS проверок
- ✅ Дополнены общие Edge-Cases для всех компонентов

### Актуальное состояние проекта

#### Технологический стек (обновлен)
- **Frontend:** Vue 3.5.17, Vite 7.0.0, Pinia 3.0.3, Tailwind CSS 4.1.11
- **Backend:** Supabase, PostgreSQL, RLS, Supabase Auth
- **Tools:** ESLint 9.30.1, Prettier 3.6.2, Vitest 3.2.4

#### Структура проекта (актуализирована)
```
src/
├── features/
│   ├── equipment/
│   │   ├── components/ (EquipmentFormModal, EquipmentFormBasicInfo, etc.)
│   │   ├── ui/ (CategorySelect, EquipmentFilters, EquipmentSearchInput)
│   │   ├── composables/ (useEquipmentCategories, useEquipmentFilters, etc.)
│   │   └── utils/ (equipmentValidationRules)
│   ├── event/
│   │   ├── components/ (EventFormModal, EventDiagnostic)
│   │   ├── ui/ (EventTabs, EventGrid, EventCard)
│   │   └── pages/ (EventList, EventDetails, EventEditor)
│   └── shared/ui/
│       ├── atoms/ (Button, Icon, Input, Spinner)
│       ├── molecules/ (Card, FormField, Modal, TableRow)
│       ├── organisms/ (Navbar, Table, UserCard)
│       └── templates/ (EmptyState, ErrorState, ForbiddenState, Layout, OfflineState)
```

#### База данных (обновлена)
- **Таблицы:** `users`, `equipments`, `events`, `mount_points`, `reports`
- **Новые поля:** `is_archived`, `created_at`, `updated_at`
- **RLS политики:** обновлены с правильными именами таблиц

### Неизменные файлы

- `supabase_schema.sql` - уже содержит правильные названия таблиц
- `supabase_seed.sql` - данные для инициализации
- `supabase_schema_fix.sql` - исправления схемы

### Рекомендации по дальнейшему использованию

1. **Используйте обновленную документацию** как источник истины для архитектуры
2. **При добавлении новых компонентов** обновляйте соответствующие файлы в `/promt`
3. **Проверяйте соответствие** реальной структуры проекта и документации
4. **Ведите changelog** изменений архитектуры для синхронизации документации

### Статус обновления: ✅ ЗАВЕРШЕНО

Все ключевые файлы документации приведены в соответствие с текущим состоянием проекта warehousev4. Документация готова к использованию разработчиками и для создания новых компонентов согласно установленным стандартам. 