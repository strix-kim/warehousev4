// Реестр мероприятий → «Площадки» и «Где работали». Чистая функция без three, React и
// часов: «сегодня» приходит аргументом (todayDateValue() — часы устройства, не базы),
// поэтому скаут сверяет её скриптом против SQL-выборки projects.
import type { ProjectListItem } from '../../projects/types'
import type { WorldArchivePlace, WorldLot } from './types'
import { archiveKind, venueKind } from './venueKind'

// Участков в сцене «Площадок» (сетка 3 × 2): остальные — строкой «ещё N» в панели зоны.
// Одно число на движок (engine/zones/venues.ts) и на HUD.
export const LOT_MAX = 6
// Строк истории у места в «Где работали»
const HISTORY_MAX = 6

// Даты — строки YYYY-MM-DD: лексический порядок совпадает с календарным
const byText = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)

function toLot(project: ProjectListItem): WorldLot {
  const { venue } = project
  return {
    id: project.id,
    name: project.name,
    client: project.client_name,
    place: venue ? { id: venue.id, name: venue.name, city: venue.city } : null,
    // Без места — типовое здание
    kind: venue ? venueKind(venue.name) : 'hall',
    dateFrom: project.date_from,
    dateTo: project.date_to,
    lists: project.listCount,
    staff: project.staffCount,
    hasPlan: project.hasHallPlan,
    crew: null,
  }
}

// Критерий зоны (план world-work-s58, решение 4): конец = coalesce(date_to, date_from).
// Конец не раньше сегодня или дат нет → «Площадки». Иначе, если есть место → «Где
// работали», сгруппировано по месту. Прошлое без места не встаёт никуда.
export function splitProjects(projects: readonly ProjectListItem[], today: string): { lots: WorldLot[]; archive: WorldArchivePlace[] } {
  const upcoming: ProjectListItem[] = []
  const past = new Map<string, ProjectListItem[]>()
  for (const project of projects) {
    const end = project.date_to ?? project.date_from
    if (end === null || end >= today) upcoming.push(project)
    else if (project.venue) {
      const rows = past.get(project.venue.id)
      if (rows) rows.push(project)
      else past.set(project.venue.id, [project])
    }
  }

  // Ближайшие первыми, без даты — в конце; равные даты — по id, чтобы порядок участков
  // не прыгал между ответами
  const lots = upcoming
    .sort((a, b) => byText(a.date_from, b.date_from) || byText(a.id, b.id))
    .map(toLot)

  const archive: WorldArchivePlace[] = [...past.values()].map((rows) => {
    // От свежих к старым по концу мероприятия; в прошлом обе даты не null
    rows.sort((a, b) => byText(b.date_to ?? b.date_from, a.date_to ?? a.date_from) || byText(a.id, b.id))
    const venue = rows[0]!.venue!
    return {
      id: venue.id,
      kind: archiveKind(venue.name),
      name: venue.name,
      city: venue.city,
      events: rows.length,
      last: rows[0]!.date_to ?? rows[0]!.date_from ?? '',
      history: rows.slice(0, HISTORY_MAX).map((row) => ({ title: row.name, date: row.date_from ?? row.date_to ?? '', listCount: row.listCount })),
    }
  })
  // Порядок мест — от свежих к старым: он же нарезка на кварталы (archiveBlocks.ts)
  archive.sort((a, b) => byText(b.last, a.last) || byText(a.id, b.id))
  return { lots, archive }
}
