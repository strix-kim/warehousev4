// Стор «движок → React»: движок пишет сюда из кадра и обработчиков указателя,
// HUD читает через useSyncExternalStore. Здесь же контракт между движком и
// оболочкой — типы без three: этот файл грузится во входном чанке.
import { useSyncExternalStore } from 'react'

export type WorldZone = 'campus' | 'venues' | 'archive'
// Ряд вдоль главной дороги, слева направо: у ряда есть края, кольца нет
export const WORLD_ZONES: readonly WorldZone[] = ['archive', 'campus', 'venues']
export const isWorldZone = (value: unknown): value is WorldZone => WORLD_ZONES.includes(value as WorldZone)

// Здания кампуса: у каждого вывеска над крышей, клавиша-дубль и раздел продукта
export type WorldSiteId = 'office' | 'warehouse' | 'garage'
export const WORLD_SITES: readonly WorldSiteId[] = ['office', 'warehouse', 'garage']

// Ключ подписи фигурки в labels; у здания ключ — сам WorldSiteId
export const whoLabelId = (personId: string) => `who:${personId}`

// Кнопка на земле, ведущая в зону. Лежит в промежутке между соседями: gap 0 — между
// «Где работали» и кампусом, 1 — между кампусом и «Площадками». В кампус ведут две
// (по одной с каждой стороны) — нужна та, что со стороны зоны from.
export const gateId = (to: WorldZone, from: WorldZone) =>
  to === 'archive' ? 'gate:0:archive' : to === 'venues' ? 'gate:1:venues' : from === 'venues' ? 'gate:1:campus' : 'gate:0:campus'

// Объекты участка «Площадок»: id = `<часть>:<id мероприятия>` (участок = мероприятие,
// с58; поле venueId — историческое имя этого id). lot — здание и весь надел, truck —
// грузовик (у мероприятия есть списки), stay — отель расселения (данных нет, в сцене не
// строится до Э2 плана world-work-s58), plan — стол с планом залов; addtruck / addplan —
// пустое место под них с «плюсом».
export const LOT_PARTS = ['lot', 'truck', 'stay', 'plan', 'addtruck', 'addplan'] as const
export type WorldLotPart = (typeof LOT_PARTS)[number]
export const lotPartId = (part: WorldLotPart, venueId: string) => `${part}:${venueId}`
// Пустая ячейка сетки после последнего участка — «Новое мероприятие»
export const ADD_LOT_ID = 'addlot'
export function parseLotId(id: string | null): { part: WorldLotPart; venueId: string } | null {
  const at = id?.indexOf(':') ?? -1
  if (!id || at < 0) return null
  const part = id.slice(0, at) as WorldLotPart
  return LOT_PARTS.includes(part) ? { part, venueId: id.slice(at + 1) } : null
}
// «Плюс» — пустое место, которое можно заполнить
export const isAddId = (id: string) => id === ADD_LOT_ID || id.startsWith('addtruck:') || id.startsWith('addplan:')

// «Где работали»: здание места и квартал (номер по порядку нарезки, с нуля)
export const placeId = (archivePlaceId: string) => `place:${archivePlaceId}`
export const blockId = (index: number) => `block:${index}`

// Строки, которые движок рисует сам (надписи на земле): в движке текстов интерфейса
// нет, оболочка даёт их готовыми через tr и присылает заново при смене языка или чисел.
// sub — подстрочник («5 мест»); пустая строка — без него.
export type WorldTexts = { zones: Record<WorldZone, { name: string; sub: string }> }

/* Контракт HUD между движком (engine/) и оболочкой (hud/, WorldStage). Обе стороны
   держатся его, а не кода друг друга.

   Подписи. Движок создаёт элемент CSS2DObject на каждое здание (класс w-sign) и на
   каждую фигурку (класс w-who) и кладёт его в labels. Элемент — точка-якорь 0×0, он
   движка: только движок пишет ему классы w-sign--sm (компактный вид), is-away (места
   нет), is-hover, is-selected, is-near (фигурка под указателем) и переменные --shift,
   --lift (px). Чип w-who — исключение: он сам и есть плашка (не якорь 0×0), меряется
   целиком, и движок пишет ему style.translate: сдвиг внутрь у края кадра и подъём
   ступенькой над соседним чипом. Содержимое — оболочки: порталом в w-sign идут .w-sign__leg и
   button.w-sign__board (движок меряет именно board, в полном и компактном виде), в
   w-who — текст чипа. Детей движок не трогает, оболочка не трогает сам элемент.

   Обвязка. Любой элемент внутри .w-stage с атрибутом data-w-chrome — неподвижная
   плашка (день, клавиши): вывески её обходят. Перемер движок запускает сам, по
   изменению детей сцены, — звать его не нужно. Панель выбранного (место, квартал) —
   data-w-chrome="panel": пока она открыта, движок сдвигает кадр влево, чтобы якорь
   выбранного не лежал под ней (engine/panelShift.ts).

   Наведение и выбор. hover и pick пишут обе стороны: движок — от указателя по сцене,
   оболочка — от наведения и фокуса на вывеске и клавише. Движок подписан на стор и
   по нему ведёт кольцо на земле и классы подписей. Клик по зданию в сцене: движок
   ставит pick и зовёт deps.onActivate(id); клик по вывеске или клавише — то же делает
   оболочка. Переход в раздел — всегда оболочка.

   Курсор. Над целью движок ставит класс is-pick на свой контейнер (.w-scene).

   Зоны (Ш5). Карта одна: кампус в начале координат, «Площадки» справа, «Где работали»
   слева. Зона строится, только если у неё есть данные (WorldData.venues / archive не
   null); построенные лежат в zones. zone — зона под камерой; остальные приглушены, их
   подписи сняты со слоя камеры (display: none ставит рендерер), их объекты не цели:
   клик по любой точке приглушённой зоны = её кнопка на земле. Хозяин зоны — адрес
   (?zone=): кнопка на земле зовёт deps.onZone, оболочка пишет адрес через replace и
   зовёт world.goZone; сама зону движок меняет только на кампус, когда у запрошенной
   нет данных. flying — камера едет: указатель не активирует, HUD может гаснуть.

   Id объектов (он же ключ подписи в labels и значение hover / pick):
     здание кампуса — WorldSiteId; фигурка — whoLabelId; кнопка зоны — gateId;
     участок — lotPartId(part, venue.id), пустая ячейка — ADD_LOT_ID;
     «Где работали» — placeId(place.id) и blockId(n); вывеска пустого архива —
     ARCH_EMPTY_ID (archiveBlocks.ts): только ключ подписи, объектом выбора не бывает.
   Квартал — цель только пальцу и компактной сцене (там и здание отвечает как свой
   квартал); мышью его выбирает вывеска, а клик по земле снимает выбор.
   Выбор участка: pick = id любой части участка. Движок поднимает ограду всего участка
   (ключ ограды — lotPartId('lot', venueId)) и ставит is-selected якорю с этим id;
   панель читает pick из стора, разбирает parseLotId и сама находит место в
   WorldData.venues. Пальцем и в компактной сцене части участка отвечают как 'lot'.
   Клик по пустой земле своей зоны (не кампуса) снимает pick. Смена зоны снимает
   hover и pick. Клик по «плюсу» (isAddId) pick не ставит — только deps.onActivate.

   Классы якорей — по ним раскладка решает, что делать с подписью:
     w-sign — вывеска на ножке: внутри обязателен .w-sign__board, движок ищет ей место
       и пишет w-sign--sm, is-away, --shift, --lift;
     w-who — чип: сам элемент и есть плашка; виден всегда, пока фигурка в кадре
       активной зоны (is-away — только вне кадра); фигурка под указателем — is-near;
     любой другой класс (w-plus, …) — свободная подпись: раскладка её не двигает и не
       гасит, только is-hover / is-selected по стору.
   Модификаторы дописываются вторым классом: 'w-sign w-sign--lot'.

   Владение файлами в заходе 2 Ш5 (три кодера параллельно, чужие файлы не править):
     А — engine/zones/venues.ts, hud/VenuePanel.tsx, hud/world-venues.css;
     Б — engine/zones/archive.ts, hud/ArchivePanel.tsx, hud/world-archive.css;
     В — engine/selection.ts (ограда, «плюс»), hud/Plus.tsx и блок .w-plus в конце
         hud/world-hud.css.
   Общее и неприкосновенное для всех троих: worldStore.ts, createWorld.ts, pointer.ts,
   hudLayout.ts, camera.ts, zones/layout.ts, groundLabel.ts, style.ts, WorldStage.tsx. */

export type WorldState = {
  // Зона под камерой и зоны, построенные на карте (в порядке ряда). Массив меняется
  // целиком и только вместе с составом.
  zone: WorldZone
  zones: readonly WorldZone[]
  // Камера переезжает между зонами
  flying: boolean
  // id объекта под указателем или в фокусе кнопки-дубля и id выбранного
  hover: string | null
  pick: string | null
  // id объекта → элемент CSS2DObject: в него HUD рисует порталом. Карта меняется
  // целиком, а не мутируется, иначе подписчики не увидят смены.
  labels: ReadonlyMap<string, HTMLElement>
  // Сцена уже 920 px: вывески и клавиши переходят в компактный вид
  hudCompact: boolean
}

// Поза камеры числами, без Vector3: её держит оболочка между пересозданиями мира.
// moved — человек крутил камеру сам; иначе позу считает движок под размер окна.
export type CameraPose = {
  position: [number, number, number]
  target: [number, number, number]
  moved: boolean
}

export type WorldStore = {
  getState: () => WorldState
  setState: (patch: Partial<WorldState>) => void
  subscribe: (listener: () => void) => () => void
}

const INITIAL: WorldState = { zone: 'campus', zones: ['campus'], flying: false, hover: null, pick: null, labels: new Map(), hudCompact: false }

export function createWorldStore(): WorldStore {
  let state = INITIAL
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    setState(patch) {
      // Движок зовёт это из кадра: без сверки каждое обращение будило бы React
      const keys = Object.keys(patch) as Array<keyof WorldState>
      if (keys.every((key) => Object.is(state[key], patch[key]))) return
      state = { ...state, ...patch }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export function useWorldState<T>(store: WorldStore, select: (state: WorldState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()))
}
