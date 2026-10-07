# План: сущность «мероприятие», состав сотрудников, наёмные — `planner`, с53

**Статус:** все 11 вопросов закрыты прорабом в с53 (раздел 7); кода ещё нет.

Пометки: **[код]** — проверено чтением кода/миграций, **[база]** — запросом к проду (SELECT, 2026-10-07),
**[предп.]** — предположение, проверить на первом прогоне.

## 0. Что нашлось (меняет постановку)

- **[база] Имя `events` занято.** `public.events` — наследие Vue: 4 строки, грантов нет, на неё ссылаются
  `mount_points`, `reports` и `equipment_lists.event_id` (`on delete cascade`). У всех 6 списков `event_id` и
  `mount_point_id` пусты. Новую таблицу назвать `events` нельзя без сноса или переименования наследия.
- **[база] Реквизиты мероприятия в `equipment_lists` — пять колонок:** `name`, `client_name`, `venue`
  (свободный текст), `reservation_start`, `reservation_end`. `description` — комментарий к документу, остаётся у списка.
- **[код] Период у списка сейчас однодневный.** `ListEditorPage` шлёт `reservationStart = reservationEnd = eventDate`;
  настоящий период есть только у `hall_plans` (`event_from`/`event_to`) и в `EventDocumentMeta`.
- **[база] Одно мероприятие уже раздвоено.** Список «Bionorica Workshop» (12.10, Double Tree by HILTON,
  Bionorica SE) и план залов «Bionorica Workshop» (12–14.10) — две несвязанные строки.
- **[база] 6 списков:** 4 `ТЕСТ*с10*` (у двух `created_by` пуст), «Список 21.08.2026 · 10:34» (только дата),
  «Bionorica Workshop». `equipment_movements.list_id` не ссылается ни на один список (0 строк).
- **[база] `employees`:** 12 строк, три разных значения `position`, колонки отдела нет. Расширения `btree_gist`
  нет (важно для lodging).
- **[код] Образец docx (только структура):** альбомный A4, один абзац-заголовок, одна таблица 8 граф: Т/р,
  Ф.И.Ш, Туғилган вақти, Тўғилган жойи, Паспорт серияси, ЖШШИР рақами, Фотосурати*, Лавозими; 39 строк, 39 фото.
  Наш xlsx (`employees/eventExport.ts`) — 9 граф, лишняя «Яшаш манзили».
- **[код] Состав сегодня:** `EmployeesPage` держит выбор в `useState`, `EmployeeEventExportDrawer` набирает шапку
  руками, в базу ничего не пишется.

## 1. Схема

### 1.1 `public.projects` — мероприятие

Имя `projects`, а не `events`: имя занято наследием, а TS-тип `Event` конфликтует с DOM. В интерфейсе —
«Мероприятие»; слово «проект» в UI уже есть («Проект или мероприятие» в `ListEditorMeta`, xlsx).

| Колонка | Тип и ограничение |
|---|---|
| `id` | uuid pk default `gen_random_uuid()` |
| `name` | text not null, `projects_name_check`: `btrim(name) <> ''`, длина ≤ 200 |
| `client_name` | text null, `projects_client_check`: null либо непустой после `btrim`, ≤ 200 |
| `venue_id` | uuid null → `venues(id)` **on delete restrict** |
| `date_from`, `date_to` | date null; `projects_dates_check` — копия `hall_plans_dates_check` (оба null, либо `from` есть и `to` null или `>= from`); `date_to is null` = один день |
| `description` | text null |
| `created_by` | uuid default `auth.uid()` → `auth.users(id)` |
| `created_at`, `updated_at` | timestamptz not null default `now()` |

- UNIQUE-индекс `projects_identity_key` по `(lower(btrim(name)), coalesce(date_from, '0001-01-01'))` — пара к
  клиентской подсказке «такое мероприятие уже есть» и защита от двойного нажатия. Ежегодный форум проходит (другая дата).
- Индексы: `(venue_id) where venue_id is not null`, `(date_from desc nulls last, id)`.
- Триггеры: новый `normalize_project_fields()` (invoker, `search_path = ''`; `btrim(name)`, `nullif(btrim(...), '')`
  для `client_name`/`description`); `update_projects_updated_at` на существующей `update_updated_at_column()`.

### 1.2 `public.project_staff` — состав

| Колонка | Тип и ограничение |
|---|---|
| `id` | uuid pk |
| `project_id` | uuid not null → `projects` **on delete cascade** |
| `employee_id` | uuid not null → `employees` **on delete cascade** (как `hall_assignments`, `stay_guests`) |
| `created_by` | uuid default `auth.uid()` |
| `created_at` | timestamptz |

- UNIQUE `project_staff_member_key (project_id, employee_id)` — пара к галке в UI.
- Индекс `(employee_id)`.
- Триггер `trg_touch_project` (after insert or delete) → `touch_project()`, копия `touch_hall_plan()` (invoker).
- Должность на мероприятии, порядок, даты участия — не в v1; документ сортируется по ФИО (`byName` в `eventExport.ts`).

### 1.3 `public.venues`

Переезжает сюда из `lodging-s49.md` без изменений: `name`, `city`, `country` text not null, `updated_at`,
UNIQUE-индекс `venues_identity_key` по `lower(btrim())` трёх полей, `normalize_venue_fields()`. Причина: место —
реквизит мероприятия; иначе `venue` мигрировали бы дважды (текст → текст → FK).

### 1.4 Связи на существующих таблицах

- `equipment_lists.project_id uuid null → projects on delete restrict`, индекс `where project_id is not null`.
  Nullable навсегда: список без мероприятия — черновой набор без реквизитов. Мероприятие с привязанными списками
  не удаляется (`23503`).
- `hall_plans.project_id uuid null → projects on delete set null`, частичный индекс. Свои
  `name`/`event_from`/`event_to` у плана остаются в v1.
- Наследные `equipment_lists.event_id`/`mount_point_id` не трогаем (строка в backlog).

### 1.5 Отдел в `employees`

- Колонка **`department text not null default 'staff'`**, ограничение **`employees_department_check`:
  `department in ('staff','hired')`**, индекс `(department)`.
- Тип — текст с CHECK: так сделаны все закрытые списки проекта (`availability`, `kind`, `role`, `list_mode`), enum в
  схеме нет, справочник ради двух значений лишний. Новый отдел — одна миграция, подписи через `tr`.
- **Наёмный отличается ровно одним:** `department = 'hired'`. Та же карточка, тот же бакет и `document_photo_id`,
  те же UNIQUE по ПИНФЛ и паспорту (один фрилансер не заведётся дважды), те же политики.
- Следствие в той же миграции: `home_summary()` (`create or replace`, сигнатура та же) считает
  `employees.count`/`expiries`/`faces` только по `staff`, иначе плитка «Сотрудники» прыгнет с 12 до 39+.
- Пикеры (`fetchEmployeeBriefs` — клетка залов, водители, «Кто потратил») показывают всех, наёмных с меткой.

### 1.6 RPC

Все — `security invoker`, `search_path = ''`, `revoke … from public, anon` + `grant execute … to authenticated`,
`notify pgrst`. Новые имена, чтобы не получить `PGRST203` и чтобы старый бандл в открытой вкладке продолжал работать:

- `create_project_equipment_list(p_project_id uuid, p_project jsonb, p_name text, p_description text,
  p_list_mode text, p_items jsonb) → jsonb {list_id, project_id}`. `p_project_id null` и `p_project` не null →
  создаёт мероприятие; оба null → список без мероприятия; `p_project_id` и `p_project` → правит реквизиты. Одна транзакция.
- `update_project_equipment_list(p_list_id uuid, p_project_id uuid, p_project jsonb, p_name, p_description,
  p_list_mode, p_items) → jsonb`. Блокировка `for update`, как сейчас.
- `fetch_equipment_lists_page(p_search text, p_from date, p_to date, p_limit int, p_offset int) → jsonb
  {rows, total}`, `stable`, образец — `fetch_equipment_models`. Поиск: имя списка, имя мероприятия, заказчик, имя
  площадки; период — по `projects.date_from`. **[предп.]** PostgREST не умеет `or` поперёк родителя и встроенного
  ресурса; подтвердится обратное — можно обойтись embed `project:projects!left(...)`.

Состав RPC не нужен: прямой DML по `project_staff` под RLS и UNIQUE.

## 2. Миграция шести живых списков

**Порядок: чистка → аддитивная схема → бэкфилл → код → (через день) снос доноров.**

1. **Чистка (необратимо).** Снести 4 тестовых списка до бэкфилла, иначе они породят 4 мусорных мероприятия и
   площадки («Зал_1 (c:\путь)», «Офис»).
2. **Бэкфилл** отдельной миграцией данных, идемпотентной (`where project_id is null`):
   - на каждый список с хотя бы одним из `client_name`/`venue`/`reservation_start` — одна строка `projects`:
     `name = list.name`, `client_name`, `date_from = reservation_start`,
     `date_to = nullif(reservation_end, reservation_start)`, `created_by = list.created_by` (явно: в миграции
     `auth.uid()` пуст);
   - `venues`: по строке на каждое непустое различное `venue`, `city`/`country` — «Ташкент»/«Узбекистан»
     (подтверждено прорабом для Double Tree by HILTON);
   - `hall_plans`: привязка только при точном совпадении `lower(btrim(name))` — одна строка (Bionorica); период
     берётся шире, из плана (12–14.10). «Samarkand» и «HILTON Tashkent City» остаются с `project_id null`,
     привяжутся из UI.
   - После чистки: 2 мероприятия, 1 площадка, 2 списка и 1 план привязаны.
3. **Доноры** (`client_name`, `venue`, `reservation_start`, `reservation_end`) остаются до выкатки кода.
   `equipment_lists.name` остаётся навсегда как подпись списка.
4. **Снос доноров** — отдельной миграцией после READY нового кода и не раньше чем через сутки (старые вкладки
   зовут старые RPC). Перед сносом — повторный бэкфилл и две сверки (ниже).

### Необратимое и правки живых данных — показать прорабу до исполнения

MCP-коннектор отклоняет `delete`/`drop` (gotchas §3): пункты А и Г — прорабу вставкой в SQL Editor, версию в
`supabase_migrations.schema_migrations` дописать руками.

**А. Удаление тестовых списков — 4 строки, не возвращается.**

```sql
delete from public.equipment_lists where id in (
 '8e6e8eef-9513-4f93-8524-00cbe46b085a', -- ТЕСТ-с10-B
 '3e1fd2a7-217a-4b88-8dc5-8a990a30b454', -- ТЕСТ-с10-A
 '2bae449e-a5f5-497f-a746-bb04d94ccc19', -- ТЕСТ_с10-D 100% "спец"
 '0f515862-6d42-48d7-b04c-57b0bc6d8468'  -- ТЕСТ-с10-RPC изменён
);
```

Каскадов нет: `equipment_movements.list_id` — 0 ссылок [база].

**Б. Бэкфилл — UPDATE 2 строк `equipment_lists` и 1 строки `hall_plans`** (после А; без А — 6 и 1). Обратимо
(`set project_id = null` + удалить созданные `projects`/`venues`).

```sql
update public.equipment_lists l set project_id = p.id from <сопоставление> p where l.project_id is null …;
update public.hall_plans set project_id = '<id Bionorica>' where id = 'b9a1080b-2b93-4b23-8ca8-4474ca8b1158';
```

`update` двинет `updated_at` списков; триггер состава (`update of equipment_items`) не сработает.

**В. Сверки перед Г (SELECT, обе должны дать 0):**

```sql
select count(*) from public.equipment_lists
 where project_id is null and (client_name is not null or venue is not null or reservation_start is not null);
select count(*) from public.equipment_lists l join public.projects p on p.id = l.project_id
 where l.client_name is distinct from p.client_name or l.reservation_start is distinct from p.date_from;
```

Вторая ловит правку через старую вкладку после бэкфилла.

**Г. Снос доноров и старых RPC — необратимо, задевает все строки `equipment_lists` (2 после чистки).**

```sql
drop function public.create_equipment_list_document(text,text,text,text,text,date,date,jsonb);
drop function public.update_equipment_list_document(uuid,text,text,text,text,text,date,date,jsonb);
drop function public.create_equipment_list_with_items(text,text,text,date,date,jsonb);
alter table public.equipment_lists
  drop column client_name, drop column venue,
  drop column reservation_start, drop column reservation_end; -- уносит equipment_lists_reservation_dates_check
notify pgrst, 'reload schema';
```

## 3. RLS и гранты

Образец — `20260824022708_create_hall_plans.sql`, одинаково на `projects`, `project_staff`, `venues`:

| Операция | Политика |
|---|---|
| select | `private.is_app_member()` |
| insert | `has_any_role(['technician','manager','admin'])` и `created_by = auth.uid()` |
| update | те же три роли, `using` и `with check` |
| delete | те же три роли |

- Гранты: `revoke all … from public, anon, authenticated`; `grant select, insert, update, delete … to authenticated`
  на все три. Изоляции между staff нет по замыслу.
- Удаление мероприятия: состав уходит каскадом, списки блокируют (`23503`), планы залов и заезды отвязываются.
- Отдельной политики на паспорта наёмных нет (решение с52). Следствие: паспорт наёмного читает любой участник
  приложения, как и штатного.
- Триггерные функции: `revoke execute … from public, anon, authenticated`; после DDL — `get_advisors` и выборка
  `routine_privileges`.
- **Ужесточение:** `equipment_lists` пишет любой участник (`is_app_member`), `projects` — только три роли. Участник
  `video_engineer` не сохранит список с реквизитами. В проде оба аккаунта `technician` [база].

**Пары «клиент ↔ база»:**

| Клиентское правило | Пара в базе | Код |
|---|---|---|
| человек в составе один раз | `project_staff_member_key` | 23505 |
| отдел из двух значений | `employees_department_check` | 23514 |
| «такое мероприятие уже есть» | `projects_identity_key` | 23505 |
| окончание не раньше начала | `projects_dates_check` | 23514 |
| имя не пустое | `projects_name_check` + триггер | 23514 |
| площадка не дублируется | `venues_identity_key` | 23505 |
| нельзя удалить мероприятие со списками | FK restrict | 23503 |
| реквизиты документа заполнены для согласования | пары нет и не нужно — документ собирается в браузере, как сейчас в `ListEditorMeta` | — |

Отказы разбирать по имени ограничения, образец — `employeeSaveErrorText`.

**`/rls-verify` обязателен** (новые таблицы, чужие записи): `argo@` + `rls-test@`, плюс не-staff временной строкой
`users` в откатываемой транзакции.

## 4. Сведение с `venues` и расселением

```
venues ◄── projects.venue_id (площадка работы)
   ▲            ▲   ▲   ▲   ▲
   │            │   │   │   └─ hotel_stays.project_id   (null, set null)
   │            │   │   └───── hall_plans.project_id    (null, set null)
   │            │   └───────── project_staff.project_id (cascade) ──► employees (department)
   │            └───────────── equipment_lists.project_id (null, restrict)
   └── hotel_stays.venue_id (отель) → stay_rooms → stay_beds → stay_guests ──► employees
```

**Правки к `lodging-s49.md`:**

1. `venues` создаётся миграцией этого плана; `create_lodging` — четыре таблицы и зависит от неё.
2. «Первая версия без привязки к мероприятию» → заменить: `hotel_stays.project_id uuid null → projects on delete
   set null` + частичный индекс сразу в `create_lodging`. Свои название и даты заезда остаются (приезжают раньше
   начала); отпуск и командировка — `project_id null`.
3. Этап 8: убрать `equipment_lists.venue_id`, `hall_plans.venue_id`, `hotel_stays.work_venue_id`; вычеркнуть
   «Сущность „мероприятие" не заводим: якорь — место плюс даты». Площадка работы = `projects.venue_id`.
4. `venues_board()` переписать через `projects`: на место — мероприятия `{id, name, from, to, lists, staff,
   has_plan}` и заезды, где место — отель. Конец записи = `coalesce(date_to, date_from)`; «запись без дат» =
   мероприятие без дат. Оговорка про две ссылки `hotel_stays → venues` и подсказку именем FK отпадает.
5. `VenueField` — в `src/react/components/` (два потребителя), а не в `lodging/`.
6. «Кто едет»: у заезда с `project_id` пикер показывает состав мероприятия первым. Подсказка, не ограничение:
   местные в отеле не живут.
7. Кэш: переименование места сбрасывает `projects:`, `equipment-lists:`, `stays:`.
8. «Только сотрудники из базы» не меняется: наёмные теперь в базе и расселяются. EXCLUDE-ограничения не затронуты.
9. Залы: слот «Наём» (`is_external`) остаётся; наёмного с именем ставят в клетку обычным человеком. Схема залов
   не меняется.

## 5. Шаги

Владение файлами: **A** — `features/employees/*`; **B** — `features/projects/*` (новый), `app/App.tsx`,
`components/VenueField.tsx`, `features/halls/*`; **C** — `features/lists/*`, `features/home/*`,
`features/equipment/EquipmentDrawer.tsx`. `lib/database.types.ts` правит только ведущий сразу после каждой миграции
(`generate_typescript_types`), до запуска кодеров. Файл миграции называть по версии, которую проштамповал
`apply_migration`.

| № | Что | Кто / параллель | Чекпоинт |
|---|---|---|---|
| 0 | Запрос А прорабу | прораб | `select count(*) from equipment_lists` → 2 |
| 1 | Миграция `employees_department` (+ `home_summary`) | ведущий | `select department, count(*) from employees` → `staff 12`; главная по-прежнему «12»; advisors чисто |
| 2 | Отдел в UI: `types.ts` (`EMPLOYEE_LIST_COLUMNS`, `EMPLOYEE_BRIEF_COLUMNS`), `api.ts` (`EmployeeInput`, `employeeRow`, ветка `employees_department_check` в `employeeSaveErrorText`, ключи `employees:list:v2`/`briefs:v2`), `EmployeeFormPage.tsx`, `EmployeesPage.tsx` (переключатель Все/Штат/Наёмные рядом с фильтром должности), `EmployeeDrawer.tsx` (метка) | **A**, параллельно с 3 | `/employees/new` → отдел «Наёмные» → сохранить → в реестре метка, фильтр «Наёмные» показывает 1; в базе `department = 'hired'`; главная всё ещё «12» |
| 3 | Миграции: `create_venues`, `create_projects` (обе таблицы, FK на `equipment_lists` и `hall_plans`, RLS, триггеры), `backfill_projects` (запрос Б), `project_list_rpc` (три RPC) | ведущий, параллельно с 2 | `projects` 2, `venues` 1, `project_id` не пуст у 2 списков и 1 плана; `anon` — ноль грантов; **прод на старом коде работает** (открыть `/lists`, сохранить правку) |
| 4 | Модуль мероприятий: `features/projects/{types,api,cacheKeys}.ts`, `ProjectsPage.tsx` (реестр, образец `HallPlansPage`), `ProjectMetaDrawer.tsx` (образец `HallPlanMetaDrawer`), `ProjectPage.tsx` (шапка + блоки «Оборудование», «Состав», «Залы»), `components/VenueField.tsx`; маршруты `/projects`, `/projects/:projectId` и пункт «Мероприятия» в группе «Люди и площадка» в `App.tsx` | **B**, после 3 | «Мероприятия» → «Новое» → название, период, площадка «новая» → строка в `projects` и `venues`; повтор тех же названия и даты → «уже есть» (23505); Bionorica показывает 1 список и план залов |
| 5а | Состав на странице мероприятия: добавить через `components/EmployeePicker.tsx`, убрать, счётчик, «Скачать Excel». Полные строки — embed `project_staff → employees(*)` без кэша (паспорта), фото — существующие `loadEventPhotos`/`pickDocumentPhoto`, файл — `downloadEmployeeEventXlsx` с `EventDocumentMeta` из мероприятия | **B**, после 4 | добавить 3 человек → 3 строки `project_staff`; вторая вкладка добавляет того же → отказ без дубля; xlsx открывается, шапка из мероприятия |
| 5б | Вход со стороны людей: в `EmployeesPage` кнопка «Состав на мероприятие»; `EmployeeEventExportDrawer.tsx` заменить на `RosterToEventDrawer.tsx` (выбрать мероприятие или создать; «Сохранить состав», «Сохранить и скачать Excel»); старый файл удалить тем же шагом. Вставка — `upsert` с `onConflict: 'project_id,employee_id'`, `ignoreDuplicates`, **`defaultToNull: false`** (грабля `saveVehicleDrivers`) | **A**, после 2 и 4 | отметить 5 → «Состав на мероприятие» → «Новое» → сохранить → переход на `/projects/:id`, в составе 5; реквизиты не набирались дважды |
| 6 | Списки на мероприятии: `lists/api.ts` (тип `EquipmentList` получает `project`, четыре поля уходят; `fetchEquipmentLists` → новый RPC; create/update → новые RPC; удалить `withLegacySchemaFallback` и legacy-ветки), `ListEditorMeta.tsx` (поле «Мероприятие»: выбрать/создать; период вместо одной даты; `VenueField`), `ListEditorPage.tsx`, `listDocument.ts` (`serializeDocument`), `useListDraftAutosave.ts`, `cacheKeys.ts` (черновик `list-draft:v2:`), `ListsPage.tsx`, `listAppend.ts`, `unitUsage.ts`, `home/HomePage.tsx` + `home/api.ts`, `equipment/EquipmentDrawer.tsx`; `/lists/new?project=ID` | **C**, после 4 (нужны `projects/api` и `VenueField`); параллельно с 5а/5б | открыть Bionorica в редакторе → реквизиты из мероприятия; сменить заказчика → меняется на `/projects/:id`; новый список с новым мероприятием → строки в обеих таблицах; список без мероприятия сохраняется; **строго:** xlsx списка Bionorica побайтно равен собранному с `main` |
| 7 | Привязка плана залов: поле «Мероприятие» в `HallPlanMetaDrawer.tsx`, `halls/api.ts`, `halls/types.ts` | **B**, после 5а | привязать «HILTON Tashkent City» → `hall_plans.project_id` заполнен, план виден на странице мероприятия |
| 8 | Машинные проверки (`scout`) и `/rls-verify` | scout + прораб | список ниже |
| 9 | Сверки В → запрос Г прорабу → ручная запись версии миграции | не раньше суток после READY шага 6 | `/lists` и редактор работают; в `information_schema.columns` четырёх колонок нет |
| 10 | Библия: `03-data-model` (§1.2, новый раздел), `02-decisions`, правки `lodging-s49.md` по разделу 4, backlog | editor | — |

**Порядок выкатки (gotchas §3, `03-data-model` §10 п. 8):** миграции 1 и 3 — до кода; снос 9 — после кода. Гейты
каждого шага кода: `npx tsc -b`, `npm run build`.

**Машинные проверки шага 8 (строго — данные и права):** `anon` — 0 грантов на три таблицы; подмена `created_by` →
42501; не-staff: insert/update/delete `projects` и `project_staff` → отказ; вторым аккаунтом читается чужое
мероприятие и состав (общий доступ staff по замыслу); дубль в составе → 23505; удаление мероприятия со списком →
23503, без списка → состав каскадом, план залов отвязан; два параллельных создания одного мероприятия → успех
один; `routine_privileges` — у `anon` нет новых функций.

## 6. Риски и развилки

**Развилки (рекомендация + почему):**

1. **Имя таблицы — `projects`**, а не переименование наследной `events`. Почему: без необратимых движений по
   наследию и без конфликта с DOM-типом `Event`. Цена — слово в коде расходится со словом в UI.
2. **`equipment_lists.project_id` nullable навсегда.** Почему: при NOT NULL каждый быстрый безымянный список
   («Список 21.08 · 10:34») рождал бы мусорное мероприятие.
3. **Один ко многим: у мероприятия несколько списков, `name` остаётся у списка.** Почему: FK на стороне списка
   стоит столько же, а списки «свет»/«звук» одного мероприятия реальны. Альтернатива — UNIQUE на `project_id` и
   снос `name`.
4. **`venues` заводим сейчас, FK вместо текста.** Почему: одна миграция поля вместо двух; мир получает источник
   данных раньше.
5. **Отдел — текст с CHECK.** Почему: канон проекта, два значения.
6. **Новые RPC под новыми именами, старые живут до шага 9.** Почему: смена сигнатуры даёт `PGRST203`, а открытые
   вкладки со старым бандлом продолжают сохранять.
7. **Реестр списков — RPC, а не embed.** Почему: поиск идёт по полям двух таблиц (см. [предп.] в 1.6).
8. **Разовая выгрузка без сохранения состава убирается.** Почему: два пути к одному документу разъедутся;
   «Сохранить и скачать» закрывает сценарий одним нажатием.
9. **Реквизиты плана залов в v1 не переносим, только ссылка.** Почему: принятый редактор залов трогать ради
   дубля названия дороже пользы; строка в backlog.
10. **Машины на мероприятие (`project_vehicles`) — не в этом плане.** Почему: цель сессии — люди;
    `VehicleEventExportDrawer` остаётся разовым.

**Риски:**

- **Окно между бэкфиллом и сносом:** старая вкладка пишет доноры мимо `projects`. Лечится повторным бэкфиллом и
  сверками В.
- **Черновик редактора** (`list-draft:*`, TTL сутки) меняет форму → ключ `v2`; несохранённый черновик на момент
  выкатки пропадёт.
- **Кэш:** запись мероприятия обязана сбрасывать `projects:` и `equipment-lists:` (карточки списков показывают его
  реквизиты); префиксы — в листовых `cacheKeys.ts`, иначе цикл `projects ↔ lists`. Состав с паспортами не
  кэшируется; на диск — только реестр мероприятий без персональных данных.
- **Общие реквизиты:** правка в редакторе списка меняет мероприятие для состава и залов; при двух вкладках
  побеждает последняя запись. Подпись в UI обязательна.
- **Лимит 1000 строк:** реестр мероприятий — страницами `.range()` с ключом `(date_from, id)`; состав читать
  embed-ом (не `.in()` с сотней uuid в адресе); `fetchEmployeePhotos` уже с `limit(1000)` — на 39+ людях запас есть.
- **Шаг 6 — самый рискованный:** 11 файлов, редактор не принят глазами после распила с35, тестов и линтера нет.
  Опора — побайтная сверка xlsx и чеклист прорабу.
- **`backfill_projects` — данные в файле миграции:** на чистой базе пустая, должна быть идемпотентной.
- **Не-staff участник** после шага 6 не сохранит список с реквизитами (см. раздел 3).
- **Бандл:** новый ленивый чанк `projects`, библиотек не добавляется; docx-генератора нет.
- **Наёмные в мире и на главной:** `home_summary` отфильтрован; мир не проверял —
  `features/world/data/useWorldData.ts` сверить в шаге 2 [предп.].
- **Колонки xlsx расходятся с образцом** (9 против 8) — решение 8 в разделе 7.

## 7. Решения прораба (с53)

1. У одного мероприятия может быть несколько списков оборудования.
2. Список без мероприятия допустим как черновой набор без даты и площадки.
3. Четыре списка `ТЕСТ*с10*` удаляются до переноса (запрос А). «Список 21.08.2026 · 10:34» остаётся и
   переезжает мероприятием с одной датой.
4. Список и план залов «Bionorica Workshop» — одно мероприятие, период 12–14 октября.
5. Double Tree by HILTON — Ташкент, Узбекистан.
6. Отделов два: «Штат» и «Наёмные».
7. 27 наёмных из образца заводятся скриптом из docx (как импорт с17): скрипт читает файл на машине прораба,
   персональные данные в git не попадают, список «кого заведёт» показывается прорабу до записи. **Шаг плана —
   после шага 2** (нужна колонка `department` и форма); в таблицу шагов раздела 5 не внесён — добавить при брифе.
8. Графа «Место жительства» в выгрузке состава — **выбор при выгрузке**: галка «с адресом» в окне выгрузки, по
   умолчанию выключена (8 граф, как в образце). Задевает `eventExport.ts` и окно выгрузки в шагах 5а/5б.
9. Разовая выгрузка без сохранения состава убирается; её заменяет «Сохранить и скачать Excel».
10. Удалять мероприятие может любой техник, пока к нему не привязаны списки (как планы залов).
11. Наёмные не входят в число «Сотрудники» на главной и в меню.
