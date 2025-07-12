# Исправление ошибок v-model в модальных компонентах

## Проблема
При компиляции Vue возникла ошибка:
```
v-model cannot be used on a prop, because local prop bindings are not writable.
Use a v-bind binding combined with a v-on listener that emits update:x event instead.
```

## Причина
В Vue 3 нельзя использовать `v-model` напрямую на пропсах компонента. Вместо этого нужно использовать комбинацию `:model-value` и `@update:modelValue`.

## Исправления

### 1. EquipmentDetailsModal.vue

**Было:**
```vue
<Modal v-model="modelValue" @update:modelValue="handleClose">
```

**Стало:**
```vue
<Modal :model-value="modelValue" @update:modelValue="handleClose">
```

**Для модального окна подтверждения удаления:**
```vue
<Modal 
  :model-value="showDeleteConfirm"
  @update:modelValue="(value) => showDeleteConfirm = value"
>
```

### 2. EquipmentTable.vue

**Для EquipmentDetailsModal:**
```vue
<EquipmentDetailsModal
  :model-value="showDetailsModal"
  @update:modelValue="(value) => showDetailsModal = value"
  :equipment="selectedEquipment"
  @edit="handleEdit"
  @delete="handleDelete"
/>
```

**Для EquipmentEditor:**
```vue
<EquipmentEditor
  :model-value="showEditModal"
  @update:modelValue="(value) => showEditModal = value"
  :is-edit="true"
  :equipment="selectedEquipment"
  :categories="categories"
  :subcategories-map="subcategoriesMap"
  @close="handleCloseModals"
  @submit="handleEditSubmit"
/>
```

## Результат
- ✅ Устранены все ошибки компиляции Vue
- ✅ Сохранена полная функциональность модальных окон
- ✅ Корректная работа с пропсами и событиями
- ✅ Приложение готово к использованию

## Техническое объяснение
Vue 3 требует явного разделения входящих данных (props) и исходящих событий (events) для обеспечения однонаправленного потока данных. Использование `:model-value` + `@update:modelValue` обеспечивает правильную архитектуру компонентов. 