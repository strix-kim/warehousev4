// WorldData — единственный вход движка. Здесь только то, что мир уже рисует:
// машины, люди, числа вывесок, участки мероприятий и архив мест; «сегодня» — своим шагом.
// Поля — как в выдаче vehicles, employees и projects, без копий сверх нужного миру.
// Числа и даты сырьём, слова и склонения собирает HUD.
import type { WorldSiteId } from '../worldStore'

export type WorldCar = {
  id: string
  brand: string
  model: string | null
  // Свободный текст из карточки машины: в hex его переводит carKinds.ts
  color: string | null
  plate: string
  // Сколько водителей закреплено за машиной (VehicleWithDrivers.drivers): ноль — над
  // машиной в гараже маркер «!» и дело на доске. Имена мир не возит — их читает карточка
  drivers: number
}

// Только имя для чипа: телефон, должность и документы сотрудника в мир не едут
export type WorldPerson = {
  id: string
  firstName: string
  lastName: string
}

// Тип места решает силуэт здания. Колонки в базе нет: тип угадывает venueKind.ts
export type WorldVenueKind = 'hotel' | 'arena' | 'hall'

// Участок на «Площадках» = мероприятие (строка projects), идущее или будущее. Два
// мероприятия в одном месте — два участка (решение прораба с58).
export type WorldLot = {
  // id мероприятия
  id: string
  name: string
  client: string | null
  // Место проведения; null — не указано, участок стоит с типовым зданием
  place: { id: string; name: string; city: string } | null
  kind: WorldVenueKind
  // Даты мероприятия, ISO (yyyy-mm-dd); null — не указана. Нет dateTo — один день
  dateFrom: string | null
  dateTo: string | null
  // Счётчики реестра мероприятий (ProjectListItem): списков, людей в составе, есть ли
  // план залов. Грузовик на участке — lists > 0, стол с макетом — hasPlan
  lists: number
  staff: number
  hasPlan: boolean
}

export type WorldArchiveKind = WorldVenueKind | 'palace'

// Место в «Где работали». Высота здания — число мероприятий; порядок в списке —
// от свежих к старым по last, он же нарезка на кварталы.
export type WorldArchivePlace = {
  id: string
  kind: WorldArchiveKind
  name: string
  city: string
  events: number
  // Дата последнего мероприятия, ISO
  last: string
  // До шести последних мероприятий: название, дата начала (ISO), число списков.
  // Позиций в реестре мероприятий нет — считаем списки
  history: Array<{ title: string; date: string; listCount: number }>
}

export type WorldData = {
  cars: WorldCar[]
  people: WorldPerson[]
  // null — источник (реестр мероприятий) не ответил: зона на карте не строится вовсе
  // (решение 6 плана world-s51). Пустой массив — источник есть, мероприятий нет: зона
  // стоит пустой. Участки — все идущие и будущие по date_from; в сцену встают первые
  // LOT_MAX (splitProjects.ts), остальные — строкой «ещё N» в панели зоны.
  venues: WorldLot[] | null
  archive: WorldArchivePlace[] | null
  // Площадки и архив — фикстуры макета (только dev и ?mock=on): HUD держит метку «макетные данные»
  mock: boolean
  // Число на вывеске здания: списки, единицы оборудования, машины. null — источник
  // этого числа не ответил, вывеска показывает только имя: ноль был бы ложью, а не
  // пустым состоянием
  sites: Record<WorldSiteId, number | null>
}
