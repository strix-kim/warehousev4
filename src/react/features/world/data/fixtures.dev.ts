// Макетные данные «Площадок» и «Где работали» — из принятого макета voxel-world-s51.html
// (PLACES, PLACES_RAW): dev-стенд худшего случая (шесть участков, имена на 43 знака).
// Включаются только ?mock=on и только в dev: грузится динамическим импортом под
// import.meta.env.DEV (useWorldData.ts), в прод-сборку не попадает.
import type { WorldArchiveKind, WorldArchivePlace, WorldLot } from './types'

// Сценарий макета по умолчанию: пять участков из шести — в сетке 3 × 2 остаётся пустая
// ячейка с «плюсом». Третий — худший случай по длине имени мероприятия и места.
export const FIXTURE_VENUES: WorldLot[] = [
  { id: 'mock-lot-1', kind: 'hotel', name: 'Bionorica Workshop', client: 'Bionorica', place: { id: 'mock-venue-1', name: 'Hyatt Regency Tashkent', city: 'Ташкент' },
    dateFrom: '2026-10-07', dateTo: '2026-10-08', lists: 1, staff: 14, hasPlan: true },
  { id: 'mock-lot-2', kind: 'arena', name: 'Tashkent IT Week', client: null, place: { id: 'mock-venue-2', name: 'Humo Arena', city: 'Ташкент' },
    dateFrom: '2026-10-09', dateTo: null, lists: 2, staff: 0, hasPlan: true },
  { id: 'mock-lot-3', kind: 'hall', name: 'Международный форум Uzbekistan Travel & Hospitality 2026', client: 'Uzbekistan Tourism Committee', place: { id: 'mock-venue-3', name: 'Hilton Tashkent City Congress Hall', city: 'Ташкент' },
    dateFrom: '2026-10-13', dateTo: '2026-10-15', lists: 3, staff: 22, hasPlan: true },
  { id: 'mock-lot-4', kind: 'hotel', name: 'Uzcard Partner Day', client: 'Uzcard', place: { id: 'mock-venue-4', name: 'InterContinental Tashkent', city: 'Ташкент' },
    dateFrom: '2026-10-21', dateTo: '2026-10-23', lists: 0, staff: 11, hasPlan: false },
  // 43 знака — предел чертежа: в вывеске обрезается, целиком — в панели. Без дат и места
  { id: 'mock-lot-5', kind: 'hall', name: 'Международный конгресс-центр «Узэкспоцентр»', client: null, place: null,
    dateFrom: null, dateTo: null, lists: 1, staff: 0, hasPlan: false },
]

// Имя · тип · город · число мероприятий · дата последнего. 34 места: в сцену встаёт 30.
const PLACES: Array<[string, WorldArchiveKind, string, number, string]> = [
  ['Hilton Tashkent City', 'hotel', 'Ташкент', 12, '2026-09-28'],
  ['Humo Arena', 'arena', 'Ташкент', 7, '2026-09-19'],
  ['Hyatt Regency Tashkent', 'hotel', 'Ташкент', 9, '2026-09-04'],
  ['Конгресс-холл Tashkent City', 'hall', 'Ташкент', 1, '2026-08-22'],
  ['Конгресс-зал гостиницы «Узбекистан», Ташкент', 'hall', 'Ташкент', 5, '2026-07-30'],
  ['InterContinental Tashkent', 'hotel', 'Ташкент', 4, '2026-06-11'],
  ['Узэкспоцентр', 'hall', 'Ташкент', 10, '2026-04-17'],
  ['Silk Road Samarkand Congress Centre', 'hall', 'Самарканд', 3, '2026-02-08'],
  ['Wyndham Tashkent', 'hotel', 'Ташкент', 2, '2025-12-13'],
  ['Дворец искусств «Истиклол»', 'palace', 'Ташкент', 6, '2025-11-21'],
  ['Lotte City Hotel Tashkent Palace', 'hotel', 'Ташкент', 8, '2025-10-25'],
  ['Спорткомплекс «Узбекистан»', 'arena', 'Ташкент', 2, '2025-10-03'],
  ['International Hotel Tashkent', 'hotel', 'Ташкент', 11, '2025-09-12'],
  ['Central Asian Expo Uzbekistan', 'hall', 'Ташкент', 4, '2025-06-06'],
  ['Дворец международных форумов «Узбекистан»', 'palace', 'Ташкент', 3, '2025-04-18'],
  ['Дворец «Дружба народов»', 'palace', 'Ташкент', 5, '2025-03-08'],
  ['Стадион «Бунёдкор»', 'arena', 'Ташкент', 1, '2025-01-24'],
  ['Hilton Garden Inn Samarkand', 'hotel', 'Самарканд', 2, '2024-11-30'],
  ['Ramada by Wyndham Tashkent', 'hotel', 'Ташкент', 6, '2024-10-19'],
  ['Magic City', 'hall', 'Ташкент', 3, '2024-09-01'],
  ['Спорткомплекс «Юнусабад»', 'arena', 'Ташкент', 4, '2024-06-14'],
  ['Courtyard by Marriott Tashkent', 'hotel', 'Ташкент', 7, '2024-05-03'],
  ['Savitsky Plaza', 'hotel', 'Самарканд', 1, '2024-03-22'],
  ['ГАБТ имени Алишера Навои', 'palace', 'Ташкент', 2, '2024-02-10'],
  ['Hampton by Hilton Tashkent', 'hotel', 'Ташкент', 3, '2024-01-19'],
  ['Samarkand Regency Amir Temur', 'hotel', 'Самарканд', 5, '2023-11-11'],
  ['Дворец искусств «Туркистон»', 'palace', 'Ташкент', 9, '2023-09-29'],
  ['Wyndham Bukhara', 'hotel', 'Бухара', 1, '2023-05-20'],
  ['Radisson Blu Tashkent', 'hotel', 'Ташкент', 2, '2023-03-04'],
  ['Парк «Навруз», павильон событий', 'hall', 'Ташкент', 4, '2022-10-15'],
  ['Mövenpick Samarkand', 'hotel', 'Самарканд', 2, '2022-06-25'],
  ['Дворец творчества молодёжи', 'palace', 'Ташкент', 3, '2022-04-09'],
  ['Grand Mir Hotel', 'hotel', 'Ташкент', 1, '2021-12-18'],
  ['Спорткомплекс «Жар»', 'arena', 'Ташкент', 2, '2021-10-02'],
]

// Названия мероприятий для строк истории
const EVENTS = [
  'Bionorica Workshop', 'Tashkent IT Week', 'Форум Uzbekistan Travel & Hospitality', 'Гала-ужин Artel', 'Конференция Uzum Tech',
  'Презентация BYD Uzbekistan', 'Саммит ICT Expo', 'Корпоратив Korzinka', 'Конгресс кардиологов', 'Премия «Бренд года»',
  'Pharma Day Ташкент', 'Tashkent Motor Show', 'Концерт симфонического оркестра', 'Форум «Иннопром. Центральная Азия»',
  'HR-конференция Team Lead', 'Новогодний вечер Beeline', 'Дилерская конференция Samsung', 'Выпускной Westminster',
  'Неделя моды Tashkent Fashion Week', 'Церемония Marketing Awards',
]

// История места: до шести последних мероприятий, назад от даты последнего
function history(seed: number, events: number, last: string) {
  const rows: WorldArchivePlace['history'] = [], d = new Date(`${last}T00:00:00Z`)
  for (let j = 0; j < Math.min(events, 6); j++) {
    rows.push({ title: EVENTS[(seed * 7 + j * 3) % EVENTS.length]!, date: d.toISOString().slice(0, 10), listCount: 1 + (seed * 13 + j * 29) % 4 })
    d.setUTCDate(d.getUTCDate() - (26 + (seed * 17 + j * 41) % 120))
  }
  return rows
}

// От свежих к старым по дате последнего мероприятия — порядок, в котором придёт выдача
export const FIXTURE_ARCHIVE: WorldArchivePlace[] = PLACES
  .map(([name, kind, city, events, last], seed) => ({ id: `mock-place-${seed + 1}`, name, kind, city, events, last, history: history(seed, events, last) }))
  .sort((a, b) => b.last.localeCompare(a.last))
