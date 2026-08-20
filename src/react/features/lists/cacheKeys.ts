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
