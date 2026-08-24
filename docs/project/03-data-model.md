# 03-data-model — ARGO Warehouse

Что лежит в базе, кто имеет к этому доступ и как это менять.

**Сверено с живой базой 2026-08-22 (сессия 12).** Всё ниже — выписка из прода через
Supabase MCP, а не реконструкция по типам. Схема живёт вне git: источник правды — база,
мост между ней и файлами — миграции в `supabase/migrations/`.

**Как пересверить**, если правку схемы сделали мимо миграции:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public' order by 1,2;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1,2;

select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated') order by 1,2;
```

**Габариты схемы на 2026-08-23 (с19):** 12 таблиц, 42 политики `public` + 4 на
`storage.objects`, 14 триггеров, 20 функций (`public` + `private`), 46 индексов,
2 Storage-бакета. Baseline (`00000000000000_baseline_remote_schema.sql`) снят в с2
и описывает **стартовую точку**, а не сегодняшнее состояние: поверх него легла
21 миграция. Переснимать его нужно только после большой ручной правки в дашборде.

## 1. Таблицы

| Таблица | Доступ клиента | Роль в продукте |
|---|---|---|
| `public.equipment` | прямой `.from()`, полный CRUD | склад: одна строка = одна позиция учёта |
| `public.equipment_lists` | прямой `.from()`, полный CRUD | документы; состав хранится прямо в строке |
| `public.equipment_movements` | прямой `.from()`, **только чтение** | журнал движений, пишется триггером |
| `public.users` | **нет ни одного гранта** — читают только `security definer`-функции | членство и роли |
| `public.employees` | `.from()`: select/insert/update, **DELETE не дан никому** | база сотрудников (с17): карточка с паспортными данными; `document_photo_id` (с19) — фото для документов |
| `public.employee_files` | `.from()`: select/insert, **ни UPDATE, ни DELETE** | файлы сотрудника: пять видов, фото несколько; сам файл — в бакете `employee-files` |
| `public.events`, `public.mount_points`, `public.reports` | **нет ни одного гранта** | наследие Vue-версии, продукт их не трогает |

У роли `anon` нет прав ни на одну таблицу `public`.

**Снесено в с10 вместе с жизненным циклом:** `equipment_reservation_items` (вторая,
нормализованная копия состава) и `reservation_status_history`. Состав списка теперь
хранится **одной копией** — в `equipment_ids` и `equipment_items` самой строки списка.

> **Политики `users_*`, `events_*`, `mount_points_*`, `reports_*` в проде существуют, но
> недостижимы.** RLS фильтрует строки только после того, как роль получила право на
> таблицу; нет гранта — запрос падает на правах, до политики дело не доходит.
> `supabase.from('users').select(...)` получит отказ, а не пустой список.

### 1.1 `public.equipment` — 14 колонок

`id` uuid pk · `model`, `brand`, `serialnumber`, `type`, `subtype`, `location` — все
**not null** · `technicalspecification`, `description` — nullable · `lengthinmeters` text
default `'N/A'` · `count` integer default 1 · `availability` text default `'available'` ·
`created_at`, `updated_at` timestamptz.

Ограничения: `availability in ('available','unavailable','diagnostics','issued')`;
`count >= 0`.

**Внешних ключей у таблицы нет ни одного. `UNIQUE` на `serialnumber` НЕТ** — есть только
обычный btree `idx_equipment_serialnumber`. Уникальность держится единственной клиентской
проверкой: это не гонка, а отсутствие ограничения (`02-decisions` §5).

`serialnumber` объявлен not null, но наружу отдаётся `string | null`: для количественного
учёта в колонке лежит служебный идентификатор `QTY::…`, который нормализация прячет (§7).
Это осознанное сужение на границе, а не рассинхрон со схемой.

### 1.2 `public.equipment_lists` — 18 колонок

`id` · `name` varchar **not null** · `description` · `type` varchar **not null**
(заполняется литералом `'custom'`, в логике не участвует) · `event_id` →
`events on delete cascade` · `mount_point_id` → `mount_points on delete set null` ·
`equipment_ids` uuid[] not null default `'{}'` · `metadata` jsonb · `created_at`,
`updated_at` · `created_by` uuid → **`auth.users(id)` без `on delete`** ·
`is_archived` · `equipment_items` jsonb default `'[]'` · `list_mode` varchar default
`'specific'` · `reservation_start`, `reservation_end` date · `client_name`, `venue` text.

Ограничения: `list_mode in ('specific','abstract')`; `reservation_dates_check` — обе
даты пусты либо `start <= end`.

> **`reservation_start` / `reservation_end` — это ДАТА МЕРОПРИЯТИЯ, не бронь.** Имя
> осталось от удалённой подсистемы. На этих колонках стоят карточка реестра и фильтр
> периода. Не чистить «за компанию».

`created_by` без `on delete` означает `no action`: удалить автора списка из `auth.users`
нельзя, пока список существует.

### 1.3 `public.equipment_movements`

`equipment_id` → `equipment` **on delete cascade**; `list_id` → `equipment_lists`
**on delete set null**; `movement_type` — check из семи значений (`created`,
`quantity_changed`, `status_changed`, `quantity_and_status_changed`, `status_normalized`,
`issued`, `returned`); `changed_by` → `auth.users on delete set null`.

**`on delete cascade` по `equipment_id` значит: удаление единицы стирает весь её журнал.**
Журнал заявлен неизменяемым, но не переживает удаление предмета.

Значения `issued`/`returned` в check остались от снесённого цикла — новых строк с ними
больше не появляется. Все 1391 существующие строки — `status_normalized`, след импорта.

## 2. RLS и гранты

RLS включён на всех девяти таблицах. Все политики адресованы роли `authenticated`.
Сотрудники (`employees`, `employee_files`) и политики бакета — §12.

| Таблица | select | insert | update | delete |
|---|---|---|---|---|
| `users` | `is_app_member()` | admin | admin | admin |
| `equipment` | `is_app_member()` | technician/manager/admin | technician/manager/admin | admin |
| `equipment_lists` | `is_app_member()` | член **и** `created_by = auth.uid()` | **только** `is_app_member()` | `is_app_member()` **и** `auth.jwt()->>'email' = 'argo@argomedia.uz'` |
| `equipment_movements` | `is_app_member()` | — | — | — |
| `events` | все 4: назначенный инженер **или** manager/admin | | | |
| `mount_points`, `reports` | все 4: `exists (select 1 from events where id = event_id)` | | | |

**Гранты (фактические):** `equipment` и `equipment_lists` — полный CRUD у
`authenticated`; `equipment_movements` — **только select**; `users`, `events`,
`mount_points`, `reports` — **ни одного гранта**; `anon` — ничего нигде.

Три замечания, каждое с последствием:

1. **`equipment_lists_update_for_members` не ограничивает ни владельца, ни статус.** Любой
   член приложения может переписать чужой список. Единственное, что защищено на уровне
   записи, — `created_by` (триггер, §4).
2. **`equipment_movements` имеет политику только на select**, а RLS без политики означает
   запрет. Вставку делает триггерная функция `private.log_equipment_change()`, объявленная
   `security definer`. **Механизм тут не в самом `security definer`:** он подменяет
   пользователя, но RLS не отключает. Политики обходятся потому, что владелец функции
   оказывается владельцем таблицы, а владелец таблицы от RLS освобождён — пока не
   выставлено `force row level security`.

   > **Проверено 2026-08-22: конструкция цела.** Все 7 таблиц и все 4 функции `private.*`
   > принадлежат роли `postgres`, `relforcerowsecurity = false` у всех семи.
   > **Что её ломает:** включить `force row level security` на `equipment_movements` —
   > и триггерная вставка начнёт падать на RLS, а журнал молча перестанет писаться. То же
   > произойдёт при смене владельца таблицы без смены владельца функции.

3. **Политики `mount_points` и `reports` проверяют лишь существование события, а не право
   на него.** Само по себе это дыра, но нейтрализована отсутствием грантов.

**EXECUTE на RPC** выдан `authenticated` для девяти публичных функций; у `anon` нет ни
одной. Это состояние приходится **удерживать руками**: default privileges Supabase отдают
`EXECUTE` каждой новой функции напрямую `anon`, и `revoke … from public` этого не снимает.
Каждая миграция, заводящая функцию, содержит отдельный `revoke execute … from anon`.

Схема `private` открыта (`usage`) для `authenticated`, но **не выставлена в Data API** —
её функции через PostgREST недоступны.

**Realtime:** ни одна рабочая таблица не входит в публикацию `supabase_realtime`.

## 3. Схема `private` — связка, которую нельзя читать по частям

| Функция | Свойства |
|---|---|
| `private.is_app_member()` → boolean | `sql stable` **`security definer`** `search_path = ''`; `exists (select 1 from public.users u where u.id = auth.uid())` |
| `private.has_any_role(text[])` → boolean | те же свойства; `u.role::text = any(allowed_roles)`. `role` — `varchar(32)` с check на `video_engineer`, `technician`, `manager`, `admin` |
| `private.log_equipment_change()` | триггерная, `security definer` |
| `private.guard_equipment_list_update()` | триггерная, `security definer` |

**Факт А.** `revoke all on table public.users from authenticated`. Клиент физически не
может прочитать свою роль — в `src/react` нет ни одного обращения к `users`.

**Факт Б.** `is_app_member()` и `has_any_role()` объявлены `security definer` и читают
`public.users` правами владельца. Именно поэтому отзыв грантов из факта А **не ломает
авторизацию**.

> **Вывод, обязательный к прочтению целиком.** Агент, который «починит» revoke, выдав
> `authenticated` право читать `users`, откроет всем таблицу пользователей с ролями.
> Агент, который вместо этого заменит `security definer` на `security invoker` в
> `is_app_member()`, **уронит вход целиком**: функция начнёт возвращать false для всех,
> и ни одна политика не пропустит ни одной строки. Оба факта менять нельзя ни по
> отдельности, ни вместе — без замены модели доставки роли на клиент (кастомный claim
> в JWT либо отдельная RPC `current_user_role() security definer`).

Тонкость: на `public.users` RLS включён, и политика чтения сама вызывает
`is_app_member()`, то есть на `users` замкнута. Не падать в рекурсию функция может
только за счёт того, что её владелец — владелец таблицы, освобождённый от RLS. Это и
проверено в §2, замечание 2.

**Побочное следствие, которое стоит признать честно.** Раз клиент не знает роли, он не
может ни спрятать, ни объяснить недоступное действие: пользователь без роли
`technician/manager/admin` получит сырую ошибку RLS на сохранении. Это дефект UX,
не безопасности.

## 4. Триггеры

| Триггер | Таблица | Когда | Функция |
|---|---|---|---|
| `trg_equipment_movement_history` | `equipment` | after insert or update of `count`, `availability` | `private.log_equipment_change()` |
| `update_equipment_updated_at` | `equipment` | before update | `public.update_updated_at_column()` |
| `trg_guard_equipment_list_update` | `equipment_lists` | before update | `private.guard_equipment_list_update()` |
| `trigger_update_equipment_lists_updated_at` | `equipment_lists` | before update | `public.update_equipment_lists_updated_at()` |
| `trg_mount_points_count` + `mount_point_insert` / `_update` / `_delete` | `mount_points` | — | `update_mount_points_count()` — **четыре триггера на одну функцию** |
| `trg_validate_technical_duties_status` | `mount_points` | before insert or update | проверяет jsonb-колонку `technical_duties` |

**`guard_equipment_list_update()` после с10 делает ровно одно:** запрещает менять
`created_by`. Прежний страж жизненного цикла (заморозка состава у не-черновика, GUC
`argo.transition_allowed`) снесён вместе с подсистемой.

**Четыре триггера пересчёта на `mount_points` вместо одного.** Порчи данных нет — функция
не инкрементирует счётчик, а пересчитывает его заново, поэтому двойной прогон даёт тот же
результат. Цена — лишняя работа. Таблица наследная, долг записан без срочности.

**Пробел журнала движений:** триггер слушает только `update of count, availability`. Смена
`brand/model/type/subtype/location` через `update_equipment_model_and_unit` в
`equipment_movements` **не попадает** — переименование модели не оставляет следа.

Все функции репозитория объявлены с `set search_path = ''`. Единственное историческое
исключение — оригинальная `update_mount_points_count()` из `scripts/2025-08-06…`, она
перекрыта поздним файлом.

## 5. RPC

**Все публичные RPC — `security invoker`**, не `definer`. Права проверяются внутри тела
вызовом `private.*` (которые как раз `definer`), плюс RLS на нижележащих таблицах.

| RPC | Вызывается клиентом |
|---|---|
| `create_equipment_list_with_items(text,text,text,date,date,jsonb)` → uuid | нет — только через обёртку ниже |
| `create_equipment_list_document(…8 аргументов)` → uuid | да |
| `update_equipment_list_document(uuid, …8)` → uuid | да |
| `update_equipment_model_and_unit(uuid, 9×text, integer, timestamptz)` → jsonb | да |
| `count_equipment_model_units(text, text)` → integer | да |
| `append_equipment_to_list(uuid, uuid, text)` → jsonb | да |
| `create_equipment_batch(9×text, text[])` → jsonb | да |
| `fetch_equipment_models(4×text, 2×integer)` → jsonb | да |
| `add_equipment_unit(uuid, text, integer)` → jsonb | да |

Три RPC с15 — три разных ответа на «клиенту не верим», их различие из кода не
выводится. `append_equipment_to_list` — ЕДИНСТВЕННЫЙ путь записи состава, где
brand/model берутся из `equipment`, а не из клиентского JSON (точечный append под
`for update`; документ-RPC выше дыру §5.1-2 сохраняют). `create_equipment_batch` —
ЕДИНСТВЕННЫЙ путь заведения, где дубль серийника проверяет база под
`pg_advisory_xact_lock` (одиночный insert по-прежнему держит клиентский ilike).
Дубль у неё — не исключение, а ответ `{status:'duplicates'}`: список занятых
номеров переводит на язык клиент. `fetch_equipment_models` повторяет построчную
семантику поиска старого каталога намеренно — чтобы серийник находил модель.

`add_equipment_unit` (с16) — «+1 единица к модели» из дровера модели: клиент
передаёт только id единицы-образца, опциональный серийник и количество; общие
поля модели сервер копирует из образца САМ — второй путь записи после append,
куда дыра «brand/model из клиентского JSON» не распространяется. С номером —
серийная строка под тем же advisory-локом, что у партии (единственный путь
ОДИНОЧНОГО заведения с серверной проверкой дубля); без номера — `count + N` на
старейшей количественной строке модели или новая `QTY::AUTO::`-строка, гонку
двух вкладок закрывает лок по нормализованной паре бренд/модель (неймспейс
`equipment-model:` не пересекается с локами серийников). Новая единица всегда
`available` — статус образца не переносится.

### 5.1 Что проверяет создание списка и что нет

**Проверяется:** членство; непустое имя после `btrim`; `list_mode` из двух значений; даты
либо обе NULL, либо `start <= end`; `p_items` — непустой массив; у каждой
`serialized`/`quantity`-позиции `equipment_id` валиден **и такая строка есть** в
`equipment`.

**НЕ проверяется:**

1. **`requested_count` против фактического наличия.** Ни при создании, ни при правке.
   В базе может лежать список на 9999 единиц оборудования, которого на складе три.
   После с10 физического гейта не осталось вообще — выдачи в продукте нет.
2. **Соответствие `brand/model/type/subtype` реальной строке `equipment`.** Текст берётся
   из клиентского JSON дословно, даже когда `equipment_id` присутствует и проверен (§6).
3. **Пустые `brand/model` проходят.** Различать надо два случая: ключа в JSON нет →
   `btrim(NULL)` = NULL → нарушение not null, сырой текст ошибки; **ключ есть, но значение
   пустое** → `btrim('')` = `''`, not null удовлетворён, и в таблицу ложится пустая строка.
   Ни CHECK, ни `nullif` этот случай нигде не ловят.
4. Даты в прошлом, длина имени, разумность `count` — не ограничены ничем.

**Правка (`update_equipment_list_document`)** повторяет тот же набор проверок, добавляет
блокировку строки `for update` и переписывает её целиком — это replace, а не merge.
Функция не проверяет, что правят **свой** список; в паре с `equipment_lists_update_for_members`
это значит: любой член приложения может переписать чужой.

### 5.2 `update_equipment_model_and_unit`

Требует роль `technician/manager/admin`. «Модельные» поля (brand, model, type, subtype,
technicalspecification, lengthinmeters, description) обновляются **у всех строк с тем же
`lower(btrim(brand))` / `lower(btrim(model))`**, поштучные (`availability`, `location`,
`count`) — только по `id`. Возвращает `updated_model_units` — сколько строк задело.

Три поведения, которые надо держать вместе:

1. **Версия карточки сверяется.** Клиент шлёт `p_expected_updated_at`; расхождение
   отменяет правку целиком, ни одно поле не записано, код **`PT409`**.
   `null` значит «сверить нечем».
   **Код ошибки здесь — не косметика (с14).** Сначала стоял `40001`
   (`serialization_failure`), а это для PostgREST означает «повтори транзакцию»:
   он и повторял, а условие детерминированное — ответ клиенту не уходил НИКОГДА.
   Вкладка висела с погасшей кнопкой, база писала по сотне тысяч исключений на
   нажатие. `PTxyz` PostgREST переводит прямо в HTTP-статус, `PT409` = 409 Conflict,
   ретраев нет. Любой будущий «конфликт, который клиент должен показать» берёт
   код из класса `PT`, а не из класса 40.
2. **`p_count` необязателен.** `count = coalesce(p_count, e.count)`, и проверка
   «неотрицательное» выполняется только когда значение реально пришло. Серийная карточка
   параметр не отправляет — иначе триггер писал бы фантомные «Изменено количество».
3. **Пустая локация не затирает прежнюю:** `coalesce(nullif(btrim(p_location), ''), e.location)`.

## 6. Денормализация состава — остаточный риск

`equipment_items` (jsonb) хранит `brand`, `model`, `type`, `subtype` **снимком на момент
сохранения**, рядом с `equipment_id`. Совпадение текста с реальной строкой `equipment`
не проверяется нигде.

После с10 острота упала: расчёт дефицита, который джойнил склад по этому тексту, снесён
вместе с подсистемой. Осталось одно последствие, и оно видимое: **сборщик состава
сохранённого списка** склеивает jsonb-снимок с живыми строками склада. Подпись берётся по
`equipment_id` как более авторитетному, снимок — фолбэк для позиций без id; иначе после
переименования модели одна позиция показывалась бы двумя строками (`02-decisions` §5).

**Чем закрывать по-настоящему:** ссылаться на `equipment_id`, а текст держать только как
снимок для печати. Не сделано.

## 7. `tracking_mode` и `inventory_code` — это НЕ колонки

Оба объявлены в `features/equipment/types.ts`, но колонок с такими именами в базе нет.
Обе величины — результат **разбора строки `serialnumber`** на лету. Это единственное
место, где доменный тип добавляет к схеме то, чего в ней нет.

Строка считается `quantity`, если `count > 1`, **или** начинается с `AUTO-`, **или**
начинается с `QTY::`, **или** попадает в набор плейсхолдеров (`''`, `n/a`, `na`, `нет`,
`без номера`, `б/н`, `none`, `null`, `-`), **или** состоит из одних нулей. Иначе —
`serialized`. `inventory_code` вытягивается из префиксов `QTY::CODE::` / `QTY::AUTO::`.

Второй, независимый парсер той же строки жил в SQL-бэкфилле для
`equipment_reservation_items`. **Таблица снесена в с10, и вместе с ней ушёл сам предмет
расхождения** — но скрипт остался в `scripts/`, и его повторный прогон вернул бы вторую
трактовку. Правило простое: парсер один, он в TypeScript.

**Чем закрывается:** настоящая колонка `tracking_mode` в `equipment` с бэкфиллом и CHECK.

## 8. Статусы оборудования: нормализация прошла

В проде на 1481 строку встречаются ровно три значения `availability`, все английские:
`available` — 1475, `unavailable` — 5, `diagnostics` — 1, `issued` — 0.

**Русских статусов не осталось ни одного.** Поэтому клиентская эвристика `isAvailable`
(`catalogGroups.ts`), которая до сих пор понимает `«в н»`, `«не »`, `«диагност»`, —
мёртвый код, и она **маскирует опечатку в английском значении**: незнакомая строка молча
считается недоступной. Записано в backlog.

## 9. Индексы

На `equipment` — девять: `equipment_pkey`, по `availability`, `brand`, `location`,
`model`, `serialnumber` (**btree, НЕ unique**), `subtype`, `type`, плюс
`equipment_model_normalized_idx` по `(lower(btrim(brand)), lower(btrim(model)))` —
он покрывает предикат, по которому работают `count_equipment_model_units` и
`update_equipment_model_and_unit`.

Отдельно `idx_equipment_search` — **GIN** по
`to_tsvector('russian', model || brand || serialnumber || coalesce(description,''))`.
**Продукт его не использует:** поиск идёт через `ilike`-фильтры, а не через `@@`. Индекс
не работает ни на один запрос и только удорожает запись — либо переводить поиск на него,
либо убирать. В backlog.

На `equipment_lists` — семь (pk, `created_at`, `event_id`, `is_archived`, `list_mode`,
`type`, `mount_point_id where not null`, `created_by`). На `equipment_movements` — четыре
(pk, `(equipment_id, changed_at desc)`, `list_id where not null`, `changed_by where not null`).

## 10. Правила изменения схемы

1. **Только миграцией в `supabase/migrations/`**, имя `YYYYMMDDHHMMSS_описание.sql`.
   **Никаких новых файлов в `scripts/`** — этот каталог объявлен архивом: он не
   воспроизводит текущее состояние и содержит как минимум один нерепрогоняемый файл.
2. **Идемпотентность обязательна:** `if not exists`, `create or replace`,
   `drop policy if exists` перед `create policy`.
   **Оговорка:** `create or replace` не годится, когда меняется сигнатура функции — выйдут
   два overload'а одного имени, и PostgREST ответит `PGRST203`. Тогда впереди ставится
   `drop function if exists` с полным списком типов, **а гранты выдаются заново** — `drop`
   уносит их с собой.
3. **Применённое руками — фиксировать миграцией в ту же сессию.** Иначе следующий агент
   изменения не увидит.
4. **Новая функция — `set search_path = ''`**, ссылки на объекты с полной схемой
   (`public.equipment`, а не `equipment`), права явно:
   `revoke all … from public, anon` + `grant execute … to authenticated`.
   `revoke … from public` **не** снимает прямой грант `anon` — нужна отдельная строка.
5. **`security definer` — только в схеме `private`** и только для того, что клиент не
   должен уметь подделать. Публичные RPC — `invoker`. Не трогать `is_app_member()` /
   `has_any_role()` без прочтения §3.
6. **После добавления или изменения RPC** — `notify pgrst, 'reload schema'` в конце
   миграции, иначе PostgREST вернёт `PGRST202`.
7. **`CASCADE` на политике RLS — не выход.** Таблица без INSERT-политики под RLS запрещает
   вставку ВСЕМ; зависимую политику пересоздают явно (грабля с10).
8. **Код в прод раньше схемы.** Удаляешь колонку или таблицу — сначала выкати код, который
   её не просит, дождись READY, и только потом миграцию. Обратный порядок роняет живой
   прод (грабля с10).

## 11. Известные расхождения схемы с ожиданиями

- **`public.users.id` не связан с `auth.users`.** Колонка `uuid not null default
  gen_random_uuid()` без внешнего ключа — при том что вся авторизация построена на
  совпадении этих идентификаторов (`is_app_member()` сверяет `u.id = auth.uid()`).
  Совпадение держится соглашением, а не базой: профиль с «неправильным» `id` вставится
  молча, а его владелец просто никогда не пройдёт проверку членства. Соседние таблицы
  ссылаются на `auth.users(id)` напрямую — в схеме сосуществуют две разные привязки.
- **Право удаления списка привязано к почте, а не к роли.** Смена почты у владельца
  аккаунта молча отберёт возможность удалять, и в интерфейсе это будет выглядеть как
  поломка приложения.
- **Дубль внешнего ключа на `mount_points`** и четыре триггера пересчёта — §4.
- **Неиспользуемый GIN-индекс** — §9.
- **Нет `UNIQUE` на `equipment.serialnumber`** — §1.1.

## 12. Сотрудники и первый Storage-бакет (с17)

Схема — миграции `20260823130000_create_employees.sql` и
`20260823140000_employee_files_bucket.sql`; здесь — только решения, которые из
них не выводятся.

- **Уникальность сотрудника — по документам, не по имени.** UNIQUE держат
  `pinfl` и пара `(passport_series, passport_number)`; **тёзки с одной датой
  рождения легальны осознанно** (однофамильцы существуют) — предупреждение о
  совпадении ФИО живёт только в форме и ничего не охраняет. Это НЕ дыра
  «клиенту не верим»: охраняемые инварианты в базе.
- **DELETE не дан никому намеренно** — ни сотрудникам, ни их файлам, ни
  объектам бакета (у `employee_files` и бакета нет даже политик UPDATE/DELETE).
  Паспортные данные: удаление — отдельное будущее решение с ролями. Убрать
  объект из бакета мостом НЕЛЬЗЯ: `storage.protect_delete()` запрещает прямой
  SQL-delete — только Storage API (при нужде: временная DELETE-политика на
  точный путь, удаление curl-ом, политику снести тем же ходом).
- **Бакет `employee-files` приватный**; наружу файл уходит только по signed URL
  (TTL час). Живая подписанная ссылка работает у ЛЮБОГО держателя до истечения —
  принято для внутренней системы (с17). Ссылки не кладут в `persistentCache`.
- **Загрузка — две ступени** (объект в бакет → строка в `employee_files`);
  упавшая вторая ступень оставляет сироту в бакете — известный долг backlog.
- **Данные заполняются постепенно:** NOT NULL только `last_name`/`first_name`;
  NULL в уникальных колонках не конфликтует — полупустые карточки заводятся
  свободно. Нормализацию ввода (upper серии, только цифры в номере и ПИНФЛ,
  btrim, '' → NULL) делает BEFORE-триггер `normalize_employee_fields` — клиент
  может присылать грязное.
- **Фото для документов — `employees.document_photo_id` (с19).** Фото у
  сотрудника несколько, удалить нельзя (см. выше), «заменить» = загрузить новое,
  а в документ и миниатюру идёт одно. Выбор хранит база, не клиент: составной
  FK `(id, document_photo_id) → employee_files(employee_id, id)` (для него
  добавлен UNIQUE `(employee_id, id)`) отбивает чужое фото кодом 23503 без
  триггера и без чтения `employee_files` под RLS; `security definer`-триггер
  `check_employee_document_photo` отбивает не-фото (скан паспорта) кодом 23514
  с именем `employees_document_photo_kind_check`. NULL — легален: клиент берёт
  последнее загруженное (`pickDocumentPhoto` в `features/employees/api.ts` —
  единственное место правила, им же живут миниатюры списка). Новых грантов нет:
  запись идёт существующей `employees_update_for_staff`.
- **Экспорт «на мероприятие» в базу не пишет** (с19): документ собирается в
  браузере из `employees`/`vehicles` и байтов бакета (`storage.download()` под
  той же SELECT-политикой, что signed URL). Новых таблиц, политик и RPC у
  экспорта нет — ни мероприятия, ни истории выгрузок.
- **Импортные 12 строк (с17)** пришли из файлов прораба (`features/empoyees/`):
  xlsx (паспорт, адрес, должность) + docx (ПИНФЛ, фото), мерж по ФИО; даты
  рождения сверены с ПИНФЛ (цифры 2–7 кодируют ДДММГГ, первая — век и пол —
  этим же приёмом можно валидировать будущий ручной ввод).

## 13. Автомобили и второй бакет (с18)

Схема — миграции `20260823150000_create_vehicles.sql` и
`20260823160000_vehicle_files_bucket.sql`; здесь — решения, которые из них
не выводятся.

- **Госномер — главный идентификатор** (база существует ради пропусков на
  локации). Хранится «как на жестянке» («01 439 SNA») — экспортным спискам
  нужен читаемый вид; канон делает BEFORE-триггер `normalize_vehicle_fields`
  (btrim → схлопнуть пробелы → upper → транслитерация кириллических двойников
  `АВЕКМНОРСТУХ` → латиница: русская раскладка дала бы невидимый дубль
  «С» ≠ «C»). Уникальность — **функциональный** индекс
  `vehicles_plate_number_key` по `replace(plate_number, ' ', '')`: «01439sna»
  и «01 439 SNA» — одна машина. Клиент шлёт номер как ввели, пре-чеков нет.
- **Водители — M2M `vehicle_drivers`**, а не массив uuid в `vehicles`: FK на
  элементы массива Postgres не умеет, целостность жила бы только в клиенте.
  **Staff имеет DELETE на связке** — единственный DELETE-грант рядовой роли во
  всей схеме, осознанный отход от канона с17: это связка, не данные; без него
  водителя нельзя снять с машины. Сами `vehicles`/`vehicle_files` — удаление
  admin-only политикой БЕЗ гранта, как у сотрудников.
- **Директор компании в машинах НЕ хранится**, а для экспортного списка
  (колонка «Раҳбари Ф.И.Ш, телефон рақами») берётся **константой
  `companyDirector`** в `lib/xlsx/documentDefaults.ts` — рядом с адресом и
  р/с фирмы. Это отмена решения с18 «экспорт достанет директора из `employees`
  по должности» (с19, принято прорабом): реквизит фирмы не должен зависеть от
  свободного текста `position` — переименовали должность или завели второго
  «директора», и документ молча испортился. Цена — ФИО+телефон лежат дважды
  (строка `employees` с должностью «Директор» тоже есть); при смене
  руководителя править константу.
- **Обязательны только марка и госномер** — осознанное отступление от канона
  «только фамилия/имя»: машина без номера бессмысленна для пропусков. Модель,
  цвет, водители, фото — добиваются постепенно.
- **Бакет `vehicle-files`** — зеркало `employee-files` (приватный, 10 МБ,
  только SELECT члену и INSERT staff, UPDATE/DELETE политик нет). Вид файла
  один — `photo`; техпаспорт/страховка — расширение CHECK отдельной миграцией.
  Сирота при упавшей второй ступени загрузки — тот же долг, что у сотрудников.
- **Пачечный upsert связки — `defaultToNull: false`** (`saveVehicleDrivers` в
  `features/vehicles/api.ts`): postgrest-js по умолчанию шлёт NULL в
  непереданные колонки, `created_by = NULL` не проходит INSERT-политику.
- **Импортные 6 машин (с18)** — из xlsx прораба; связки нашли сотрудников по
  нормализованной паре паспорта (6/6), тем же файлом шести водителям дописаны
  телефоны, которых не было в импорте с17.

## 14. Залы: матрица распределения (с20)

Пять таблиц подсистемы: `hall_plans` (шапка мероприятия) → `halls` (колонки:
цвет hex-строкой, номер = порядок) → `plan_positions` (строки ВСЕГО плана, роль
technician/operator/other) → `hall_assignments` (ячейка: позиция × зал × человек)
и общий `position_catalog`. Решения, не выводимые из кода:

- **Ячейка = максимум один человек**: UNIQUE `hall_assignments_cell_key
  (position_id, hall_id)`. Записей-вакансий нет — пустая ячейка и есть вакансия
  (решение прораба, отмена ранних «слотов» с NULL).
- **Составные FK** `(hall_id, plan_id)` и `(position_id, plan_id)` — обе «ноги»
  ячейки принадлежат одному плану; приём тот же, что у `document_photo_id` с19.
- **`position_catalog` без FK из планов** — строка плана это снимок на день
  мероприятия: удаление позиции из справочника историю не переписывает.
  Уникальность — функциональный `lower(btrim(name))`. Вписанная руками позиция
  дописывается в справочник клиентом тихо (отказ дубля — не ошибка).
  Порядок чипов — лесенка `created_at` засева (миграция `catalog_seed_order`);
  людские записи с `now()` встают после засеянных.
- **Staff-DELETE на всех пяти таблицах** — решение прораба с20: планирование —
  черновик; отход от канона с17 «DELETE только на связку» осознанный.
- **`touch_hall_plan` — security invoker** (after-триггеры детей двигают
  `updated_at` плана): пишущему в детей нужен UPDATE на `hall_plans` — появится
  роль без него, запись начнёт падать на триггере.
- **Один человек во многих ячейках — норма** (страховка на все залы). База не
  ограничивает; интерфейсные скрепка/×N — подсказки без пары в базе, и это
  легально: они ничего не запрещают.
- Таблица `hall_positions` (v1, позиции внутри зала) снесена миграцией
  `hall_matrix` — структуру перевернул бумажный образец прораба (handoff с20).
