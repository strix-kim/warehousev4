import { supabase } from '../../lib/supabase'
import { cachedQuery, readCachedQuery } from '../../lib/persistentCache'

// ЛИСТОВОЙ модуль: импортирует только supabase и persistentCache, и больше ничего.
// Владелец таблицы equipment_lists — lists/api, но спрашивает отсюда карточка
// оборудования (features/equipment). Прямой импорт lists/api замкнул бы граф фич
// в цикл: lists/api уже тянет equipment/api за fetchEquipmentByIds. Тот же приём,
// что и у cacheKeys.ts.

// Ровно то, что рисует карточка: имя, дата мероприятия и id для ссылки. Полную
// строку списка сюда тянуть нельзя — потребовался бы тип из lists/api.
export type UnitListUsage = {
  id: string
  name: string
  reservation_start: string | null
}

// Ключ живёт под префиксом equipment-lists:, а не equipment: — значение зависит
// от состава списков, а не от строки склада. Создание, правка и удаление списка
// уже сбрасывают этот префикс целиком, поэтому своей инвалидации не нужно.
const unitUsageCacheKey = (equipmentId: string) => `equipment-lists:unit:${equipmentId}`

function sortByEventDate(rows: UnitListUsage[]) {
  // Ближайшее мероприятие первым; недатированные — в конец, они ничего не говорят
  // о том, когда единица понадобится.
  return rows.sort((a, b) => {
    if (a.reservation_start === b.reservation_start) return a.name.localeCompare(b.name)
    if (!a.reservation_start) return 1
    if (!b.reservation_start) return -1
    return a.reservation_start.localeCompare(b.reservation_start)
  })
}

export function readCachedUnitLists(equipmentId: string) {
  return readCachedQuery<UnitListUsage[]>(unitUsageCacheKey(equipmentId))
}

/**
 * В каких сохранённых списках стоит эта единица.
 *
 * Состав хранится двумя формами сразу: серийные позиции — в массиве
 * equipment_ids, количественные — в jsonb equipment_items. Отсюда ДВА запроса,
 * а не один `.or(...)`: внутри `.or` значение jsonb пришлось бы квотировать
 * вместе с фигурными скобками и кавычками, а порядок слоёв квотирования там
 * некоммутативен — цена ошибки выше, чем лишний запрос к таблице из шести строк.
 *
 * Позиции `planned` не находятся и не должны: они ссылаются на модель, а не на
 * единицу. Но ключ equipment_id у них ЕСТЬ и равен null (проверено выпиской из
 * прода) — отсюда защита от пустого значения ниже.
 */
export async function fetchUnitLists(equipmentId: string): Promise<UnitListUsage[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  // ЛОВУШКА: planned-позиции хранят "equipment_id": null ЯВНЫМ ключом, и запрос
  // с пустым значением совпал бы `@>` со всеми ними разом — карточка показала бы
  // чужие списки как свои. Единица без id — не повод спрашивать.
  if (!equipmentId) return []

  return cachedQuery(unitUsageCacheKey(equipmentId), 10 * 60 * 1000, async () => {
    const columns = 'id,name,reservation_start'
    const [serialized, quantity] = await Promise.all([
      client.from('equipment_lists').select(columns).contains('equipment_ids', [equipmentId]),
      // JSON.stringify обязателен, и это не украшение. postgrest-js смотрит на тип
      // значения: массив он сериализует как МАССИВ POSTGRES через join(','), и
      // массив объектов превращается в cs.{[object Object]} — PostgREST отвечает
      // 400 «invalid input syntax for type json» ещё до проверки прав. Строка
      // уходит как есть и даёт корректное cs.[{"equipment_id":"…"}].
      client.from('equipment_lists').select(columns).contains('equipment_items', JSON.stringify([{ equipment_id: equipmentId }])),
    ])
    if (serialized.error) throw serialized.error
    if (quantity.error) throw quantity.error

    // Единица может стоять в списке обеими формами сразу (серийная позиция плюс
    // количественная того же id) — тогда список пришёл бы дважды.
    const byId = new Map<string, UnitListUsage>()
    for (const row of [...(serialized.data ?? []), ...(quantity.data ?? [])]) {
      byId.set(row.id, { id: row.id, name: row.name, reservation_start: row.reservation_start })
    }
    return sortByEventDate([...byId.values()])
  })
}
