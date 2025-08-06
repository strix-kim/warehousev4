# Mount Point Equipment Management System

## 🎯 Обзор

Система управления оборудованием точек монтажа находится в процессе переработки. Новый функционал будет разработан с нуля.

## 🏗️ Архитектура

### Компоненты

```
src/features/mount-point/
├── composables/
│   └── useMountPointEquipment.js     # Основная логика управления
├── components/
│   ├── MountPointEquipmentManager.vue # Главный компонент управления
│   └── MountPointFormModal.vue       # Форма создания/редактирования
├── use-used-equipment-ids.js         # Контроль уникальности
├── filter-available-equipment.js     # Фильтрация оборудования
```

### Структура данных

```typescript
interface MountPoint {
  id: number
  name: string
  event_id: number
  equipment_plan: number[]      // Планируемое оборудование
  equipment_fact: number[]      // Установленное оборудование
  equipment_final: number[]     // Автоматически генерируемый финальный список
}
```

## 🔧 Основные принципы

### 1. Контроль уникальности

**Уровень 1: Внутри точки монтажа**
- Оборудование не может быть одновременно планируемым и установленным
- Приоритет: установленное > планируемое

**Уровень 2: Между точками монтажа**
- Одно оборудование не может использоваться в нескольких точках одного мероприятия
- Реактивное отслеживание изменений через Pinia store

### 2. Автоматическое формирование финального списка

```javascript
// Приоритет: установленное > планируемое
const finalList = [...actualEquipment, ...plannedEquipment.filter(id => !actualEquipment.includes(id))]
```

### 3. Переиспользование существующих компонентов

- `useEquipmentFilters` - фильтрация по категориям, статусу
- `useEquipmentSearch` - поиск с автодополнением
- `EquipmentSearchInput`, `CategorySelect` - UI компоненты

## 📦 Использование

### Базовое использование

```vue
<template>
  <MountPointEquipmentManager
    :event-id="eventId"
    :mount-point-id="mountPointId"
    :initial-data="mountPointData"
    @save="handleSave"
    @change="handleChange"
    @error="handleError"
  />
</template>

<script setup>
import { MountPointEquipmentManager } from '@/features/mount-point/components'

const handleSave = (equipmentData) => {
  console.log('Сохранено:', equipmentData)
  // { planned: [...], actual: [...], final: [...] }
}
</script>
```

### Использование composable

```javascript
import { useMountPointEquipment } from '@/features/mount-point/composables/useMountPointEquipment'

const {
  isLoading,
  error,
  isEquipmentAvailable,
  getEquipmentUsageDetails
} = useMountPointEquipment(eventId, mountPointId)
```

## 🚧 Статус разработки

**ТЕКУЩИЙ СТАТУС:** Система находится в процессе переработки. Весь старый функционал создания списков оборудования удален.

**ПЛАНЫ:**
- Разработка нового интерфейса управления оборудованием
- Упрощение логики работы с оборудованием
- Улучшение UX/UI компонентов

## 📋 TODO

- [ ] Разработать новый интерфейс управления оборудованием
- [ ] Создать упрощенную логику работы с оборудованием
- [ ] Добавить новые UI компоненты
- [ ] Обновить документацию 