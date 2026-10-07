import { invalidateCachePrefix } from '../../lib/persistentCache'

// ЛИСТОВОЙ модуль: импортирует только persistentCache и ничего больше.
// Реквизиты мероприятия показывают карточки списков, а счётчики мероприятия
// двигают списки, состав и планы залов — значит сбрасывать кэш мероприятий
// обязаны и lists, и employees, и halls. Возьми они сброс из projects/api, а
// projects/api — что-нибудь у них, граф фич замкнулся бы в цикл (тот же довод,
// что у lists/cacheKeys).
export const PROJECTS_CACHE_PREFIX = 'projects:'

// Реестр мероприятий целиком — единственное, что из модуля ложится на диск:
// персональных данных в нём нет (название, заказчик, период, площадка, числа).
export const PROJECTS_LIST_CACHE_KEY = `${PROJECTS_CACHE_PREFIX}list`

// Справочник мест живёт под тем же префиксом: место — реквизит мероприятия, и
// новое место обязано появиться в поле «Площадка» тем же сбросом.
export const VENUES_CACHE_KEY = `${PROJECTS_CACHE_PREFIX}venues`

// Префикс кэша списков. Владелец — features/lists (там он записан литералом в
// api.ts), здесь — второе упоминание той же строки: импортировать её из lists
// нельзя, это и был бы цикл. Черновик редактора (`list-draft:`) лежит вне
// префикса намеренно и этим сбросом не задевается.
const EQUIPMENT_LISTS_CACHE_PREFIX = 'equipment-lists:'

// Сброс после записи самого мероприятия или места: уезжают реестр мероприятий,
// справочник мест и всё, что кэшируют списки, — их карточки показывают название,
// заказчика, период и площадку мероприятия.
export function invalidateProjectsCache() {
  invalidateCachePrefix(PROJECTS_CACHE_PREFIX)
  invalidateCachePrefix(EQUIPMENT_LISTS_CACHE_PREFIX)
}

// Сброс одних счётчиков реестра — для записей, которые реквизитов не меняют:
// состав (project_staff), привязка плана залов, привязка списка. Кэш списков
// при этом не трогаем: он сбрасывается своей записью.
export function invalidateProjectCounters() {
  invalidateCachePrefix(PROJECTS_CACHE_PREFIX)
}
