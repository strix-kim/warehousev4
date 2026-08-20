# 04-architecture — ARGO Warehouse

Как устроен фронтенд технически: что из чего состоит, в каком порядке запускается,
где живут данные и кэш, и где приложение падает целиком.

Все якоря `файл:строка` в этой странице проверены чтением файла на дату написания.
Живой код — только `src/react` (23 файла, 5083 строки). Всё остальное в `src/` —
мёртвый Vue (CLAUDE.md, правило 7), в этой странице не рассматривается.

---

## 1. Дерево `src/react`

Числа получены `wc -l` по каждому файлу; сумма — 5083, файлов — 23.

| Файл | Строк | За что отвечает |
|---|---:|---|
| `styles.css` | 889 | Вся дизайн-система одним файлом: токены, сетка, компоненты, мобильные брейкпойнты. Импортируется один раз в `main.tsx:7`. Единственный файл за порогом распила ~800 |
| `features/lists/ListEditorPage.tsx` | 731 | Редактор списка (создание `/lists/new` и правка `/lists/:listId/edit`): каталог по моделям, выбор позиций, расчёт остатка в браузере, сохранение через RPC, экспорт |
| `features/lists/ListsPage.tsx` | 557 | Реестр списков, карточка-drawer со сводкой, история этапов, дефицит, переходы статусов, удаление, сборка строк для Excel |
| `features/equipment/EquipmentPage.tsx` | 512 | Каталог оборудования: поиск с дебаунсом, фильтр статуса, пагинация, drawer карточки единицы с режимом редактирования и историей движений |
| `features/equipment/api.ts` | 315 | Единственная точка доступа к таблицам `equipment` / `equipment_movements` и RPC `update_equipment_model_and_unit`. Здесь же нормализация `tracking_mode` / `inventory_code` |
| `features/lists/xlsxExport.ts` | 266 | Самописная генерация .xlsx без библиотеки: OOXML строками + собственный ZIP (`crc32` `:190`, `zip` `:202`). Экранирование XML есть — `xml()` (`:27-34`), разбор в разделе 6 |
| `features/lists/api.ts` | 258 | Единственная точка доступа к `equipment_lists` / `reservation_status_history` и четырём RPC списков. Содержит legacy-фолбэк (раздел 9) |
| `features/equipment/EquipmentCreatePage.tsx` | 242 | Форма создания единицы: два режима учёта (серийный / количественный), клиентская проверка дубля серийника, подсказки из таксономии |
| `app/App.tsx` | 179 | Роутер, гейт сессии, `AppShell` (сайдбар + прогрев), `RouteBoundary`, два скелетона загрузки |
| `generated/equipmentImages.ts` | 179 | Сгенерированная карта `brand::model` → путь к WebP в `public/equipment-images/`. Правится только генератором |
| `components/AppDatePicker.tsx` | 166 | Собственный календарь в портале: позиционирование, узбекские месяцы зашиты в код, возврат фокуса на триггер |
| `features/equipment/EquipmentVisual.tsx` | 135 | Подбор картинки по `normalize(brand)::normalize(model)` (`:26-37`), прелоад пачками, фолбэк на иконку категории |
| `lib/persistentCache.ts` | 115 | Двухуровневый кэш (Map + localStorage) с TTL, дедупликацией параллельных загрузок и LRU-обрезкой. Разобран в разделе 7 |
| `components/AppSelect.tsx` | 105 | Кастомный селект в портале с ролями listbox/option (контракт не выполнен, раздел 13) |
| `features/auth/LoginPage.tsx` | 99 | Экран входа по email+паролю, единственный `role="alert"` в проекте (`:89`) |
| `features/auth/AuthProvider.tsx` | 75 | Контекст сессии: `getSession`, подписка `onAuthStateChange`, `signIn`/`signOut`. Третий и последний импортёр клиента Supabase |
| `lib/equipmentTaxonomy.ts` | 69 | Словарь ru→uz для типов и подтипов оборудования (единственное место, где локализация — таблица, а не `tr`) |
| `lib/i18n.tsx` | 52 | `LanguageProvider`, `useLanguage`, `LanguageSwitcher`. Разобран в разделе 10 |
| `lib/useModalLayer.ts` | 32 | Хук слоя модалки: блокировка скролла body, компенсация ширины скроллбара, Escape |
| `features/equipment/types.ts` | 23 | Тип `Equipment` (18 строк) и `EquipmentPageResult`. **Это TypeScript-контракт, а не DDL** — см. раздел 6 |
| `main.tsx` | 19 | Монтирование и порядок провайдеров |
| `lib/supabase.ts` | 16 | Создание клиента Supabase из `VITE_*`, флаг `isSupabaseConfigured` |
| `features/home/HomePage.tsx` | 49 | Стартовый экран-развилка: две большие ссылки на каталог и списки, без данных |

Структурный вывод: слоёв три — `app/` (каркас), `features/<фича>/` (страница + её api),
`lib/` + `components/` (общее). Общего слоя состояния (Redux/Zustand/React Query) нет;
его роль исполняет `lib/persistentCache.ts` плюс локальный `useState` на каждой странице.

---

## 2. Точка входа и порядок провайдеров

| Шаг | Якорь | Что происходит |
|---|---|---|
| HTML | `index.html:2` | `<html lang="ru">` — стартовое значение, позже перезаписывается (раздел 10) |
| HTML | `index.html:15` | `<div id="root">` |
| HTML | `index.html:16` | `<script type="module" src="/src/react/main.tsx">` — единственная точка входа |
| JS | `main.tsx:9` | `createRoot(document.getElementById('root')!)` — non-null assertion, без проверки |
| JS | `main.tsx:10` | `StrictMode` (в dev даёт двойной прогон эффектов — важно помнить про таймеры прогрева) |
| JS | `main.tsx:11` | `BrowserRouter` |
| JS | `main.tsx:12` | `LanguageProvider` |
| JS | `main.tsx:13` | `AuthProvider` |
| JS | `main.tsx:14` | `App` |
| CSS | `main.tsx:7` | `import './styles.css'` — единственный импорт стилей во всём приложении |

`index.html:9-11` — три `<link rel="preload">` на аватар и две иллюстрации; это
единственная предзагрузка на уровне разметки.

Порядок значим: `LanguageProvider` снаружи `AuthProvider`, поэтому экран входа уже
локализован. `AuthProvider` снаружи `App`, поэтому `App.tsx:22` может читать `useAuth()`
безусловно.

---

## 3. Маршруты

Определение — `App.tsx:26-37`. Гейт сессии — безымянный `Route` (`App.tsx:28`):
`session ? <AppShell/> : <Navigate to="/login" replace/>`. Его детей ровно шесть
(`:29-34`) — это все экраны под сайдбаром. Вне гейта, соседними элементами того же
`<Routes>`, объявлены ещё два маршрута: `/login` (`:27`, объявлен ДО гейта, ребёнком
ему не является) и `*` (`:36`). Отсюда восемь строк в таблице ниже: шесть детей гейта
плюс эти два.

| Путь | Компонент | Ленивый | Что видит пользователь |
|---|---|---|---|
| `/login` | `LoginPage` (`App.tsx:27`) | да (`:14`) | Форма входа. Вне `AppShell` — без сайдбара |
| `/` (index) | `HomePage` (`:29`) | да (`:19`) | Развилка: каталог или списки |
| `/equipment` | `EquipmentPage` (`:30`) | да (`:15`) | Каталог с поиском, фильтром, пагинацией |
| `/equipment/new` | `EquipmentCreatePage` (`:31`) | да (`:16`) | Форма новой единицы |
| `/lists` | `ListsPage` (`:32`) | да (`:17`) | Реестр списков + drawer карточки |
| `/lists/new` | `ListEditorPage` (`:33`) | да (`:18`) | Пустой редактор списка |
| `/lists/:listId/edit` | `ListEditorPage` (`:34`) | да (`:18`) | Тот же редактор с загрузкой существующего списка |
| `*` | — (`:36`) | — | `<Navigate to={session ? '/' : '/login'} replace/>` — 404-страницы нет |

Пока `AuthProvider` не ответил (`App.tsx:24`), рендерится `AppLoader` (`:172-178`) —
брендовая заглушка вместо всего приложения.

Оговорка про гейт: это UX-гейт, а не защита. Он лишь прячет экраны от анонима;
доступ к данным решает RLS в Postgres (см. страницу по БД). Обход гейта не даёт данных,
но и не должен считаться «защитой маршрута».

`AppShell` (`App.tsx:40-156`) — статический сайдбар: бренд, три `NavLink`, быстрое
действие `/lists/new`, декоративный блок «Быстрый процесс», переключатель языка,
подвал с email из `session?.user.email` (`:43`) и кнопкой выхода (`:148`).
Состояние свёрнутости — `localStorage['argo:sidebar-collapsed']` (`:44`, `:47`).

---

## 4. Ленивая загрузка и прогрев

Все шесть страниц объявлены дважды: сначала функцией-загрузчиком (`App.tsx:7-12`),
затем обёрткой `lazy()` (`App.tsx:14-19`). Разделение сделано ради прогрева: те же
функции переиспользуются в таймерах, поэтому прогрев и рендер бьют в один и тот же
модульный кэш браузера.

`AppShell` в `useEffect` (`App.tsx:50-91`) заводит три отложенных таймера:

| Таймер | Задержка | Якорь | Что делает |
|---|---:|---|---|
| `moduleTimer` | 0 мс | `App.tsx:51-59` | `Promise.allSettled` на пять `import()` страниц (кроме `LoginPage`). Прогревает только JS-чанки |
| `primaryDataTimer` | 120 мс | `App.tsx:60-73` | Импортирует оба api-модуля и дёргает `fetchEquipment({page:1, search:'', availability:'', pageSize: 8\|50})` (`:65-70`) и `fetchEquipmentLists()` (`:71`). Размер страницы выбирается по `matchMedia('(max-width: 820px)')` |
| `editorDataTimer` | 700 мс | `App.tsx:74-85` | `fetchAllEquipment()` + `fetchEquipmentTaxonomy()` (`:80-81`), затем `preloadEquipmentImages(equipment, 32)` (`:83`) — первые 32 картинки |

Все три снимаются в cleanup (`:86-90`).

**Ключевой момент: прогрев и есть источник первого кадра.** `fetchEquipment` и
`fetchEquipmentLists` внутри обёрнуты в `cachedQuery` (`equipment/api.ts:70`,
`lists/api.ts:65`), то есть кладут результат в `persistentCache`. Страницы при монтировании
читают ровно тот же кэш синхронно, в инициализаторе `useState`:

- `EquipmentPage.tsx:72` — `readCachedEquipment({page:1, search:'', availability:'', pageSize})`;
  ключ совпадает с прогревочным вызовом байт в байт (`equipmentPageCacheKey`, `api.ts:53-55`),
  поэтому переход на `/equipment` рисует данные в первом же кадре, `isLoading` стартует
  как `false` (`:79`);
- `ListsPage.tsx:131` — `readCachedEquipmentLists()`;
- `ListEditorPage.tsx:102-103` — `readCachedAllEquipment()` и `readCachedEquipmentList(listId)`.

Отсюда правило: **менять сигнатуру прогревочного вызова в `App.tsx` нельзя в отрыве
от `readCached*` на странице.** Разошёлся хоть один параметр ключа — прогрев остаётся
в кэше мусором, а страница показывает скелетон, и никакой ошибки при этом не будет.

Оба таймера с сетью гасят ошибки: `.catch(() => undefined)` на `App.tsx:72` и `:84`.

---

## 5. Отказоустойчивости нет (критический раздел)

### 5.1. Ни одной границы ошибок

```
grep -rnE "ErrorBoundary|componentDidCatch|errorElement|getDerivedStateFromError" src/react → 0
```

`RouteBoundary` (`App.tsx:159-161`) — это `<Suspense fallback={<RouteLoader/>}>{children}</Suspense>`
и больше ничего. Слово «Boundary» в имени вводит в заблуждение: Suspense ловит
*ожидание*, но не *отказ*. Отклонённый промис проходит сквозь него вверх и, не найдя
границы, срывает рендер всего дерева — React размонтирует корень.

### 5.2. Сценарий белого экрана целиком

1. Пользователь держит вкладку открытой. Загруженный `index.html` ссылается на чанки
   с хэшами текущего билда.
2. Выкатывается новый билд. Vite перегенерирует хэши; старые файлы `/assets/*.js`
   на проде исчезают.
3. Пользователь кликает по разделу, который ещё не прогрелся, — срабатывает
   `import()` из `App.tsx:7-12` на исчезнувший URL.
4. Файла нет. С с5 рерайт обходит ассеты (`vercel.json`: `/((?!assets/|equipment-images/).*)`),
   поэтому промах отдаёт честный 404. До с5 рерайт ловил и `/assets/*` — промах
   отдавал `index.html` со статусом 200, `Content-Type: text/html` и годовым
   `immutable` (проверено аудитом живым запросом; закрыто шагом 5 порядка работ).
5. Браузер получает 404 → `import()` отклоняется сетевой ошибкой (до с5 — ошибкой
   парсинга HTML как ES-модуля, и отравленный ответ жил в кэше год).
6. `React.lazy` возвращает отклонённый промис. Границы нет (5.1) → **белый экран
   всего приложения**, включая сайдбар и навигацию.
7. `lazy` кэширует отказ, поэтому повторный рендер не помогает. Единственное лечение —
   ручная перезагрузка, о которой пользователю никто не сообщает: белый экран
   не отличим от «приложение зависло».

Заголовок `Cache-Control: immutable` на `/assets/(.*)` задуман для существующих
файлов, но прежняя версия этого раздела утверждала, что «на этот сценарий он не
влияет», — аудит с4 опроверг это живым запросом: HTML-ответ рерайта уезжал клиенту
с годовым `immutable`, и отравление переживало даже откат к тому же коду. После с5
промах отдаёт 404; остаточный риск — приклеивается ли `immutable` к самому 404
(заголовки Vercel ставятся до файловой системы) — на проде ещё не проверен:
`curl -sI <домен>/assets/nope.js` после первого прод-деплоя с5.

### 5.3. Отказ в проде невидим

```
grep -rn "console\." src/react → 0
```

Ни одной строки клиентской диагностики. В `package.json:16-22` нет Sentry и любого
другого сборщика ошибок. Значит: белый экран из 5.2, любое необработанное исключение
и любой `.catch(() => undefined)` не оставляют следа нигде — ни в консоли, ни на сервере.
Единственный канал обратной связи — жалоба сотрудника.

### 5.4. Офлайн не отслеживается

```
grep -rnE "onLine|offline|navigator\." src/react → 0
```

Признака «сеть недоступна» в интерфейсе нет. В связке с `persistentCache.ts:93-96`
(при ошибке загрузчика возвращается прежнее значение, ошибка до UI не доходит) это даёт
худший вариант: сеть лежит, а пользователь видит данные прошлой недели и уверен, что
смотрит склад. Подробнее — раздел 7.

### 5.5. Незащищённый localStorage на старте

`persistentCache` аккуратно оборачивает localStorage в `try/catch` (`:22-31`, `:68-73`),
а два места на пути загрузки — нет:

- `i18n.tsx:17` — `window.localStorage.getItem(STORAGE_KEY)` в инициализаторе `useState`;
- `App.tsx:44` — то же для `argo:sidebar-collapsed`.

Если localStorage недоступен (Safari в приватном режиме, отключённые данные сайтов,
корпоративная политика), обращение бросает `SecurityError` на этапе первого рендера.
Границы ошибок нет → приложение не стартует вовсе.

### 5.6. Молча проглатываемые ошибки — полный список

| Якорь | Что глохнет | Что видит пользователь |
|---|---|---|
| `App.tsx:72` | Прогрев каталога и списков | Ничего; просто нет ускорения |
| `App.tsx:84` | Прогрев редактора и картинок | Ничего |
| `EquipmentCreatePage.tsx:53` | `fetchEquipmentTaxonomy()` в форме создания | Пустые подсказки типа/подтипа без объяснения |
| `persistentCache.ts:93-96` | Любая сетевая ошибка при наличии кэша | Старые данные без признака устаревания |
| `persistentCache.ts:29`, `:48`, `:71` | Порча/переполнение localStorage | Ничего |
| `AuthProvider.tsx:29-31` | Отказ `getSession()` | Считается «нет сессии» → редирект на `/login` |
| `EquipmentCreatePage.tsx:76-77` | **Проверка уникальности серийного номера.** `catch { return false }` — любой сбой запроса читается как «дубля нет», и вставка идёт (`:86` → `:94`) | Ничего: форма сохраняет позицию, будто проверка прошла |

Последняя строка — не рядовая: это единственный `catch` в списке, который возвращает
РАЗРЕШАЮЩЕЕ значение. Остальные глушат ускорение или подсказки, этот глушит защиту.
Разбор — `02-features` §5.1, строка (а2) сводной таблицы.

---

## 6. Слой данных

### Клиент

`lib/supabase.ts` целиком (16 строк):

- `:3-4` — `import.meta.env.VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`;
- `:6` — `isSupabaseConfigured = Boolean(url && key)`;
- `:8-15` — при наличии переменных `createClient(url, key, { auth: { persistSession: true,
  autoRefreshToken: true, detectSessionInUrl: true } })`, иначе экспортируется **`null`**.

Поведение при отсутствии переменных: сборка проходит, приложение стартует, экран входа
рисуется. `AuthProvider.tsx:19-22` при `supabase === null` сразу снимает `isLoading`,
`signIn` (`:52-54`) бросает «Supabase не настроен. Добавьте переменные окружения.» —
это единственное место, где пользователю говорят правду. Все функции обоих api-модулей
начинаются с `if (!supabase) throw new Error('Supabase не настроен')` (например
`equipment/api.ts:66`, `lists/api.ts:63`), но до них без сессии не доходит.

### Кто ходит в базу

```
grep -rn "lib/supabase" src/react
→ features/lists/api.ts:1
→ features/equipment/api.ts:1
→ features/auth/AuthProvider.tsx:3
```

Ровно три импортёра, из них два ходят в данные (`.from()`, `.rpc()`), а `AuthProvider`
использует только `supabase.auth.*` (`:25`, `:36`, `:56`, `:61`). Ни одна страница
не обращается к Supabase напрямую — это соблюдается на 100%, и это самое здоровое
свойство архитектуры.

### Чего в коде нет

```
grep -rnE "\.storage|\.channel\(|realtime|\.functions\." src/react → 0
```

Ни Supabase Storage (картинки — статические файлы в `public/equipment-images/`),
ни realtime-каналов (данные обновляются только по действию пользователя и по TTL),
ни вызовов edge-функций. Значит, любой факт «в проде есть бакет/канал/функция»
из кода не подтверждается и требует проверки мостом.

### Поверхность запросов

| Таблица / RPC | Где | Операция |
|---|---|---|
| `equipment` | `equipment/api.ts:74, 114, 134, 152, 183, 211, 225, 268` | select ×7, insert ×1 (`:183`) |
| `equipment_movements` | `equipment/api.ts:306` | select, `.limit(50)` |
| `equipment_lists` | `lists/api.ts:67, 78, 128, 136, 209` | select ×4, delete ×1 (`:209`) |
| `reservation_status_history` | `lists/api.ts:250` | select |
| `update_equipment_model_and_unit` | `equipment/api.ts:252` | rpc |
| `create_equipment_list_document` | `lists/api.ts:169` | rpc |
| `update_equipment_list_document` | `lists/api.ts:188` | rpc |
| `reservation_shortages` | `lists/api.ts:225` | rpc |
| `transition_equipment_list_status` | `lists/api.ts:234` | rpc |

Асимметрия: чтение везде идёт прямым select по таблицам, а запись — почти везде через
RPC. Два исключения из «запись только через RPC» — insert оборудования
(`equipment/api.ts:183-200`) и delete списка (`lists/api.ts:208-213`), они бьют в таблицу
напрямую и опираются целиком на RLS.

### Про колонки

**DDL базовых таблиц (`equipment`, `equipment_lists`, `users`, `events`, `mount_points`,
`reports`) в репозитории отсутствует.** Поэтому тип `features/equipment/types.ts:1-18` —
это утверждение о том, какую форму строки код *ожидает* от PostgREST, а не описание
таблицы. Два поля этого типа заведомо не колонки:

- `tracking_mode` (`types.ts:6`) и `inventory_code` (`types.ts:7`) вычисляются на клиенте
  функцией `normalizeEquipment` (`equipment/api.ts:10-32`) разбором строки `serialnumber`
  по префиксам `QTY::CODE::`, `QTY::AUTO::`, `AUTO-` и списку плейсхолдеров (`:8`).

Аналогично `advanced_features` (`lists/api.ts:29`) — не колонка, а флаг, который
проставляет сам клиент (раздел 9). Проверять реальную схему — только через Supabase MCP
или дашборд.

### Выгрузка .xlsx — экранирование XML закрыто

Единственный путь данных наружу мимо Supabase — `features/lists/xlsxExport.ts`
(266 строк): OOXML собирается конкатенацией строк, ZIP пишется вручную (`crc32` `:190`,
`zip` `:202`), библиотеки нет.

**Экранирование пользовательского текста ЕСТЬ и применено ко всему пользовательскому
тексту.** `function xml(value)` (`:27-34`) заменяет `&`, `<`, `>`, `"`, `'` на сущности
и вызывается во всех местах, куда попадает ввод:

| Место вызова `xml()` | Якорь | Что через него проходит |
|---|---|---|
| `textCell` | `:37` | Любая текстовая ячейка листа |
| `formulaCell` | `:45` | Текст формулы (сейчас всегда служебный `SUM(...)`) |
| Колонтитулы листа | `:135` | `input.name` в `oddHeader`/`evenHeader` |
| `docProps/core.xml` | `:247` | `input.name` в `<dc:title>` |

Весь ввод пользователя попадает в лист только через `textCell`: название, заказчик,
площадка, описание (метаданные `:91-98`, рендер `:102`), название позиции, серийные
номера и примечание (строки состава `:111-120`, ячейки `:119`). Итоговая строка (`:121`)
и шапка таблицы собраны из констант. `numberCell` (`:40-42`) подставляет значение типа
`number` — экранировать там нечего.

Единственная неэкранированная подстановка в XML — `sheetName` (`:241`), и это константа:
`'Uskunalar'` либо `'Оборудование'` по языку. `safeFileName` (`:236-238`) чистит имя
файла от `\ / : * ? " < > |` — это про файловую систему, не про XML.

Вывод: название списка или заказчика с `&`, `<`, `>` битого .xlsx не даёт — вопрос
из прежней редакции этой страницы закрыт чтением файла. Остаток — **не** XML, а
собственный формат колонтитулов Excel, где `&` служит префиксом кодов (`&L`, `&R`, `&P`):
после разбора XML `&amp;` снова становится `&`, и Excel может прочитать его как код.
На целостность файла это не влияет, только на отрисовку шапки; проверяется прогоном
экспорта со списком, в названии которого стоит `&`.

---

## 7. Кэш `lib/persistentCache.ts`

Два уровня: `memoryCache: Map` (`:10`) и localStorage с префиксом
`argo-warehouse:v3:` (`:1`, `:13-15`). Плюс `pendingLoads: Map` (`:11`) — дедупликация
параллельных запросов по одному ключу.

### Все ключи и TTL

| Ключ | TTL | Где пишется | Что лежит |
|---|---:|---|---|
| `equipment:{"page":N,"search":…,"availability":…,"pageSize":N}` | 10 мин | `equipment/api.ts:70` (ключ строит `:53-55`) | Страница каталога `{rows, total}` |
| `equipment:all` | 10 мин | `equipment/api.ts:109` | Весь склад массивом |
| `equipment:model-count:<brand>::<model>` | 10 мин | `equipment/api.ts:223` | Число единиц модели |
| `equipment:movements:<equipmentId>` | 5 мин | `equipment/api.ts:304` | До 50 движений |
| `equipment-taxonomy` | **24 ч** | `equipment/api.ts:150` | `{types, subtypes}` |
| `equipment-lists:recent` | 10 мин | `lists/api.ts:65` | До 50 списков + `total` |
| `equipment-lists:detail:<listId>` | 10 мин | `lists/api.ts:126` | Один список |
| `equipment-lists:shortages:<listId>` | 5 мин | `lists/api.ts:224` | Дефицит |
| `equipment-lists:history:<listId>` | 5 мин | `lists/api.ts:248` | История этапов |
| `equipment-lists:composition:<listId>` | 10 мин | `ListsPage.tsx:115` | Строки состава для Excel |

### Где сравнивается `expiresAt`

**Только в `cachedQuery`, строка `:83`:**
`if (!options.bypass && cached && cached.expiresAt > Date.now()) return cached.value`.

`readEntry` (`:17-32`) и `readCachedQuery` (`:34-36`) `expiresAt` **не сравнивают** —
`readCachedQuery` возвращает `readEntry(key)?.value ?? null` при любом возрасте записи.
Проверка `typeof entry.expiresAt !== 'number'` (`:26`) — только валидация формы JSON.

Практическое следствие: все синхронные `readCached*` в инициализаторах `useState`
(`EquipmentPage.tsx:72`, `ListsPage.tsx:131`, `ListEditorPage.tsx:102-103`,
`EquipmentPage.tsx:305`, `ListsPage.tsx:341-343`) рисуют **сколь угодно старые данные**.
TTL ограничивает не показ, а только повторный сетевой запрос. Возраст записи ничем
не ограничен сверху, кроме LRU-обрезки (см. ниже) и ручной смены `v3` в `:1`.

### Что происходит при ошибке сети

`cachedQuery` (`:88-97`):

```
loader().then(писать в кэш).catch((error) => {
  if (cached?.value !== undefined) return cached.value   // :94
  throw error                                            // :95
})
```

То есть при наличии любой прежней записи ошибка **гасится и подменяется старым
значением**. Промис резолвится успешно, вызывающая страница считает загрузку удачной,
`setError('')` остаётся, индикатора устаревания нет. Ошибка доходит до UI только при
холодном кэше. Вместе с отсутствием отслеживания офлайна (5.4) это означает: **отличить
«данные свежие» от «сеть лежит уже час» изнутри интерфейса невозможно**.

### Запись и обрезка

`writeEntry` (`:59-74`): кладёт `{value, expiresAt: now+ttl, touchedAt: now}` в Map и в
localStorage, затем `trimStorage()`.
`trimStorage` (`:38-57`): перебирает все ключи с префиксом, сортирует по `touchedAt`
убыванием, `.slice(64)` и удаляет хвост (`MAX_PERSISTED_ENTRIES = 64`, `:2`).
Битые JSON удаляются на месте (`:48-50`). Обрезка идёт **по последней записи, а не по
сроку годности** — просроченная, но недавно записанная запись переживёт свежую редкую.
Память (`memoryCache`) не обрезается никогда.

### Когда сбрасывается

`invalidateCachePrefix(prefix)` (`:103-115`) чистит Map по `startsWith(prefix)` и
localStorage по `startsWith('argo-warehouse:v3:' + prefix)`. Вызовы:

| Действие | Якорь | Что сбрасывает |
|---|---|---|
| `createEquipment` | `equipment/api.ts:203-204` | `equipment:`, `equipment-taxonomy` |
| `updateEquipmentModelAndUnit` | `equipment/api.ts:274-276` | `equipment:`, `equipment-taxonomy`, `equipment-lists:composition:` |
| `createEquipmentList` | `lists/api.ts:181` | `equipment-lists:` |
| `updateEquipmentList` | `lists/api.ts:201` | `equipment-lists:` |
| `deleteEquipmentList` | `lists/api.ts:217` | `equipment-lists:` |
| `transitionEquipmentList` | `lists/api.ts:240-241` | `equipment-lists:`, `equipment:` |

Тонкость префиксов: `equipment:` накрывает `equipment:all`, `equipment:model-count:`
и `equipment:movements:`, но **не** накрывает `equipment-taxonomy` и `equipment-lists:*`
(другой разделитель). Поэтому таксономия сбрасывается отдельной строкой — при добавлении
нового ключа с дефисом это легко забыть.

Чего сброс не делает:

- **при выходе из аккаунта кэш не чистится.** `signOut` (`AuthProvider.tsx:59-63`) вызывает
  только `supabase.auth.signOut()`; `invalidateCachePrefix` в нём не вызывается
  (grep по `src/react` даёт вызовы только в двух api-модулях). Данные склада остаются
  в localStorage браузера и подхватятся первым кадром следующего пользователя на той же
  машине;
- **при выкатке нового билда кэш не инвалидируется.** Версия `v3` (`:1`) — литерал в коде;
  чтобы сбросить всё, надо руками поднять её до `v4` и выкатить.

---

## 8. Пагинация и лимит Data API

| Запрос | Якорь | Порция | Риск |
|---|---|---:|---|
| `fetchEquipment` | `equipment/api.ts:80` | `.range(from, to)`, `pageSize` 50 (`:6`) или 8 на мобильном (`EquipmentPage.tsx:32`, `:34-38`) | Нет. Единственная честная серверная пагинация в проекте, с `count: 'exact'` (`:75`) |
| `fetchAllEquipment` | `equipment/api.ts:112-125` | Цикл по 1000: `.range(from, from+999)` | **Есть, см. ниже** |
| `fetchEquipmentTaxonomy` | `equipment/api.ts:154` | `.range(0, 1999)` одним запросом | **Есть, см. ниже** |
| `fetchEquipmentByIds` | `equipment/api.ts:130-140` | `.in('id', ids)` без `range` | Список с более чем `db-max-rows` единицами обрежется молча; плюс длина URL при большом `in` |
| `fetchEquipmentLists` | `lists/api.ts:70`, `:81` | `.limit(50)` | Реестр списков **не пагинируется вообще** — 51-й и далее недостижимы из интерфейса. `count` берётся `exact` (`:68`), то есть счётчик покажет больше, чем можно открыть |
| `fetchEquipmentMovements` | `equipment/api.ts:310` | `.limit(50)` | Осознанная отсечка истории |
| `fetchReservationHistory` | `lists/api.ts:249-253` | Без `limit` и без `range` | Обрежется по `db-max-rows` молча |

### Где именно упирается в 1000

Data API (PostgREST) режет ответ по настройке `db-max-rows`; у Supabase по умолчанию
это 1000. Фактическое значение для этого проекта **не установлено** — конфигурации
в репозитории нет (`supabase/config.toml` отсутствует). Проверяется в Supabase Dashboard
→ Settings → API → Max rows либо мостом Supabase MCP.

Два места ломаются тихо, если лимит равен 1000 или меньше:

1. **`fetchAllEquipment` (`equipment/api.ts:112-125`).** Условие выхода из цикла —
   `if (batch.length < batchSize) break` (`:124`). Оно смешивает «таблица кончилась»
   и «сервер обрезал страницу». При `db-max-rows < 1000` первая же порция придёт
   короче 1000 → цикл выйдет после одной итерации → **весь редактор списка получит
   усечённый склад и не узнает об этом**. При ровно 1000 логика верна.
2. **`fetchEquipmentTaxonomy` (`equipment/api.ts:151-155`).** Запрошено 2000 строк,
   но выдадут не больше `db-max-rows`, а `.order()` в этом запросе **нет** — порядок
   строк не определён. Значит набор типов и подтипов собирается из произвольного
   подмножества склада, и подсказки в форме создания могут не содержать существующих
   категорий. Кэшируется это на 24 часа (`:150`).

Замер, который закрывает вопрос: сравнить `select count(*) from equipment` с длиной
массива, который возвращает `fetchAllEquipment`. **Числа строк в проде мы не знаем.**
`public/equipment-images/report.json` даёт 217, но это снимок для подбора картинок,
а не выписка из базы, и `docs/handoffs/2026-08-19-0-audit.md:52` в том же репозитории называет 223.
Ни одно из двух чисел не проверено запросом — см. правило «есть в коде ≠ есть в базе»
в §0 `03-data-model`.

---

## 9. Legacy-фолбэк списков — архитектурная мина

### Что написано

`lists/api.ts:66-95`, внутри `cachedQuery('equipment-lists:recent', 10 мин, …)`:

```
const { data, error, count } = await client.from('equipment_lists')
  .select(listColumns, { count: 'exact' }).order('created_at', …).limit(50)

if (!error) return { rows: …map(item => ({...item, advanced_features: true})), total }   // :72-75

const legacy = await client.from('equipment_lists')
  .select('id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived', …)  // :77-81
if (legacy.error) throw error                                                            // :82
return { rows: …map(item => ({ ...item,
  reservation_status: 'draft',        // :86
  reservation_start: null, reservation_end: null, shortage_snapshot: null,
  client_name: null, venue: null,
  advanced_features: false,           // :92
})), total: legacy.count ?? 0 }
```

Вторая копия того же — `fetchEquipmentList` (`lists/api.ts:126-152`): `:133` —
успех, `:135-140` — безусловный legacy-select, `:141` — `if (legacy.error) throw modern.error`,
`:144` — `reservation_status: 'draft'`, `:150` — `advanced_features: false`.

### Почему это мина

Ветка выбирается **по факту наличия ошибки, а не по её коду**. Соседние функции того же
файла так не делают:

- `fetchReservationShortages` — `lists/api.ts:226`:
  `if (error && (error.code === 'PGRST202' || error.code === '42883')) return []`;
- `fetchReservationHistory` — `lists/api.ts:254`:
  `if (error && (error.code === 'PGRST205' || error.code === '42P01')) return []`;
- `fetchEquipmentMovements` — `equipment/api.ts:311`: та же пара `PGRST205/42P01`.

То есть в проекте уже есть работающая конвенция «фолбэк только на отсутствие объекта
схемы», и обе функции списков из неё выпадают.

### Точный сценарий срабатывания

Оговорка, важная для честности: при **устойчивом** отказе сети или протухшем JWT
второй запрос упадёт тоже, и `:82` / `:141` бросят исходную ошибку — до подмены не дойдёт.
Мина срабатывает, когда первый запрос падает, а второй проходит. Это не экзотика:

1. **Разные права на разные колонки.** `listColumns` (`:56`) включает `client_name`,
   `venue`, `reservation_status`, `reservation_start`, `reservation_end`,
   `shortage_snapshot`; legacy-набор (`:79`) — нет. Любой column-level revoke на
   `equipment_lists` или удалённая/переименованная колонка из этого списка даёт ошибку
   на первом select и успех на втором. Оговорка: column-level revoke именно на
   `equipment_lists` в репозитории **не встречается** — гранты на неё выдаются
   табличными (`scripts/2026-08-19_reservations_history_rls.sql:1058`). Это путь
   гипотетический, но открытый: чтобы его пройти, достаточно одной миграции.
2. **Единичный сетевой сбой.** Legacy-select — отдельный HTTP-запрос; мигнувшая сеть,
   таймаут, обрыв Wi-Fi ровно на первом запросе → второй уходит и проходит.

### Последствие

Флаг `advanced_features: false` вместе с принудительным `reservation_status: 'draft'`
меняет то, что видит пользователь:

- `ListsPage.tsx:272` — карточка списка показывает не реальный этап, а фиксированное
  «Сохранён»: **выданный клиенту комплект выглядит как черновик**;
- `ListsPage.tsx:357` — `action = undefined`, кнопки переходов исчезают, список
  «зависает» без возможности что-то с ним сделать;
- `ListsPage.tsx:364-366`, `:122-123` — история этапов и дефицит не запрашиваются вообще;
- `ListEditorPage.tsx:147` — `if (cached?.reservation_status === 'draft') setListToEdit(cached)` —
  подделанный «черновик» открывается в редакторе на первом кадре. Дальше `:150` делает
  повторную загрузку и `:153` бракует не-черновик, но если фолбэк отработает и там,
  редактор останется открытым на выданном списке.
- **Всё это кэшируется на 10 минут** — `equipment-lists:recent` (`:65`) и
  `equipment-lists:detail:<id>` (`:126`). Даже когда сеть восстановилась, интерфейс
  ещё десять минут показывает подделку, потому что `readCachedEquipmentLists`
  (`ListsPage.tsx:131`) `expiresAt` не сверяет (раздел 7), а перезапрос уйдёт только
  после истечения TTL.

Правильное поведение — гейт по коду ошибки, как у соседей (`PGRST202/42883/PGRST205/42P01`
плюс коды отсутствующей колонки), и запрет кэшировать деградированный результат.
Строка в бэклог — обязательна.

---

## 10. Локализация

`lib/i18n.tsx` (52 строки). Файла-словаря нет; вместо него функция.

| Что | Якорь | Детали |
|---|---|---|
| Языки | `:3` | `type Language = 'ru' \| 'uz'` — ровно два |
| Ключ хранения | `:12` | `argo:language` в localStorage |
| Начальное значение | `:16-19` | Читает localStorage; всё, что не `'uz'`, трактуется как `'ru'`. Язык браузера не учитывается |
| Побочные эффекты | `:21-25` | На каждую смену: пишет localStorage (`:22`), ставит `document.documentElement.lang` = `uz`/`ru` (`:23`), меняет `document.title` (`:24`) |
| Контракт | `:9`, `:31` | `tr: (ru, uz) => string` — обе строки передаются в месте вызова. Строка физически не может появиться на одном языке |
| Локаль | `:7`, `:29` | `locale: 'ru-RU' \| 'uz-UZ'` — для `Intl.DateTimeFormat` |
| Мемо | `:27-32` | Значение контекста пересобирается только при смене языка |
| Провайдер | `:34`, `main.tsx:12` | Обёрнут вокруг `AuthProvider` — вход тоже локализован |
| Гард | `:37-41` | `useLanguage` вне провайдера бросает |
| Переключатель | `:43-51` | Две кнопки RU/UZ, `role="group"` (`:47`), `aria-pressed` (`:48-49`) |

`index.html:2` задаёт `lang="ru"` статически; `i18n.tsx:23` перезаписывает атрибут после
первого эффекта. То есть при выбранном узбекском в первом кадре документ ещё объявлен
русским — для скринридера это заметно, для верстки нет.

Исключение из правила «локализация — это `tr`»: `lib/equipmentTaxonomy.ts` — обычный
словарь `Record<string, string>` для типов и подтипов оборудования (значения приходят
из базы, инлайн-парой их не покроешь). Второе исключение — узбекские месяцы и дни недели,
зашитые прямо в `components/AppDatePicker.tsx:5-6`.

---

## 11. Слой модалок

Общего компонента `Modal` в проекте **нет**. Есть три самостоятельных drawer'а, каждый
объявлен внутри своей страницы, плюс один общий хук на поведение.

| Drawer | Компонент/якорь | Хук | Что показывает |
|---|---|---|---|
| Карточка оборудования | `EquipmentPage.tsx:414` | `:303` | Единица склада, режим редактирования, история движений |
| Карточка списка | `ListsPage.tsx:446` | `:338` | Состав, дефицит, история этапов, переходы, удаление |
| Превью модели | `ListEditorPage.tsx:710` | `:701` | Описание модели в каталоге редактора |

Разметка у всех трёх одинакова: `<div className="drawer-layer" role="dialog"
aria-modal="true" aria-label={…} onMouseDown={onClose}>` с `onMouseDown` +
`stopPropagation` на внутренней `<aside>` — закрытие по клику вне панели.
Первым фокусируемым элементом стоит кнопка закрытия с `autoFocus`
(`EquipmentPage.tsx:423`, `ListsPage.tsx:451`, `ListEditorPage.tsx:714`).

`lib/useModalLayer.ts` — единственная общая часть:

- `:5-9` — `onClose` кладётся в ref, чтобы эффект слоя не перезапускался при каждом
  рендере родителя;
- `:12-13` — запоминает прежние `overflow` и `paddingRight` у `body`;
- `:14`, `:19-22` — считает ширину скроллбара как `innerWidth - documentElement.clientWidth`
  и компенсирует её паддингом, чтобы страница не дёргалась;
- `:23` — `body.style.overflow = 'hidden'`;
- `:15-17`, `:24` — глобальный `keydown` на Escape;
- `:26-30` — полное восстановление в cleanup.

Хук намеренно узкий: он **не** делает фокус-ловушку, **не** возвращает фокус на триггер
и **не** управляет портированием. Ограничения — в разделе 13.

Отдельно стоят два поповера в `components/`, которые ведут себя как модалки, но модалками
не являются: `AppSelect` (`:79-102`, портал в `document.body`) и `AppDatePicker`
(`:134-163`, `role="dialog" aria-modal="false"`). Оба при `resize`/`scroll` **закрываются**,
а не перепозиционируются (`AppSelect.tsx:51`, `:54-55`; `AppDatePicker.tsx:89`, `:92-93`).

---

## 12. Сборка и деплой

### TypeScript

`tsconfig.json` (3 строки) — пустой корень со ссылкой на `./tsconfig.app.json`
(project references, `files: []`).

`tsconfig.app.json`:

| Настройка | Строка | Значение |
|---|---|---|
| `target` / `lib` | `:3`, `:5` | `ES2022`; `ES2022, DOM, DOM.Iterable` |
| `allowJs` | `:6` | `false` |
| `strict` | `:10` | `true` |
| `module` / `moduleResolution` | `:12-13` | `ESNext` / `Bundler` |
| `isolatedModules`, `noEmit` | `:15-16` | `true` / `true` (эмитит Vite) |
| `jsx` | `:17` | `react-jsx` |
| `types` | `:18` | `["vite/client"]` — отсюда типы `import.meta.env` |
| **`include`** | **`:20`** | **`["src/react"]`** |

Строка `:20` — то, чем мёртвый Vue физически отрезан от сборки. Проверка типов его
не видит, и `npx tsc -b` на него не ругается.

### Vite

`vite.config.ts` — 7 строк: `plugins: [react()]` (`:5`), `base: '/'` (`:6`).
Никакой ручной нарезки чанков, алиасов, прокси и env-префиксов — всё по умолчанию.
Разделение бандла целиком определяется динамическими `import()` из `App.tsx:7-12`.

### Скрипты и версии (`package.json`)

| Что | Строка | Значение |
|---|---|---|
| `engines.node` | `:7` | `22.x` |
| `dev` | `:10` | `vite` |
| `build` | `:11` | `tsc -b && vite build` |
| `build:vercel` | `:12` | `tsc -b && vite build --mode production` |
| `images:equipment` | `:13` | `node scripts/fetch-equipment-images.mjs` |
| `preview` | `:14` | `vite preview` |
| `@supabase/supabase-js` | `:17` | `2.50.2` |
| `lucide-react` | `:18` | `0.468.0` |
| `react` / `react-dom` | `:19-20` | `19.2.8` |
| `react-router-dom` | `:21` | `7.18.2` |
| `@types/react` / `@types/react-dom` | `:24-25` | `19.2.18` / `19.2.4` |
| `@vitejs/plugin-react` | `:26` | `5.2.0` |
| `typescript` | `:27` | `5.9.3` |
| `vite` | `:28` | `7.3.6` |

Все версии закреплены точно, без `^`. Тестового скрипта нет, линтера в зависимостях нет.
`node_modules` в рабочей копии **отсутствует как каталог** — перед любым `npx tsc -b`
или `npm run build` нужен `npm install`.

### Vercel (`vercel.json`)

| Правило | Строки | Смысл |
|---|---|---|
| `/equipment-images/(.*)` | `:3-8` | `Cache-Control: public, max-age=31536000, immutable` — фото склада навсегда |
| `/assets/(.*)` | `:9-14` | То же для хэшированных бандлов |
| `/brand/(.*)` | `:15-20` | `max-age=604800, stale-while-revalidate=86400` |
| `/illustrations/(.*)` | `:21-26` | То же |
| `/(.*)` | `:27-35` | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| rewrite `/(.*)` → `/` | `:37-39` | SPA-рерайт. Он же — четвёртое звено сценария белого экрана (5.2) |

Чего в заголовках нет: `Content-Security-Policy`, `Strict-Transport-Security`.
Команда сборки и корневой каталог в `vercel.json` не заданы — значит берутся из настроек
проекта в Vercel, которые из git не восстанавливаются (какой из двух build-скриптов
реально вызывается — **не установлено**, проверяется в дашборде Vercel или Vercel MCP).

### Переменные окружения

Ровно две, обе читаются в одном месте — `lib/supabase.ts:3-4`:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Шаблон — `.env.example` (3 строки).
Префикс `VITE_` означает попадание в бандл; для публикуемого ключа Supabase это штатно
(CLAUDE.md, правило 3).

### Файлы-призраки

Пять источников описывают мёртвый Vue и активно вводят в заблуждение — их присутствие
не означает ни что инструмент работает, ни что описанная архитектура существует.
Три лежат в корне, два — в подкаталогах:

| Файл | Где | Почему призрак |
|---|---|---|
| `vitest.config.js` | корень | Импортирует `@vitejs/plugin-vue` (`:2`), настроен на алиас `@ → src` (`:17`). Ни `vitest`, ни `@vitejs/plugin-vue` в `package.json` нет, скрипта `test` нет. **Тестов в проекте нет вообще** |
| `.eslintrc.json` | корень | `plugin:vue/vue3-recommended` (`:9`), плагин `vue` (`:16`), правила `vue/*` (`:24-25`). ESLint и плагин в зависимостях отсутствуют. **Линтера в проекте нет** |
| `.cursorrules` (203 строки) | корень | Инструкции для Cursor: Atomic Design в `src/shared/ui/` (`:7`), Vue 3 Composition API (`:13`), Pinia (`:14`), Tailwind (`:16`), обязательные обёртки поверх PrimeVue (`:22-23`). Ни Vue, ни Pinia, ни Tailwind, ни PrimeVue в `package.json` нет — там пять зависимостей, все React-овые |
| `.cursor/rules/*.mdc` — 7 файлов, 382 строки | подкаталог | Шесть из семи про Vue 3, структуру Vue-проекта и Tailwind; самый крупный — `ui-kit-v2-bento-rules.mdc` (339 строк). Cursor подхватывает их автоматически, то есть агент в Cursor начнёт писать Vue без единого вопроса |
| `docs/ARCHITECTURE.md` (96 строк) | подкаталог | Описывает Vue-структуру `app/router`, `app/store`, `features/events`, `features/users`, `features/reports`, Atomic Design и алиасы `@shared/ui`. Ни одного из этих каталогов в живом коде нет. Агент, прочитавший его вместо этой страницы, спроектирует под несуществующее приложение |

Живой из конфигов — `.prettierrc`: `endOfLine: lf, printWidth: 100, semi: false,
singleQuote: true, tabWidth: 2, trailingComma: es5`. Совпадает с фактическим стилем
`src/react` (сам Prettier в зависимостях тоже не закреплён — форматирование идёт из IDE).

### Где README противоречит коду

| README | Факт |
|---|---|
| `README.md:53`: «Редактирование и удаление исторических записей пока отключены» | Редактирование оборудования работает: кнопка «Редактировать» — `EquipmentPage.tsx:422`, сохранение — `:381-401` через `updateEquipmentModelAndUnit`. Удаление списка работает: `ListsPage.tsx:428-432` → `deleteEquipmentList`, кнопка — `:546` |
| `README.md:53`: «Старую версию по-прежнему можно открыть в ветке `main`» | `main` — единственная ветка (`git branch -a`) и содержит именно новую React-версию. Утверждение ложно и опасно: сотрудник пойдёт искать старую версию там, где лежит прод |
| `README.md:37-42`: раздел «Проверка» — блок с `npm run build` (`:40`) и `npm audit` (`:41`) | Верно по составу, но перед этим обязателен `npm install` — `node_modules` нет |
| `README.md:49`: «страницы кешируются на 10 минут, справочник — на 24 часа» | По TTL верно (раздел 7). Умалчивает главное: показ данных TTL не ограничен, `readCached*` срок годности не проверяет |

`docs/handoffs/2026-08-19-0-audit.md` построчно не сверялся. Из проверяемого: его пункт про «основной
JS-бандл ~354 КБ (109 КБ gzip)» подтвердить нельзя без установки зависимостей и сборки;
его пункт «Полного focus trap внутри боковых панелей пока нет» — **подтверждается**
(раздел 13).

---

## 13. Доступность

### Что есть

| Механизм | Якоря |
|---|---|
| `role="alert"` — единственный на весь проект | `features/auth/LoginPage.tsx:89` |
| `role="status"` на скелетоне маршрута | `app/App.tsx:165` (`aria-label="Загрузка раздела"` — жёстко по-русски, мимо `tr`) |
| `role="dialog" aria-modal="true"` + `aria-label` у трёх drawer'ов | `EquipmentPage.tsx:414`, `ListsPage.tsx:446`, `ListEditorPage.tsx:710` |
| Начальный фокус на кнопке закрытия | `EquipmentPage.tsx:423`, `ListsPage.tsx:451`, `ListEditorPage.tsx:714` |
| Escape закрывает слой | `useModalLayer.ts:15-17`, `:24` |
| Блокировка скролла фона без дёрганья | `useModalLayer.ts:19-23` |
| `role="tablist"` / `role="tab"` + `aria-selected` в мобильном редакторе | `ListEditorPage.tsx:552`, `:553`, `:554` |
| `role="group"` + `aria-pressed` у переключателя языка | `i18n.tsx:47`, `:48-49` |
| Возврат фокуса на триггер в поповерах | `AppSelect.tsx:93`; `AppDatePicker.tsx:117`, `:159` |
| Два блока `@media (prefers-reduced-motion: reduce)` | `styles.css:639`, `:887` |
| `document.documentElement.lang` следует за выбором языка | `i18n.tsx:23` |

Полный инвентарь ролей по `src/react` (grep): `status` ×1, `alert` ×1, `dialog` ×4
(три drawer'а + поповер календаря `AppDatePicker.tsx:138`), `listbox` ×1, `option` ×1,
`tablist` ×1, `tab` ×2, `group` ×1.

### Чего нет

1. **Фокус-ловушки в drawer'ах и возврата фокуса на триггер.** `useModalLayer` этого
   не делает; ничего рядом тоже. Tab из открытой панели уходит в фон под ней, а после
   закрытия фокус теряется в начало документа. При этом в поповерах возврат фокуса
   реализован (`AppSelect.tsx:93`, `AppDatePicker.tsx:117`, `:159`) — **проект не
   согласован сам с собой**, и образец правильного поведения лежит в соседнем каталоге.
2. **`AppSelect` не выполняет объявленный listbox-контракт.** Заявлено:
   `aria-haspopup="listbox"` (`:71`), `aria-expanded` (`:72`), `role="listbox"` (`:83`),
   `role="option"` (`:90`), `aria-selected` (`:91`). Не реализовано: навигация стрелками
   Up/Down, Home/End, выбор по Enter/Space, `aria-activedescendant`. Единственный
   клавиатурный обработчик — Escape (`:50`). Для скринридера это хуже нативного `<select>`:
   контракт обещан и не исполнен.
3. **`aria-live` нет ни одного** (`grep -rn "aria-live" src/react` → 0). Кроме `role="alert"`
   на экране входа, ни одно асинхронное событие не объявляется: успех сохранения
   оборудования, ошибка сохранения, смена этапа списка, удаление, окончание экспорта в
   Excel — всё это меняет DOM молча. Для незрячего пользователя нажатие «Сохранить»
   не даёт обратной связи вообще.
4. **Поповеры закрываются вместо перепозиционирования** при скролле и ресайзе
   (`AppSelect.tsx:51`, `:54-55`; `AppDatePicker.tsx:89`, `:92-93`). Пользователь с
   экранной лупой или зумом теряет открытый список от любого сдвига вьюпорта.
5. **Skip-link'а к основному содержимому нет** — при табуляции придётся пройти весь
   сайдбар (`App.tsx:95-150`) на каждой странице.
6. `role="status"` на `RouteLoader` (`App.tsx:165`) имеет `aria-label` строкой в коде
   мимо `tr` — узбекскому пользователю объявится по-русски.

Зоны касания 44 px и контраст относятся к дизайн-системе — их разбор в странице
по дизайну, а не здесь.

---

## Не покрыто

Не прочитано или не установлено по теме этой страницы:

1. **Реальная схема БД.** DDL таблиц `equipment`, `equipment_lists`, `users`, `events`,
   `mount_points`, `reports` в репозитории отсутствует. Всё, что здесь сказано про
   поля, — это TypeScript-контракт (`features/equipment/types.ts:1-18`,
   `features/lists/api.ts:13-30`), а не описание базы. Устанавливается: Supabase MCP
   (`list_tables`) или дашборд.
2. **Значение `db-max-rows`.** От него зависит, ломается ли `fetchAllEquipment` и
   `fetchEquipmentTaxonomy` (раздел 8). Устанавливается: Supabase Dashboard →
   Settings → API → Max rows.
3. **Настройки проекта в Vercel.** Какая build-команда вызывается (`build` или
   `build:vercel`), какой Node, какие env-переменные заведены, есть ли Deployment
   Protection — в `vercel.json` этого нет. Устанавливается: Vercel MCP / дашборд.
4. **Фактический размер бандла и его нарезка.** Требует `npm install` + `npm run build`;
   `node_modules` отсутствует. Утверждение `docs/handoffs/2026-08-19-0-audit.md` о 354 КБ / 109 КБ gzip
   не проверено.
5. **Корректность самописного ZIP в `features/lists/xlsxExport.ts`.** Экранирование XML
   больше не вопрос — оно есть и разобрано в разделе 6. Остаётся непроверенным сам
   контейнер: `crc32` (`:190-197`) и `zip` (`:202-234`) написаны руками, метод сжатия
   выставлен в 0 — store (`:212`), Zip64-записи нет (EOCD ровно 22 байта, `:223`).
   Ни один сгенерированный файл в рамках этой сверки не открывался в Excel.
   Проверяется прогоном экспорта на длинном списке и
   открытием результата в Excel и LibreOffice. Второй незакрытый пункт того же файла —
   `&` в колонтитулах (раздел 6).
6. **`features/equipment/EquipmentVisual.tsx`** (135 строк) прочитан частично: разобраны
   `normalize()` (`:26-32`) и `imageKey()` (`:34-37`), которые де-факто задают контракт
   именования файлов в `public/equipment-images/`. Логика прелоада, счётчиков ratio
   и фолбэка на иконку категории не разобрана.
7. **Внутренности трёх больших страниц.** `ListEditorPage.tsx` (731),
   `ListsPage.tsx` (557), `EquipmentPage.tsx` (512) прочитаны точечно — по якорям кэша,
   drawer'ов, гвардов и ролей. Их состояние, эффекты и порядок вычислений полностью
   не разобраны; расчёт остатков и распределение по единицам в редакторе — тема страницы
   по фичам.
8. **`styles.css`** (889) не разбиралась: проверены только два блока
   `prefers-reduced-motion` (`:639`, `:887`). Дизайн-система — отдельная страница.
9. **Порядок применения `scripts/*.sql` относительно `supabase/migrations/`** нигде не
   зафиксирован; механизма применения в репозитории нет (нет `supabase/config.toml`,
   нет пакета `supabase`, нет `.github/`). Это тема страницы по БД, но она напрямую
   влияет на то, какие колонки реально доступны клиенту и, следовательно, срабатывает ли
   legacy-фолбэк из раздела 9. Столкновение видно прямо в двух файлах:
   `scripts/2026-08-19_reservations_history_rls.sql:1056` выдаёт
   `grant select, insert, update, delete on table public.users to authenticated`, а
   `scripts/2026-08-19_security_performance_hardening.sql:6` — `revoke all on table
   public.users from authenticated`. Какой из них применён последним, из git не
   восстанавливается.

   **Два факта, которые нельзя читать порознь.** Отзыв прав выше — табличный и на
   `public.users`, а не column-level на `equipment_lists`; на фолбэк раздела 9 он не
   влияет. Выглядит он как поломка входа, но ею не является: `private.is_app_member()`
   (`scripts/2026-08-19_reservations_history_rls.sql:9-21`) и `private.has_any_role()`
   (`:23-36`) объявлены `security definer` (`:13`, `:27`) и выполняются с правами
   владельца функции, поэтому отзыв гранта у роли `authenticated` их не касается;
   `authenticated` дан только `execute` на эти функции (`:40-41`).
   **Не «чинить» этот revoke возвратом прав** — прямого доступа к `public.users` у
   клиента и не должно быть, а возврат откроет таблицу ролей. Чем именно владеют эти
   функции и освобождён ли владелец от RLS (`public.users` — `enable row level security`,
   `:882`), **не установлено**; устанавливается
   `select relowner, relforcerowsecurity from pg_class where relname = 'users'`.
10. **Поведение `React.lazy` при отказе чанка не воспроизведено экспериментально.**
    Цепочка раздела 5.2 выведена из кода и правил Vercel (рерайты применяются после
    проверки файловой системы), но не проверена на живом деплое. Проверяется так:
    открыть прод, выкатить новый билд, не перезагружая вкладку перейти в непрогретый
    раздел; ожидание — белый экран и ошибка загрузки модуля в консоли браузера.
