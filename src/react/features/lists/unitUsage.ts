import { supabase } from '../../lib/supabase'
import { cachedQuery, readCachedQuery } from '../../lib/persistentCache'

// ЛИСТОВОЙ модуль: импортирует только supabase и persistentCache, и больше ничего.
// Владелец таблицы equipment_lists — lists/api, но спрашивает отсюда карточка
// оборудования (features/equipment). Прямой импорт lists/api замкнул бы граф фич
// в цикл: lists/api уже тянет equipment/api за fetchEquipmentByIds. Тот же приём,
// что и у cacheKeys.ts.

// Ровно то, что рисует карточка: имя, дата мероприятия и id для ссылки. Полную
// строку списка сюда тянуть нельзя — потребовался бы тип из lists/api.
// count — сколько штук этой единицы стоит в списке; null у серийной позиции,
// там всегда одна и число было бы шумом.
// date_from — дата начала МЕРОПРИЯТИЯ списка (projects.date_from); null и у
// списка без мероприятия, и у мероприятия без даты.
export type UnitListUsage = {
  id: string
  name: string
  date_from: string | null
  count: number | null
}

// Ключ живёт под префиксом equipment-lists:, а не equipment: — значение зависит
// от состава списков, а не от строки склада. Создание, правка и удаление списка
// уже сбрасывают этот префикс целиком, поэтому своей инвалидации не нужно; его же
// сбрасывает правка мероприятия (projects/cacheKeys) — отсюда читается его дата.
// v2 — форма значения сменилась (reservation_start → date_from).
const unitUsageCacheKey = (equipmentId: string) => `equipment-lists:unit:v2:${equipmentId}`

function sortByEventDate(rows: UnitListUsage[]) {
  // Ближайшее мероприятие первым; недатированные — в конец, они ничего не говорят
  // о том, когда единица понадобится.
  return rows.sort((a, b) => {
    if (a.date_from === b.date_from) return a.name.localeCompare(b.name)
    if (!a.date_from) return 1
    if (!b.date_from) return -1
    return a.date_from.localeCompare(b.date_from)
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
    // Дата — у мероприятия: своей у списка нет. Embed по единственному внешнему
    // ключу equipment_lists.project_id; у списка без мероприятия project === null.
    const columns = 'id,name,project:projects(date_from)'
    const [serialized, quantity] = await Promise.all([
      client.from('equipment_lists').select(columns).contains('equipment_ids', [equipmentId]),
      // JSON.stringify обязателен, и это не украшение. postgrest-js смотрит на тип
      // значения: массив он сериализует как МАССИВ POSTGRES через join(','), и
      // массив объектов превращается в cs.{[object Object]} — PostgREST отвечает
      // 400 «invalid input syntax for type json» ещё до проверки прав. Строка
      // уходит как есть и даёт корректное cs.[{"equipment_id":"…"}].
      // equipment_items тянется целиком ради count: сколько штук стоит в списке.
      client.from('equipment_lists').select(`${columns},equipment_items`).contains('equipment_items', JSON.stringify([{ equipment_id: equipmentId }])),
    ])
    if (serialized.error) throw serialized.error
    if (quantity.error) throw quantity.error

    // Единица может стоять в списке обеими формами сразу (серийная позиция плюс
    // количественная того же id) — тогда список пришёл бы дважды. Количественная
    // ветка идёт второй и перекрывает запись серийной своим count.
    const byId = new Map<string, UnitListUsage>()
    for (const row of serialized.data ?? []) {
      byId.set(row.id, { id: row.id, name: row.name, date_from: row.project?.date_from ?? null, count: null })
    }
    for (const row of quantity.data ?? []) {
      const items = (row.equipment_items ?? []) as { equipment_id?: string | null; count?: number }[]
      const item = items.find((entry) => entry.equipment_id === equipmentId)
      const count = typeof item?.count === 'number' && item.count > 0 ? item.count : null
      byId.set(row.id, { id: row.id, name: row.name, date_from: row.project?.date_from ?? null, count })
    }
    return sortByEventDate([...byId.values()])
  })
}
