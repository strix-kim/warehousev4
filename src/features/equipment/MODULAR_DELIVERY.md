# 📦 Equipment Module - Независимая поставка

## 🎯 Архитектурная цель

Equipment модуль разработан для **независимой поставки разным клиентам**. Он имеет **НУЛЕВЫЕ статические зависимости** и может работать как самостоятельный пакет с автоматической деградацией к заглушкам.

## 🏗️ Самодостаточная архитектура

### ✅ Что входит в equipment модуль:

```
src/features/equipment/
├── api/
│   ├── equipment-api.js                    # ✅ Основное API оборудования
│   ├── equipment-lists-api.js              # ✅ API списков оборудования  
│   └── equipment-external-data-api.js      # ✅ API внешних данных (мероприятия/точки)
├── components/                             # ✅ Все UI компоненты
├── composables/                            # ✅ Вся бизнес-логика
├── constants/                              # ✅ Константы и справочники
├── store/                                  # ✅ State management
└── index.js                                # ✅ Публичный API модуля
```

### 🔄 Стратегия динамической загрузки данных

**equipment-external-data-api.js** использует революционный подход:

1. **🔍 Динамическая проверка** - автоматически определяет доступность модулей
2. **📦 Условные импорты** - загружает модули только если они доступны
3. **🎭 Умные заглушки** - генерирует реалистичные демо-данные
4. **🛡️ Graceful degradation** - плавная деградация при ошибках

```javascript
// 🔍 Автоматическая проверка доступности
const eventsAvailable = await isEventsModuleAvailable()

if (eventsAvailable) {
  // 📦 Динамический импорт
  const { fetchActiveEvents } = await import('@/features/events/api/eventApi')
} else {
  // 🎭 Переключение на заглушки
  return await loadEventsStub()
}
```

## 📋 Сценарии поставки

### 🎯 Сценарий 1: Полная поставка
```
Клиент получает все модули:
├── equipment/     ✅
├── events/        ✅  
└── mount-points/  ✅

Результат: Полная функциональность
```

### 🎯 Сценарий 2: Только equipment модуль
```
Клиент получает только:
├── equipment/     ✅
├── events/        ❌ Нет
└── mount-points/  ❌ Нет

Результат: Equipment работает с заглушками
```

### 🎯 Сценарий 3: Интеграция с внешними системами
```
Клиент заменяет external-data-api на свой:
├── equipment/                    ✅
├── custom-events-integration/    ✅ Кастомная интеграция
└── custom-locations-api/         ✅ Кастомная интеграция

Результат: Equipment интегрирован с системами клиента
```

## 🔧 Настройка для разных клиентов

### 1. Автоматическая конфигурация

В `equipment-external-data-api.js` **НЕТ** статических импортов:

```javascript
// 🚫 СТАРЫЙ ПОДХОД (статические импорты)
// import { fetchActiveEvents } from '@/features/events/api/eventApi'

// ✅ НОВЫЙ ПОДХОД (динамические импорты)
async function loadEventsForEquipmentLists() {
  const eventsAvailable = await isEventsModuleAvailable()
  
  if (!eventsAvailable) {
    return await loadEventsStub() // Автоматические заглушки
  }
  
  // Динамический импорт только когда модуль доступен
  const { fetchActiveEvents } = await import('@/features/events/api/eventApi')
  // ...
}
```

### 2. Переменные окружения

```javascript
// .env.client-a
VITE_HAS_EVENTS_MODULE=true
VITE_HAS_MOUNT_POINTS_MODULE=true

// .env.client-b  
VITE_HAS_EVENTS_MODULE=false
VITE_HAS_MOUNT_POINTS_MODULE=false
```

### 3. Условная загрузка

```javascript
const loadEvents = process.env.VITE_HAS_EVENTS_MODULE === 'true' 
  ? loadEventsForEquipmentLists 
  : loadEventsStub
```

## 📦 Инструкция по поставке

### Шаг 1: Подготовка пакета
```bash
# Копируем только equipment модуль
cp -r src/features/equipment/ client-package/

# Добавляем необходимые shared компоненты
cp -r src/shared/ui-v2/ client-package/shared/
```

### Шаг 2: Настройка зависимостей
```bash
# Проверяем какие модули доступны у клиента
if [ ! -d "client-package/features/events" ]; then
  # Переключаем на заглушки
  sed -i 's/loadEventsForEquipmentLists/loadEventsStub/g' equipment-external-data-api.js
fi
```

### Шаг 3: Тестирование изоляции
```bash
# Запускаем только с equipment модулем
npm run test:equipment-only
```

## 🧪 Тестирование модульности

### Тест независимости:
```javascript
// tests/equipment-isolation.test.js
describe('Equipment Module Independence', () => {
  it('should work without events module', () => {
    // Мок отсутствующего events API
    jest.mock('@/features/events/api/eventApi', () => ({
      fetchActiveEvents: jest.fn().mockRejectedValue(new Error('Module not found'))
    }))
    
    // Equipment должен работать с заглушками
    expect(loadEventsStub()).resolves.toBeTruthy()
  })
})
```

## 🔄 Миграция между версиями

### Обновление equipment модуля у клиента:
1. **Сохранить конфигурацию** клиента
2. **Заменить только equipment/** папку  
3. **Применить конфигурацию** заново
4. **Протестировать** интеграцию

## ✅ Checklist готовности к поставке

### Перед отправкой клиенту:
- [ ] Equipment модуль запускается изолированно
- [ ] Заглушки работают корректно  
- [ ] Все зависимости инкапсулированы
- [ ] Документация актуальна
- [ ] Тесты изоляции проходят
- [ ] UI компоненты работают автономно

---

**🎯 Результат: Equipment модуль готов к независимой поставке любым клиентам!**