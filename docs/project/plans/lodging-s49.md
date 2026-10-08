# План: «Расселение» (сотрудники по номерам отеля) и места `venues` — `planner`, с49

**Правлен в с58 по разделу 4 плана с53** (мероприятие уже в проде с с54).

Прораб план выслушал, по сути не возражал; явного «да» на старт кода не давал. Живая база
при планировании не читалась — опора на миграции и `database.types.ts`. Образца нет: сейчас
расселяют устно, отелю сообщают «кто с кем в каком номере».

Заявка: отель (название, город, страна) → номера → кровати и число мест (≥ 1) → даты отеля и
номеров → выбор сотрудников и раскладка по номерам.

## Решения

- **Четыре таблицы** по образцу залов: `hotel_stays`, `stay_rooms`, `stay_beds`, `stay_guests`.
  Модуль `src/react/features/lodging/`, маршруты `/stays`, `/stays/:stayId`.
- **`venues` уже есть** (`20261007184903_create_venues.sql`, с54): одна таблица мест на обе
  роли — отель (`hotel_stays.venue_id`) и площадка (`projects.venue_id`); роль выводится из ссылок.
- **Только сотрудники из базы (прораб),** гостей в схему не закладываем. Наёмные теперь в
  `employees` (`department = 'hired'`) и расселяются наравне; EXCLUDE это не затрагивает.
- **Место для сна — адресуемый слот `(bed_id, place_no)`**: «не больше людей, чем мест» держит
  exclusion-constraint, тот же адрес — позиция фигурки в 3D.
- **Даты наследуются:** у номера и жильца свои даты необязательны, `NULL` = «как у родителя».
- **Участник и жилец — одна строка `stay_guests`**; `bed_id is null` = едет, не расселён.
- **Инварианты на таблицах, не в RPC** (у `authenticated` прямой DML — урок с45).
- **Привязка к мероприятию:** `hotel_stays.project_id uuid null → projects on delete set null`
  с частичным индексом — сразу в `create_lodging`. Название и даты заезда свои (приезжают раньше
  начала); отпуск и командировка — `project_id null`.
- **Текст и xlsx для отеля — в первой версии; номера вводятся пачкой** («двухместный 5»).
- Перетаскивания нет: «нажал человека → нажал место» либо «пустое место → пикер».

## Модель

Общее: `id uuid pk`, `created_by uuid default auth.uid()`, `created_at`; имена не пустые.

| Таблица | Колонки | Ключи |
|---|---|---|
| `venues` (есть, с54) | `name`, `city`, `country` text not null; `updated_at` | UNIQUE-индекс `venues_identity_key` по `lower(btrim(...))` трёх полей; триггер `trg_normalize_venue_fields` |
| `hotel_stays` | `venue_id` → `venues` **on delete restrict**; `project_id` null → `projects` on delete set null; `name`; `check_in`, `check_out` date not null; `updated_at` | CHECK `hotel_stays_dates_check`: `check_out > check_in`; индекс `(venue_id)`; частичный `(project_id) where project_id is not null` |
| `stay_rooms` | `stay_id` → cascade; `name`; `floor smallint null`; `sort_order`; `check_in`, `check_out` null | UNIQUE `(id, stay_id)`; UNIQUE-индекс `stay_rooms_name_key (stay_id, lower(btrim(name)))`; индекс `(stay_id)` |
| `stay_beds` | `stay_id` → cascade; `room_id`; `places smallint not null`; `sort_order` | составной FK `(room_id, stay_id)` → `stay_rooms(id, stay_id)` cascade; UNIQUE `(id, stay_id)`; CHECK `places between 1 and 4`; индексы `(stay_id)`, `(room_id)` |
| `stay_guests` | `stay_id` → cascade; `employee_id` not null → `employees` cascade; `bed_id` null; `place_no smallint` null; `check_in`, `check_out` null; `eff_from`, `eff_to` date not null | составной FK `(bed_id, stay_id)` → `stay_beds(id, stay_id)` cascade; CHECK `(bed_id is null) = (place_no is null)`; два EXCLUDE; индексы `(stay_id)`, `(employee_id)` |

- Номера принадлежат заезду, не отелю (отель каждый раз даёт другие). Тип кровати не
  хранится: `places = 1` — односпальная, `2` — двуспальная.
- Даты полуоткрытые: `check_out` — день выезда, ночь не занимает.
- `eff_from`/`eff_to` = `coalesce(жилец, номер, заезд)`, перезаписывает триггер; клиент
  читает готовые, зеркала правила в JS нет.

```sql
create extension if not exists btree_gist with schema extensions;
constraint stay_guests_no_overlap  exclude using gist
  (employee_id with =, daterange(eff_from, eff_to, '[)') with &&),
constraint stay_guests_place_taken exclude using gist
  (bed_id with =, place_no with =, daterange(eff_from, eff_to, '[)') with &&)
```

| Правило | Механизм | Клиент получит |
|---|---|---|
| Мест ≥ 1 | CHECK | `23514` |
| Одно место — один человек в ночь | EXCLUDE `stay_guests_place_taken` | `23P01` |
| Человек — в одном месте в ночь (все заезды и отели) | EXCLUDE `stay_guests_no_overlap` | `23P01` |
| `place_no` ≤ `places` | триггер-страж на `stay_guests` | `23514`, `stay_guests_place_no_check` |
| Кровать не уменьшить под жильцом | триггер `before update of places` | `stay_beds_places_occupied` |
| Даты номера внутри заезда | страж на `stay_rooms` | `stay_rooms_within_stay` |
| Даты жильца внутри номера | страж на `stay_guests` | `stay_guests_within_room` |
| Всё из одного заезда | составные FK | `23503` |

Ошибки триггеров — образцом `check_employee_document_photo` (`using errcode, constraint`, имя
и в тексте). Смена дат родителя: `after update of check_in, check_out` делает пустой `update`
детей → страж перепроверяет и пересчитывает `eff_*`; вылез чужой срок — откат с именем.

**Гонка:** EXCLUDE — свойство индекса, блокировок не нужно. Триггерные проверки под READ
COMMITTED гонке подвержены → каждый страж первым делом берёт
`pg_advisory_xact_lock(hashtextextended('hotel-stay:' || stay_id, 0))` (приём из
`create_equipment_batch`). Обмен двух жильцов одним действием в v1 не делаем.

Мелкие триггеры: `touch_hotel_stay()` (invoker), `update_updated_at_column()`,
для имён — `normalize_hall_name()` (`normalize_venue_fields()` уже стоит на `venues`). Отдельной малой миграцией —
RPC `add_stay_rooms(p_stay_id uuid, p_rooms jsonb)`, security invoker (удобство, не защита).

## RLS

Копия политик залов (`20260824022708_create_hall_plans.sql`) на все четыре таблицы: select —
`private.is_app_member()`; insert — три staff-роли и `created_by = auth.uid()`; update/delete —
те же роли. Изоляции между staff нет по замыслу. Функции: `search_path = ''`; триггерные —
`revoke execute … from public, anon, authenticated`.

## UX

Меню — «Расселение», группа «Люди и площадка»; телефон — «Ещё»; плитки на главной нет.

1. **«Новый заезд»** — дровер (`HallPlanMetaDrawer`): название; отель (выбор или новый:
   название, город, страна); заезд/выезд; «Номера сразу» — счётчики по типам.
2. **Редактор** открывается с номерами «1…N», автосохранение, настоящие номера — инлайн.
3. **«Кто едет»** — чек-лист сотрудников с поиском; занятые в другом заезде подписаны. У заезда
   с `project_id` первым идёт состав мероприятия (`project_staff`) — подсказка, не ограничение.
4. **Раскладка** двумя равноправными путями (см. решения).
5. **«Скопировать для отеля»** (образец `planText.ts`) и **«Excel»** — главное действие.
   Колонки: №, Номер, Мест, ФИО, Заезд, Выезд, Ночей; без объединений; язык RU/UZ при скачивании.

Экран: шапка (период, ночи, отель), сводка «Едут / Расселено / Мест / Свободно», сетка
карточек номеров, справа липкий пул «Не расселены». 390 — один столбец, пул полосой сверху,
пикер нижним листом; эта же раскладка — правая панель 3D-режима.

## Этапы

| № | Что | Чекпоинт |
|---|---|---|
| 0 | Не начат (с58: всё ещё в `features/halls/`). Чистый перенос из залов: `halls/InlineText.tsx` → `components/`; `SaveState` из `HallPlanPage.tsx` → `components/` с `.hall-save`; шов `run`/`runInsert`/`pending`/`errorText` из `useHallPlanEditor.ts` → `lib/useSaveRunner.ts`. **Трогает принятый редактор залов — отдельным коммитом.** | залы и ТВ как раньше |
| 1 | Миграции `create_lodging` (после `create_venues` и `create_projects` с54), `add_stay_rooms` | SQL-прогон; advisors чисто |
| 2 | Типы, реестр, создание/правка/удаление заезда, пачка номеров (`StaysPage`, `StayMetaDrawer`; `VenueField` есть, в `components/`) | заезд с 5+1 номерами → строки в базе |
| 3 | Редактор: структура (`StayPage`, `useStayEditor`, `RoomCard`, `lodging.css` с префиксом `stay-`) | переживает перезагрузку |
| 4 | Люди и раскладка (`GuestsDrawer`, `PlaceCell`, `PlacePicker`) | вторая вкладка на занятое место получает отказ |
| 5 | Свои даты номера/жильца, сдвиг заезда (`DatesPopover`) | «с 12 окт» у одного |
| 6 | Экспорт (`stayText.ts`, `roomingExport.ts`) | текст в буфере, xlsx открывается |
| 7 | `/rls-verify`, библия, слияние | v1 в проде |
| 8 | **«Площадки — данные»** (твёрдый этап) | ниже |
| 9 | 3D: макет, потом продукт | ниже |

Кэш по канону залов: только реестр (`stays:list`, TTL 5 мин); места — готовый `projects:venues`
(`features/projects/cacheKeys.ts`); сам заезд не кэшируется. Переименование места сбрасывает
`projects:`, `equipment-lists:` и `stays:`.

Проверки машиной: `anon` — ноль грантов; подмена `created_by`; не-staff — временная строка
`users` с `video_engineer` внутри откатываемой транзакции; каждая строка таблицы инвариантов;
стыковые даты проходят, пересекающиеся нет; два параллельных `curl` на одно место — успех один.

## Этап 8 — места и квадраты мира

Новых связей нет: площадка работы — `projects.venue_id`, списки и планы залов привязаны к
мероприятию через `project_id` с с54. Этап — только `venues_board()` и страница `/venues`.

**Квадрат места вычисляется, флага «архив» нет.** Конец записи — `coalesce(date_to, date_from)`:

| Состояние места | Где стоит |
|---|---|
| есть мероприятие или заезд с концом ≥ сегодня | «Площадки» |
| датированных будущих нет, но есть мероприятие без дат | «Площадки» (принято ведущим по умолчанию) |
| всё датированное в прошлом, мероприятий без дат нет | «Где работали» |
| ни мероприятий, ни заездов | только список `/venues` |

«Сегодня» считает клиент (`todayDateValue()`), не база (UTC против Ташкента +5).

RPC `venues_board()` по образцу `home_summary` (`returns jsonb`, `stable`, invoker), через
`projects`: на каждое место с привязанным — `id`, `name`, `city`, `country`, счётчики, `last_to`,
`undated`; для мест с `last_to >= current_date - 1` или `undated > 0` — мероприятия `{id, name,
from, to, lists, staff, has_plan}` и заезды, где место — отель (`guests`, `placed`). Имён людей
в ответе нет. Кэш `venues:board`, TTL 60 с, запись не сбрасывает (как `home:summary`) — здание
отстаёт до минуты. История одного места — встраиванием PostgREST.
View отвергнут: по умолчанию исполняется правами владельца и обходит RLS.

`/venues` — одна страница на оба квадрата (текущие сверху, архив ниже), текстовый путь сцены.

## Этап 9 — 3D

Сцена — второй вид состояния `useStayEditor`, сама в базу не пишет. Координаты не хранятся:
этаж из `stay_rooms.floor` (пусто — по 4 номера), порядок из `sort_order`, ширина кровати из
`places`, слот из `place_no`; нерасселённые — в лобби; опоздавший до своей даты — у входа с
чемоданом; под сценой ряд ночей. Камера в три четверти, передняя стена снята. Вход — здание
отеля на квадрате «Площадки». Зависит от плана внедрения мира (r3f, ленивый чанк).

## Риски и «проверить на первом прогоне»

- `btree_gist` в проекте не стоял — класс операторов при расширении в схеме `extensions`.
- `23P01` через PostgREST — приходит ли сразу и с именем ограничения (урок с14 про `40001`).
- Цепочка пересчёта дат опирается на срабатывание `update of` без смены значения.
- Коннектор отклоняет `drop`/`delete` — не споткнётся ли о `on delete cascade`, `grant delete`.
- Этап 0 трогает принятый редактор залов; тестов нет.
- Залы не меняются: слот «Наём» (`is_external`) остаётся, наёмного с именем ставят в клетку
  обычным человеком.

## Вопросы, закрытые значениями по умолчанию (прораб не отвечал)

Человек в двух заездах на пересекающиеся даты запрещён, даже не расселённый · в файле для
отеля нет паспортных данных и латиницы · «двухместный» = две раздельные кровати ·
удаление — любому технику · директор участвует в расселении · номер без кроватей легален.
