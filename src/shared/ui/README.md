# UI Kit & Дизайн-система

## Структура каталогов

```
src/shared/ui/
  atoms/      # Базовые элементы (Button, Input, Spinner, Icon)
  molecules/  # Составные элементы (Modal, Card, TableRow, FormField)
  organisms/  # Сложные блоки (Table, UserCard)
  templates/  # Шаблоны layout и UI-состояний (Layout, EmptyState, ErrorState и др.)
```

## Базовые паттерны
- Все стили — только Tailwind CSS (без кастомных CSS)
- Layout и spacing — только через Tailwind
- Иконки — только SVG (Heroicons, Lucide, тематические SVG)
- Компоненты оформляются как Vue 3 SFC с `<script setup>`
- Подробные комментарии и документация обязательны
- Все компоненты адаптивны и доступны (accessibility)

## Примеры использования

### Кнопка
```vue
<script setup>
import Button from '@/shared/ui/atoms/Button.vue'
</script>
<Button label="Сохранить" />
<Button label="Удалить" class="bg-red-500 hover:bg-red-700" />
```

### Поле ввода
```vue
<script setup>
import Input from '@/shared/ui/atoms/Input.vue'
</script>
<Input v-model="value" placeholder="Введите текст" />
```

### Модальное окно
```vue
<script setup>
import Modal from '@/shared/ui/molecules/Modal.vue'
</script>
<Modal v-model="show" header="Заголовок">
  <p>Контент окна</p>
  <template #footer>
    <Button label="Закрыть" @click="show = false" />
  </template>
</Modal>
```

### Пагинация
```vue
<script setup>
import Pagination from '@/shared/ui/molecules/Pagination.vue'
</script>
<Pagination
  :current-page="page"
  :total-pages="totalPages"
  :total="total"
  :items-on-page="itemsOnPage"
  @page-change="handlePageChange"
/>
```

### Таблица
```vue
<script setup>
import Table from '@/shared/ui/organisms/Table.vue'
import TableRow from '@/shared/ui/molecules/TableRow.vue'
</script>
<Table :items="users">
  <template #thead>
    <th>Имя</th><th>Email</th>
  </template>
  <TableRow v-for="u in users" :key="u.id">
    <td>{{ u.name }}</td><td>{{ u.email }}</td>
  </TableRow>
</Table>
```

### Состояния страниц
```vue
<script setup>
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import ForbiddenState from '@/shared/ui/templates/ForbiddenState.vue'
import OfflineState from '@/shared/ui/templates/OfflineState.vue'
</script>
<EmptyState message="Нет данных" description="Добавьте первую запись" />
<ErrorState message="Ошибка загрузки" description="Попробуйте позже" />
<ForbiddenState message="Нет доступа" description="Обратитесь к администратору" />
<OfflineState message="Нет соединения" description="Проверьте интернет" />
```

## Описание пропсов и слотов

### Button.vue
| Prop      | Тип      | Описание                        |
|-----------|----------|---------------------------------|
| label     | String   | Текст кнопки                    |
| icon      | String   | SVG-иконка (опционально)        |
| type      | String   | Тип кнопки (button, submit)     |
| disabled  | Boolean  | Отключение                      |

### Input.vue
| Prop        | Тип      | Описание                        |
|-------------|----------|---------------------------------|
| modelValue  | String   | Значение (v-model)              |
| placeholder | String   | Плейсхолдер                     |
| disabled    | Boolean  | Отключение                      |
| ariaLabel   | String   | Подпись для accessibility       |

### Modal.vue
| Prop        | Тип      | Описание                        |
|-------------|----------|---------------------------------|
| modelValue  | Boolean  | Видимость (v-model)             |
| header      | String   | Заголовок окна                  |
| closable    | Boolean  | Можно ли закрыть                |
| width       | String   | Ширина окна                     |
| Слоты       |          | header, footer, default         |

### Pagination.vue
| Prop        | Тип      | Описание                        |
|-------------|----------|---------------------------------|
| currentPage | Number   | Текущая страница                |
| totalPages  | Number   | Общее количество страниц        |
| total       | Number   | Общее количество записей        |
| itemsOnPage | Number   | Записей на текущей странице     |
| События     |          | page-change                     |

### Table.vue
| Prop              | Тип      | Описание                        |
|-------------------|----------|---------------------------------|
| items             | Array    | Массив данных                   |
| Слоты             |          | header, footer, thead, tfoot    |

### EmptyState/ErrorState/ForbiddenState/OfflineState.vue
| Prop        | Тип      | Описание                        |
|-------------|----------|---------------------------------|
| message     | String   | Основное сообщение               |
| description | String   | Дополнительное описание          |
| icon        | String   | SVG-иконка (опционально)        |

## Best practices
- Используйте только компоненты из UI Kit для новых страниц и фичей
- Не используйте кастомные CSS — только Tailwind
- Всегда добавляйте aria-label и другие атрибуты доступности
- Документируйте все новые компоненты и паттерны

---

> Любые вопросы и предложения по развитию дизайн-системы — обсуждать с UI/UX-лидом или через pull request в этот файл. 