# Дизайн-система Warehouse v4 (PrimeVue + Bento)

## 🎯 Принципы

### **Bento Grid подход:**
- **Карточки фиксированного размера** (2x2, 2x1, 1x1, 1x2)
- **Сетка 12 колонок** для адаптивности
- **Консистентные отступы** (16px, 24px, 32px)
- **Единая цветовая палитра**

### **PrimeVue интеграция:**
- **Компоненты-обертки** поверх PrimeVue
- **Единый API** для всех компонентов
- **Кастомизация через CSS переменные**
- **Тематизация** (светлая/темная)

---

## 📐 Правила композиции

### **Размеры карточек (Bento):**
```css
.bento-card-2x2 { grid-column: span 2; grid-row: span 2; }
.bento-card-2x1 { grid-column: span 2; grid-row: span 1; }
.bento-card-1x2 { grid-column: span 1; grid-row: span 2; }
.bento-card-1x1 { grid-column: span 1; grid-row: span 1; }
```

### **Отступы и spacing:**
- **xs**: 4px
- **sm**: 8px  
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px

### **Цветовая палитра:**
- **Primary**: #3B82F6 (синий)
- **Secondary**: #64748B (серый)
- **Success**: #10B981 (зеленый)
- **Warning**: #F59E0B (желтый)
- **Danger**: #EF4444 (красный)
- **Info**: #06B6D4 (голубой)

---

## 🧩 Компоненты-обертки

### **Структура:**
```
src/shared/ui/
├── atoms/           # Базовые компоненты
│   ├── Button/
│   ├── Input/
│   └── Card/
├── molecules/       # Составные компоненты
│   ├── SearchBar/
│   ├── FilterPanel/
│   └── StatusBadge/
├── organisms/       # Сложные компоненты
│   ├── DataTable/
│   ├── Dashboard/
│   └── Navigation/
└── templates/       # Шаблоны страниц
    ├── BentoGrid/
    ├── SidebarLayout/
    └── ModalLayout/
```

---

## 📋 Правила разработки

### **1. Всегда используй обертки:**
```vue
<!-- ❌ Плохо -->
<Button label="Сохранить" />

<!-- ✅ Хорошо -->
<WarehouseButton variant="primary" size="md">
  Сохранить
</WarehouseButton>
```

### **2. Следуй Bento сетке:**
```vue
<BentoGrid>
  <BentoCard size="2x2" title="Оборудование">
    <EquipmentStats />
  </BentoCard>
  <BentoCard size="1x1" title="Мероприятия">
    <EventCount />
  </BentoCard>
</BentoGrid>
```

### **3. Используй консистентные отступы:**
```vue
<template>
  <div class="warehouse-layout">
    <header class="warehouse-header">
      <Navigation />
    </header>
    <main class="warehouse-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.warehouse-layout {
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
}
</style>
```

### **4. Тематизация через CSS переменные:**
```css
:root {
  --warehouse-primary: #3B82F6;
  --warehouse-secondary: #64748B;
  --warehouse-spacing-xs: 4px;
  --warehouse-spacing-sm: 8px;
  --warehouse-spacing-md: 16px;
  --warehouse-spacing-lg: 24px;
  --warehouse-spacing-xl: 32px;
  --warehouse-border-radius: 8px;
  --warehouse-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

---

## 🎨 Примеры компонентов

### **WarehouseButton (обертка над PrimeVue Button):**
```vue
<template>
  <Button
    :label="label"
    :icon="icon"
    :class="buttonClasses"
    :disabled="disabled"
    @click="$emit('click', $event)"
  />
</template>

<script setup>
import { computed } from 'vue'
import Button from 'primevue/button'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  label: { type: String, default: '' }
})

const buttonClasses = computed(() => [
  'warehouse-button',
  `warehouse-button--${props.variant}`,
  `warehouse-button--${props.size}`
])
</script>

<style scoped>
.warehouse-button {
  border-radius: var(--warehouse-border-radius);
  font-weight: 500;
  transition: all 0.2s ease;
}

.warehouse-button--primary {
  background: var(--warehouse-primary);
  border-color: var(--warehouse-primary);
}

.warehouse-button--md {
  padding: var(--warehouse-spacing-sm) var(--warehouse-spacing-md);
  font-size: 14px;
}
</style>
```

### **BentoCard (Bento сетка):**
```vue
<template>
  <div :class="cardClasses">
    <header v-if="title" class="bento-card__header">
      <h3 class="bento-card__title">{{ title }}</h3>
      <slot name="actions" />
    </header>
    <div class="bento-card__content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: String, default: '1x1' },
  title: { type: String, default: '' }
})

const cardClasses = computed(() => [
  'bento-card',
  `bento-card--${props.size}`
])
</script>

<style scoped>
.bento-card {
  background: white;
  border-radius: var(--warehouse-border-radius);
  box-shadow: var(--warehouse-shadow);
  padding: var(--warehouse-spacing-lg);
  border: 1px solid #e5e7eb;
}

.bento-card--2x2 { grid-column: span 2; grid-row: span 2; }
.bento-card--2x1 { grid-column: span 2; grid-row: span 1; }
.bento-card--1x2 { grid-column: span 1; grid-row: span 2; }
.bento-card--1x1 { grid-column: span 1; grid-row: span 1; }

.bento-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--warehouse-spacing-md);
}

.bento-card__title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}
</style>
```

---

## 🚀 Миграция

### **Пошаговый план:**

1. **Установить PrimeVue**
2. **Создать компоненты-обертки**
3. **Настроить CSS переменные**
4. **Создать BentoGrid систему**
5. **Постепенно мигрировать компоненты**

### **Приоритеты:**
- ✅ Сначала базовые компоненты (Button, Input, Card)
- ✅ Затем молекулы (SearchBar, FilterPanel)
- ✅ Потом организмы (DataTable, Dashboard)
- ✅ В конце шаблоны (BentoGrid, Layouts) 