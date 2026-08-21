# 03-data-model — ARGO Warehouse

Что лежит в базе, кто имеет к этому доступ и как это менять.

**Сверено с живой базой 2026-08-20 (сессия 2).** Утверждения о колонках, типах,
ограничениях, политиках, индексах, грантах и триггерах — выписка из прода через
Supabase MCP, а не реконструкция по TypeScript-типам, как было в сессии 1.
Утверждения о клиентском коде по-прежнему опираются на якоря `файл:N`.

**Поверх выписки с2 легли пять миграций сессии 5** (§2.4): одна функция заведена,
одна дважды переделана, один индекс добавлен, один лишний грант снят. Таблицы,
политики и колонки в с5 не менялись, поэтому §1 и §3 остаются выпиской с2 в силе.
Отдельно с с5 схема имеет **машинное представление на клиенте** —
`src/react/lib/database.types.ts` снят с прода `generate_typescript_types`, и
`createClient<Database>` типизирует границу с базой (§1.4, `04-architecture` §6).

Все якоря вида `файл:N` проверены чтением файла. Пути даны от корня репозитория
`warehouse.argomedia.uz`.

---

## 0. Схема в репозитории есть — это выписка, а не реконструкция

**Снята 2026-08-20 (сессия 2) через Supabase MCP по системному каталогу Postgres
и лежит в `supabase/migrations/00000000000000_baseline_remote_schema.sql`** (далее
`baseline.sql`). До этого DDL базовых таблиц в git отсутствовал вовсе, и вся страница
была реконструкцией по TypeScript-типам; теперь каждое утверждение о колонке, типе,
ограничении, политике, индексе и гранте — **выписка из живой базы**.

Что это меняет для агента:

- **Прод-схема из git восстанавливается.** `baseline.sql` содержит 134 объекта —
  ровно столько же, сколько нашлось в проде: 9 таблиц, 30 политик, 10 триггеров,
  15 функций, 31 индекс, ключи и проверки. Полнота проверена механической сверкой
  имён (134 из 134), а не чтением глазами.
- **Файл идемпотентен и к проду не применялся** — он снят С прода. Версия
  `00000000000000` выбрана так, чтобы он всегда шёл первым, до миграций `20260819*`.
- Типы и реальность разошлись ровно в одном месте, и оно осталось: `Equipment.tracking_mode`
  и `Equipment.inventory_code` (`types.ts`) колонками **не являются** (см. §9).
- Инструмента применения SQL в репозитории по-прежнему нет: ни `supabase/config.toml`,
  ни пакета `supabase` в `package.json` (`@supabase/supabase-js` — `package.json:17`),
  ни `.github/`. Миграции применяются вручную — через дашборд или Supabase MCP.

**Чего в `baseline.sql` нет** (и восстанавливается отдельно): данные, настройки Auth и
Storage, служебные схемы Supabase (`auth`, `storage`, `realtime`) — их ведёт платформа.

**Как пересверить факты прода** (три запроса; после любой правки схемы мимо `baseline.sql`
он устаревает):

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public' order by 1,2;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1,2,3;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated') order by 1,2;
```

**Состояние данных на момент снятия** (2026-08-20): `equipment` — 1481 строка,
`equipment_movements` — 1391, `events` — 4, `mount_points` — 9, `public.users` — **1**,
`auth.users` — **1**. `equipment_lists`, `equipment_reservation_items`,
`reservation_status_history`, `reports` — **пусто**. То есть ни одного сохранённого
списка в проде ещё нет, а аккаунт в системе ровно один — это прямо касается
`/rls-verify`: второго аккаунта для прогона под двумя пользователями **не существует**,
его нужно завести.

---

**Конвенция сокращений в ссылках.** Имена SQL-файлов длинные, поэтому в тексте они
сокращаются с многоточием, а сокращение раскрывается так:

| Сокращение | Полный путь |
|---|---|
| `…rls.sql` | `scripts/2026-08-19_reservations_history_rls.sql` |
| `…hardening.sql` | `scripts/2026-08-19_security_performance_hardening.sql` |
| `…equipment_model_editing.sql` | `scripts/2026-08-19_equipment_model_editing.sql` |
| `…list_document_fields.sql` | `scripts/2026-08-19_list_document_fields.sql` |
| `migrations/20260819131611` | `supabase/migrations/20260819131611_edit_saved_equipment_lists.sql` |
| `baseline.sql` | `supabase/migrations/00000000000000_baseline_remote_schema.sql` — снимок прод-схемы, снят в с2 |

Голый `api.ts` без префикса разрешается по контексту абзаца: в разделах про каталог
и оборудование это `src/react/features/equipment/api.ts`, в разделах про списки —
`src/react/features/lists/api.ts`. Механическая проверка якорей (`/doc-audit`) обязана
знать обе таблицы, иначе она пометит эти ссылки как нерезолвящиеся.

## 1. Таблицы

Всё ниже — выписка из прода через `baseline.sql` (§0). Столбец «Откуда факт» теперь
показывает не источник знания, а **историю объекта**: `baseline` — существовал до
первой миграции, происхождение неизвестно; `скрипт`/`миграция` — заведён конкретным
файлом репозитория, который можно прочитать.

### 1.1 Живые таблицы

«Живая» здесь означает «участвует в работе продукта», а не «клиент к ней ходит».
Столбец «Доступ клиента» разводит два разных случая: таблица, которую браузер
называет напрямую через PostgREST (`.from(…)`), и таблица, которую браузер не
называет ни разу — её читают и пишут только RPC и триггеры на сервере.

| Таблица | Доступ клиента | Откуда факт |
|---|---|---|
| `public.equipment` | прямой `.from('equipment')` — `equipment/api.ts, 132, 152, 166, 185, 227, 261, 288, 361` (девять мест) | alter + TS; базового DDL нет |
| `public.equipment_lists` | прямой `.from('equipment_lists')` — `lists/api.ts, 244, 290, 299, 487` | alter + TS; базового DDL нет |
| `public.equipment_movements` | прямой `.from('equipment_movements')` — `equipment/api.ts`, только чтение (грант тоже только `select`, `…rls.sql:1061`) | **DDL есть**: `…rls.sql:135-154` |
| `public.reservation_status_history` | прямой `.from('reservation_status_history')` — `lists/api.ts`, только чтение (грант только `select`, `…rls.sql:1060`) | **DDL есть**: `…rls.sql:120-133` |
| `public.equipment_reservation_items` | **клиент не обращается ни разу**, хотя мог бы: полный CRUD-грант (`…rls.sql:1059`) и четыре RLS-политики (`…rls.sql:941-978`) на месте. Состав списка пишется только внутри RPC (`…rls.sql:684-699`, `migrations/20260819131611:98-116`), а обратно приходит агрегатом из `reservation_shortages` (`lists/api.ts`) | **DDL есть**: `scripts/2026-08-19_reservations_history_rls.sql:96-118` |
| `public.users` | **клиент не обращается ни разу и не может**: у `authenticated` НЕТ НИ ОДНОГО гранта — проверено в проде. Таблицу читают только `security definer`-функции `private.*` — см. §4.1 | baseline; DDL: `baseline.sql`, §1 |

Практический вывод: поверхность прямых обращений браузера — ровно **четыре таблицы**
(`equipment`, `equipment_lists`, `equipment_movements`, `reservation_status_history`)
плюс **шесть RPC** (пять прежних и `count_equipment_model_units` с с5, §2.4).
Всё остальное в базе живёт за серверными функциями.

### 1.2 Legacy-таблицы (клиенту больше не доступны)

| Таблица | Статус |
|---|---|
| `public.events` | legacy; права у `authenticated` отозваны — `scripts/2026-08-19_security_performance_hardening.sql:5` |
| `public.mount_points` | legacy; там же |
| `public.reports` | legacy; там же |

`README.md:13` подтверждает: «События, точки монтажа, отчёты, управление ролями и
демонстрационный UI Kit из старой версии не входят в новый продукт».
`docs/handoffs/2026-08-19-0-audit.md:86` утверждает, что эти таблицы **пусты** — это утверждение про
данные прода, из репозитория не проверяется.

Проверено grep'ом по `.from(` во всём `src/react`: единственные имена таблиц —
`equipment`, `equipment_lists`, `equipment_movements`, `reservation_status_history`.
Ни `users`, ни `events`, ни `mount_points`, ни `reports`, ни
`equipment_reservation_items` не упомянуты ни разу — что и зафиксировано в §1.1.

### 1.3 Таблица-призрак: её нет (закрыто в с2)

В сессии 1 предполагалось, что `public.validate_technical_duties_status()`
(`scripts/2026-08-19_security_performance_hardening.sql:12`) обслуживает таблицу вроде
`technical_duties`. **Это опровергнуто выпиской из прода:** функция — триггер
`trg_validate_technical_duties_status` `before insert or update on public.mount_points`,
и проверяет она **jsonb-колонку** `mount_points.technical_duties`, перебирая её
элементы и требуя `status in ('в работе','выполнено','проблема')`.

Таблицы `technical_duties` в проде нет. Таблиц в `public` ровно девять, все перечислены
в §1.1–1.2 — незнакомых объектов не осталось.

### 1.4 `public.equipment` — колонки

Выписка из прода (`baseline.sql`, §1). 14 колонок, все `not null` отмечены явно:

| Колонка | Тип | Обязательность и умолчание |
|---|---|---|
| `id` | uuid | not null, default `gen_random_uuid()` |
| `model`, `brand` | text | **not null** |
| `serialnumber` | text | **not null** (расхождение с TS закрыто в с5 — см. ниже) |
| `type`, `subtype` | text | **not null** |
| `location` | text | **not null** |
| `technicalspecification`, `description` | text | nullable |
| `lengthinmeters` | text | default `'N/A'` |
| `count` | integer | default `1` |
| `availability` | text | default `'available'` |
| `created_at`, `updated_at` | timestamptz | default `now()` |

Ограничения:

- `equipment_availability_check`: `availability in ('available','unavailable','diagnostics','issued')`;
- `equipment_count_nonnegative_check`: `count >= 0`.

**`UNIQUE` на `serialnumber` в проде НЕТ — проверено.** Есть только обычный btree
`idx_equipment_serialnumber`. Уникальность держится единственной клиентской проверкой:
это не гонка, а отсутствие ограничения — разбор в разделе «Расхождения документации
с кодом» в конце страницы.

**`serialnumber` объявлен `not null` — расхождение с TS закрыто в с5.** Тип строки
больше не пишется руками: он выводится из сгенерированной схемы —
`EquipmentRow = Tables<'equipment'>` (`features/equipment/types.ts`), а клиент
создаётся как `createClient<Database>` (`lib/supabase.ts`, `:10`). Доменный
`Equipment` переопределяет ровно три поля и объясняет каждое (`types.ts`):
`serialnumber` наружу отдаётся `string | null`, потому что для количественного учёта
в колонке лежит служебный идентификатор `QTY::…`, который нормализация прячет;
`availability` и `count` в схеме nullable, а интерфейс считает их строкой и числом.
То есть nullable в TS теперь не рассинхрон со схемой, а осознанное сужение на границе
нормализации. Пустой серийник вдобавок отсекается до вставки, с внятным сообщением
(`equipment/api.ts`), а не падением на `NOT NULL`.

### 1.5 `public.equipment_lists` — колонки

Базовая часть таблицы неизвестна; колонки видны по запросам и по `alter`-ам.

| Колонка | Откуда факт |
|---|---|
| `id`, `name`, `description`, `type`, `created_at`, `updated_at`, `is_archived`, `metadata`, `created_by`, `equipment_ids` uuid[] | вставка `…rls.sql:673-682`, backfill `:257-259`, `:261` |
| `equipment_items` jsonb default `'[]'` | **alter**: `scripts/2025-01-10_equipment_lists_abstract_mode.sql:6-7` |
| `list_mode` varchar(20) default `'specific'` check in ('specific','abstract') | **alter**: `2025-01-10…:10-11` |
| `client_name`, `venue` text | **alter**: `scripts/2026-08-19_list_document_fields.sql:3-5` |
| `reservation_status` text not null default `'draft'` | **alter**: `…rls.sql:45-46` |
| `reservation_start`, `reservation_end` date | `…rls.sql:47-48` |
| `confirmed_at`, `issued_at`, `returned_at` timestamptz | `…rls.sql:49-51` |
| `status_changed_at` not null default now(), `status_changed_by` uuid | `…rls.sql:52-53` |
| `shortage_snapshot` jsonb not null default `'[]'` | `…rls.sql:54` |
| `mount_point_id` | uuid, FK → `mount_points(id)` **on delete set null** — тип и внешний ключ установлены выпиской из прода; в репозитории FK не заводился ни одним файлом |

Ограничения (все подтверждены в проде): `equipment_lists_reservation_status_check`
(4 значения), `equipment_lists_reservation_dates_check` (обе даты пусты либо start ≤ end),
`equipment_lists_list_mode_check` (`specific` / `abstract`),
`equipment_lists_status_changed_by_fkey` → `auth.users(id) on delete set null`,
`equipment_lists_created_by_fkey` → `auth.users(id)` **без `on delete`** — то есть
удалить автора списка из `auth.users` нельзя, пока список существует (поведение по
умолчанию `no action`). Плюс `event_id` → `events` on delete cascade и
`mount_point_id` → `mount_points` on delete set null.

**Два представления состава списка живут одновременно** и синхронизируются вручную
внутри RPC: legacy-пара `equipment_ids` / `equipment_items` (`…rls.sql:655-671`,
`migrations/20260819131611_edit_saved_equipment_lists.sql:67-83`) и нормализованная
таблица `equipment_reservation_items`. Расчёт дефицита (`reservation_shortages`)
читает **только нормализованную**, а клиентский экспорт и старый UI — legacy-поля
(`lists/api.ts` тянет `equipment_ids,equipment_items`). Если кто-то запишет в
`equipment_lists` мимо RPC, два представления разъедутся.

### 1.6 `public.equipment_reservation_items` — DDL есть (`…rls.sql:96-118`)

| Колонка | Определение |
|---|---|
| `id` | uuid pk default `gen_random_uuid()` |
| `list_id` | uuid not null → `equipment_lists(id)` **on delete cascade** (`:98`) |
| `equipment_id` | uuid → `equipment(id)` **on delete set null** (`:99`) |
| `brand`, `model`, `type`, `subtype` | text **not null** — денормализованные копии, см. §8 (`:100-103`) |
| `tracking_mode` | text not null, check in ('serialized','quantity','planned') (`:104`, `:109-110`) |
| `requested_count` | integer not null default 1, check > 0 (`:105`, `:111`) |
| `created_by` | uuid not null default `auth.uid()` → `auth.users(id)` **on delete restrict** (`:106`) |
| `created_at`, `updated_at` | timestamptz not null default now() (`:107-108`) |

Дополнительно:
- `:112-116` — `equipment_reservation_items_equipment_check`: `planned` ⇒ `equipment_id is null`;
  `serialized`/`quantity` ⇒ `equipment_id is not null`.
- `:117` — `unique (list_id, equipment_id)`. **Ловушка:** Postgres по умолчанию считает
  NULL различными, поэтому для `planned`-строк (где `equipment_id is null`) уникальность
  **не работает** — один список может содержать сколько угодно дублей одной планируемой
  модели.
- `created_by … on delete restrict` (`:106`) означает: пользователя, создавшего хоть
  одну позицию, **нельзя удалить из `auth.users`** без предварительной чистки. Это
  единственный `restrict` в схеме.

### 1.7 `public.reservation_status_history` — DDL есть (`…rls.sql:120-133`)

`id`, `list_id` → `equipment_lists` on delete cascade (`:122`), `from_status` (nullable),
`to_status` (not null), `note`, `shortage_snapshot` jsonb default `'[]'`,
`changed_by` → `auth.users` on delete set null (`:127`), `changed_at`.
Check-ограничения на оба статуса — `:129-132`. Пишется **только триггером**
`private.log_reservation_status_change()` (§5); клиенту дан `select` и ничего больше
(`…rls.sql:1060`).

### 1.8 `public.equipment_movements` — DDL есть (`…rls.sql:135-154`)

`id`, `equipment_id` → `equipment` on delete **cascade** (`:137`), `list_id` →
`equipment_lists` on delete set null (`:138`), `movement_type` (check из 7 значений,
`:149-153`), `quantity_delta`, `quantity_before/after`, `status_before/after`, `note`,
`changed_by` → `auth.users` on delete set null, `changed_at`, `metadata` jsonb.

`on delete cascade` по `equipment_id` значит: **удаление единицы оборудования стирает
весь её журнал движений**. Журнал заявлен неизменяемым (`…rls.sql:450-451`), но не
переживает удаление предмета. Удалять `equipment` может admin (`…rls.sql:916-918`).

---

## 2. Два механизма SQL: порядок установлен (с2)

В репозитории **два независимых набора SQL**, и они пересекаются по объектам.

| Набор | Файлы | Даты |
|---|---|---|
| `supabase/migrations/` | 9 + baseline | четыре от `20260819` (13:16–14:28) и пять от `20260820` (16:39–18:32, сессия 5 — см. §2.4) |
| `scripts/*.sql` | 6 | `2025-01-10`, `2025-08-06`, четыре от `2026-08-19` (без времени) |

**Порядок больше не гипотеза.** `supabase_migrations.schema_migrations` в проде
содержит восемь записей, и они разрешают все споры сессии 1:

| # | Версия в проде | Имя в проде | Файл репозитория |
|---|---|---|---|
| 1 | `20260819100935` | `reservations_history_rls_20260819` | `scripts/2026-08-19_reservations_history_rls.sql` |
| 2 | `20260819102946` | `security_performance_hardening_20260819` | `scripts/2026-08-19_security_performance_hardening.sql` |
| 3 | `20260819110118` | `list_document_fields_20260819` | `scripts/2026-08-19_list_document_fields.sql` |
| 4 | `20260819111900` | `equipment_model_editing_20260819` | `scripts/2026-08-19_equipment_model_editing.sql` |
| 5 | `20260819132044` | `edit_saved_equipment_lists` | `migrations/20260819131611_…` |
| 6 | `20260819141934` | `allow_list_owners_to_delete_drafts` | `migrations/20260819141650_…` |
| 7 | `20260819142805` | `allow_default_account_to_delete_any_list` | `migrations/20260819142617_allow_app_members_to_delete_any_list.sql` |
| 8 | `20260819142903` | `optimize_default_account_delete_policy` | `migrations/20260819142846_…` |

Три вывода:

1. **Порядок — `scripts/` → `migrations/`.** Четыре скрипта от 19.08 применены первыми
   (10:09–11:19), четыре миграции следом (13:20–14:29). Значит везде ниже, где сессия 1
   писала «зависит от порядка», действует ветка «`scripts/` → `migrations/`».
2. **`scripts/*.sql` от 19.08 — НЕ архив.** Они применены к проду и зарегистрированы как
   миграции, просто под другими версиями и именами. Утверждение «`scripts/` — архив без
   гарантий применения» верно только для двух старых файлов.
3. **Два старых скрипта (`2025-01-10`, `2025-08-06`) в истории миграций отсутствуют.**
   Их эффект в базе есть (колонки `equipment_items`, `list_mode`, индексы,
   `update_mount_points_count`), но записи о применении нет — их прогоняли до перехода
   на миграции. Имена в проде и в репозитории также разошлись у пункта 7: файл называется
   `allow_app_members_to_delete_any_list`, применённая миграция —
   `allow_default_account_to_delete_any_list`. Правит она именно default-account.

Инструмента применения в репозитории по-прежнему нет (§0) — миграции гоняют вручную.

### 2.1 Конфликт первый: права на `public.users`

| Файл:строка | Действие |
|---|---|
| `scripts/2026-08-19_reservations_history_rls.sql:1046` | `revoke all on table public.users from anon, authenticated` |
| `scripts/2026-08-19_reservations_history_rls.sql:1056` | `grant select, insert, update, delete on table public.users to authenticated` |
| `scripts/2026-08-19_security_performance_hardening.sql:6` | `revoke all on table public.users from authenticated` |

Это прямое противоречие: `…rls.sql:1056` выдаёт полный набор прав, `…hardening.sql:6`
забирает всё. **Спор закрыт выпиской из прода (с2): победил `revoke`.**

Фактические гранты `authenticated` в проде — ровно такие:

| Таблица | Права `authenticated` |
|---|---|
| `equipment`, `equipment_lists`, `equipment_reservation_items` | select, insert, update, delete |
| `equipment_movements`, `reservation_status_history` | **только select** |
| `users`, `events`, `mount_points`, `reports` | **ни одного гранта** |

У роли `anon` нет прав ни на одну таблицу `public`. Тот же результат по legacy-таблицам:
`…rls.sql:1062-1064` давал `events`, `mount_points`, `reports` полный CRUD,
`…hardening.sql:5` всё отозвал — и, поскольку `hardening` шёл вторым (§2), отзыв и
действует.

**Практическое следствие, которое надо помнить при чтении §3:** политики `users_*`,
`events_*`, `mount_points_*`, `reports_*` в проде существуют, но **недостижимы**.
RLS фильтрует строки только после того, как роль получила право на таблицу; нет
гранта — запрос падает на правах, до политики дело не доходит. Любой код вида
`supabase.from('users').select(...)` получит отказ, а не пустой список.

**Не читай этот раздел в отрыве от §4.1.** «Права то дают, то забирают» — не признак
недоделки, которую надо привести к одному виду. Отзыв прав на `public.users` работает
ровно потому, что функции проверки членства объявлены `security definer` и читают
таблицу в обход клиентских прав. Вернуть `authenticated` право читать `public.users`
значит открыть всем таблицу ролей, ничего при этом не починив.

### 2.2 Конфликт второй: политика удаления списков (важнее первого)

`scripts/2026-08-19_reservations_history_rls.sql:864-880` — цикл, который **дропает все
политики** на девяти таблицах, включая `equipment_lists`, и затем пересоздаёт свой набор,
где на delete стоит только `equipment_lists_delete_for_admins` (`:937`).

Четыре миграции — это последовательная переделка ровно этой политики:

| Миграция | Итог |
|---|---|
| `20260819141650_allow_list_owners_to_delete_drafts.sql:9-20` | admin удаляет всё; член приложения — свои черновики |
| `20260819142617_allow_app_members_to_delete_any_list.sql:9-22` | предыдущие дропнуты; остаётся только `…_delete_for_default_account`: член приложения **и** `auth.jwt()->>'email' = 'argo@argomedia.uz'` |
| `20260819142846_optimize_default_account_delete_policy.sql:3-13` | та же политика пересоздана дословно (`:11-12` идентичны `142617:20-21`); зачем — из диффа не следует |

**Итог установлен (с2): действует ветка «`scripts/` → `migrations/`».** В проде на
`equipment_lists` ровно одна политика удаления:

```sql
equipment_lists_delete_for_default_account  DELETE  to authenticated
using (
  (select private.is_app_member())
  and ((select auth.jwt()) ->> 'email') = 'argo@argomedia.uz'
)
```

Политики `equipment_lists_delete_for_admins` в проде **нет**. Значит:

- **удалять списки может ровно один почтовый адрес** — `argo@argomedia.uz`;
- **роль `admin` права удаления не даёт вообще**;
- право привязано не к роли и не к членству, а к строке в JWT. Смена почты у владельца
  аккаунта молча отберёт возможность удалять списки, и в интерфейсе это будет выглядеть
  как поломка приложения (см. абзац ниже про `lists/api.ts`). Долг записан в backlog.

Клиент (`lists/api.ts`) делает обычный `delete … .select('id').maybeSingle()`
и при пустом ответе кидает `Equipment list cannot be deleted` (`:494`) — то есть
отказ RLS выглядит как ошибка приложения, а не как отказ прав. Отличить один сценарий
от другого по UI невозможно.

### 2.3 Что ещё зависит от порядка

`scripts/2025-08-06_mount_points_fk.sql:19-28` создаёт `update_mount_points_count()`
**без** `search_path` и с багом на DELETE (использует `new.event_id`, который при
DELETE равен NULL). `scripts/2026-08-19_security_performance_hardening.sql:14-30`
переписывает функцию правильно (`coalesce(new.event_id, old.event_id)`, `:22`) и
пришпиливает `search_path = ''` (`:17`). Если кто-то прогонит файл 2025-08-06 повторно
после hardening — баг вернётся.

### 2.4 Пять миграций сессии 5 (2026-08-20)

Все пять — фиксы аудита с4, все идут поверх baseline и четвёрки `20260819*`.
Ни одна не трогает таблицы: правятся только функции, гранты и один индекс.

| Миграция | Что делает |
|---|---|
| `20260820163924_keep_equipment_location_on_empty_update.sql` | `update_equipment_model_and_unit`: в поштучном `update` вместо `nullif(btrim(p_location), '')` теперь `location = coalesce(nullif(btrim(p_location), ''), e.location)` (`:66`). Пустая локация от клиента больше не роняет транзакцию о `NOT NULL`, а оставляет прежнее значение. Тело скопировано из baseline, изменена одна строка; права не переопределяются — `create or replace` сохраняет прежний `grant execute` (`:6`) |
| `20260820172928_count_equipment_model_units.sql` | Новая RPC `public.count_equipment_model_units(p_brand text, p_model text) returns integer`, `language sql stable` **`security invoker`** `set search_path = ''` (`:7-18`). Считает по ТОМУ ЖЕ правилу, что и правка модели: `lower(btrim(brand))` + `lower(btrim(model))` (`:16-17`). `revoke all … from public` + `grant execute … to authenticated` (`:22-23`) |
| `20260820173459_revoke_anon_count_units.sql` | Догоняющая правка и **грабля на будущее**: `revoke … from public` не снимает прямой грант, который `anon` получает через default privileges Supabase на новые функции. Проверка `information_schema` после предыдущей миграции показала `anon` в `grantee` — снят явным `revoke execute … from anon` (`:5`) |
| `20260820180641_equipment_model_normalized_idx.sql` | `create index if not exists equipment_model_normalized_idx on public.equipment (lower(btrim(brand)), lower(btrim(model)))` (`:6-7`) — закрывает пробел, отмеченный в §7: по сырым колонкам этот предикат индексом не покрывался, и каждый вызов `reservation_shortages` шёл последовательным чтением `equipment` (~1307 буферов на вызов, `:5`) |
| `20260820183210_optimistic_lock_equipment_update.sql` | Переделка `update_equipment_model_and_unit` со сменой сигнатуры, поэтому старая версия сначала **сносится** `drop function` (`:28`): два overload'а одного имени дали бы PostgREST `PGRST203`. Разбор — ниже |

**Что именно поменяла последняя миграция** (`20260820183210`):

- **`p_count integer default null`** (`:33`). Не прислали параметр — количество не
  трогается: `count = coalesce(p_count, e.count)` (`:100`), и проверка «неотрицательное»
  тоже выполняется только когда значение реально пришло (`:77-79`). Раньше серийная
  карточка всегда отправляла `1`, и запись с другим количеством получала фантомную
  строку «Изменено количество» в `equipment_movements` при правке одного описания —
  триггер `trg_equipment_movement_history` реагирует на `count`.
- **`p_expected_updated_at timestamptz default null`** (`:34`) — оптимистическая
  блокировка. Клиент присылает `updated_at`, на котором открыл карточку; расхождение
  с текущим отменяет правку целиком: `raise exception 'Equipment card is stale' using
  errcode = '40001'` (`:59-62`). Код `40001` — стандартный `serialization_failure`,
  по нему клиент отличает конфликт версий от любого другого отказа
  (`EquipmentDrawer.tsx`). `null` от клиента значит «не сверять».
- **Совместимость** заявлена явно (`:19-22`): оба новых аргумента имеют default, то
  есть старый клиент с 11 именованными аргументами проходит как раньше. Порядок
  выкатки любой.
- **Гранты выданы заново** (`:114-116`): `drop` снёс прежние, а `revoke from public`
  сам по себе не снимает прямой грант `anon` — та же грабля, что и в
  `20260820173459`, здесь закрыта отдельной строкой `revoke execute … from anon`.
- Тело скопировано не из baseline, а из `20260820163924` (`:24-26`) — иначе потерялась
  бы оборона `location` от пустой строки.

---

## 3. RLS: таблица → политика → роль → условие → файл

RLS включён на девяти таблицах: `…rls.sql:882-890`.
Перед включением все существовавшие политики на этих таблицах дропаются циклом
`…rls.sql:864-880` — комментарий `:862-863` объясняет: чтобы старые permissive-политики
не складывались с новыми.

Все политики адресованы роли `authenticated` (`anon` не имеет ни одной).

| Таблица | Политика | cmd | Условие | Файл:строка |
|---|---|---|---|---|
| `users` | `users_select_for_members` | select | `private.is_app_member()` | `…rls.sql:892-894` |
| `users` | `users_insert_for_admins` | insert | `has_any_role({admin})` | `…rls.sql:895-897` |
| `users` | `users_update_for_admins` | update | `has_any_role({admin})` (using + check) | `…rls.sql:898-901` |
| `users` | `users_delete_for_admins` | delete | `has_any_role({admin})` | `…rls.sql:902-904` |
| `equipment` | `equipment_select_for_members` | select | `is_app_member()` | `…rls.sql:906-908` |
| `equipment` | `equipment_insert_for_inventory_team` | insert | `has_any_role({technician,manager,admin})` | `…rls.sql:909-911` |
| `equipment` | `equipment_update_for_inventory_team` | update | тот же набор ролей | `…rls.sql:912-915` |
| `equipment` | `equipment_delete_for_admins` | delete | `has_any_role({admin})` | `…rls.sql:916-918` |
| `equipment_lists` | `equipment_lists_select_for_members` | select | `is_app_member()` | `…rls.sql:920-922` |
| `equipment_lists` | `equipment_lists_insert_for_members` | insert | член **и** `created_by = auth.uid()` **и** `reservation_status='draft'` **и** три `*_at is null` | `…rls.sql:923-932` |
| `equipment_lists` | `equipment_lists_update_for_members` | update | **только** `is_app_member()` — без владельца и без статуса | `…rls.sql:933-936` |
| `equipment_lists` | `equipment_lists_delete_for_admins` | delete | `has_any_role({admin})` | `…rls.sql:937-939` |
| `equipment_lists` | `equipment_lists_delete_for_owners_and_admins` | delete | admin **или** (член и владелец и `draft`) | `migrations/20260819141650:9-20` — **дропнута** миграцией `142617:6-7` |
| `equipment_lists` | `equipment_lists_delete_for_default_account` | delete | член **и** `auth.jwt()->>'email' = 'argo@argomedia.uz'` | `migrations/20260819142617:15-22`, пересоздана `142846:6-13` |
| `equipment_reservation_items` | `reservation_items_select_for_members` | select | `is_app_member()` | `…rls.sql:941-943` |
| `equipment_reservation_items` | `reservation_items_insert_for_drafts` | insert | член **и** `created_by = auth.uid()` **и** родительский список в `draft` | `…rls.sql:944-953` |
| `equipment_reservation_items` | `reservation_items_update_for_drafts` | update | член **и** родитель в `draft` (using + check) | `…rls.sql:954-969` |
| `equipment_reservation_items` | `reservation_items_delete_for_drafts` | delete | член **и** родитель в `draft` | `…rls.sql:970-978` |
| `reservation_status_history` | `reservation_history_select_for_members` | select | `is_app_member()` | `…rls.sql:980-982` |
| `equipment_movements` | `equipment_movements_select_for_members` | select | `is_app_member()` | `…rls.sql:983-985` |
| `events` | `events_{select,insert,update,delete}_for_assigned_team` | все 4 | `auth.uid() = any(responsible_engineers)` **или** `has_any_role({manager,admin})` | `…rls.sql:987-1014` |
| `mount_points` | `mount_points_{select,insert,update,delete}_by_event` | все 4 | `exists (select 1 from public.events e where e.id = event_id)` | `…rls.sql:1016-1028` |
| `reports` | `reports_{select,insert,update,delete}_by_event` | все 4 | то же | `…rls.sql:1030-1042` |

Замечания по политикам:

1. **`equipment_lists_update_for_members` (`:933-936`) не ограничивает ни владельца, ни
   этап.** Любой член приложения может обновить любой список. Ограничение по этапу даёт
   не RLS, а триггер `private.guard_reservation_list_update()` (§5). Тот, кто отключит
   или перепишет триггер, получит свободную запись во все поля жизненного цикла.
2. `reservation_status_history` и `equipment_movements` имеют политики **только на select** —
   при этом RLS без соответствующей политики означает запрет. Вставку делают триггерные
   функции `private.log_*` (§5), объявленные `security definer` (`…rls.sql:455`, `:554`).
   **Механизм тут не в самом `security definer`:** он лишь подменяет пользователя,
   от чьего имени идёт запрос, а RLS не отключает. Политики обходятся потому, что
   владелец функции при `security definer` оказывается владельцем таблицы, а владелец
   таблицы от RLS освобождён — пока на таблице не выставлено `force row level security`.
   **Проверено в с2: конструкция цела.** Все девять таблиц `public` и все пять функций
   `private.*` принадлежат роли `postgres`, `relforcerowsecurity = false` у всех девяти.
   Владелец функции и владелец таблицы совпадают, принудительный RLS не включён —
   значит вставка из триггера политики обходит, и журналы неподделываемы ровно так, как
   задумано (`…rls.sql:450-451`).

   **Что это ломает при неаккуратной правке:** включите `force row level security` на
   `equipment_movements` или `reservation_status_history` — и триггерная вставка начнёт
   падать на RLS, а история молча перестанет писаться (политик на insert там нет). То же
   произойдёт, если сменить владельца таблицы, не сменив владельца функции. Перепроверка:
   `select relname, relowner::regrole, relforcerowsecurity from pg_class where relname in ('reservation_status_history','equipment_movements')`
   плюс `select proname, proowner::regrole from pg_proc where pronamespace = 'private'::regnamespace`.
3. Политики `mount_points` и `reports` проверяют лишь **существование** события, а не
   право на него. Само по себе это дыра (любой authenticated читает чужие точки монтажа
   через `exists`), но нейтрализована грантами: `…hardening.sql:5` отзывает права на
   таблицы целиком. Порядок применения (§2) решает, действует ли нейтрализация.
4. `docs/handoffs/2026-08-19-0-audit.md:76` оправдывает оставшиеся гранты `authenticated` на пять рабочих
   таблиц («убрать без отдельного серверного API нельзя»). Это согласуется с
   `…rls.sql:1056-1064`, но противоречит `…hardening.sql:5-6` в части `users` и legacy —
   ещё одно проявление §2.1.

### 3.1 Гранты (нужны в дополнение к RLS)

**Фактическое состояние прода** (проверено в с2, таблица целиком — в §2.1): полный CRUD
у `authenticated` есть на `equipment`, `equipment_lists`, `equipment_reservation_items`;
только `select` — на `equipment_movements` и `reservation_status_history`; на `users`,
`events`, `mount_points`, `reports` — **ни одного гранта**. У `anon` — ничего.

История: `…rls.sql:1046-1054` отзывал всё, `…rls.sql:1056-1064` возвращал широкие права,
`…hardening.sql:5-6` снова снял `users` и три legacy-таблицы. Поскольку `hardening`
применялся вторым (§2), в проде осталось состояние после него.

**EXECUTE на RPC** выдан `authenticated` для семи функций: `reservation_shortages`,
`create_equipment_list_with_items`, `create_equipment_list_document`,
`update_equipment_list_document`, `transition_equipment_list_status`,
`update_equipment_model_and_unit`, `count_equipment_model_units` (седьмая заведена
в с5, §2.4). У `anon` нет ни одной — но это состояние приходится **удерживать
руками**: default privileges Supabase отдают `EXECUTE` каждой новой функции напрямую
`anon`, и `revoke … from public` этого не снимает. Обе миграции с5, заводившие или
пересоздававшие функцию, содержат отдельный `revoke execute … from anon`
(`20260820173459:5`, `20260820183210:115`). Схема `private` открыта
(`usage`) для `postgres` и `authenticated`, но её функции недоступны через PostgREST,
потому что схема не выставлена в Data API.

**Realtime:** ни одна рабочая таблица не входит в публикацию `supabase_realtime` —
подписок на изменения в проде нет.

`…rls.sql:1066` — `notify pgrst, 'reload schema'`. Без него PostgREST не увидит новые RPC.
Клиентские фолбэки на коды `PGRST202/42883` (`lists/api.ts`) и `PGRST205/42P01`
(`lists/api.ts`, `equipment/api.ts`) — это ровно защита от несброшенного кэша схемы.
Там же лежит **временный** фолбэк `countEquipmentModelUnits` (`equipment/api.ts`):
пока миграция `20260820172928` не применена, база отвечает «функции нет», и счёт идёт
по-старому — `.eq` по сырым строкам. Гейт строго по коду отсутствия функции; после
применения миграции ветка мертва и подлежит удалению вместе с комментарием (`:282-285`).

---

## 4. Схема `private` и функции безопасности

`…rls.sql:5-7`: `create schema if not exists private`; `revoke all on schema private from
public, anon`; `grant usage … to authenticated`. Схема **не выставлена** в Data API,
поэтому её функции недоступны через PostgREST-RPC.

| Функция | Строка | Свойства |
|---|---|---|
| `private.is_app_member()` → boolean | `…rls.sql:9-21` | `language sql stable` **`security definer`** `set search_path = ''`; тело: `exists (select 1 from public.users u where u.id = auth.uid())` |
| `private.has_any_role(allowed_roles text[])` → boolean | `…rls.sql:23-36` | те же свойства; `u.role::text = any(allowed_roles)`. **Тип установлен (с2): `role` — не enum, а `character varying(32)`** с check-ограничением `users_role_check` на четыре значения: `video_engineer`, `technician`, `manager`, `admin`. Приведение `::text` здесь — просто согласование типов с `text[]` |

Права: `revoke all … from public, anon` (`:38-39`), `grant execute … to authenticated`
(`:40-41`).

### 4.1 Связка, которую нельзя читать по частям

**Факт А.** `scripts/2026-08-19_security_performance_hardening.sql:6` —
`revoke all on table public.users from authenticated`. Клиент физически не может
прочитать свою роль: в `src/react` нет ни одного обращения к `users`, а
`AuthProvider.tsx` (75 строк целиком) работает только с `supabase.auth` и знает лишь
`Session`. Любая идея «прятать кнопки по роли, прочитав `public.users`» технически
невыполнима без нового серверного эндпоинта или кастомного JWT-claim.

**Факт Б.** `private.is_app_member()` и `private.has_any_role()` объявлены
**`security definer`** (`…rls.sql:13`, `:27`). Они читают `public.users` правами
владельца функции, а не вызывающего. Именно поэтому отзыв **грантов** из факта А
**не ломает авторизацию**: все RLS-политики и все проверки внутри RPC продолжают работать.

Оговорка, та же что в §3, замечание 2: гранты `security definer` снимает, а RLS —
нет. На `public.users` RLS включён (`…rls.sql:882`), и политика чтения сама вызывает
`is_app_member()` (`:892-894`), то есть на `users` замкнута. Не падать в рекурсию и
проходить эту политику функция может только за счёт того, что её владелец —
владелец `public.users`, освобождённый от RLS. Владелец в репозитории не зафиксирован,
`force row level security` тоже нигде не выставляется — **проверить запросом из §3**.

**Вывод, обязательный к прочтению вместе:** revoke на `public.users` — не баг и не
недоделка. Агент, который «починит» этот revoke, выдав `authenticated` право читать
`users`, откроет всем сотрудникам таблицу пользователей с ролями. Агент, который вместо
этого попробует «привести к единому стилю» и заменит `security definer` на
`security invoker` в `private.is_app_member()`, **уронит вход целиком**: функция начнёт
возвращать false для всех, `is_app_member()` провалится, и ни одна политика не пропустит
ни одной строки. Оба факта менять нельзя ни по отдельности, ни вместе — без замены
модели доставки роли на клиент (кастомный claim в JWT либо отдельная RPC вида
`public.current_user_role() security definer`).

**Побочное следствие, которое стоит признать честно.** Раз клиент не знает роли, он
не может ни спрятать, ни объяснить недоступное действие. Пример: `createEquipment`
(`equipment/api.ts`) делает прямой `insert` в `equipment`, а право даёт
`equipment_insert_for_inventory_team` (`…rls.sql:909-911`). Пользователь без роли
`technician/manager/admin` получит сырую ошибку RLS от PostgREST. Это дефект UX,
не безопасности.

---

## 5. Триггеры

Все три триггерные функции — в схеме `private`, `security definer`, `search_path = ''`,
с `revoke all … from public, anon, authenticated` (`…rls.sql:586-588`). Комментарий
`:450-451` формулирует замысел: клиент не должен уметь подделать или стереть историю.

В проде триггеров **десять**, не четыре — полный список снят выпиской (`baseline.sql`, §6):

| Триггер | Таблица | Когда | Функция |
|---|---|---|---|
| `trg_equipment_movement_history` | `public.equipment` | `after insert or update of count, availability` | `private.log_equipment_change()` — `…rls.sql:452-508`, создан `:591-593` |
| `update_equipment_updated_at` | `public.equipment` | `before update` | `public.update_updated_at_column()` |
| `trg_guard_reservation_list_update` | `public.equipment_lists` | `before update` | `private.guard_reservation_list_update()` — `…rls.sql:510-549`, создан `:596-598` |
| `trg_reservation_status_history` | `public.equipment_lists` | `after insert or update` | `private.log_reservation_status_change()` — `…rls.sql:551-584`, создан `:601-603` |
| `trigger_update_equipment_lists_updated_at` | `public.equipment_lists` | `before update` | `public.update_equipment_lists_updated_at()` |
| `trg_mount_points_count` | `public.mount_points` | `after insert or delete or update` | `update_mount_points_count()` — создан `scripts/2025-08-06_mount_points_fk.sql:31-33`, тело переписано `…hardening.sql:14-30` |
| `mount_point_insert` | `public.mount_points` | `after insert` | то же `update_mount_points_count()` |
| `mount_point_update` | `public.mount_points` | `after update of event_id` | то же |
| `mount_point_delete` | `public.mount_points` | `after delete` | то же |
| `trg_validate_technical_duties_status` | `public.mount_points` | `before insert or update` | `public.validate_technical_duties_status()` |

**Находка с2: на `mount_points` висят четыре триггера пересчёта вместо одного.**
`trg_mount_points_count` покрывает `insert or delete or update` целиком, а
`mount_point_insert` / `mount_point_update` / `mount_point_delete` дублируют его
поштучно. На каждую вставку `update_mount_points_count()` выполняется дважды.

Порчи данных это не даёт — функция не инкрементирует счётчик, а **пересчитывает его
заново** (`select count(*) … where event_id = …`), поэтому двойной прогон даёт тот же
результат. Цена — лишняя работа, а не расхождение. Таблица `mount_points` — наследие
Vue-версии, продукт её не трогает, так что долг записан в backlog без срочности.

**`guard_reservation_list_update` — единственная защита жизненного цикла на уровне
записи** (RLS её не даёт, см. §3, замечание 1):

- `:517-526` — правка `status_changed_at/by`, `confirmed_at`, `issued_at`, `returned_at`,
  `shortage_snapshot` запрещена, если не выставлен `argo.transition_allowed = 'true'`;
- `:528-530` — `created_by` неизменяем;
- `:532-535` — смена `reservation_status` только через `transition_equipment_list_status()`;
- `:537-546` — у не-черновика неизменяемы даты, `equipment_ids`, `equipment_items`, `list_mode`.

Механизм разрешения — сессионные GUC через `set_config(…, true)` (локально в транзакции):
`argo.transition_allowed`, `argo.movement_type`, `argo.list_id`, `argo.transition_note`.
Ставятся внутри `transition_equipment_list_status` (`…rls.sql:746-747`, `:785-787`, `:802`,
`:817-819`, `:834`) и сбрасываются в конце (`:842-845`). **`transition_equipment_list_status`
объявлена `security invoker` (`:712`)** — значит, GUC ставит сам вызывающий. Технически
пользователь, имеющий прямой SQL-доступ, может выставить `argo.transition_allowed` сам
и обойти гварда; через PostgREST-RPC — нет, произвольный SQL там недоступен.

**Пробел журнала движений:** триггер `…rls.sql:592` слушает только
`update of count, availability`. Смена `brand/model/type/subtype/location` через
`update_equipment_model_and_unit` (`scripts/2026-08-19_equipment_model_editing.sql:54-65`)
в `equipment_movements` **не попадает** — переименование модели не оставляет следа.
Учитывая, что `reservation_shortages` джойнит по этому же тексту (§8), это значимо.

`log_equipment_change` при `update` выходит без записи, если ни `count`, ни `availability`
не изменились (`:474-477`), и берёт тип движения из `argo.movement_type`, принимая только
`issued`/`returned` (`:479-488`).

### 5.1 `search_path`

- Все функции репозитория объявлены с `set search_path = ''` — `…rls.sql:14, 28, 337, 456,
  514, 555, 618, 713`; `…equipment_model_editing.sql:19`; `…list_document_fields.sql:25`;
  `migrations/20260819131611:17`; `…hardening.sql:17`.
- Четырём унаследованным функциям `search_path` прикручен задним числом:
  `…hardening.sql:10-12` — `update_updated_at_column()`, `update_equipment_lists_updated_at()`,
  `validate_technical_duties_status()`; плюс переписанная `update_mount_points_count()`.
  **Тела выписаны в с2** (`baseline.sql`, §5) — сюрпризов нет:
  `update_updated_at_column()` и `update_equipment_lists_updated_at()` идентичны и
  делают `NEW.updated_at = NOW()`; `validate_technical_duties_status()` перебирает
  jsonb-массив `mount_points.technical_duties` и требует
  `status in ('в работе','выполнено','проблема')` — это и есть источник легенды о
  «таблице-призраке» (§1.3). Все три написаны с CRLF-переносами, в отличие от остальных
  функций схемы, — то есть заводились вставкой из другого редактора.
- Прямой вызов всех четырёх запрещён: `…hardening.sql:32-35`.
- Единственное исключение из правила — оригинальная `update_mount_points_count()` в
  `scripts/2025-08-06_mount_points_fk.sql:19-28`: без `search_path`, `security invoker`
  по умолчанию. Перекрыта поздним файлом.

---

## 6. RPC-функции

Все публичные RPC — `security definer`? **Нет.** Все — `security invoker`
(`…rls.sql:336`, `:617`, `:712`; `…equipment_model_editing.sql:18`;
`…list_document_fields.sql:24`; `migrations/20260819131611:16`). Права проверяются
внутри тела вызовом `private.*` (которые как раз `definer`), плюс RLS на нижележащих
таблицах.

| RPC | Определена | Права | Вызывается клиентом |
|---|---|---|---|
| `public.reservation_shortages(uuid)` → set of 10 колонок | `…rls.sql:321-448` | revoke public/anon `:855`, grant authenticated `:858` | `lists/api.ts` |
| `public.create_equipment_list_with_items(text,text,text,date,date,jsonb)` → uuid | `…rls.sql:607-703` | `:856`, `:859` | нет — только через обёртку ниже |
| `public.transition_equipment_list_status(uuid,text,text)` → jsonb | `…rls.sql:705-853` | `:857`, `:860` | `lists/api.ts` |
| `public.create_equipment_list_document(text,text,text,text,text,date,date,jsonb)` → uuid | `…list_document_fields.sql:12-51` | `:53-59` | `lists/api.ts` |
| `public.update_equipment_list_document(uuid,text,text,text,text,text,date,date,jsonb)` → uuid | `migrations/20260819131611:3-120` | `:122-128` | `lists/api.ts` |
| `public.update_equipment_model_and_unit(uuid, 9×text, integer default null, timestamptz default null)` → jsonb | **действующая версия — `migrations/20260820183210:30-109`**; предыдущие: `…equipment_model_editing.sql:3-82`, `migrations/20260820163924:7-76` | `20260820183210:114-116` | `equipment/api.ts` |
| `public.count_equipment_model_units(text, text)` → integer | `migrations/20260820172928:7-18` — `sql stable` **`security invoker`** | `20260820172928:22-23`, `20260820173459:5` | `equipment/api.ts` |

### 6.1 `create_equipment_list_with_items` — что проверяет и что нет

Что **проверяется** (`…rls.sql:625-653`):

| Проверка | Строка |
|---|---|
| вызывающий — член приложения (`is_app_member()`) | `:625-627` |
| имя после `btrim` непусто | `:628-630` |
| `p_list_mode in ('specific','abstract')` | `:631-633` |
| даты либо обе NULL, либо start ≤ end | `:634-637` |
| `p_items` — непустой JSON-массив | `:638-640` |
| у каждой позиции `serialized`/`quantity` `equipment_id` — валидный UUID **и** такая строка есть в `public.equipment` | `:641-653` |

Что **НЕ проверяется**:

1. **`requested_count` против фактического наличия — НЕ проверяется.** Ни здесь, ни в
   `update_equipment_list_document`. Можно сохранить черновик и подтвердить бронь на
   9999 единиц оборудования, которого на складе три. Единственный физический гейт —
   переход `confirmed → issued` (`…rls.sql:771-783`). До выдачи в базе спокойно лежит
   нереализуемая бронь, а при `confirmed` она ещё и **вычитается из доступного остатка
   для чужих списков** (`reservation_shortages` `:373-393` считает `reserved` по
   `confirmed`-спискам) — то есть фиктивная бронь блокирует склад другим.
2. **Соответствие `brand/model/type/subtype` реальной строке `equipment` — НЕ
   проверяется.** Текст берётся из клиентского JSON дословно (`:692-695`), даже когда
   `equipment_id` присутствует и проверен. См. §8.
3. `tracking_mode` не валидируется в теле — только CHECK-ограничением таблицы (`:109-110`);
   отказ придёт сырым текстом нарушения ограничения.
4. Позиции `planned` не проверяются вообще: `:641-653` фильтрует только `serialized`/`quantity`.
   При этом вставка (`:690-691`) использует **более слабое** регулярное выражение
   `^[0-9a-f-]{36}$`, чем валидация (`:646`, полный UUID-шаблон). `planned`-позиция с
   произвольной 36-символьной строкой из дефисов и hex пройдёт в `equipment_id` и упадёт
   на CHECK `:112-116` — снова сырая ошибка вместо внятной.
5. **Пустые `brand/model/type/subtype` проходят.** Вставка кладёт `btrim(item->>'brand')`
   и так далее (`:692-695`). Различать надо два случая:
   - **ключа в JSON нет** → `item->>'brand'` даёт NULL → `btrim(NULL)` = NULL →
     нарушение NOT NULL (`:100-103`), сырой текст ошибки;
   - **ключ есть, но значение пустое или из одних пробелов** → `btrim('')` = `''`,
     NOT NULL удовлетворён, и в таблицу **ложится пустая строка**. Ни CHECK, ни
     `nullif(…, '')` этот случай нигде не ловят.

   Это отдельная дыра целостности, а не частный случай NOT NULL: пустая строка потом
   становится ключом группировки в `reservation_shortages` (`lower(btrim(brand))` и
   далее, §8), и позиция склеивается со всеми другими пустыми. Показательно, что
   backfill в том же файле пустые как раз отсеивает —
   `nullif(btrim(item->>'brand'), '') is not null` и три такие же строки (`:298-301`);
   RPC этой проверки не унаследовал. То же в `update_equipment_list_document`
   (`migrations/20260819131611:109-112`).
6. Дубли: две `serialized`-позиции с одним `equipment_id` в одном `p_items` → нарушение
   `unique (list_id, equipment_id)` (`:117`). Для `planned` дублей нет вообще (§1.6).
7. Даты в прошлом, длина имени, разумность `count` — не ограничены ничем.

Обёртка `create_equipment_list_document` (`…list_document_fields.sql:12-51`) добавляет
ровно `client_name` и `venue` (`:39-43`) и ничего не валидирует сверх базовой RPC.

### 6.2 `update_equipment_list_document` — та же логика для правки

`migrations/20260819131611:24-65` повторяет весь набор проверок создания и добавляет
две своих: список существует (`:28-36`, с `for update`) и `reservation_status = 'draft'`
(`:37-39`). Далее полностью **пересоздаёт** состав: `delete from equipment_reservation_items
where list_id = …` (`:98-99`) и вставляет заново (`:101-116`). Проверки `requested_count`
против наличия здесь тоже нет.

Важно: функция не проверяет, что правит **свой** список — только что он черновик. В паре
с `equipment_lists_update_for_members` (§3, замечание 1) это значит: любой член
приложения может переписать чужой черновик.

### 6.3 `transition_equipment_list_status` — единственное место, где сверяется физика

`…rls.sql:729-735` — допустимы ровно три маршрута: `draft→confirmed`, `confirmed→issued`,
`issued→returned`. Возврата назад и отмены нет — **отменить подтверждённую бронь
невозможно ни одной операцией репозитория**.

- `confirmed` (`:737-752`): требует обе даты (`:738-740`); считает дефицит и кладёт его в
  `shortage_snapshot` (`:741-744`), но **дефицит не блокирует подтверждение** — он
  информационный, что прямо заявлено комментарием `:319-320`.
- `issued` (`:754-807`): `list_mode` должен быть `specific` (`:755-757`); ни одной
  `planned`-позиции (`:758-763`); блокировка строк `equipment` через `for update of e`
  в порядке `order by e.id` (`:764-769`, защита от дедлоков); проверка наличия —
  `serialized` должно быть `available`, `quantity` должно быть `available` и
  `count >= requested_count` (`:771-783`); затем `serialized` → `issued` (`:788-793`),
  `quantity` → `count - requested_count`, и если стало 0 → `unavailable` (`:794-800`).
- `returned` (`:809-839`): зеркально возвращает `available` и прибавляет `count`
  (`:820-832`). **Возврат не проверяет, что вернули столько же:** прибавляется текущий
  `requested_count`, а список после выдачи защищён от правки состава триггером
  (`:537-546`) — так что практически сходится, но при ручной правке в базе — нет.

### 6.4 `update_equipment_model_and_unit` — массовое обновление под оптимистической блокировкой

Действующая версия — `migrations/20260820183210:30-109` (§2.4); ниже якоря по ней.

`:45-47` — требует роль `technician/manager/admin`. `:64-79` — обязательны
brand/model/type/subtype, `availability` из четырёх значений, `count >= 0` (последняя
проверка выполняется только когда `p_count` реально прислан).

Ключевое поведение (`:81-92`): «модельные» поля (brand, model, type, subtype,
technicalspecification, lengthinmeters, description) обновляются **у всех строк с тем же
`lower(btrim(brand))`/`lower(btrim(model))`**, а не только у выбранной. Функция
возвращает `updated_model_units` (`:94`, `:106`) — сколько строк задело.

**Счётчик доезжает до пользователя (закрыто в с5).** Клиент берёт из ответа не только
`error`, но и `data` (`equipment/api.ts`), достаёт `updated_model_units`
проверками, а не приведением типа (`readUpdatedModelUnits`, `:327-331`), и показывает
это число в сообщении об успехе (`EquipmentDrawer.tsx`). Поля нет или оно не
число — сообщение выводится **без цифры**, выдуманное не подставляется. В журнал
движений переименование модели по-прежнему не попадает (§5): триггер слушает только
`count` и `availability`.

**Три с5-правки в поведении, которые надо держать вместе:**

1. **Версия карточки сверяется** (`:59-62`). Клиент шлёт `p_expected_updated_at` —
   тот `updated_at`, на котором открыл карточку (`equipment/api.ts`,
   `EquipmentDrawer.tsx`). Расхождение отменяет правку целиком, ни одно поле не
   записано, код ошибки — `40001`. `null` значит «сверить нечем».
2. **`p_count` необязателен** (`:33`, `:100`). Серийная карточка количеством не
   управляет и параметр не отправляет вовсе (`EquipmentDrawer.tsx`) — `count`
   остаётся прежним, `before = after`, и триггер `trg_equipment_movement_history`
   строку не пишет. Раньше принудительная `1` плодила фантомные «Изменено количество».
3. **Пустая локация не затирает прежнюю** (`:99`, миграция `20260820163924`).
   Клиент при этом называет пустое поле сам, до запроса
   (`EquipmentDrawer.tsx`), чтобы отказ не пришёл безымянным.

Предварительный счёт единиц модели, который карточка показывает **до** сохранения,
с с5 тоже считает база — RPC `count_equipment_model_units` по тому же
`lower(btrim(...))` (`equipment/api.ts`, вывод `EquipmentDrawer.tsx`).
Прежний клиентский `.eq` по сырым строкам занижал оценку на записях с пробелами
и другим регистром.

---

## 7. Индексы

| Индекс | Таблица / выражение | Файл:строка |
|---|---|---|
| `idx_equipment_lists_list_mode` | `equipment_lists(list_mode)` | `2025-01-10…:21` |
| `idx_mount_points_event` | `mount_points(event_id)` | `2025-08-06…:15` |
| `idx_events_archived` | `events(is_archived)` | `2025-08-06…:16` |
| `equipment_reservation_items_list_idx` | `(list_id)` | `…rls.sql:156-157` |
| `equipment_reservation_items_equipment_idx` | `(equipment_id) where not null` | `…rls.sql:158-160` |
| `equipment_reservation_items_model_idx` | **`(lower(btrim(brand)), lower(btrim(model)), lower(btrim(type)), lower(btrim(subtype)))`** — обслуживает джойны `reservation_shortages` | `…rls.sql:161-164` |
| `equipment_lists_reservation_window_idx` | `(reservation_status, reservation_start, reservation_end) where status in ('confirmed','issued')` | `…rls.sql:165-167` |
| `equipment_lists_created_by_idx` | `(created_by)` | `…rls.sql:168-169` |
| `equipment_movements_equipment_changed_idx` | `(equipment_id, changed_at desc)` | `…rls.sql:170-171` |
| `equipment_movements_list_idx` | `(list_id) where not null` | `…rls.sql:172-174` |
| `reservation_status_history_list_changed_idx` | `(list_id, changed_at desc)` | `…rls.sql:175-176` |
| `equipment_lists_mount_point_id_idx` | `(mount_point_id) where not null` | `…hardening.sql:38-40` |
| `equipment_lists_status_changed_by_idx` | `(status_changed_by) where not null` | `…hardening.sql:41-43` |
| `equipment_movements_changed_by_idx` | `(changed_by) where not null` | `…hardening.sql:44-46` |
| `equipment_reservation_items_created_by_idx` | `(created_by)` | `…hardening.sql:47-48` |
| `reports_event_id_idx` | `(event_id) where not null` | `…hardening.sql:49-51` |
| `reservation_status_history_changed_by_idx` | `(changed_by) where not null` | `…hardening.sql:52-54` |

Шесть последних — закрытие предупреждения Supabase `unindexed_foreign_keys`
(`…hardening.sql:37`, подтверждено `docs/handoffs/2026-08-19-0-audit.md:75`).

**В репозитории индексов на `equipment` не было ни одного — но в проде их восемь**
(выписка с2, `baseline.sql`, §3):

| Индекс | Выражение |
|---|---|
| `idx_equipment_availability` | `(availability)` |
| `idx_equipment_brand` | `(brand)` |
| `idx_equipment_location` | `(location)` |
| `idx_equipment_model` | `(model)` |
| `idx_equipment_serialnumber` | `(serialnumber)` — **btree, НЕ unique** |
| `idx_equipment_subtype` | `(subtype)` |
| `idx_equipment_type` | `(type)` |
| `idx_equipment_search` | **GIN** по `to_tsvector('russian', model \|\| ' ' \|\| brand \|\| ' ' \|\| serialnumber \|\| ' ' \|\| coalesce(description,''))` |

Девятый заведён в с5 миграцией (§2.4):

| Индекс | Выражение | Файл |
|---|---|---|
| `equipment_model_normalized_idx` | `(lower(btrim(brand)), lower(btrim(model)))` | `migrations/20260820180641:6-7` |

Два замечания, которые стоит держать в голове:

- **Полнотекстовый GIN-индекс существует, но продукт его не использует.** Поиск в
  каталоге идёт через `ilike`-фильтры, а не через `to_tsvector/@@`, — значит этот индекс
  сейчас не работает ни на один запрос и только удорожает запись. Либо переводить поиск
  на него, либо убирать; занесено в backlog.
- **Индекс под нормализованное сопоставление модели на `equipment` появился в с5.**
  `equipment_model_normalized_idx` (`migrations/20260820180641`) покрывает предикат
  `lower(btrim(brand))` + `lower(btrim(model))`, по которому работают
  `count_equipment_model_units`, `update_equipment_model_and_unit` и `reservation_shortages`.
  До него каждый вызов `reservation_shortages` шёл последовательным чтением `equipment`
  (~1307 буферов, замер в комментарии миграции `:5`). Оговорка: индекс двухколоночный,
  а `reservation_shortages` группирует по **четырём** ключам, добавляя `type` и `subtype`
  (`…rls.sql:361-372`) — совпадение частичное, префикс из двух колонок работает,
  полного покрытия четвёрки на складе по-прежнему нет.

---

## 8. Денормализация состава списков — архитектурный риск

`equipment_reservation_items` хранит `brand`, `model`, `type`, `subtype` **текстом**
(`…rls.sql:100-103`), рядом с `equipment_id`. Текст пишется дословно из клиентского
JSON — `…rls.sql:692-695` (создание) и `migrations/20260819131611:109-112` (правка).
Совпадение текста с реальной строкой `equipment`, на которую указывает `equipment_id`,
**не проверяется нигде**.

`public.reservation_shortages` (`…rls.sql:321-448`) считает дефицит **джойном по этому
тексту**, а не по `equipment_id`:

- `target_groups` (`:344-360`) — группировка позиций списка по
  `lower(btrim(brand)), lower(btrim(model)), lower(btrim(type)), lower(btrim(subtype))`;
- `inventory` (`:361-372`) — ёмкость склада, та же четвёрка ключей, `sum(count)` только
  по строкам с `availability = 'available'` (`:367`);
- `other_reservations` (`:373-393`) — чужие `confirmed`-брони с пересечением дат
  (`daterange … && …`, `:389-390`), та же четвёрка ключей;
- склейка — `left join … using (brand_key, model_key, type_key, subtype_key)` (`:444-446`).

Только `conflicts` (`:395-426`) джойнит по `equipment_id` — и то лишь для `serialized`.

**Последствия расхождения текста:**

| Что случилось | Что видит пользователь |
|---|---|
| В позиции опечатка / лишний пробел внутри слова / другой регистр букв, не снимаемый `lower(btrim())` | `left join inventory` не находит группу → `capacity = 0` → фантомная нехватка на всю запрошенную величину |
| Модель переименована через `update_equipment_model_and_unit` **после** сохранения списка | все ранее сохранённые списки этой модели становятся «дефицитными»: склад переехал на новый текст, позиции остались на старом |
| Два разных написания одной модели на складе | ёмкость расщепляется на две группы, каждая считается отдельно |
| Позиция названа так же, как чужая модель | склейка с чужой группой, ложно завышенная ёмкость |

Причём переименование модели — операция массовая и бесследная (§6.4, §5). Это делает
риск не теоретическим: одна правка каталога тихо ломает расчёт всех исторических броней.

**Чем закрывать (не сделано):** считать ёмкость и брони по `equipment_id`, а текст
хранить как снимок для печати; либо ввести суррогатный `model_id` в `equipment` и
ссылаться на него; либо на худой конец триггер, сверяющий текст позиции с
`equipment` при вставке.

---

## 9. `tracking_mode` и `inventory_code` — это НЕ колонки

`Equipment.tracking_mode` и `Equipment.inventory_code` объявлены в
`src/react/features/equipment/types.ts`, но **колонок с такими именами в базе нет**.
Обе величины — результат **разбора строки `serialnumber`** на лету. Это единственное
место, где доменный тип добавляет к схеме то, чего в ней нет: остальные поля
`Equipment` приходят из `Tables<'equipment'>` как есть (`types.ts`, §1.4).

**Парсер №1 (TypeScript):** `src/react/features/equipment/api.ts`, применяется в
`normalizeEquipment` ко всем прочитанным строкам (`:116`, `:140`, `:157`, `:172`, `:371`).

Строка считается `quantity`, если (`:26-30`): `count > 1`, **или** начинается с `AUTO-`,
**или** начинается с `QTY::`, **или** попадает в набор плейсхолдеров
(`:20` — `'', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-'`), **или**
состоит из одних нулей (`/^0+$/`). Иначе — `serialized`.
`inventory_code` вытягивается из префиксов `QTY::CODE::` / `QTY::AUTO::` (`:32-36`).
При записи обратно: `storedQuantityIdentifier()` (`:48-53`) кладёт `QTY::CODE::<код>`
либо `QTY::AUTO::<uuid>`; вызов — `createEquipment` (`:221-223`).

**Парсер №2 (SQL):** `scripts/2026-08-19_reservations_history_rls.sql:247-255` — тот же
набор условий в backfill'е `tracking_mode` для `equipment_reservation_items`.

**Риск расхождения — не гипотетический, расхождение уже есть.**
TS работает с **обрезанной** строкой: `const storedIdentifier = row.serialnumber.trim()`
(`api.ts`; `?.` больше не нужен — схема объявляет колонку not null), и все проверки
идут по ней. SQL обрезает **только** в проверке
плейсхолдеров (`lower(btrim(e.serialnumber)) in (…)`, `:251`), а `like 'QTY::%'` (`:249`),
`like 'AUTO-%'` (`:250`) и `~ '^0+$'` (`:252`) применяет к **сырому** значению.
Значение `' QTY::CODE::17'` (ведущий пробел): TS → `quantity`, SQL → `serialized`.
Аналогично `' 000'`.

Второе расхождение: `inventory_code` в SQL **не вычисляется вообще**. Понятие живёт
только в браузере.

Третье: TS-парсер применяется к каждому чтению, SQL-парсер отработал единожды в
backfill'е. Новые записи получают `tracking_mode` из клиентского JSON в RPC
(`…rls.sql:696`) — то есть от парсера №1. Значит, поле `equipment_reservation_items.tracking_mode`
для старых строк вычислено правилом SQL, для новых — правилом TS. Одна таблица, два
источника истины.

**Чем закрывается:** нормальная колонка `tracking_mode` в `equipment` с бэкфиллом и
CHECK; либо одна SQL-функция-парсер, вызываемая и из бэкфилла, и через RPC, а клиент
её результат только читает.

---

## 10. Битая кодировка в SQL-скрипте

`scripts/2026-08-19_reservations_history_rls.sql:186`:

```sql
    when availability in ('В наличии', 'available', 'В н�личии') then 'available'
```

Проверено `hexdump -C`: третий литерал содержит байты `d0 92 20 d0 bd **ef bf bd** d0 bb
d0 b8 d1 87 d0 b8 d0 b8` — на месте буквы «а» (`d0 b0`) стоит `EF BF BD`, то есть
U+FFFD REPLACEMENT CHARACTER. Файл пережил round-trip через кодировку, потерявшую
символ.

Строка входит в блок нормализации статусов оборудования (`:180-192`), где `case`
заканчивается **`else 'unavailable'`** (`:190`).

**Последствие.** Литерал `'В н�личии'` добавлен намеренно — значит, в базе такое
искажённое значение реально встречалось. Но исправление символа при переносе файла
случайно, и нет гарантии, что байты в файле совпали с байтами в базе. Любая строка
`equipment`, чей `availability` не сматчился ни с одним литералом, молча получает
`'unavailable'` (`:190`) — то есть **пропадает из доступного склада без единого
предупреждения**. При этом `equipment_movements` фиксирует такой переход как
`status_normalized` (`:205-207`), так что улики есть, но только если кто-то догадается
туда посмотреть.

Второе последствие: правка этой строки задним числом **ничего не чинит** — блок
нормализации идемпотентен (`:198` — `where e.availability is distinct from n.new_status`)
и повторный прогон уже нормализованные строки не тронет. Разбор надо делать запросом по
`equipment_movements` (`movement_type = 'status_normalized'`, `metadata->>'migration'`).

Отдельно: клиентская эвристика `isAvailable` до сих пор понимает **русские** статусы
(`status.startsWith('в н')`, `status.includes('диагност')`, `status.startsWith('не ')`)
наравне с `'available'`/`'unavailable'`/`'issued'`. В с5 она переехала вместе с моделью
групп каталога — теперь это `features/lists/catalogGroups.ts` (чистый перенос,
поведение не менялось). Второе место с тем же разбором — `toEquipmentAvailability`
в `features/equipment/availability.ts`, но оно работает иначе: неопознанное
значение остаётся неопознанным и показывается как есть (`:36-40`), а не подменяется
«недоступно».

**Спор закрыт выпиской с2: прав CHECK, эвристика — мёртвый код.** В проде на 1481 строку
встречаются ровно три значения `availability`, все английские:

| Значение | Строк |
|---|---|
| `available` | 1475 |
| `unavailable` | 5 |
| `diagnostics` | 1 |
| `issued` | 0 |

Русских статусов не осталось ни одного — нормализация прошла полностью. Разбор русских
строк в `ListEditorPage.tsx` можно удалять: он не срабатывает и при этом маскирует
опечатку в английском значении (незнакомая строка молча считается недоступной).
Занесено в backlog.

---

## 11. Идемпотентность повторного прогона `…rls.sql`

Проверено по тексту (прогон не выполнялся):

| Блок | Строки | Идемпотентен? |
|---|---|---|
| Нормализация статусов + журнал | `:180-209` | **да** — `where old_status is distinct from new_status` (`:209`) и `:198` |
| Backfill из `equipment_ids` | `:236-263` | **да** — `on conflict (list_id, equipment_id) do nothing` (`:263`), `equipment_id` там всегда not null |
| Backfill из `equipment_items` | `:265-302` | **НЕТ для `planned`** — `on conflict (list_id, equipment_id)` (`:302`) не срабатывает при `equipment_id is null` (NULL ≠ NULL), а `planned`-строки пишутся именно с NULL (`:271-275`). Повторный прогон **удвоит** все планируемые позиции во всех списках |
| Backfill истории | `:304-317` | **да** — `where not exists (…)` (`:315-317`) |
| DDL, политики, гранты | `:96-176`, `:864-1064` | да — `if not exists` / `drop policy` в цикле / `revoke`+`grant` |

Практический вывод: файл **нельзя прогонять повторно** без предварительной очистки
`planned`-строк.

---

## 12. Правила изменения схемы

1. **Только миграцией в `supabase/migrations/`.** Имя — `YYYYMMDDHHMMSS_краткое_описание.sql`,
   как у девяти существующих. Никаких новых файлов в `scripts/` — этот каталог
   объявляется **архивом**, он не воспроизводит текущее состояние и содержит как
   минимум один нерепрогоняемый файл (§11).
2. **Идемпотентность обязательна:** `if not exists`, `create or replace`,
   `drop policy if exists` перед `create policy`. Так сделаны все девять миграций и
   четыре скрипта 2026-08-19.
   **Оговорка с с5:** `create or replace` не годится, когда меняется сигнатура функции —
   получаются два overload'а одного имени, и PostgREST отвечает `PGRST203`. Тогда
   впереди ставится `drop function if exists` с полным списком типов старой сигнатуры
   (`migrations/20260820183210:28`), а **гранты выдаются заново** — `drop` уносит их
   с собой, и `revoke … from public` не заменяет явного `revoke execute … from anon`
   (`:114-116`, разбор в §3.1).
3. **Применённое руками — фиксировать задним числом.** Если что-то прогнали в
   SQL Editor, в тот же день создаётся миграция с тем же SQL, помеченная комментарием
   «применено вручную <дата>». Иначе следующий агент этого изменения не увидит.
4. **Новая функция — `set search_path = ''`, все ссылки на объекты — с полной схемой**
   (`public.equipment`, а не `equipment`). Проверять права явно:
   `revoke all … from public, anon` + `grant execute … to authenticated`. Ни одна функция
   в репозитории от этого правила не отступает — не отступать и дальше.
5. **`security definer` — только в схеме `private` и только для того, что клиент не
   должен уметь подделать** (проверка роли, запись журнала). Публичные RPC — `invoker`.
   Не трогать `private.is_app_member()` / `private.has_any_role()` без прочтения §4.1.
6. **После добавления/изменения RPC** — `notify pgrst, 'reload schema'` в конце миграции
   (образец: `…rls.sql:1066`), иначе PostgREST вернёт `PGRST202`.
7. **Baseline снят (с2) — держать его в актуальном состоянии.**
   `supabase/migrations/00000000000000_baseline_remote_schema.sql` описывает прод на
   2026-08-20. Он НЕ обновляется сам: правка схемы мимо миграции делает его враньём,
   а врущая дока опаснее отсутствующей. Порядок такой — изменение оформляется обычной
   миграцией `YYYYMMDDHHMMSS_*.sql`, а baseline пересниматься не обязан: он описывает
   стартовую точку, поверх которой миграции накатываются по порядку. Переснимать его
   имеет смысл только после большой ручной правки в дашборде.
8. **Правки RLS-политик**: помнить про цикл `…rls.sql:864-880`, который дропает всё на
   девяти таблицах. Пока этот файл кто-то может прогнать повторно, любая политика,
   заведённая миграцией, — временная.

---

## Не покрыто

**Закрыто в сессии 2** (было пунктами 1–8 списка сессии 1): реальная схема прода,
порядок применения `scripts/` и `migrations/`, права `authenticated` на `users` и
legacy-таблицы, действующая политика удаления списков, тела трёх унаследованных функций
и навешенные на них триггеры, «таблица-призрак» `technical_duties`, тип `users.role`,
тип и внешний ключ `equipment_lists.mount_point_id`, наличие индексов на `equipment`.
Всё перечисленное теперь выписка из базы, а не догадка.

Остаётся не покрытым:

1. **`equipment_lists.type`** — колонка заполняется литералом `'custom'` (`…rls.sql:678`)
   и читается клиентом (`lists/api.ts,56`), но нигде не используется в логике. Какие
   ещё значения там встречаются, по данным сказать нельзя: таблица в проде пуста.
2. **Реальное поведение при конкурентных транзакциях** — блокировки `for update`
   расставлены (`…rls.sql:726`, `:764-769`, `:810-815`; `migrations/20260819131611:32`),
   но нагрузочно/интеграционно не проверялись. Автотестов и CI нет.
3. **Владельцы таблиц и функций `private.*`.** Известно, что все пять функций `private.*`
   объявлены `security definer` с `search_path = ''`, а `force row level security` не
   включён ни на одной таблице. Но конкретный владелец (а значит — обходит ли `definer`
   политики полностью) выпиской с2 не снимался. Закрывается
   `select relname, relowner::regrole, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace`
   и `select proname, proowner::regrole from pg_proc where pronamespace = 'private'::regnamespace`.
4. **Утверждение `docs/handoffs/2026-08-19-0-audit.md:81` про 11 дублирующихся нормализованных
   серийников** — в с2 не перепроверялось запросом; остальные его утверждения о данных
   подтвердились (1481 позиция, старые списки отсутствуют, legacy-таблицы почти пусты:
   `events` — 4 строки, `mount_points` — 9, `reports` — 0).
5. **Данные не в схеме `public`** — настройки Auth (политика паролей, MFA), содержимое
   `storage`, конфигурация Realtime. Выписка с2 покрывала только `public` и `private`.

### Расхождения схемы с репозиторием (найдены выпиской с2)

**Состояние на конец с5: из пяти пунктов закрыт один — последний
(`serialnumber` / TS). Остальные четыре не тронуты: ни `users.id` без FK,
ни дубль внешнего ключа `mount_points`, ни четыре триггера пересчёта, ни
неиспользуемый GIN-индекс в с5 не правились и остаются как есть.**

- **`public.users.id` не связан с `auth.users`.** Колонка объявлена
  `uuid not null default gen_random_uuid()` и внешнего ключа на `auth.users(id)` не
  имеет — при том что вся авторизация построена на совпадении этих идентификаторов
  (`private.is_app_member()` сверяет `u.id = auth.uid()`). Совпадение держится
  соглашением, а не базой: профиль с «неправильным» `id` вставится молча, а его
  владелец просто никогда не пройдёт проверку членства. Соседние таблицы ссылаются на
  `auth.users(id)` напрямую (`equipment_lists.created_by`,
  `equipment_reservation_items.created_by`, `*.changed_by`) — то есть в схеме
  сосуществуют две разные привязки к пользователю.
- **Дубль внешнего ключа на `mount_points`.** `mount_points_event_id_fkey` и
  `mount_points_event_fk` — одна и та же пара колонок, одно и то же
  `on delete cascade`. Второй заведён `scripts/2025-08-06_mount_points_fk.sql`, первый
  существовал раньше. Вреда нет, кроме двойной проверки на каждой вставке.
- **Четыре триггера пересчёта вместо одного** на `mount_points` — разбор в §5.
- **GIN-индекс полнотекстового поиска `idx_equipment_search` существует, но не
  используется** ни одним запросом продукта — §7. **Не тронут в с5.**
- ~~**`equipment.serialnumber` объявлен `not null`,** а TypeScript-тип считает поле
  необязательным~~ — **закрыто в с5.** Типы генерируются из схемы
  (`src/react/lib/database.types.ts`, клиент — `createClient<Database>`), доменные
  типы выводятся из `Tables<>`, и nullable у `serialnumber` теперь не рассинхрон, а
  задокументированное сужение нормализации. Разбор — §1.4.

### Расхождения документации с кодом (обнаруженные)

- **`README.md:53`** — «Редактирование и удаление исторических записей пока отключены
  до нормализации статусов и отдельной проверки RLS-политик». **Ложь.** Редактирование
  оборудования работает через `update_equipment_model_and_unit`
  (`equipment/api.ts`, вызов из `EquipmentDrawer.tsx`); правка списков — через
  `update_equipment_list_document` (`lists/api.ts`); удаление списка —
  `deleteEquipmentList` (`lists/api.ts`, вызов `ListsPage.tsx`). Все три пути
  живые и подкреплены серверными объектами.
- **`docs/handoffs/2026-08-19-0-audit.md:73`** — «Убраны слишком широкие прямые права … на таблицу
  пользователей» подано как свершившийся факт. В репозитории это состояние
  **не определено** — оно зависит от порядка прогона (§2.1).
- **`docs/handoffs/2026-08-19-0-audit.md:85`** и **`:81`** сами признают дыру с уникальностью серийного
  номера. Формулировка «теоретическая гонка» смягчает вдвое — и половину этой дыры
  с5 закрыл, а половину нет. Разводить их обязательно.

  **Что осталось: `UNIQUE`-ограничения на `equipment.serialnumber` в проде НЕТ.**
  Есть только обычный btree `idx_equipment_serialnumber` (§1.4, §7). Единственная
  преграда — клиентская `serialNumberExists` (`equipment/api.ts`, запрос
  `.ilike`), вызываемая из `checkSerial()` (`EquipmentCreatePage.tsx`) перед
  `createEquipment` (`:147`). Две одновременные вкладки пройдут проверку обе.
  Это по-прежнему нарушение правила 1 CLAUDE.md, и место ему — в backlog.

  **Что закрыто в с5: отказ проверки больше не читается как «дубля нет».** Результат
  проверки стал типом из четырёх значений, где `'failed'` — отдельное состояние
  «мы не знаем» (`EquipmentCreatePage.tsx`). `catch` ставит именно его
  (`:119-126`), а `handleSubmit` при `'failed'` **останавливает сохранение** и пишет
  «Не удалось проверить серийный номер на дубли. Запись не сохранена — повторите
  попытку.» (`:137-143`). Раньше `catch` возвращал `false`, то есть разрешал вставку
  при любом сбое одного запроса. Кнопку `'failed'` намеренно не блокирует (`:69-71`):
  отправка перепроверит номер сама, иначе единичный сетевой сбой запирал бы форму.

  Отдельно про регистр и подстановочные знаки: проверка регистронезависимая (`.ilike`),
  и с с5 шаблон экранируется — `%`, `_` и `\` теряют спецсмысл
  (`escapeLikePattern`, `equipment/api.ts`, применение `:263`). До этого
  серийник `AB_1234` совпадал с `AB-1234` и давал ложный дубль. INSERT кладёт
  `input.serialnumber?.trim()` (`api.ts`, `:231`), так что «sn-001» при
  существующем «SN-001» проверка **поймает**. Разойтись значения могут только в
  гонке двух вкладок — то есть ровно там, где нужен `UNIQUE`.
