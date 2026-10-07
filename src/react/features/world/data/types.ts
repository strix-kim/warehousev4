// WorldData — единственный вход движка. Здесь только то, что мир уже рисует:
// машины, люди, числа вывесок, площадки и архив мест; «сегодня» добавится своим шагом.
// Поля — как в выдаче vehicles и employees, без копий сверх нужного миру. У площадок и
// архива источника в базе ещё нет (таблица venues — Ш9): форма — по данным макета с51,
// числа и даты сырьём, слова и склонения собирает HUD.
import type { WorldSiteId } from '../worldStore'

export type WorldCar = {
  id: string
  brand: string
  model: string | null
  // Свободный текст из карточки машины: в hex его переводит carKinds.ts
  color: string | null
  plate: string
}

// Только имя для чипа: телефон, должность и документы сотрудника в мир не едут
export type WorldPerson = {
  id: string
  firstName: string
  lastName: string
}

// Тип места решает силуэт здания
export type WorldVenueKind = 'hotel' | 'arena' | 'hall'

// Место на «Площадках»: стоит на карте, пока к нему привязано идущее или будущее
export type WorldVenue = {
  id: string
  kind: WorldVenueKind
  name: string
  // Мероприятие и его зал на этом месте
  title: string
  hall: string
  // Даты мероприятия, ISO (yyyy-mm-dd); один день — обе равны
  dateFrom: string
  dateTo: string
  halls: string[]
  // У места есть план залов: на участке — стол с макетом; нет — пустое место с «плюсом»
  hasPlan: boolean
  // Позиций в привязанном списке оборудования (у участка грузовик); null — списка нет
  gearCount: number | null
  // Расселение (у участка отель); null — пустое место с «плюсом»
  stay: { hotel: string; rooms: number; people: number } | null
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
  // До шести последних мероприятий: название, дата (ISO), число позиций списка
  history: Array<{ title: string; date: string; items: number }>
}

export type WorldData = {
  cars: WorldCar[]
  people: WorldPerson[]
  // null — источника нет: зона на карте не строится вовсе (решение 6 плана world-s51).
  // Пустой массив — источник есть, мест нет: зона стоит пустой.
  venues: WorldVenue[] | null
  archive: WorldArchivePlace[] | null
  // Площадки и архив — фикстуры макета (только dev): HUD держит метку «макетные данные»
  mock: boolean
  // Число на вывеске здания: списки, единицы оборудования, машины. null — источник
  // этого числа не ответил, вывеска показывает только имя: ноль был бы ложью, а не
  // пустым состоянием
  sites: Record<WorldSiteId, number | null>
}
