// Состав мероприятий → кто где стоит в мире. Чистая функция без three, React и часов,
// как splitProjects: «сегодня» приходит аргументом, поэтому скаут сверяет её скриптом
// против выборки project_staff. Человек стоит в мире один раз: либо на участке
// мероприятия, которое идёт сегодня, либо на кампусе.
import { parseDateValue, toDateValue } from '../../../lib/date'
import type { StaffByProject } from '../../projects/staffApi'
import type { WorldLot, WorldPerson } from './types'

// Даты — строки YYYY-MM-DD: лексический порядок совпадает с календарным
const isToday = (lot: WorldLot, today: string) => lot.dateFrom !== null && lot.dateFrom <= today && today <= (lot.dateTo ?? lot.dateFrom)

// «Завтра» — календарно от строки today, по локальным компонентам (lib/date.ts): часового
// пояса и часов здесь нет. null — today не дата: «сборов» тогда нет вовсе
function nextDay(today: string): string | null {
  const date = parseDateValue(today)
  if (!date) return null
  date.setDate(date.getDate() + 1)
  return toDateValue(date)
}

// Участки, чей состав нужен миру: мероприятие идёт сегодня или начинается завтра.
// Пустой ответ — запроса состава нет вовсе (useWorldData.ts)
export function crewLotIds(lots: readonly WorldLot[], today: string): string[] {
  const tomorrow = nextDay(today)
  return lots.filter((lot) => isToday(lot, today) || (tomorrow !== null && lot.dateFrom === tomorrow)).map((lot) => lot.id)
}

// Тот же расклад людей по участкам: адаптер по нему решает, отдавать ли движку прежний
// массив (движок сверяет venues ссылкой и пересобирает сцену на каждую новую)
export function sameCrews(a: readonly WorldLot[], b: readonly WorldLot[]): boolean {
  return a.length === b.length && a.every((lot, i) => {
    const left = lot.crew
    const right = b[i]!.crew
    if (left === null || right === null) return left === right
    return left.length === right.length && left.every((person, j) => {
      const other = right[j]!
      return person.id === other.id && person.firstName === other.firstName && person.lastName === other.lastName
    })
  })
}

// people — штат кампуса (наёмных в нём нет), lots — ВСЕ участки, а не первые LOT_MAX:
// человек на седьмом участке на кампус не возвращается. staff: null — состав не ответил,
// мир остаётся с серыми фигурками. Участок, которого в ответе нет (ответ старше реестра),
// тоже остаётся с crew: null — пустой состав и «не спрашивали» не одно и то же.
export function placePeople(people: WorldPerson[], lots: WorldLot[], staff: StaffByProject | null, today: string): { people: WorldPerson[]; lots: WorldLot[] } {
  if (!staff) return { people, lots }
  const tomorrow = nextDay(today)

  // Человек в двух идущих мероприятиях стоит на том, что началось раньше; равные даты —
  // по id мероприятия. Порядок lots на это не влияет
  const running = lots
    .filter((lot) => isToday(lot, today) && staff.has(lot.id))
    .sort((a, b) => (a.dateFrom! < b.dateFrom! ? -1 : a.dateFrom! > b.dateFrom! ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const away = new Set<string>()
  const crews = new Map<string, WorldPerson[]>()
  for (const lot of running) {
    const crew: WorldPerson[] = []
    for (const { employee } of staff.get(lot.id)!) {
      if (away.has(employee.id)) continue
      away.add(employee.id)
      crew.push({ id: employee.id, firstName: employee.firstName, lastName: employee.lastName, packing: false })
    }
    // Порядок — как в составе на экране мероприятия (sortStaff): фамилия, имя, id
    crew.sort((a, b) => a.lastName.localeCompare(b.lastName, 'ru') || a.firstName.localeCompare(b.firstName, 'ru') || a.id.localeCompare(b.id))
    crews.set(lot.id, crew)
  }

  // «Сборы» — только штатные завтрашнего мероприятия; «идёт сегодня» важнее: кто уже
  // стоит на участке, того на кампусе нет
  const packing = new Set<string>()
  if (tomorrow !== null) {
    for (const lot of lots) {
      if (lot.dateFrom !== tomorrow) continue
      for (const { employee } of staff.get(lot.id) ?? []) {
        if (employee.department === 'staff') packing.add(employee.id)
      }
    }
  }

  // Ничего не сдвинулось — те же массивы: лишняя ссылка на lots стоит пересборки сцены
  const moved = people.some((person) => away.has(person.id) || packing.has(person.id) !== person.packing)
  return {
    people: moved
      ? people.filter((person) => !away.has(person.id)).map((person) => (packing.has(person.id) === person.packing ? person : { ...person, packing: !person.packing }))
      : people,
    lots: crews.size > 0 ? lots.map((lot) => (crews.has(lot.id) ? { ...lot, crew: crews.get(lot.id)! } : lot)) : lots,
  }
}
