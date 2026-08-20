import { invalidateCachePrefix } from '../../lib/persistentCache'

// ЛИСТОВОЙ модуль: импортирует только persistentCache и ничего больше.
// Здесь живёт ключ кэша состава списка — владелец у фичи lists, но сбрасывать
// его нужно и из equipment/api (правка модели меняет подписи позиций).
// Вынесено отдельно от api.ts, чтобы equipment/api зависел от этого модуля,
// а не от lists/api: иначе рёбра lists → equipment и equipment → lists
// замкнули бы граф фич в цикл.
export const listCompositionCachePrefix = 'equipment-lists:composition:'

export function listCompositionCacheKey(listId: string) {
  return `${listCompositionCachePrefix}${listId}`
}

export function invalidateListCompositionCache() {
  invalidateCachePrefix(listCompositionCachePrefix)
}
