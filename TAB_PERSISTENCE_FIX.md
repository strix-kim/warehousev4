# Исправление: Сохранение активной вкладки при перезагрузке страницы

## 🎯 Проблема
При перезагрузке страницы точки монтажа пользователь всегда возвращался на вкладку "Обзор", даже если был на другой вкладке.

## 🔍 Причина
В компоненте `mount-point-details-page.vue` активная вкладка инициализировалась значением по умолчанию:
```javascript
const activeTab = ref('overview')
```

При перезагрузке страницы это значение сбрасывалось к `'overview'`.

## ✅ Решение

### 1. Добавлена функция инициализации активной вкладки
```javascript
const initializeActiveTab = () => {
  // Сначала проверяем URL параметр
  const urlTab = route.query.tab
  if (urlTab && ['overview', 'equipment', 'team', 'duties'].includes(urlTab)) {
    activeTab.value = urlTab
    return
  }
  
  // Если нет в URL, проверяем localStorage
  const savedTab = localStorage.getItem(`mount-point-tab-${mountPointId}`)
  if (savedTab && ['overview', 'equipment', 'team', 'duties'].includes(savedTab)) {
    activeTab.value = savedTab
  }
}
```

### 2. Добавлено сохранение активной вкладки
```javascript
const saveActiveTab = (tab) => {
  // Сохраняем в localStorage
  localStorage.setItem(`mount-point-tab-${mountPointId}`, tab)
  
  // Обновляем URL без перезагрузки страницы
  const newQuery = { ...route.query, tab }
  router.replace({ query: newQuery })
}
```

### 3. Добавлен обработчик изменения вкладки
```javascript
const handleTabChange = (tab) => {
  activeTab.value = tab
  saveActiveTab(tab)
}
```

### 4. Добавлен watch для отслеживания изменений URL
```javascript
watch(() => route.query.tab, (newTab) => {
  if (newTab && ['overview', 'equipment', 'team', 'duties'].includes(newTab)) {
    activeTab.value = newTab
  }
})
```

### 5. Обновлены обработчики кликов на вкладки
Заменил прямые присваивания на вызовы `handleTabChange`:
```javascript
@click="handleTabChange('overview')"
@click="handleTabChange('equipment')"
@click="handleTabChange('team')"
@click="handleTabChange('duties')"
```

## 🔧 Механизм работы

### Приоритет восстановления вкладки:
1. **URL параметр** - если в URL есть `?tab=equipment`, восстанавливается вкладка "Оборудование"
2. **localStorage** - если в URL нет параметра, проверяется сохраненная вкладка в localStorage
3. **По умолчанию** - если ничего не найдено, используется вкладка "Обзор"

### Сохранение при переключении:
1. **localStorage** - вкладка сохраняется для конкретной точки монтажа
2. **URL** - параметр добавляется в URL для возможности поделиться ссылкой

## 🎉 Результат

**Теперь при перезагрузке страницы:**
- ✅ Пользователь остается на той же вкладке
- ✅ URL содержит информацию о текущей вкладке
- ✅ Можно поделиться ссылкой на конкретную вкладку
- ✅ Состояние сохраняется между сессиями

**Примеры URL:**
- `/mount-points/1` - вкладка "Обзор" (по умолчанию)
- `/mount-points/1?tab=equipment` - вкладка "Оборудование"
- `/mount-points/1?tab=team` - вкладка "Команда"
- `/mount-points/1?tab=duties` - вкладка "Техзадания" 