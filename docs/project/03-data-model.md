# 03-data-model — ARGO Warehouse

Что лежит в базе, кто имеет к этому доступ и как это менять.

Все якоря вида `файл:N` проверены чтением файла. Пути даны от корня репозитория
`warehouse.argomedia.uz`.

---

## 0. Главное предупреждение: схемы в репозитории нет

**DDL базовых таблиц `users`, `equipment`, `equipment_lists`, `events`, `mount_points`,
`reports` в репозитории ОТСУТСТВУЕТ.** Ни `create table`, ни дампа. Есть только
`alter table … add column if not exists` поверх уже существующих таблиц.

Следствия, которые обязан учитывать любой агент:

- Прод-схема из git **не восстанавливается**. Развернуть проект с нуля по репозиторию нельзя.
- Любое утверждение «в таблице `equipment` есть колонка X» ниже — это утверждение про
  **TypeScript-тип** `src/react/features/equipment/types.ts:1-18` или про **колонку,
  упомянутую в SQL-запросе**, а не выписка из базы. Типы и реальность могут расходиться:
  `Equipment.tracking_mode` и `Equipment.inventory_code` (`types.ts:6-7`) колонками
  **не являются** вообще (см. §9).
- Механизма применения SQL в репозитории нет: нет `supabase/config.toml`
  (в `supabase/` только каталог `migrations/`), нет пакета `supabase` в `package.json`
  (там из супабейсного только `@supabase/supabase-js` — `package.json:17`), нет `.github/`.
  Всё, что описано ниже, кто-то прогонял руками в SQL Editor. Что именно прогнали и в
  каком порядке — **не установлено**.

**Чем закрывается:** `supabase db pull` (после `supabase link`) или `pg_dump --schema-only`.
До тех пор — все разделы ниже читать как реконструкцию, а не как выписку.

**Как проверить фактическое состояние прода** (три запроса, без них спорить о схеме бессмысленно):

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public' order by 1,2;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1,2,3;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated') order by 1,2;
```

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

Голый `api.ts` без префикса разрешается по контексту абзаца: в разделах про каталог
и оборудование это `src/react/features/equipment/api.ts`, в разделах про списки —
`src/react/features/lists/api.ts`. Механическая проверка якорей (`/doc-audit`) обязана
знать обе таблицы, иначе она пометит эти ссылки как нерезолвящиеся.

## 1. Таблицы

Столбец «Откуда факт»: `DDL` — таблица реально создана файлом в репозитории;
`alter` — файл только добавляет колонку к таблице неизвестного происхождения;
`TS` — колонка известна лишь по TypeScript-типу или по тексту запроса.

### 1.1 Живые таблицы

«Живая» здесь означает «участвует в работе продукта», а не «клиент к ней ходит».
Столбец «Доступ клиента» разводит два разных случая: таблица, которую браузер
называет напрямую через PostgREST (`.from(…)`), и таблица, которую браузер не
называет ни разу — её читают и пишут только RPC и триггеры на сервере.

| Таблица | Доступ клиента | Откуда факт |
|---|---|---|
| `public.equipment` | прямой `.from('equipment')` — `equipment/api.ts:74, 114, 134, 152, 183, 211, 225, 268` | alter + TS; базового DDL нет |
| `public.equipment_lists` | прямой `.from('equipment_lists')` — `lists/api.ts:67, 78, 128, 136, 209` | alter + TS; базового DDL нет |
| `public.equipment_movements` | прямой `.from('equipment_movements')` — `equipment/api.ts:306`, только чтение (грант тоже только `select`, `…rls.sql:1061`) | **DDL есть**: `…rls.sql:135-154` |
| `public.reservation_status_history` | прямой `.from('reservation_status_history')` — `lists/api.ts:250`, только чтение (грант только `select`, `…rls.sql:1060`) | **DDL есть**: `…rls.sql:120-133` |
| `public.equipment_reservation_items` | **клиент не обращается ни разу**, хотя мог бы: полный CRUD-грант (`…rls.sql:1059`) и четыре RLS-политики (`…rls.sql:941-978`) на месте. Состав списка пишется только внутри RPC (`…rls.sql:684-699`, `migrations/20260819131611:98-116`), а обратно приходит агрегатом из `reservation_shortages` (`lists/api.ts:225`) | **DDL есть**: `scripts/2026-08-19_reservations_history_rls.sql:96-118` |
| `public.users` | **клиент не обращается ни разу и не может**: права `authenticated` отозваны (`…hardening.sql:6`). Таблицу читают только `security definer`-функции `private.*` — см. §4.1 | только политики и гранты; DDL нет |

Практический вывод: поверхность прямых обращений браузера — ровно **четыре таблицы**
(`equipment`, `equipment_lists`, `equipment_movements`, `reservation_status_history`)
плюс пять RPC. Всё остальное в базе живёт за серверными функциями.

### 1.2 Legacy-таблицы (клиенту больше не доступны)

| Таблица | Статус |
|---|---|
| `public.events` | legacy; права у `authenticated` отозваны — `scripts/2026-08-19_security_performance_hardening.sql:5` |
| `public.mount_points` | legacy; там же |
| `public.reports` | legacy; там же |

`README.md:13` подтверждает: «События, точки монтажа, отчёты, управление ролями и
демонстрационный UI Kit из старой версии не входят в новый продукт».
`AUDIT-2026-08-19.md:70` утверждает, что эти таблицы **пусты** — это утверждение про
данные прода, из репозитория не проверяется.

Проверено grep'ом по `.from(` во всём `src/react`: единственные имена таблиц —
`equipment`, `equipment_lists`, `equipment_movements`, `reservation_status_history`.
Ни `users`, ни `events`, ни `mount_points`, ни `reports`, ни
`equipment_reservation_items` не упомянуты ни разу — что и зафиксировано в §1.1.

### 1.3 Таблица-призрак

`scripts/2026-08-19_security_performance_hardening.sql:12` вызывает
`alter function public.validate_technical_duties_status() set search_path = ''`.
Функция с таким именем подразумевает таблицу вроде `technical_duties`, которой нет
нигде больше в репозитории. Сколько ещё таких таблиц в проде — **не установлено**
(закрывается запросом из §0).

### 1.4 `public.equipment` — колонки

Базового DDL нет. Колонки, подтверждённые SQL-запросами и TS-типом:

| Колонка | Откуда факт |
|---|---|
| `id` uuid | `…rls.sql:242`, `types.ts:2` |
| `brand`, `model`, `type`, `subtype` | `…rls.sql:243-246`, `types.ts:3-4,8-9` |
| `serialnumber` | `…rls.sql:249-252`, `types.ts:5` (nullable по TS) |
| `count` integer | `…rls.sql:248`, `types.ts:12` |
| `availability` text | `…rls.sql:184`, `types.ts:13` |
| `location` | `2026-08-19_equipment_model_editing.sql:72`, `types.ts:15` |
| `technicalspecification`, `lengthinmeters`, `description` | `…equipment_model_editing.sql:60-62`, `types.ts:10-11,14` |
| `created_at`, `updated_at` | `…equipment_model_editing.sql:63`, `types.ts:16-17` |

Ограничения, заведённые репозиторием (`scripts/2026-08-19_reservations_history_rls.sql`):

- `:211` — `alter column availability set default 'available'`;
- `:220-222` — `equipment_availability_check`: `availability in ('available','unavailable','diagnostics','issued')`;
- `:230-231` — `equipment_count_nonnegative_check`: `count >= 0`.

**`UNIQUE` на `serialnumber` в репозитории отсутствует.** Уникальность держится
только клиентской проверкой — это дыра, разбор в разделе «Расхождения документации
с кодом» в конце страницы.

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
| `mount_point_id` | только по индексу `…hardening.sql:38-40` — колонка есть, тип **не установлен** |

Ограничения (`…rls.sql:56-94`, все через `do $$ … if not exists`):
`equipment_lists_reservation_status_check` (4 значения, `:65`),
`equipment_lists_reservation_dates_check` (обе даты пусты либо start ≤ end, `:75-82`),
`equipment_lists_status_changed_by_fkey` → `auth.users(id) on delete set null` (`:92`).

**Два представления состава списка живут одновременно** и синхронизируются вручную
внутри RPC: legacy-пара `equipment_ids` / `equipment_items` (`…rls.sql:655-671`,
`migrations/20260819131611_edit_saved_equipment_lists.sql:67-83`) и нормализованная
таблица `equipment_reservation_items`. Расчёт дефицита (`reservation_shortages`)
читает **только нормализованную**, а клиентский экспорт и старый UI — legacy-поля
(`lists/api.ts:56` тянет `equipment_ids,equipment_items`). Если кто-то запишет в
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

## 2. Два механизма SQL и их конфликт

В репозитории **два независимых набора SQL**, и они пересекаются по объектам.

| Набор | Файлы | Даты |
|---|---|---|
| `supabase/migrations/` | 4 | `20260819131611`, `20260819141650`, `20260819142617`, `20260819142846` — все 2026-08-19, 13:16–14:28 |
| `scripts/*.sql` | 6 | `2025-01-10`, `2025-08-06`, четыре от `2026-08-19` (без времени) |

Порядок применения **нигде не зафиксирован**, инструмента применения нет (§0).
Внутри `scripts/` порядок вообще определяется только тем, как человек кликал в
SQL Editor: имена файлов лексически сортируются, но никто не обязывался их так гонять.

### 2.1 Конфликт первый: права на `public.users`

| Файл:строка | Действие |
|---|---|
| `scripts/2026-08-19_reservations_history_rls.sql:1046` | `revoke all on table public.users from anon, authenticated` |
| `scripts/2026-08-19_reservations_history_rls.sql:1056` | `grant select, insert, update, delete on table public.users to authenticated` |
| `scripts/2026-08-19_security_performance_hardening.sql:6` | `revoke all on table public.users from authenticated` |

Это прямое противоречие: `…rls.sql:1056` выдаёт полный набор прав, `…hardening.sql:6`
забирает всё. Кто побеждает — определяется **исключительно порядком прогона**,
которого в репозитории нет. Лексически `reservations_history_rls` < `security_performance_hardening`
(`r` < `s`), и `AUDIT-2026-08-19.md:57` («Убраны слишком широкие прямые права … на
таблицу пользователей») говорит в пользу того, что `hardening` был последним, — но
это косвенный довод, а не факт. **Фактическое состояние — не установлено**, закрывается
третьим запросом из §0.

Тот же конфликт по legacy-таблицам: `…rls.sql:1062-1064` даёт `events`, `mount_points`,
`reports` полный CRUD `authenticated`, `…hardening.sql:5` всё отзывает.

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

Итог зависит от порядка:

- **`scripts/` → `migrations/`**: удалять списки может только аккаунт `argo@argomedia.uz`.
  Роль admin права удаления **не даёт**.
- **`migrations/` → `scripts/`**: цикл `…rls.sql:864-880` сносит
  `equipment_lists_delete_for_default_account` вместе со всеми, и остаётся
  `equipment_lists_delete_for_admins` (`:937`) — то есть кнопка удаления у
  `argo@argomedia.uz` перестаёт работать, если у аккаунта нет роли `admin`.

Клиент (`lists/api.ts:205-219`) делает обычный `delete … .select('id').maybeSingle()`
и при пустом ответе кидает `Equipment list cannot be deleted` (`:216`) — то есть
отказ RLS выглядит как ошибка приложения, а не как отказ прав. Отличить один сценарий
от другого по UI невозможно.

### 2.3 Что ещё зависит от порядка

`scripts/2025-08-06_mount_points_fk.sql:19-28` создаёт `update_mount_points_count()`
**без** `search_path` и с багом на DELETE (использует `new.event_id`, который при
DELETE равен NULL). `scripts/2026-08-19_security_performance_hardening.sql:14-30`
переписывает функцию правильно (`coalesce(new.event_id, old.event_id)`, `:22`) и
пришпиливает `search_path = ''` (`:17`). Если кто-то прогонит файл 2025-08-06 повторно
после hardening — баг вернётся.

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
   **Владелец объектов в репозитории не зафиксирован** (ни одного `alter table … owner to`),
   `force row level security` тоже не встречается ни в `scripts/`, ни в
   `supabase/migrations/` — значит вся конструкция держится на владельце по умолчанию,
   назначенном тем, кто прогонял SQL. Пока это не проверено — **не установлено**.
   Закрывается запросом:
   `select relname, relowner::regrole, relforcerowsecurity from pg_class where relname in ('reservation_status_history','equipment_movements')`
   плюс `select proname, proowner::regrole from pg_proc where pronamespace = 'private'::regnamespace`.
   Владельцы функции и таблицы совпали и `relforcerowsecurity = false` — журналы
   неподделываемы, как задумано (`…rls.sql:450-451`). Разошлись — вставка из триггера
   упадёт на RLS, и история просто перестанет писаться.
3. Политики `mount_points` и `reports` проверяют лишь **существование** события, а не
   право на него. Само по себе это дыра (любой authenticated читает чужие точки монтажа
   через `exists`), но нейтрализована грантами: `…hardening.sql:5` отзывает права на
   таблицы целиком. Порядок применения (§2) решает, действует ли нейтрализация.
4. `AUDIT-2026-08-19.md:60` оправдывает оставшиеся гранты `authenticated` на пять рабочих
   таблиц («убрать без отдельного серверного API нельзя»). Это согласуется с
   `…rls.sql:1056-1064`, но противоречит `…hardening.sql:5-6` в части `users` и legacy —
   ещё одно проявление §2.1.

### 3.1 Гранты (нужны в дополнение к RLS)

`…rls.sql:1046-1054` — тотальный `revoke all` с `anon` и `authenticated` на девять таблиц.
`…rls.sql:1056-1064` — обратные гранты `authenticated`:

- полный CRUD: `users`, `equipment`, `equipment_lists`, `equipment_reservation_items`,
  `events`, `mount_points`, `reports`;
- только `select`: `reservation_status_history` (`:1060`), `equipment_movements` (`:1061`).

Далее `…hardening.sql:5-6` снимает `users`, `events`, `mount_points`, `reports` — см. §2.1.

`…rls.sql:1066` — `notify pgrst, 'reload schema'`. Без него PostgREST не увидит новые RPC.
Клиентские фолбэки на коды `PGRST202/42883` (`lists/api.ts:226`) и `PGRST205/42P01`
(`lists/api.ts:254`, `equipment/api.ts:311`) — это ровно защита от несброшенного кэша схемы.

---

## 4. Схема `private` и функции безопасности

`…rls.sql:5-7`: `create schema if not exists private`; `revoke all on schema private from
public, anon`; `grant usage … to authenticated`. Схема **не выставлена** в Data API,
поэтому её функции недоступны через PostgREST-RPC.

| Функция | Строка | Свойства |
|---|---|---|
| `private.is_app_member()` → boolean | `…rls.sql:9-21` | `language sql stable` **`security definer`** `set search_path = ''`; тело: `exists (select 1 from public.users u where u.id = auth.uid())` |
| `private.has_any_role(allowed_roles text[])` → boolean | `…rls.sql:23-36` | те же свойства; `u.role::text = any(allowed_roles)` — `role` приводится к тексту, значит колонка, вероятно, enum; фактический тип **не установлен** |

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
(`equipment/api.ts:180-206`) делает прямой `insert` в `equipment`, а право даёт
`equipment_insert_for_inventory_team` (`…rls.sql:909-911`). Пользователь без роли
`technician/manager/admin` получит сырую ошибку RLS от PostgREST. Это дефект UX,
не безопасности.

---

## 5. Триггеры

Все три триггерные функции — в схеме `private`, `security definer`, `search_path = ''`,
с `revoke all … from public, anon, authenticated` (`…rls.sql:586-588`). Комментарий
`:450-451` формулирует замысел: клиент не должен уметь подделать или стереть историю.

| Триггер | Таблица | Когда | Функция |
|---|---|---|---|
| `trg_equipment_movement_history` | `public.equipment` | `after insert or update of count, availability` | `private.log_equipment_change()` — `…rls.sql:452-508`, создан `:591-593` |
| `trg_guard_reservation_list_update` | `public.equipment_lists` | `before update` | `private.guard_reservation_list_update()` — `…rls.sql:510-549`, создан `:596-598` |
| `trg_reservation_status_history` | `public.equipment_lists` | `after insert or update` | `private.log_reservation_status_change()` — `…rls.sql:551-584`, создан `:601-603` |
| `trg_mount_points_count` | `public.mount_points` | `after insert or delete or update` | `update_mount_points_count()` — создан `scripts/2025-08-06_mount_points_fk.sql:31-33`, тело переписано `…hardening.sql:14-30` |

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
  **Тел этих трёх функций в репозитории нет** — что они делают, не установлено.
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
| `public.reservation_shortages(uuid)` → set of 10 колонок | `…rls.sql:321-448` | revoke public/anon `:855`, grant authenticated `:858` | `lists/api.ts:225` |
| `public.create_equipment_list_with_items(text,text,text,date,date,jsonb)` → uuid | `…rls.sql:607-703` | `:856`, `:859` | нет — только через обёртку ниже |
| `public.transition_equipment_list_status(uuid,text,text)` → jsonb | `…rls.sql:705-853` | `:857`, `:860` | `lists/api.ts:234` |
| `public.create_equipment_list_document(text,text,text,text,text,date,date,jsonb)` → uuid | `…list_document_fields.sql:12-51` | `:53-59` | `lists/api.ts:169` |
| `public.update_equipment_list_document(uuid,text,text,text,text,text,date,date,jsonb)` → uuid | `migrations/20260819131611:3-120` | `:122-128` | `lists/api.ts:188` |
| `public.update_equipment_model_and_unit(uuid, 9×text, integer)` → jsonb | `…equipment_model_editing.sql:3-82` | `:87-90` | `equipment/api.ts:252` |

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

### 6.4 `update_equipment_model_and_unit` — тихое массовое обновление

`…equipment_model_editing.sql:26-28` — требует роль `technician/manager/admin`.
`:39-52` — обязательны brand/model/type/subtype, `availability` из четырёх значений,
`count >= 0`.

Ключевое поведение (`:54-65`): «модельные» поля (brand, model, type, subtype,
technicalspecification, lengthinmeters, description) обновляются **у всех строк с тем же
`lower(btrim(brand))`/`lower(btrim(model))`**, а не только у выбранной. Функция
возвращает `updated_model_units` (`:67`, `:79`) — сколько строк задело.

**Клиент этот счётчик не получает вовсе.** Вызов написан как
`const { error } = await client.rpc('update_equipment_model_and_unit', {…})`
(`equipment/api.ts:252-264`) — из ответа деструктурируется **только** `error`,
`data` не берётся. Возвращённый функцией jsonb отбрасывается прямо на месте вызова.
Дальше клиент перечитывает **одну** строку по `id` (`:267-271`) и её же и возвращает
(`:277`). Так что масштаб правки не то что не показан пользователю — он не доезжает
даже до JS. Переименование модели у 40 единиц — одна невидимая операция; в журнал
движений она тоже не попадёт (§5).

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
(`…hardening.sql:37`, подтверждено `AUDIT-2026-08-19.md:59`).

**Индексов на `equipment` в репозитории нет ни одного** — включая тот, что нужен
`reservation_shortages` для группировки по `lower(btrim(brand/model/type/subtype))`
(`…rls.sql:361-372`). Есть ли они в проде — не установлено.

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
`src/react/features/equipment/types.ts:6-7`, но **колонок с такими именами в базе нет**.
Обе величины — результат **разбора строки `serialnumber`** на лету.

**Парсер №1 (TypeScript):** `src/react/features/equipment/api.ts:10-32`, применяется в
`normalizeEquipment` ко всем прочитанным строкам (`:102`, `:122`, `:139`, `:277`).

Строка считается `quantity`, если (`:14-18`): `count > 1`, **или** начинается с `AUTO-`,
**или** начинается с `QTY::`, **или** попадает в набор плейсхолдеров
(`:8` — `'', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-'`), **или**
состоит из одних нулей (`/^0+$/`). Иначе — `serialized`.
`inventory_code` вытягивается из префиксов `QTY::CODE::` / `QTY::AUTO::` (`:20-24`).
При записи обратно: `storedQuantityIdentifier()` (`:34-39`) кладёт `QTY::CODE::<код>`
либо `QTY::AUTO::<uuid>`; вызов — `createEquipment` (`:187-189`).

**Парсер №2 (SQL):** `scripts/2026-08-19_reservations_history_rls.sql:247-255` — тот же
набор условий в backfill'е `tracking_mode` для `equipment_reservation_items`.

**Риск расхождения — не гипотетический, расхождение уже есть.**
TS работает с **обрезанной** строкой: `const storedIdentifier = row.serialnumber?.trim()`
(`api.ts:11`), и все проверки идут по ней. SQL обрезает **только** в проверке
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

Отдельно: клиентская эвристика `isAvailable` в `ListEditorPage.tsx:82-86` до сих пор
понимает **русские** статусы (`status.startsWith('в н')`, `status.includes('диагност')`,
`status.startsWith('не ')`) наравне с `'available'`/`'unavailable'`/`'issued'`. То есть
клиент готов к тому, что нормализация не везде прошла — а CHECK `…rls.sql:220-222`
утверждает, что русских значений быть не может. Одно из двух неверно; какое — не установлено.

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
   как у четырёх существующих. Никаких новых файлов в `scripts/` — этот каталог
   объявляется **архивом**, он не воспроизводит текущее состояние и содержит как
   минимум один нерепрогоняемый файл (§11).
2. **Идемпотентность обязательна:** `if not exists`, `create or replace`,
   `drop policy if exists` перед `create policy`. Одна транзакция `begin; … commit;` —
   так сделаны все четыре миграции и четыре скрипта 2026-08-19.
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
7. **До любого изменения схемы** сначала сделать `supabase db pull` и закоммитить
   полученный baseline (§0). Писать миграцию поверх неизвестного состояния —
   это то, как проект пришёл в текущее положение.
8. **Правки RLS-политик**: помнить про цикл `…rls.sql:864-880`, который дропает всё на
   девяти таблицах. Пока этот файл кто-то может прогнать повторно, любая политика,
   заведённая миграцией, — временная.

---

## Не покрыто

1. **Реальная схема прода** — главное. Ни одной колонки не подтверждено выпиской из базы.
   Закрывается `supabase db pull` / `pg_dump --schema-only` / тремя запросами из §0.
2. **Порядок, в котором `scripts/` и `supabase/migrations/` были применены к проду.**
   Из-за этого не установлено: есть ли у `authenticated` прямые права на `public.users`,
   `events`, `mount_points`, `reports` (§2.1) и какая политика удаления списков
   действует — «только `argo@argomedia.uz`» или «только admin» (§2.2). Закрывается
   запросами к `pg_policies` и `information_schema.role_table_grants`.
3. **Тела трёх унаследованных функций** — `public.update_updated_at_column()`,
   `public.update_equipment_lists_updated_at()`, `public.validate_technical_duties_status()`.
   В репозитории только `alter … set search_path` и `revoke` (`…hardening.sql:10-12, 32-34`).
   Какие триггеры на них навешены и какие таблицы затрагивают — не установлено
   (`select … from pg_trigger` / `pg_get_functiondef`).
4. **Таблица `technical_duties`** (или как она называется) и любые другие таблицы прода,
   не упомянутые в репозитории — §1.3.
5. **Тип колонки `public.users.role`.** Из `u.role::text` (`…rls.sql:34`) следует, что
   это, вероятно, enum, но какой и с какими значениями — не установлено. Известные из
   политик значения: `admin`, `manager`, `technician`.
6. **Тип и назначение `equipment_lists.mount_point_id`** — колонка видна только по
   индексу `…hardening.sql:38-40`; FK на `mount_points` в репозитории не заводится.
7. **`equipment_lists.type`** — колонка заполняется литералом `'custom'` (`…rls.sql:678`)
   и читается клиентом (`lists/api.ts:19,56`), но нигде не используется в логике.
   Какие ещё значения там встречаются в проде — не установлено.
8. **Наличие индексов на `public.equipment`** — в репозитории ни одного (§7).
9. **Утверждения `AUDIT-2026-08-19.md` о данных прода** (`:53` — 1481 позиция и 0 старых
   списков; `:65` — 11 дублирующихся серийников; `:70` — старые таблицы пусты) —
   репозиторием не проверяются. `AUDIT-2026-08-19.md` построчно целиком не сверялся.
10. **Реальное поведение при конкурентных транзакциях** — блокировки `for update`
    расставлены (`…rls.sql:726`, `:764-769`, `:810-815`; `migrations/20260819131611:32`),
    но нагрузочно/интеграционно не проверялись. `AUDIT-2026-08-19.md:68` подтверждает:
    автотестов и CI нет.
11. **Владельцы таблиц и функций `private.*`** — от них зависит, обходят ли
    `security definer`-функции RLS (§3 замечание 2, §4.1). В репозитории нет ни одного
    `alter … owner to` и ни одного `force row level security`. Закрывается
    `select relname, relowner::regrole, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace`
    и `select proname, prosecdef, proowner::regrole from pg_proc where pronamespace = 'private'::regnamespace`.

### Расхождения документации с кодом (обнаруженные)

- **`README.md:53`** — «Редактирование и удаление исторических записей пока отключены
  до нормализации статусов и отдельной проверки RLS-политик». **Ложь.** Редактирование
  оборудования работает через `update_equipment_model_and_unit`
  (`equipment/api.ts:249`, вызов из `EquipmentPage.tsx:387`); правка списков — через
  `update_equipment_list_document` (`lists/api.ts:185`); удаление списка —
  `deleteEquipmentList` (`lists/api.ts:205`, вызов `ListsPage.tsx:432`). Все три пути
  живые и подкреплены серверными объектами.
- **`AUDIT-2026-08-19.md:57`** — «Убраны слишком широкие прямые права … на таблицу
  пользователей» подано как свершившийся факт. В репозитории это состояние
  **не определено** — оно зависит от порядка прогона (§2.1).
- **`AUDIT-2026-08-19.md:69`** и **`:65`** сами признают дыру с уникальностью серийного
  номера. Формулировка «теоретическая гонка» смягчает вдвое.

  Во-первых, `UNIQUE`-ограничения на `equipment.serialnumber` нет вовсе, так что это не
  гонка, а **отсутствие ограничения**: единственная преграда — клиентская
  `serialNumberExists` (`equipment/api.ts:208-217`, запрос `.ilike`), вызываемая из
  `checkSerial()` (`EquipmentCreatePage.tsx:73`) перед `createEquipment` (`:94`).

  Во-вторых — и это хуже — **дыра не требует даже конкурентности**. `checkSerial()`
  обёрнут в `try/catch`, и `catch` возвращает `false` (`EquipmentCreatePage.tsx:76-77`),
  то есть «дубля нет». `handleSubmit` берёт это значение как `hasDuplicate` (`:86`) и
  при `false` идёт прямо в `createEquipment` (`:94`). Любой сбой самого запроса —
  обрыв сети, 401 по протухшей сессии, ошибка PostgREST, отсутствие `supabase`
  (`api.ts:209` бросает исключение) — молча трактуется как «можно сохранять».
  Одна вкладка, один пользователь, никакой гонки: достаточно, чтобы проверочный
  запрос не долетел. Сообщения об этом пользователь не увидит — `catch` пустой.

  Отдельно про регистр: проверка регистронезависимая (`.ilike`), а INSERT кладёт
  `input.serialnumber?.trim()` как есть (`equipment/api.ts:187-189`). Значит «sn-001»
  при уже существующем «SN-001» проверка как раз **поймает** и сохранить не даст.
  Разойтись эти два значения могут только если проверку обойти — конкурентно либо
  через сбой запроса выше.
