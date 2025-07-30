# Добавление поиска и фильтров в модальное окно оборудования

## 🎯 Задача
Добавить поиск и фильтры в модальное окно формирования планируемого списка оборудования, используя компоненты с главной страницы оборудования.

## ✅ Реализованные изменения

### 1. Импорты компонентов
**Добавлены импорты:**
```javascript
import EquipmentSearchInput from '@/features/equipment/ui/EquipmentSearchInput.vue'
import CategorySelect from '@/features/equipment/ui/CategorySelect.vue'
```

### 2. Состояния фильтров
**Добавлены реактивные состояния:**
```javascript
// Состояния фильтров
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedSubcategory = ref('')
const selectedStatus = ref('')
```

### 3. Обновленная логика фильтрации
**Расширенное computed свойство `availableEquipment`:**
```javascript
const availableEquipment = computed(() => {
  return equipmentStore.equipments.filter(equipment => {
    // Базовая фильтрация
    const isAvailable = isEquipmentAvailable(equipment.id) && 
                       !plannedEquipment.value.includes(equipment.id)
    
    if (!isAvailable) return false
    
    // Фильтр по поиску
    if (searchQuery.value) {
      const searchLower = searchQuery.value.toLowerCase()
      const matchesSearch = 
        equipment.brand?.toLowerCase().includes(searchLower) ||
        equipment.model?.toLowerCase().includes(searchLower) ||
        equipment.serial_number?.toLowerCase().includes(searchLower) ||
        equipment.category?.toLowerCase().includes(searchLower) ||
        equipment.subcategory?.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }
    
    // Фильтр по категории
    if (selectedCategory.value && equipment.category !== selectedCategory.value) {
      return false
    }
    
    // Фильтр по подкатегории
    if (selectedSubcategory.value && equipment.subcategory !== selectedSubcategory.value) {
      return false
    }
    
    // Фильтр по статусу
    if (selectedStatus.value && equipment.status !== selectedStatus.value) {
      return false
    }
    
    return true
  })
})
```

### 4. Методы обработки фильтров
**Добавлены методы:**
```javascript
const handleSearch = (query) => {
  searchQuery.value = query
}

const handleCategoryChange = (category) => {
  selectedCategory.value = category
  selectedSubcategory.value = '' // Сбрасываем подкатегорию при смене категории
}

const handleSubcategoryChange = (subcategory) => {
  selectedSubcategory.value = subcategory
}

const handleStatusChange = (event) => {
  selectedStatus.value = event.target.value
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedSubcategory.value = ''
  selectedStatus.value = ''
}

const hasActiveFilters = computed(() => {
  return searchQuery.value || selectedCategory.value || selectedSubcategory.value || selectedStatus.value
})
```

### 5. Опции для фильтров
**Добавлены опции статуса:**
```javascript
const statusOptions = [
  { value: '', label: 'Любой статус' },
  { value: 'operational', label: 'Работает' },
  { value: 'broken', label: 'Сломано' },
  { value: 'in_repair', label: 'В ремонте' }
]
```

### 6. Секция фильтров в модальном окне
**Добавлена новая секция:**
```html
<!-- Фильтры -->
<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
  <div class="flex items-center justify-between mb-4">
    <h4 class="font-medium text-gray-900">Фильтры поиска</h4>
    <Button
      v-if="hasActiveFilters"
      @click="clearFilters"
      variant="secondary"
      size="sm"
    >
      <Icon name="X" set="lucide" size="xs" class="mr-1" />
      Очистить фильтры
    </Button>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Поиск -->
    <div class="md:col-span-2">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Поиск оборудования
      </label>
      <EquipmentSearchInput
        v-model="searchQuery"
        placeholder="Поиск по бренду, модели, серийному номеру..."
        @search="handleSearch"
      />
    </div>
    
    <!-- Категория -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Категория
      </label>
      <CategorySelect
        :category-value="selectedCategory"
        :subcategory-value="selectedSubcategory"
        @update:category="handleCategoryChange"
        @update:subcategory="handleSubcategoryChange"
      />
    </div>
    
    <!-- Статус -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Статус
      </label>
      <select
        v-model="selectedStatus"
        @change="handleStatusChange"
        class="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
               transition-colors duration-200"
      >
        <option
          v-for="option in statusOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>
  </div>
</div>
```

### 7. Обновленные индикаторы
**Обновлен заголовок секции:**
```html
<div class="flex items-center gap-2">
  <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
    Доступно: {{ availableEquipment.length }}
  </span>
  <span v-if="hasActiveFilters" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
    Фильтры активны
  </span>
</div>
```

### 8. Улучшенное пустое состояние
**Обновлено сообщение о пустом списке:**
```html
<p class="text-gray-600 font-medium">
  {{ hasActiveFilters ? 'Нет оборудования по фильтрам' : 'Нет доступного оборудования' }}
</p>
<p class="text-sm text-gray-500 mt-1">
  {{ hasActiveFilters 
    ? 'Попробуйте изменить параметры поиска или очистить фильтры' 
    : 'Все оборудование уже используется в других точках монтажа' 
  }}
</p>
<div class="mt-3 p-2 bg-gray-50 rounded-lg">
  <p class="text-xs text-gray-500">
    Всего в системе: <strong>{{ equipmentStore.equipments.length }}</strong> единиц оборудования
  </p>
  <p v-if="hasActiveFilters" class="text-xs text-gray-500 mt-1">
    Доступно без фильтров: <strong>{{ equipmentStore.equipments.filter(eq => isEquipmentAvailable(eq.id) && !plannedEquipment.value.includes(eq.id)).length }}</strong> единиц
  </p>
</div>
```

## 🎨 Визуальные особенности

### Макет фильтров
- **Адаптивная сетка** - 1 колонка на мобильных, 2-4 на десктопе
- **Поиск занимает 2 колонки** для удобства ввода
- **Серый фон** для выделения секции фильтров

### Интерактивность
- **Кнопка очистки фильтров** появляется только при активных фильтрах
- **Индикатор активных фильтров** в заголовке секции
- **Автоматический сброс подкатегории** при смене категории

### Поиск
- **Поиск по всем полям** - бренд, модель, серийный номер, категория, подкатегория
- **Регистронезависимый поиск**
- **Мгновенная фильтрация** при вводе

## 🔧 Техническая реализация

### Компоненты
- **EquipmentSearchInput** - продвинутый поиск с автодополнением
- **CategorySelect** - выбор категории и подкатегории с зависимостями
- **Нативный select** для статуса

### Реактивность
- **Computed свойства** для автоматического пересчета
- **Watch эффекты** для синхронизации состояний
- **Мгновенная фильтрация** без задержек

### Производительность
- **Ленивая фильтрация** - вычисляется только при необходимости
- **Оптимизированные computed** свойства
- **Минимальные перерендеры**

## 📊 Функциональность

### Поиск
- ✅ **Поиск по бренду** и модели
- ✅ **Поиск по серийному номеру**
- ✅ **Поиск по категории** и подкатегории
- ✅ **Регистронезависимый** поиск

### Фильтры
- ✅ **Фильтр по категории** с зависимыми подкатегориями
- ✅ **Фильтр по статусу** (работает, сломано, в ремонте)
- ✅ **Комбинированные фильтры** - поиск + категория + статус

### Управление
- ✅ **Очистка всех фильтров** одной кнопкой
- ✅ **Индикация активных фильтров**
- ✅ **Автоматический сброс** зависимых фильтров

## 🎉 Результат

**Добавлены полнофункциональные фильтры:**

1. ✅ **Поиск оборудования** - по всем текстовым полям
2. ✅ **Фильтр по категории** - с зависимыми подкатегориями
3. ✅ **Фильтр по статусу** - работа, ремонт, поломка
4. ✅ **Комбинированная фильтрация** - все фильтры работают вместе
5. ✅ **Управление фильтрами** - очистка, индикация
6. ✅ **Адаптивный дизайн** - работает на всех устройствах

**Пользователь теперь может:**
- 🔍 **Быстро найти** нужное оборудование
- 🏷️ **Фильтровать по категориям** и статусу
- 📱 **Удобно работать** на любых устройствах
- 🎯 **Точно выбирать** подходящее оборудование

**Система стала намного удобнее для поиска и выбора оборудования!** 🚀 