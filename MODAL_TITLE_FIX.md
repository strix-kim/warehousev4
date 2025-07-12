# 🔧 Исправление предупреждения Vue Modal

## ❌ **Проблема**

```
[Vue warn]: Extraneous non-props attributes (title) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes.
```

**Причина:** В `EventEditor.vue` передавался пропс `:title` в компонент `Modal`, но:
1. Компонент `Modal` ожидает пропс `header`, а не `title`
2. Мы используем слот `#header` для кастомного заголовка
3. Vue не может автоматически унаследовать лишние пропсы в Teleport компонентах

## ✅ **Решение**

### **До исправления:**
```vue
<Modal 
  v-model="modalValue" 
  size="lg"
  :title="isEdit ? 'Редактировать мероприятие' : 'Создать мероприятие'"
>
  <template #header>
    <!-- Кастомный заголовок -->
  </template>
</Modal>
```

### **После исправления:**
```vue
<Modal 
  v-model="modalValue" 
  size="lg"
>
  <template #header>
    <!-- Кастомный заголовок -->
  </template>
</Modal>
```

## 📋 **Детали**

### **Компонент Modal поддерживает:**
- **Пропс `header`** — простой текстовый заголовок
- **Слот `#header`** — кастомный заголовок с иконками и стилизацией

### **В EventEditor мы используем:**
- Слот `#header` с иконкой и динамическим текстом
- Поэтому пропс `title` был лишним

### **Проверенные файлы:**
- ✅ `EventEditor.vue` — исправлен
- ✅ `EventFormModal.vue` — корректно использует только слот
- ✅ Другие Modal компоненты — без проблем

## 🎯 **Результат**

- ❌ Предупреждение Vue устранено
- ✅ Функциональность сохранена
- ✅ Кастомные заголовки работают корректно
- ✅ Консистентность API Modal компонента

---

**Исправление завершено! Предупреждения Vue больше нет.** 🎉 