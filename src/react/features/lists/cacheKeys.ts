import { hasCachedPrefix, invalidateCachePrefix } from '../../lib/persistentCache'

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
//
// v2 — форма черновика сменилась в с54: реквизиты переехали в мероприятие
// (`project` вместо clientName/venue/eventDate). Черновик прошлой формы не
// читается и не переносится — он выпадет сам по TTL; несохранённая работа на
// момент выкатки теряется (принятый риск плана event-s53).
const LIST_DRAFT_CACHE_PREFIX = 'list-draft:v2:'
export const LIST_DRAFT_CACHE_KEY = `${LIST_DRAFT_CACHE_PREFIX}new`
export const LIST_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

// Несохранённые правки ОТКРЫТОГО списка (с13, U3-M) лежат отдельным ключом на
// каждый список. Тот же префикс `list-draft:v2:` и тот же срок: это ровно такая же
// «работа, которую ещё не сохранили», просто у неё уже есть строка в базе.
// Ключ БЕЗ id остаётся за /lists/new — карточка черновика в реестре спрашивает
// именно его и не должна показывать правки уже сохранённых списков.
export function listDraftCacheKey(listId?: string) {
  return listId ? `${LIST_DRAFT_CACHE_PREFIX}${listId}` : LIST_DRAFT_CACHE_KEY
}

// Есть ли несохранённый черновик — нового списка или правок открытого. Спрашивает
// выход из системы: он стирает кэш целиком, и черновик ушёл бы вместе с ним.
// Вечным «несохранённое» не станет: черновик стирается при сохранении, при
// «Отбросить», автосейвом при совпадении с базой и сам протухает через сутки.
// Префикс с версией: черновик прошлой формы редактор уже не покажет, и держать
// из-за него выход из системы незачем.
export function hasUnsavedListDraft() {
  return hasCachedPrefix(LIST_DRAFT_CACHE_PREFIX)
}
