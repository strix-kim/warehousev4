import { invalidateCachePrefix } from '../../lib/persistentCache'

// ЛИСТОВОЙ модуль: импортирует только persistentCache и ничего больше.
// Здесь живёт ключ кэша состава списка — владелец у фичи lists, но сбрасывать
// его нужно и из equipment/api (правка модели меняет подписи позиций).
// Вынесено отдельно от api.ts, чтобы equipment/api зависел от этого модуля,
// а не от lists/api: иначе рёбра lists → equipment и equipment → lists
// замкнули бы граф фич в цикл.
export const listCompositionCachePrefix = 'equipment-lists:composition:'

// v2 — форма значения сменилась (массив строк → { rows, missingUnits }). Ключи
// прошлой формы лежат в localStorage у всех, кто уже открывал списки, и без
// смены ключа первый кадр после выкатки читал бы массив как объект. Старые ключи
// остаются под тем же префиксом, поэтому сбрасываются вместе с новыми.
export function listCompositionCacheKey(listId: string) {
  return `${listCompositionCachePrefix}v2:${listId}`
}

export function invalidateListCompositionCache() {
  invalidateCachePrefix(listCompositionCachePrefix)
}

// Черновик несохранённого списка (/lists/new). Ключ НАМЕРЕННО живёт вне префикса
// `equipment-lists:`: тот целиком сбрасывается на каждом создании, правке,
// удалении и смене этапа — и унёс бы с собой работу, которую пользователь ещё не
// сохранял. Сутки — верхняя граница «вернусь к этому завтра»; дальше запись
// протухает сама.
export const LIST_DRAFT_CACHE_KEY = 'list-draft:new'
export const LIST_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

// Несохранённые правки ОТКРЫТОГО списка (с13, U3-M) лежат отдельным ключом на
// каждый список. Тот же префикс `list-draft:` и тот же срок: это ровно такая же
// «работа, которую ещё не сохранили», просто у неё уже есть строка в базе.
// Ключ БЕЗ id остаётся за /lists/new — карточка черновика в реестре спрашивает
// именно его и не должна показывать правки уже сохранённых списков.
export function listDraftCacheKey(listId?: string) {
  return listId ? `list-draft:${listId}` : LIST_DRAFT_CACHE_KEY
}
