# Архитектура Warehouse v4

## Обзор

Проект использует **feature-based архитектуру** с элементами **Atomic Design** для UI компонентов.

## Структура проекта

```
src/
├── app/                    # Конфигурация приложения
│   ├── router/            # Роутинг
│   ├── store/             # Глобальные stores
│   ├── plugins/           # Vue плагины
│   └── main.js           # Точка входа
│
├── features/              # Бизнес-модули
│   ├── equipment/         # Модуль оборудования
│   ├── events/           # Модуль событий
│   ├── mount-points/     # Модуль точек крепления
│   ├── users/            # Модуль пользователей
│   └── reports/          # Модуль отчетов
│
├── shared/               # Общие ресурсы
│   ├── ui/              # Дизайн-система
│   ├── composables/     # Общие composables
│   ├── utils/           # Утилиты
│   ├── constants/       # Константы
│   └── types/           # Общие типы
│
├── pages/               # Страницы приложения
└── assets/              # Статические ресурсы
```

## Принципы организации

### 1. Feature-based архитектура

Каждый модуль (`features/`) самодостаточен и содержит:

```
feature/
├── components/     # UI компоненты модуля
├── composables/    # Бизнес-логика
├── api/           # API для модуля
├── types/         # TypeScript типы
└── index.js       # Публичный API
```

### 2. Atomic Design для UI

- **atoms**: Button, Input, Icon, Spinner
- **molecules**: Card, FormField, Modal, Pagination
- **organisms**: Table, Navbar, UserCard
- **templates**: Layout, ErrorState, EmptyState

### 3. Импорты

Используйте алиасы для импортов:

```javascript
// Вместо
import EquipmentTable from '@/features/equipment/EquipmentTable.vue'

// Используйте
import { EquipmentTable } from '@features/equipment'
import { Button } from '@shared/ui'
```

## Правила разработки

### Добавление нового модуля

1. Создайте папку в `features/`
2. Следуйте стандартной структуре
3. Создайте `index.js` с публичным API
4. Добавьте алиас в `vite.config.js`

### Добавление UI компонента

1. Определите уровень (atom/molecule/organism/template)
2. Разместите в соответствующей папке
3. Экспортируйте через `shared/index.js`

### Импорты между модулями

- Модули могут импортировать только публичный API других модулей
- Общие ресурсы импортируются из `@shared`
- Избегайте циклических зависимостей

## Преимущества

✅ **Масштабируемость**: Легко добавлять новые модули
✅ **Изоляция**: Модули независимы друг от друга
✅ **Переиспользование**: Atomic Design компонентов
✅ **Читаемость**: Четкая структура и алиасы
✅ **Производительность**: Ленивая загрузка модулей 