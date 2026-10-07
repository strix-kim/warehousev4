// Макетные данные «Площадок» и «Где работали» — из принятого макета voxel-world-s51.html
// (PLACES, PLACES_RAW). Источника в базе ещё нет (таблица venues — Ш9), и этот файл
// уйдёт тем же шагом, что принесёт живые данные. Грузится только динамическим импортом
// под import.meta.env.DEV (useWorldData.ts): в прод-сборку не попадает.
import type { WorldArchiveKind, WorldArchivePlace, WorldVenue } from './types'

// Сценарий макета по умолчанию: пять мест из шести — в сетке 3 × 2 остаётся пустая
// ячейка с «плюсом». Третье — худший случай по длине имени.
export const FIXTURE_VENUES: WorldVenue[] = [
  { id: 'mock-venue-1', kind: 'hotel', name: 'Hyatt Regency Tashkent', hall: 'Grand Ballroom A+B', title: 'Bionorica Workshop', dateFrom: '2026-10-07', dateTo: '2026-10-08',
    halls: ['Grand Ballroom A+B', 'Jupiter', 'Uranus'], hasPlan: true, gearCount: 32, stay: { hotel: 'Hyatt Regency Tashkent', rooms: 8, people: 14 } },
  { id: 'mock-venue-2', kind: 'arena', name: 'Humo Arena', hall: 'Конгресс-холл, 2 этаж', title: 'Tashkent IT Week', dateFrom: '2026-10-09', dateTo: '2026-10-09',
    halls: ['Конгресс-холл', 'Зал Humo'], hasPlan: true, gearCount: 54, stay: null },
  { id: 'mock-venue-3', kind: 'hall', name: 'Hilton Tashkent City Congress Hall', hall: 'Большой зал и переговорные A–C', title: 'Международный форум Uzbekistan Travel & Hospitality 2026', dateFrom: '2026-10-13', dateTo: '2026-10-15',
    halls: ['Registan', 'Samarkand', 'Переговорные A–C'], hasPlan: true, gearCount: 128, stay: { hotel: 'Hilton Tashkent City', rooms: 12, people: 22 } },
  { id: 'mock-venue-4', kind: 'hotel', name: 'InterContinental Tashkent', hall: 'Зал Samarkand', title: 'Uzcard Partner Day', dateFrom: '2026-10-21', dateTo: '2026-10-23',
    halls: ['Samarkand', 'Bukhara'], hasPlan: false, gearCount: null, stay: { hotel: 'InterContinental Tashkent', rooms: 6, people: 11 } },
  // 43 знака — предел чертежа: в вывеске обрезается, целиком — в панели
  { id: 'mock-venue-5', kind: 'hall', name: 'Международный конгресс-центр «Узэкспоцентр»', hall: 'Павильон 3', title: 'UzBuild 2026', dateFrom: '2026-11-02', dateTo: '2026-11-04',
    halls: ['Павильон 3', 'Атриум'], hasPlan: true, gearCount: 12, stay: null },
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

// Названия мероприятий для строк истории — в продукте это списки, привязанные к месту
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
    rows.push({ title: EVENTS[(seed * 7 + j * 3) % EVENTS.length]!, date: d.toISOString().slice(0, 10), items: 18 + (seed * 13 + j * 29) % 110 })
    d.setUTCDate(d.getUTCDate() - (26 + (seed * 17 + j * 41) % 120))
  }
  return rows
}

// От свежих к старым по дате последнего мероприятия — порядок, в котором придёт выдача
export const FIXTURE_ARCHIVE: WorldArchivePlace[] = PLACES
  .map(([name, kind, city, events, last], seed) => ({ id: `mock-place-${seed + 1}`, name, kind, city, events, last, history: history(seed, events, last) }))
  .sort((a, b) => b.last.localeCompare(a.last))
