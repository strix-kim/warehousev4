# Анализ компонентов для добавления оборудования

## Текущее состояние

### 🔍 Существующие компоненты

#### 1. `EquipmentEditor.vue` (src/features/equipment/)
**Функциональность:**
- ✅ Модальное окно для добавления/редактирования оборудования
- ✅ Все поля схемы БД (model, brand, serial_number, quantity, status, location, category, subcategory, tech_description, description)
- ✅ Валидация обязательных полей
- ✅ Поддержка категорий и подкатегорий
- ✅ Состояния loading/error

**Проблемы и несоответствия:**

❌ **Дизайн-система:**
- Использует кастомный CSS вместо Tailwind CSS
- Не использует компоненты из `src/shared/ui/`
- Стили не соответствуют обновленной дизайн-системе
- Шрифт `JetBrains Mono` не соответствует основному дизайну

❌ **Архитектура:**
- Не интегрирован с обновленным `Modal.vue` (новая система размеров)
- Не использует `FormField.vue` и `Input.vue` из дизайн-системы
- Дублирует логику валидации
- Неоптимальная структура пропсов

❌ **UX/UI:**
- Устаревший визуальный стиль
- Не соответствует современным стандартам форм
- Отсутствует прогрессивная валидация
- Нет автосохранения в localStorage

#### 2. Интеграция на странице `equipment-page.vue`
**Текущая реализация:**
- ❌ Заглушка модального окна (TODO комментарий)
- ❌ `EquipmentEditor` не подключен к странице
- ❌ Отсутствует обработка событий добавления
- ❌ Нет интеграции с Pinia store

### 🎯 Требования к новым компонентам

#### Функциональные требования:
1. **Полная интеграция с дизайн-системой** - использование только Tailwind CSS и компонентов из `src/shared/ui/`
2. **Современный UX** - прогрессивная валидация, автосохранение, улучшенная навигация
3. **Accessibility** - полная поддержка screen readers, клавиатурной навигации
4. **Responsive дизайн** - адаптивность для всех устройств
5. **Интеграция с состоянием** - полная интеграция с Pinia store и API

#### Технические требования:
1. **Vue 3 Composition API** с `<script setup>`
2. **Только Tailwind CSS** - никакого кастомного CSS
3. **TypeScript-готовность** - четкие интерфейсы пропсов
4. **Тестируемость** - разделение логики и UI
5. **Производительность** - ленивая загрузка, оптимизация ререндеров

## 📋 План создания новых компонентов

### 1. Новый `EquipmentForm.vue` (замена EquipmentEditor.vue)

**Местоположение:** `src/features/equipment/components/EquipmentForm.vue`

**Архитектура:**
```vue
<template>
  <Modal 
    :model-value="modelValue" 
    @update:modelValue="handleClose"
    :header="isEdit ? 'Редактировать оборудование' : 'Добавить оборудование'"
    size="xl"
    class="equipment-form-modal"
  >
    <!-- Основная форма -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Основная информация -->
      <EquipmentFormBasicInfo 
        v-model="formData"
        :errors="validationErrors"
        :categories="categories"
        :subcategories-map="subcategoriesMap"
      />
      
      <!-- Техническая информация -->
      <EquipmentFormTechnicalInfo 
        v-model="formData"
        :errors="validationErrors"
      />
      
      <!-- Дополнительная информация -->
      <EquipmentFormAdditionalInfo 
        v-model="formData"
        :errors="validationErrors"
      />
    </form>

    <!-- Footer с кнопками -->
    <template #footer>
      <EquipmentFormActions
        :loading="loading"
        :is-edit="isEdit"
        :can-save="canSave"
        @cancel="handleClose"
        @save="handleSubmit"
        @save-draft="handleSaveDraft"
      />
    </template>
  </Modal>
</template>
```

**Ключевые особенности:**
- ✅ Модульная структура с подкомпонентами
- ✅ Использование обновленного `Modal.vue`
- ✅ Прогрессивная валидация
- ✅ Автосохранение черновиков
- ✅ Интеграция с дизайн-системой

### 2. Подкомпоненты формы

#### `EquipmentFormBasicInfo.vue`
**Назначение:** Основная информация (модель, бренд, серийный номер, количество, статус, локация)

```vue
<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
      Основная информация
    </h3>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField 
        label="Модель" 
        :error="errors.model"
        required
      >
        <Input
          v-model="localData.model"
          placeholder="Например, Blackmagic ATEM Mini Pro"
          :variant="errors.model ? 'error' : 'default'"
          @blur="validateField('model')"
        />
      </FormField>
      
      <FormField 
        label="Бренд" 
        :error="errors.brand"
        required
      >
        <Input
          v-model="localData.brand"
          placeholder="Например, Blackmagic"
          :variant="errors.brand ? 'error' : 'default'"
          @blur="validateField('brand')"
        />
      </FormField>
      
      <!-- Остальные поля... -->
    </div>
  </div>
</template>
```

#### `EquipmentFormTechnicalInfo.vue`
**Назначение:** Категоризация (категория, подкатегория)

#### `EquipmentFormAdditionalInfo.vue`
**Назначение:** Описания (техническое описание, заметки)

#### `EquipmentFormActions.vue`
**Назначение:** Кнопки действий (сохранить, отмена, сохранить черновик)

### 3. Composables для логики

#### `useEquipmentForm.js`
```javascript
// src/features/equipment/composables/useEquipmentForm.js

import { ref, computed, watch } from 'vue'
import { useEquipmentStore } from '@/stores/equipment-store'
import { useFormValidation } from '@/shared/composables/useFormValidation'
import { useLocalStorage } from '@/shared/composables/useLocalStorage'

export function useEquipmentForm(isEdit = false, initialData = null) {
  const equipmentStore = useEquipmentStore()
  
  // Форма и состояние
  const formData = ref(getInitialFormData(initialData))
  const loading = ref(false)
  const isDirty = ref(false)
  
  // Валидация
  const { errors, validateField, validateForm, clearErrors } = useFormValidation(equipmentValidationRules)
  
  // Автосохранение черновиков
  const { save: saveDraft, load: loadDraft, clear: clearDraft } = useLocalStorage('equipment-form-draft')
  
  // Computed
  const canSave = computed(() => {
    return !loading.value && 
           formData.value.model && 
           formData.value.brand && 
           formData.value.serial_number &&
           !Object.keys(errors.value).length
  })
  
  // Методы
  const handleSubmit = async () => {
    if (!validateForm(formData.value)) return
    
    loading.value = true
    try {
      if (isEdit) {
        await equipmentStore.updateEquipment(initialData.id, formData.value)
      } else {
        await equipmentStore.createEquipment(formData.value)
      }
      clearDraft()
      return true
    } catch (error) {
      console.error('Ошибка сохранения:', error)
      return false
    } finally {
      loading.value = false
    }
  }
  
  const handleSaveDraft = () => {
    saveDraft(formData.value)
  }
  
  // Автосохранение при изменениях
  watch(formData, (newData) => {
    isDirty.value = true
    if (isDirty.value) {
      saveDraft(newData)
    }
  }, { deep: true })
  
  return {
    formData,
    loading,
    errors,
    canSave,
    isDirty,
    validateField,
    handleSubmit,
    handleSaveDraft,
    clearErrors
  }
}
```

#### `useFormValidation.js`
```javascript
// src/shared/composables/useFormValidation.js

import { ref, reactive } from 'vue'

export function useFormValidation(rules) {
  const errors = reactive({})
  
  const validateField = (fieldName, value) => {
    const rule = rules[fieldName]
    if (!rule) return true
    
    const error = rule(value)
    if (error) {
      errors[fieldName] = error
      return false
    } else {
      delete errors[fieldName]
      return true
    }
  }
  
  const validateForm = (data) => {
    let isValid = true
    Object.keys(rules).forEach(fieldName => {
      if (!validateField(fieldName, data[fieldName])) {
        isValid = false
      }
    })
    return isValid
  }
  
  const clearErrors = () => {
    Object.keys(errors).forEach(key => delete errors[key])
  }
  
  return {
    errors,
    validateField,
    validateForm,
    clearErrors
  }
}
```

### 4. Правила валидации

#### `equipmentValidationRules.js`
```javascript
// src/features/equipment/utils/equipmentValidationRules.js

export const equipmentValidationRules = {
  model: (value) => {
    if (!value?.trim()) return 'Модель обязательна для заполнения'
    if (value.length < 2) return 'Модель должна содержать минимум 2 символа'
    if (value.length > 100) return 'Модель не должна превышать 100 символов'
    return null
  },
  
  brand: (value) => {
    if (!value?.trim()) return 'Бренд обязателен для заполнения'
    if (value.length < 2) return 'Бренд должен содержать минимум 2 символа'
    if (value.length > 50) return 'Бренд не должен превышать 50 символов'
    return null
  },
  
  serial_number: (value) => {
    if (!value?.trim()) return 'Серийный номер обязателен для заполнения'
    if (value.length < 3) return 'Серийный номер должен содержать минимум 3 символа'
    if (value.length > 50) return 'Серийный номер не должен превышать 50 символов'
    // Проверка на уникальность должна быть асинхронной
    return null
  },
  
  quantity: (value) => {
    const num = Number(value)
    if (!num || num < 1) return 'Количество должно быть больше 0'
    if (num > 1000) return 'Количество не должно превышать 1000'
    if (!Number.isInteger(num)) return 'Количество должно быть целым числом'
    return null
  },
  
  category: (value) => {
    if (!value?.trim()) return 'Категория обязательна для выбора'
    return null
  },
  
  subcategory: (value) => {
    if (!value?.trim()) return 'Подкатегория обязательна для выбора'
    return null
  },
  
  location: (value) => {
    if (!value?.trim()) return 'Локация обязательна для заполнения'
    if (value.length > 100) return 'Локация не должна превышать 100 символов'
    return null
  },
  
  tech_description: (value) => {
    if (value && value.length > 1000) return 'Техническое описание не должно превышать 1000 символов'
    return null
  },
  
  description: (value) => {
    if (value && value.length > 500) return 'Описание не должно превышать 500 символов'
    return null
  }
}
```

## 🔄 План интеграции

### Этап 1: Создание базовых компонентов (1-2 дня)
1. ✅ Создать `EquipmentForm.vue` с использованием дизайн-системы
2. ✅ Создать подкомпоненты формы
3. ✅ Создать composables для логики
4. ✅ Создать правила валидации

### Этап 2: Интеграция с существующей системой (1 день)
1. ✅ Обновить `equipment-page.vue` для использования нового компонента
2. ✅ Интегрировать с Pinia store
3. ✅ Обновить API методы при необходимости
4. ✅ Добавить обработку ошибок

### Этап 3: Тестирование и полировка (1 день)
1. ✅ Протестировать все сценарии использования
2. ✅ Проверить accessibility
3. ✅ Оптимизировать производительность
4. ✅ Добавить документацию

### Этап 4: Замена старого компонента (0.5 дня)
1. ✅ Заменить использование `EquipmentEditor.vue` на новый `EquipmentForm.vue`
2. ✅ Удалить старый компонент
3. ✅ Обновить импорты и зависимости

## 🎨 Дизайн-требования

### Цветовая схема
- **Основные цвета:** `gray-50`, `gray-100`, `gray-500`, `gray-700`, `gray-900`
- **Акцентные цвета:** `red-600`, `red-700` (кнопки действий), `blue-600` (ссылки)
- **Статусные цвета:** `green-600` (успех), `red-600` (ошибки), `yellow-600` (предупреждения)

### Типографика
- **Заголовки:** `text-lg font-semibold` для секций, `text-xl font-bold` для главного заголовка
- **Лейблы:** `text-sm font-medium text-gray-700`
- **Основной текст:** `text-sm text-gray-900`
- **Вспомогательный текст:** `text-xs text-gray-600`

### Отступы и размеры
- **Общие отступы:** `space-y-6` между секциями, `space-y-4` внутри секций
- **Поля ввода:** `px-4 py-2` для стандартных полей
- **Кнопки:** `px-6 py-3` для основных, `px-4 py-2` для вторичных

## 🚀 Преимущества нового подхода

### Техническая согласованность
✅ **Полная интеграция с дизайн-системой** - использование только компонентов из `src/shared/ui/`  
✅ **Tailwind CSS only** - никакого кастомного CSS  
✅ **Модульная архитектура** - разделение ответственности между компонентами  
✅ **Переиспользуемые composables** - логика доступна для других форм  

### UX улучшения
✅ **Прогрессивная валидация** - валидация по мере ввода  
✅ **Автосохранение черновиков** - защита от потери данных  
✅ **Улучшенная навигация** - логичная группировка полей  
✅ **Accessibility** - полная поддержка screen readers  

### Поддержка и развитие
✅ **Легче тестировать** - разделение логики и UI  
✅ **Легче расширять** - модульная структура  
✅ **Согласованность** - единый стиль с остальным проектом  
✅ **Масштабируемость** - готовность к новым требованиям  

Этот план обеспечивает создание современного, производительного и поддерживаемого решения для добавления оборудования, полностью соответствующего стандартам проекта. 