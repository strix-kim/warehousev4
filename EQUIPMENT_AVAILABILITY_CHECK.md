# Анализ доступного оборудования в модальном окне

## 🔍 Откуда берется оборудование

### 1. Источник данных
Оборудование загружается из **Supabase базы данных** через API:
```javascript
// equipmentApi.js
export async function fetchEquipments() {
  return await supabase
    .from('equipments')
    .select('*')
    .order('name', { ascending: true })
}
```

### 2. Хранилище данных
Данные хранятся в **equipmentStore**:
```javascript
// equipment-store.js
state: () => ({
  equipments: [],      // Список всего оборудования
  loading: false,
  error: null,
  // ...
})
```

### 3. Фильтрация доступного оборудования
В модальном окне используется computed свойство:
```javascript
const availableEquipment = computed(() => {
  return equipmentStore.equipments.filter(equipment => 
    isEquipmentAvailable(equipment.id) && 
    !plannedEquipment.value.includes(equipment.id)
  )
})
```

## 🎯 Логика фильтрации

### Первый фильтр: `isEquipmentAvailable(equipment.id)`
Проверяет, не используется ли оборудование в других точках монтажа:

```javascript
// use-used-equipment-ids.js
const isEquipmentAvailable = (equipmentId) => {
  return !usedEquipmentIds.value.has(Number(equipmentId))
}
```

**Что исключает:**
- Оборудование из `equipment_plan` других точек монтажа
- Оборудование из `equipment_fact` других точек монтажа  
- Оборудование из `equipment_final` других точек монтажа

### Второй фильтр: `!plannedEquipment.value.includes(equipment.id)`
Исключает оборудование, которое уже добавлено в планируемый список текущей точки монтажа.

## 📊 Текущее количество оборудования

### В базе данных (seed.sql):
```sql
-- Оборудование
insert into equipments (id, model, brand, serial_number, quantity, status, location, category, subcategory, tech_description, description) values
  ('10000000-0000-0000-0000-000000000001', 'V-Mixer 700', 'Roland', 'SN-VM700-001', 2, 'operational', 'Main Storage', 'Audio', 'Mixer', 'Digital audio mixer', 'Основной микшер для FOH'),
  ('10000000-0000-0000-0000-000000000002', 'LED Panel 4K', 'Samsung', 'SN-LED4K-002', 10, 'operational', 'Warehouse A', 'Video', 'Display', '4K LED panel', 'Панели для видеостены'),
  ('10000000-0000-0000-0000-000000000003', 'Shure SM58', 'Shure', 'SN-SM58-003', 5, 'in_repair', 'Repair Room', 'Audio', 'Microphone', 'Dynamic vocal mic', 'Микрофоны для вокала');
```

**Итого в базе: 3 единицы оборудования**

### Использование в точках монтажа:
```sql
-- Точки монтажа (mount_points)
insert into mount_points (id, event_id, name, responsible_engineers, equipment_plan, equipment_final, equipment_fact) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Main Stage', ARRAY['00000000-0000-0000-0000-000000000004']::uuid[], ARRAY['10000000-0000-0000-0000-000000000001']::uuid[], ARRAY['10000000-0000-0000-0000-000000000001']::uuid[], ARRAY['10000000-0000-0000-0000-000000000001']::uuid[]),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Video Wall', ARRAY['00000000-0000-0000-0000-000000000003']::uuid[], ARRAY['10000000-0000-0000-0000-000000000002']::uuid[], ARRAY['10000000-0000-0000-0000-000000000002']::uuid[], ARRAY['10000000-0000-0000-0000-000000000002']::uuid[]);
```

**Распределение:**
- **Main Stage** использует: V-Mixer 700 (ID: 10000000-0000-0000-0000-000000000001)
- **Video Wall** использует: LED Panel 4K (ID: 10000000-0000-0000-0000-000000000002)

## 🎯 Доступное оборудование в модальном окне

### Для точки монтажа "Main Stage":
- ❌ **V-Mixer 700** - уже используется в этой точке
- ❌ **LED Panel 4K** - используется в Video Wall
- ✅ **Shure SM58** - доступно (в ремонте, но не используется)

**Доступно: 1 единица оборудования**

### Для точки монтажа "Video Wall":
- ❌ **V-Mixer 700** - используется в Main Stage  
- ❌ **LED Panel 4K** - уже используется в этой точке
- ✅ **Shure SM58** - доступно (в ремонте, но не используется)

**Доступно: 1 единица оборудования**

## 🔧 Как увеличить количество доступного оборудования

### 1. Добавить больше оборудования в базу данных
```sql
-- Добавить новые единицы оборудования
insert into equipments (id, model, brand, serial_number, quantity, status, location, category, subcategory, tech_description, description) values
  ('10000000-0000-0000-0000-000000000004', 'Behringer X32', 'Behringer', 'SN-X32-004', 1, 'operational', 'Main Storage', 'Audio', 'Mixer', 'Digital mixer', 'Резервный микшер'),
  ('10000000-0000-0000-0000-000000000005', 'Sony Camera', 'Sony', 'SN-SONY-005', 3, 'operational', 'Warehouse B', 'Video', 'Camera', '4K camera', 'Камеры для съемки');
```

### 2. Освободить оборудование от других точек монтажа
```sql
-- Очистить списки оборудования в точках монтажа
update mount_points 
set equipment_plan = ARRAY[]::uuid[], 
    equipment_fact = ARRAY[]::uuid[], 
    equipment_final = ARRAY[]::uuid[]
where id = '30000000-0000-0000-0000-000000000001';
```

### 3. Изменить статус оборудования на "operational"
```sql
-- Изменить статус с "in_repair" на "operational"
update equipments 
set status = 'operational' 
where id = '10000000-0000-0000-0000-000000000003';
```

## 📈 Рекомендации

### Для тестирования:
1. **Добавить больше оборудования** в seed файл
2. **Создать разные сценарии** использования
3. **Проверить фильтрацию** на разных точках монтажа

### Для продакшена:
1. **Регулярно обновлять** статус оборудования
2. **Мониторить использование** оборудования
3. **Добавлять новое оборудование** по мере необходимости

## 🎉 Вывод

**В данный момент в модальном окне доступно:**
- **1 единица оборудования** (Shure SM58) для каждой точки монтажа
- **Остальное оборудование** уже используется в других точках
- **Система фильтрации работает корректно** - исключает занятое оборудование 