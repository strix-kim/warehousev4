# План: «Производственные расходы» (`/expenses`) — `planner`, с49

Принят прорабом по сути (плоский журнал, ведёт один человек). Живая база при планировании
не читалась (мост был слеп) — факты о проде из `03-data-model` и миграций; на старте кода
сверить первым вызовом.

Образец сотрудника (Google Sheets): заголовок «Производственные расходы»; колонки
«Наименование расхода» | «Дата» | «Сумма»; строки «Напитки для команды — 09.09.2026 —
102 000», «Аккумуляторы для кликеров — 21.09.2026 — 40 000»; «Итого: 142 000». Сумы, целые.

## Решения

- **Одна таблица `public.expenses`**, без контейнера-«отчёта»: отчёт = выгрузка xlsx (тот же
  принцип, что у списков на мероприятие). Группировка — месяц фильтром. Понадобится
  контейнер — nullable `report_id` аддитивной миграцией.
- **Журнал ведёт один человек (прораб).** Добавить к плану планировщика: необязательное
  `spent_by uuid null → employees(id) on delete set null` («Кто потратил», `EmployeePicker`)
  и фильтр по нему. Это атрибуция, не защита.
- **Права — строго владелец** (`created_by = auth.uid()`) на все четыре операции. Первая
  owner-политика на чтение в проекте. Руководство получает файл. Открыть второму аккаунту —
  одна миграция позже; ужесточать деньги задним числом больнее.
- **Итог считает база** — одной RPC со строками.
- Мероприятие, валюта (только UZS), статус, фото чека — не в v1.
- 3D расходам не нужен (личные деньги на общем кампусе).

## Модель

| Колонка | Тип и ограничение |
|---|---|
| `id` | uuid pk |
| `name` | text not null, `btrim(name) <> ''`, длина ≤ 200 |
| `spent_on` | date not null, **без default** (`current_date` в базе — UTC, до 05:00 Ташкента это вчера; дату шлёт клиент из `todayDateValue()`) |
| `amount` | bigint not null, `amount > 0 and amount <= 1000000000` |
| `spent_by` | uuid null → `employees` |
| `created_by` | uuid not null default `auth.uid()`, FK `auth.users(id)` |
| `created_at`, `updated_at` | timestamptz |

- Ограничения именованные (`expenses_amount_check`, `expenses_name_check`) — отказ разбирается
  по имени, как `vehicleSaveErrorText`.
- Триггеры без новых функций: `public.normalize_hall_name()` (делает `btrim(new.name)`,
  потому колонка зовётся `name`) и `public.update_updated_at_column()`.
- Индекс `(created_by, spent_on desc, created_at desc, id)`.

## RLS и RPC

```sql
-- select / update (using + with check) / delete
(select private.is_app_member()) and created_by = (select auth.uid())
-- insert и запись дополнительно:
(select private.has_any_role(array['technician','manager','admin'])) and created_by = (select auth.uid())
```

Гранты: `revoke all … from public, anon, authenticated`, затем `grant select, insert, update,
delete … to authenticated`.

RPC `public.expenses_period(p_from date, p_to date) returns jsonb` — `security invoker`,
`stable`, `search_path = ''`, проверка членства внутри, явный фильтр `created_by = auth.uid()`.
Отдаёт `{rows, total, count}` одним снимком (образец — `home_summary`). Сумма по подгруженным
строкам на клиенте молча соврёт при обрезке Data API на 1000 строк; скалярный jsonb под
обрезку не попадает. `revoke … from public, anon`, `grant execute … to authenticated`,
`notify pgrst, 'reload schema'`.

## UX (телефон первым)

- Навигация: сайдбар — группа «Инструменты», «Расходы» (`sidebar__nav-extra`); телефон — лист
  «Ещё» (`MobileMoreSheet`). Плитки на главной нет.
- Экран: h1 «Производственные расходы», переключатель месяца «‹ Октябрь 2026 ›», месяц в
  адресе (`?m=2026-10`). Десктоп — `.data-table.data-table--registry`, три колонки образца,
  «Итого» в `<tfoot>`. Телефон — строки-карточки (`06-responsive-registry.css`, `data-label`).
- Итог виден всегда: плашка над нижней навигацией «Итого за октябрь · 142 000 сум» + кнопка
  «+ Расход» (свой класс по образцу `.bulk-bar`; рендерить вне `.data-panel` — её `transform`
  ломает `fixed`).
- Ввод — `DrawerFrame`, три поля (+ «Кто потратил»): наименование (автофокус); сумма
  (`inputMode="numeric"`, только цифры, живая разрядка, суффикс «сум»); дата (`AppDatePicker`,
  сегодня). Каркас — `HallPlanMetaDrawer` (`useGuardedClose`, `useModalLayer`, `UnsavedPrompt`).
- Правка — тап по строке; удаление — `useArmedAction`. Пусто — `EmptyState art roomy`.
- Форматы свои, не `Intl` (для `uz` он отдаёт ISO): `formatSum`/`parseSum` в
  `features/expenses/format.ts`; дата `ДД.ММ.ГГГГ` из строки; валюта `tr('сум', 'so‘m')`.

## Экспорт

`features/expenses/xlsxExport.ts` по образцу `buildSheet` из `lists/xlsxExport.ts`: заголовок
(merge `A1:C1`), шапка, строки по возрастанию даты, «Итого» формулой `SUM` с кэш-значением
из базы. Сумма числом с разрядами: три новых xf в хвост `lib/xlsx/styles.ts` с `numFmtId="3"`
и `applyNumberFormat="1"` (`cellXfs` 21 → 24). `ExportFileKind` + `'expenses'`. Перед сборкой
перечитать период в обход кэша и сверить `sum(rows) === total`; не сошлось — файл не выдаётся.
Печати нет.

## Этапы

1. **Миграция** (таблица, индекс, триггеры, RLS, гранты, RPC; без `drop … if exists` —
   коннектор отклоняет `drop`). Машиной под двумя ролями: А вставил → Б видит 0 строк,
   `update`/`delete` 0, RPC `total = 0`; чужой `created_by` → 42501; `amount = 0`, пустое имя
   → 23514; `anon` — отказ на гранте.
2. **Журнал:** `database.types.ts` (пометка «ПРАВКА РУКАМИ»), `features/expenses/{types,api,
   format}.ts`, `ExpensesPage.tsx`, `expenses.css` (префикс `.expenses-`), границы месяца в
   `lib/date.ts`, маршрут и ссылки в `app/App.tsx`. Кэш `expenses:period:<from>:<to>`, TTL 10 мин.
3. **Ввод/правка/удаление:** `ExpenseDrawer.tsx`; удаление `.delete().eq('id').select('id')`,
   ноль строк = отказ. `formatSum`/`parseSum` — Node-скриптом по таблице случаев (расчёт).
4. **Экспорт:** `xmllint` по XSD (gotchas §15), сверка ячеек с образцом.

Гейт перед `main`: `/rls-verify` под `argo@` и `rls-test@` (включая прямой REST по id чужой
строки и первый кадр из кэша после смены аккаунта). Библия: `01-product`, `03-data-model`
(первая owner-политика), `02-decisions` (почему плоский журнал).

**На вырост:** 5 — статус (`reimbursed_on date null`, отмечает владелец); 6 — чек
(`expense_files` + приватный бакет, политики storage owner-scoped по первому сегменту пути);
7 — руководитель (роль в `users`, guard-триггер, расширение select-политики).

## Риски

- `users` и `employees` никак не связаны; `users` клиент не читает (грантов нет).
- Тестовые строки в проде после REST-прогона — `DELETE` по живым данным, показать до
  исполнения; предпочтительно `begin … rollback`.
- `created_by → auth.users` без `on delete`: аккаунт с расходами не удалить.
- Первый числовой формат в xlsx-пакете; Windows Excel не проверен ни для одного файла.
- Суммы ложатся в `localStorage` (scope по пользователю и очистка на выходе уже есть).
