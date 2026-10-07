# План: воксельный мир в продукте (`src/react/features/world`) — `planner`, с51

Источник облика — макет `docs/project/design/voxel-world-s50.html` (4542 строки: CSS 11–878, DOM 881–1024, скрипт 1026–4540). Раскладка зон — целевая с51 (одна карта, три зоны вдоль дороги, приглушённые соседи, надписи на земле, ограда, «плюсы»); файл `voxel-world-s51.html` не читался — он в работе. Мост Supabase жив с с51 (планировщик его не трогал: всё про базу в плане — по коду и миграциям).

## Решения

1. **Vanilla three, без r3f/drei.** Это отменяет строку брифа с46 «стек — `react-three-fiber` (+ `drei`)» — нужно «да» прораба (вопрос 1 в конце).
2. **Движок — императивный, React — оболочка и HUD.** `createWorld(container, deps)` возвращает `{ setData, setStyle, goZone, select, dispose, store }`; React монтирует его в `useEffect`, а HUD рисует компонентами через `createPortal` в элементы `CSS2DObject`. Позиции вывесок двигает движок по кадру (как `layoutHud` макета), `setState` в кадре нет.
3. **Никаких THREE-объектов на уровне модуля.** В макете всё глобально (`W`, `state`, `roots`, `labels`, `MATS`, `GEO`, `GATES`, `RINGS`, `P`, `SH`). В продукте всё это — поля `WorldCtx` одного экземпляра. Иначе StrictMode и HMR получают два мира на общих кэшах.
4. **Портируем только принятую форму `softline`.** Оси `cube/soft/toy/line` и `?shape=` остаются на стенде `voxel-style-s48.html` (бриф с49). Уходят `SHAPE_CFG`, ветки `toy` в `kit()` и панель макета.
5. **Маршрут `/world` только под `import.meta.env.DEV`** до шага выкатки. Прод-сборка не получает ни маршрута, ни чанка three, ни фикстур.
6. **Зона без источника данных не строится.** `WorldData.venues === null` → зон «Площадки» и «Где работали» на карте нет, кадр камеры = кампус. Фикстуры живут только в dev.
7. **Мир не входит в общий прогрев `moduleTimer`** в `AppShell` (`02-decisions`: «расширять прогрев тяжёлым — значит откатывать с26»). У него свой отложенный прогрев с условиями (§3).

## 1. three напрямую против r3f/drei

Версии по npm-реестру на 2026-10-07: `three` 0.186.1, `@types/three` 0.186.0, `@react-three/fiber` 9.8.1 (peer `react >=19 <19.4`), `@react-three/drei` 10.7.9. Context7 (`/pmndrs/react-three-fiber`) подтверждает: fiber@9 — пара к react@19; `<primitive object>` при размонтировании не диспозится; StrictMode с v9 наследуется от react-dom.

| Ось | Vanilla three | r3f + drei |
|---|---|---|
| Перенос макета | ~3,5 тыс. строк JS почти 1:1: `kit()`, `makeCar`, `viewPose`, `layoutHud`, `hullMaterial` с `onBeforeCompile`, слияние геометрий | Переписывание. Либо честный JSX (теряется `mergeGeometries` в один меш на «материал + рёбра»), либо всё через `<primitive>` — тогда r3f даёт только `Canvas` и цикл, а dispose всё равно наш |
| Чанк мира (оценка gzip) | three ~160–185 КБ + аддоны ~12–18 КБ + свой код ~20–30 КБ = **~195–235 КБ** | то же + fiber ~45–55 КБ + используемое из drei ~15–40 КБ = **~255–330 КБ** |
| React 19 | не зависит | работает, но peer `<19.4` ставит потолок на обновление React |
| Правки прорабом | Читает тот же код, что принимал в макете: «поднять крышу» = число в `buildOffice` | JSX привычнее, но мир — геометрия и матрицы, а не компоненты; `drei`-абстракции — третий слой между ним и three |
| HMR | Правка модуля движка пересоздаёт мир (~100–300 мс); позу камеры и зону держим в `import.meta.hot.data` | Точечный HMR — единственный реальный плюс |
| Шпаргалка | `docs/system/libs/three.md` уже есть (r186) | нужны две новые |
| Зависимости | 6 → 7 рантайм | 6 → 9 (+ транзитивные zustand, react-reconciler, three-stdlib) |

**Рекомендация: `three@0.186.1` (точная версия, как в макете) + dev `@types/three@0.186.0`.** r3f окупается, когда сцена — дерево реактивных компонентов. Здесь сцена — генератор миниатюр из данных, с ручной камерой и ручной раскладкой HUD. Цифры размера — оценка, факт снимается build-логом в Ш1.

Следствие для Vite: чанк three ≈ 600–700 КБ min при `chunkSizeWarningLimit: 250`. Варнинг неизбежен: three не режется ниже порога, даже разделённый на `three.core` и `three.module`. В `manualChunks` (`vite.config.ts`) добавить ветку `three` → чанк `three`, чтобы правка мира не сбрасывала его из кэша. Варнинг принять и записать в `02-decisions`; порог глобально не поднимать (вопрос 2).

## 2. Модель модулей

Порог ~800 строк на файл; по оценке самый крупный модуль — `zones/archive.ts` (~400). В `engine/` нет React, в `hud/` нет three.

```
src/react/features/world/
  WorldPage.tsx          dev-маршрут /world: сцена + панель сценариев (из «панели макета»)
  WorldStage.tsx         монтирует движок в слот, порталы HUD, откаты (нет WebGL / потерян контекст)
  loadWorld.ts           import('./engine/createWorld') + прогрев; НЕ lazyWithReload (см. §3)
  support.ts             hasWebGL2(), prefersReducedMotion(); вне чанка three, без импортов three
  settings.ts            ключ argo-world-style: readWorldStyle / saveWorldStyle / useWorldStyle; вне чанка three
  worldStore.ts          внешний стор движок→React (zone, hover, pick, labels, hudCompact) под useSyncExternalStore
  data/
    types.ts             WorldData: campus, cars, people, today, venues|null, archive|null
    useWorldData.ts      адаптеры из живых API (§4)
    carKinds.ts          brand+model → kind из SPEC, color (текст) → hex, запасной силуэт
    fixtures.dev.ts      CARS/DAYS/PLACES/ARCH_PLACES/EMPLOYEES макета; импорт только под DEV
  engine/
    createWorld.ts       WorldCtx, renderer, сцена, свет, туман, цикл, ResizeObserver, dispose   ← initWorld, buildWorld, restyle
    tokens.ts            чтение токенов :root                                                    ← T, tok
    style.ts             PALETTES (white/night), INKS, роли материалов                           ← applyStyle, hullMaterial
    primitives.ts        box, solid, kit, rbox, hull, inkLines, crease; кэши GEO/MATS в ctx      ← «3D: примитивы»
    ground.ts            земля, сетка, дороги, дерево, границы участков                          ← ground, roads, tree
    groundLabel.ts       надпись на земле (CanvasTexture)                                        ← gateTexture, makeGate
    buildings.ts         buildOffice, buildWarehouse, buildGarage
    cars.ts              SPEC, makeCar (сверка с voxel-cars-spec.md)
    people.ts            makePerson, pose
    selection.ts         наведение, выбор; кольцо с50 → ограда с51                               ← makeRing…tickRings
    camera.ts            sph, framePoints, viewPose, fit, pullIn, переезд между зонами           ← CAM, placeCamera, camTo
    pointer.ts           raycast, hover, pick, клавиатура                                        ← pickAt, bindPointer, activate
    life.ts              фургон, бригада, прохожие                                               ← homeLife, tickLife
    hudLayout.ts         перемер и расстановка вывесок без наложений (геометрия прямоугольников) ← measureHud, placeSign, layoutHud
    zones/layout.ts      три зоны вдоль дороги, приглушение соседей, «плюсы» (из с51)
    zones/campus.ts      buildCampus
    zones/garage.ts      garageShell, buildGarageView, setLayout, tickGarage, въезд и выезд
    zones/venues.ts      buildLot, buildTruck, buildStay, участки
    zones/archive.ts     кварталы, высоты, цели тапа
  hud/
    Sign.tsx, NameChip.tsx, DayCap.tsx, EventCard.tsx, Dock.tsx (кнопки-дубли),
    CarCard.tsx, VenuePanel.tsx, ArchivePanel.tsx, icons.tsx
  settings/WorldSettingsPage.tsx    экран «Настройки» с живым предпросмотром
  world.css, world-hud.css, world-venues.css, world-archive.css, world-settings.css
```

Правила слоя:
- **CSS.** Feature-CSS в проекте не изолирован (`02-decisions`, с37), поэтому у всех селекторов мира префикс `w-`. В макете они голые (`.sign`, `.cap`, `.dock`, `.plaque`, `.panel`, `.route`) и пересекутся с продуктом. Блок токенов и оболочки макета (строки 12–176, `.u-*`, `.p-tabs`) не переносится: токены совпадают с `styles/01-tokens.css` (сверено, все 22 на месте).
- **HUD.** В макете это `innerHTML`-строки (`signHTML`, `renderDock`, `renderCap`, `renderRoute`). В продукте — компоненты с `tr(ru, uz)` и существующими `ruPlural`, знаком госномера (`splitPlate` из главной), `toLocaleString(locale)`. Узбекских строк в макете нет — их пишет кодер (долг «носителем не проверено» растёт).
- **Материалы приглушённых соседей.** Кэш материалов в макете общий по цвету; для приглушения ключ кэша должен включать зону. Точное решение приходит из с51, место для него — `style.ts`.
- **Адрес.** Зона — `?zone=` через `replace` (в макете hash); гараж — маршрут `/vehicles`; участок — маршрут вместе с `venues`.

## 3. Ленивый чанк и откаты

- **Точки входа в чанк three:** `/world` (dev), затем главная в режиме «мир», `/vehicles`, «Настройки». Импорт — `loadWorld()`.
- **Загрузка на главной — не через `lazyWithReload`.** Тот при провале чанка перезагружает страницу, а главная — прежде всего навигация. `loadWorld()` ловит отказ сам: `reportAppError(scope: 'chunk')` и плитки.
- **Первый кадр главной.** Плитки рисуются сразу, из `readCachedHomeSummary`. Мир встаёт поверх своего слота, когда чанк и сцена готовы, без сдвига вёрстки (высота слота фиксирована).
- **Прогрев.** Отдельный таймер в `AppShell` (не `moduleTimer`), `requestIdleCallback` с запасным `setTimeout` ~2 с. Условия: `home === 'world'`, `hasWebGL2()`, нет `navigator.connection?.saveData`. Греется только JS-чанк, сцена не строится.
- **Таблица откатов** (решения брифа с47/с50, единственное место — `WorldStage` + `HomePage`):

| Условие | Главная | Гараж, площадки |
|---|---|---|
| нет WebGL2 / чанк не приехал / `webglcontextlost` | нынешние плитки | список (текстовый путь) |
| «Главная: плитки» в настройках | плитки, чанк не грузится | мир |
| `prefers-reduced-motion` | неподвижный мир: `enableDamping = false`, `life.ts` стоит, рендер по требованию, переезд камеры мгновенный | то же |

- **Плитки выделяются из `HomePage`** в `features/home/HomeTiles.tsx` чистым переносом (первый шаг внедрения на главную): они и запасной вид, и нижняя половина телефона.
- **Телефон (≤820, `MOBILE_MEDIA_QUERY`).** Мир сверху картой фиксированной высоты, плитки ниже; пять вкладок прежние, «Настройки» — в листе «Ещё». Сцена только для тапов: вращение одним пальцем выключено, `touch-action: pan-y`, иначе `OrbitControls` съест прокрутку страницы. Цель тапа — участок и квартал (бриф с50). `setPixelRatio(min(dpr, 2))`. Цикл стоит, когда слот вне экрана (`IntersectionObserver`) и при `document.hidden`. Живой телефон, Safari и палец не проверял никто — приёмка только у прораба.

## 4. Данные

`WorldData` — единственный вход движка. Адаптер не хранит копий: читает существующие кэши и API, новых ключей `persistentCache` не заводит.

| Что в мире | Источник сейчас | Примечание |
|---|---|---|
| Вывеска склада: единицы | `fetchHomeSummary` → `equipment.units` | ключ `home:summary`, как у плиток и меню |
| Вывеска гаража: число машин | `summary.vehicles.count` | |
| Вывеска офиса: число списков | `fetchEquipmentLists(...).total`, тот же запрос, что в `HomePage` | в `home_summary` списков нет; в числе 4 мусорных `ТЕСТ-с10-*`, как и на плитке |
| Машины гаража, госномер, водитель | `fetchVehicles` / `readCachedVehicles` (`VehicleWithDrivers.drivers`) | 6 строк, прогреты; силуэт по `carKinds.ts`: неизвестная модель → запасной силуэт; `color` — свободный текст → таблица в hex с запасным белым |
| Фигурки и чипы имён | `fetchEmployeeList` / `readCachedEmployeeList` | 12 строк, паспортных полей в выдаче нет |
| «Сегодня мероприятие» | **источника нет** | `hallPlan.eventFrom/eventTo` покрывает только план залов; списки по `reservation_start/end` на первой странице выдачи не гарантированы |
| «86 на выезде», «1 в пути» | **источника нет** | связи списка с машиной в схеме нет — вторые строки вывесок не показываем |
| «Площадки», «Где работали» | **таблицы `venues` нет** | появятся с `venues_board()` (`lodging-s49.md`) |

Честность в проде:
- `venues` и `archive` в прод-адаптере — `null`; зоны не строятся, надписей «0 мест» и «скоро» нет. Пустая «Где работали · 0» была бы ложью, а не пустым состоянием.
- В dev `useWorldData` подмешивает `fixtures.dev.ts` динамическим импортом под `import.meta.env.DEV` (в прод-бандл не попадает). В HUD — постоянная метка «макетные данные» на зонах с фикстурами. «Плюс» добавления в dev отвечает тостом «макет», в базу не пишет.
- «Сегодня» до появления источника выключено: фургон стоит в гараже, карточки события нет. Источник — отдельный этап со схемой (Ш8).

## 5. Этапы

Порядок по зависимостям. «Пар.» — что отдаётся разным кодерам одновременно; граница — владение файлами. Гейты каждого шага — `npm run check` и `npm run build`; в отчёте размер чанков из build-лога.

**Ш0. Решения и онбординг (без кода продукта).** Ответы прораба на вопросы 1–4. Правки `docs/system/libs/three.md`: npm-подключение вместо importmap, конвенции «ctx вместо глобалей», «dispose по списку», «порталы HUD». Вычеркнуть r3f в `voxel-brief.md`. Дождаться приёмки `voxel-world-s51.html`: Ш5–Ш7 портируются с него, не с с50.

**Ш1. Скелет: мир открывается на `/world` (dev).** Один кодер, с с51 не пересекается.
- `package.json` (three точной версией, `@types/three` в dev), `vite.config.ts` (чанк `three`).
- `App.tsx`: маршрут `/world` внутри `AppShell` под `import.meta.env.DEV`, через `lazyWithReload` (здесь это допустимо — страница целиком).
- Новые файлы: `WorldPage`, `WorldStage`, `loadWorld`, `support`, `worldStore`, `engine/createWorld|tokens|style|primitives|ground|camera`, `engine/buildings.ts` — только офис, `world.css`.
- Чекпоинт: `localhost:5180/world` → сетка, дорога, офис в «гальке с контуром», камера крутится. Уйти на `/lists` и вернуться 5 раз → в консоли нет «Too many active WebGL contexts», один `<canvas>` в DOM. Сборка прода: чанка `three` в `dist/assets` нет (маршрут срезан).
- Факты в отчёт: размер чанка three и чанка мира (min и gzip), время от импорта до первого кадра.

**Ш2. Кампус целиком, статично.** Пар.: кодер А — `buildings.ts` (склад, гараж) + `zones/campus.ts`; кодер Б — `cars.ts` + `people.ts` + `data/carKinds.ts`; кодер В — `settings.ts` + палитра «Ночь» и тон контура в `style.ts` + `setStyle` без перезагрузки (`restyle` макета).
- Чекпоинт: три здания, 6 машин у гаража, 12 фигурок. В dev-панели переключить «Ночь» и три тона контура → мир перекрашивается, камера на месте, `localStorage['argo-world-style']` меняется.

**Ш3. HUD кампуса и выбор.** Пар.: А — `engine/pointer.ts`, `selection.ts`, `hudLayout.ts`; Б — `hud/Sign|NameChip|Dock|DayCap|icons` + `world-hud.css`. Контракт между ними (поля `worldStore` и карта `labels`) фиксируется в `worldStore.ts` на Ш1.
- Чекпоинт: вывески «Знаки B2» над зданиями не налезают на 1440 и 390. Tab проходит по кнопкам-дублям, фокус подсвечивает здание, Enter ведёт в раздел (`/lists`, `/equipment`, `/vehicles`). Переключатель языка меняет подписи.

**Ш4. Живые данные кампуса.** Один кодер: `data/types.ts`, `data/useWorldData.ts`, подключение в `WorldStage`.
- Чекпоинт: числа на вывесках равны числам плиток главной в соседней вкладке; машины — 6 с настоящими госномерами; имена на чипах из `employees`. Сверка скаутом: `select count(*)` по `equipment`, `vehicles`, `employees`, `equipment_lists` против экрана (если мост жив).

**Ш5. Одна карта с тремя зонами (из принятого с51).** `zones/layout.ts`, `groundLabel.ts`, переезд камеры в `camera.ts`, `?zone=`. Пар. после общего `layout.ts`: А — `zones/venues.ts` + `hud/VenuePanel` + `world-venues.css`; Б — `zones/archive.ts` + `hud/ArchivePanel` + `world-archive.css`; В — ограда и «плюсы» в `selection.ts`. Данные — `fixtures.dev.ts`.
- Чекпоинт: соседние зоны приглушены, клик по надписи на земле → камера переезжает, зона становится яркой. Выбор участка поднимает ограду. Наведение на пустую ячейку показывает «плюс». Метка «макетные данные» видна. С `?mock=off` зон нет, кадр = кампус.

**Ш6. «Настройки» и главная (выкатка в прод).**
- Ш6а — чистый перенос плиток: `features/home/HomeTiles.tsx` из `HomePage.tsx`, поведение не меняется. Чекпоинт: главная на проде неотличима от прежней.
- Ш6б — маршрут `/settings` (`WorldSettingsPage`), пункт в сайдбаре и в листе «Ещё» (`App.tsx`).
- Ш6в — `HomePage` выбирает мир или плитки по таблице §3; прогрев чанка в `AppShell`; `/world` остаётся dev-стендом.
- Пар.: Ш6а и Ш6б одновременно (`HomePage`/`HomeTiles` против `settings/` + `App.tsx`); Ш6в после обоих.
- Чекпоинт: «Главная: плитки» → прежняя главная, во вкладке Network нет чанка `three`. «Мир» → кампус. Chrome с выключенным WebGL (`--disable-gpu` или флаг) → плитки без ошибок. 390 → мир сверху, плитки ниже, страница прокручивается пальцем по сцене.
- Размер входного чанка до и после — в отчёт: `support.ts` и `settings.ts` не должны тянуть three.

**Ш7. Гараж на `/vehicles`.** `zones/garage.ts`, `hud/CarCard`, врезка в `VehiclesPage.tsx` (разделённый экран, «Свернуть 3D» → нынешний реестр, выбор сохраняется per-device). Въезд из кампуса с анимацией требует одного renderer на два маршрута: узел сцены живёт в `AppShell` и переезжает в слот страницы (`appendChild`, приём макета `setView`). Это отдельный подшаг — подъём хоста из `WorldStage` в `AppShell`; до него гараж строит свой экземпляр без перелёта.
- Чекпоинт: клик по машине = строка реестра и карточка справа с водителем. Поиск по госномеру подсвечивает машину. «Свернуть 3D» → прежняя страница. 390 → сцена сверху, лист снизу.

**Ш8. «Сегодня» — схема до кода.** Отдельная миграция: `create or replace function home_summary` с блоком `today` (списки и план залов, чей период покрывает сегодня; имя, место, число позиций). Дата «сегодня» — по Ташкенту (`(now() at time zone 'Asia/Tashkent')::date`), а не `current_date` сессии. Потом код: `parseHomeSummary` читает `today` как необязательное поле, `life.ts` включает фургон, появляется `EventCard`.
- Совместимость в обе стороны: старый клиент неизвестный ключ игнорирует, новый без ключа считает «мероприятий нет».
- Ждёт живого моста; `planner` на формулу «сегодня» — отдельным заходом.
- RPC начнёт отдавать имена списков → **прогон `/rls-verify` под двумя аккаунтами обязателен до закрытия**.

**Ш9. Живые «Площадки» и архив** — после `venues` и `venues_board()` по `lodging-s49.md`. Адаптер меняет `null` на данные, фикстуры удаляются тем же шагом (правило «мусора не заводим»), «плюс» получает настоящее действие. Новые таблицы и политики → `/rls-verify`.

## 6. Риски

- **Бандл.** +~200–235 КБ gzip ленивым чанком; прораб снял ограничение по весу (бриф с46), но варнинг Vite появится на каждой сборке. Проверять на Ш1 и Ш6в, что three не утёк во входной чанк через статический импорт из `settings.ts`, `support.ts` или `hud/*`. Любой `import … from 'three'` вне `engine/` — дефект.
- **Утечки и dispose.** `dispose()` обязан сделать: `setAnimationLoop(null)`, `ResizeObserver.disconnect()`, снять слушатели указателя, клавиатуры и `document.fonts`, `controls.dispose()`, обход сцены (`geometry`, `material`, `material.map`), очистить кэши ctx, `renderer.dispose()` + `forceContextLoss()`, удалить `canvas` и слой CSS2D. Браузер держит ~16 WebGL-контекстов, утечка проявится на десятом-двадцатом заходе. Проверка — чекпоинт Ш1 (5 заходов) и снимок кучи скаутом на Ш6.
- **StrictMode.** Двойной mount в dev: эффект создаёт мир, cleanup сносит, эффект создаёт снова. Работает только при полном dispose и отсутствии модульных THREE-объектов (решение 3). Асинхронный `loadWorld()` в эффекте — с флагом отмены, иначе второй мир встанет в отмонтированный контейнер.
- **Порталы HUD.** Элемент `CSS2DObject` создаёт движок, а содержимое рисует React. При `restyle` и пересборке зоны элементы должны переживать пересборку или стор обязан отдать новую карту `labels` до удаления старых узлов, иначе React размонтирует портал в уже удалённый узел. `CSS2DRenderer` каждый кадр пишет `transform` в элемент — анимировать можно только внутренний блок (`three.md`).
- **Шрифт надписей на земле.** `gateTexture` ждёт `document.fonts.ready`, но оно не гарантирует загрузку начертания, которого на странице ещё нет (Manrope 800, кириллица). Нужен явный `document.fonts.load('800 116px Manrope', text)` и перерисовка текстуры после него. Узбекский «o‘» — проверить, что глиф есть в подмножествах woff2 из `assets/fonts`. Смена языка перерисовывает текстуры.
- **Доступность.** Canvas скринридеру ничего не даёт: каждый кликабельный объект — настоящая `<button>` или `<Link>` в `Dock` и списках, текстовый путь существует без WebGL. Фокус не теряется при пересборке HUD (в макете это чинилось руками в `setView`). «Настройки» со скринридером не проверены (долг с50).
- **Кэш.** `argo-world-style` — настройка устройства, вне `persistentCache` и вне `purgeCacheScope`: выход из системы её не стирает, у двух сотрудников на одном компьютере она общая. Владелец один — `settings.ts`. Синхронизация между вкладками — событие `storage`.
- **Лимит 1000 строк Data API** мир не задевает (6 машин, 12 сотрудников, агрегаты RPC). Задевал бы склад с 1471 единицей, но склад в мире — одно здание с числом.
- **Телефон и Safari.** Жесты, `:has()`, `inert`, потеря контекста при сворачивании вкладки на iOS (`webglcontextlost` → плитки) — машиной не проверяется.
- **HMR.** Правка модуля движка пересоздаёт мир; без сохранения позы камеры в `import.meta.hot.data` прораб после каждой правки возвращается в стартовый кадр — заложить в Ш1.
- **Параллельный с51.** Модули, зависящие от раскладки (`zones/layout`, `camera` — переезд, `selection` — ограда, `groundLabel`), до приёмки с51 не портировать. Ш1–Ш4 от с51 не зависят.
- **Тестов и линтера нет.** Гейты — `tsc -b` и сборка; расчёты (`viewPose`, `hudLayout`, `carKinds`) держать чистыми функциями без three-сцены, чтобы скаут мог сверить их скриптом против макета.
- **Мост Supabase** жив с с51. Ш1–Ш7 базу не трогают; Ш8 и Ш9 без моста не стартуют.

## В библию и доки

- `02-decisions.md`:
  - мир — vanilla three, почему не r3f;
  - чанк `three` и принятый варнинг размера;
  - мир вне `moduleTimer`, свой прогрев и его условия;
  - загрузка мира на главной мимо `lazyWithReload`;
  - `argo-world-style` — настройка устройства вне скоупа пользователя;
  - зона без источника не строится.
- `docs/system/libs/three.md`: npm-подключение, `WorldCtx`, список dispose, порталы HUD, шрифты текстур.
- `voxel-brief.md`: строка про r3f заменена решением с51.
- `current-state.md`: число зависимостей (6 → 7), размеры чанков, файлы у порога.
- `03-data-model.md`: только на Ш8 (блок `today` в `home_summary`).

## Вопросы прорабу (до Ш1)

1. Vanilla three вместо r3f/drei из брифа с46 — да?
2. Варнинг Vite о размере чанка `three` принять, порог 250 не поднимать — да?
3. `/world` только на локалхосте (в превью Vercel не виден). Если нужен в превью — флаг `VITE_WORLD=1`; значение не секретное.
4. До Ш8 фургон не ездит и карточки события нет — согласен, или «сегодня» поднять выше гаража?

## Файлы

- Макет: `docs/project/design/voxel-world-s50.html`
- Бриф: `docs/project/design/voxel-brief.md`
- Шпаргалка: `docs/system/libs/three.md`
- Роутер и прогрев: `src/react/app/App.tsx` (`App`, `AppShell`, `moduleTimer`)
- Главная: `src/react/features/home/HomePage.tsx`, `src/react/features/home/api.ts` (`fetchHomeSummary`, `parseHomeSummary`)
- Машины: `src/react/features/vehicles/api.ts` (`fetchVehicles`, `readCachedVehicles`), `src/react/features/vehicles/VehiclesPage.tsx`
- Сотрудники: `src/react/features/employees/api.ts` (`fetchEmployeeList`)
- Сборка: `vite.config.ts` (`manualChunks`), `src/react/lib/lazyWithReload.ts`
- RPC: `supabase/migrations/20260928133529_home_summary.sql`
- План `venues`: `docs/project/plans/lodging-s49.md`
