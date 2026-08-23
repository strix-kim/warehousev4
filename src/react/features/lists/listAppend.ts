import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, readCachedQuery } from '../../lib/persistentCache'
import type { UnitListUsage } from './unitUsage'

// ЛИСТОВОЙ модуль, как unitUsage.ts: спрашивает карточка оборудования
// (features/equipment), а прямой импорт lists/api замкнул бы граф фич в цикл.
// Тянет только supabase, persistentCache и тип соседнего листового модуля.

// Кнопке «В список» нужны те же три поля, что и разделу «Сейчас в списках»:
// имя, дата мероприятия, id. Count пикеру не нужен — он про содержимое списка,
// а не про его пригодность как цели.
export type AppendTarget = Omit<UnitListUsage, 'count'>

// count приходит только у количественной позиции — итоговое число штук в
// списке после добавления. У серийной его нет: там всегда одна.
export type AppendResult = { status: 'added' | 'already'; count: number | null }

// Ключ под префиксом equipment-lists:, как у unitUsage: список целей зависит от
// состава списков и сбрасывается их создание/правкой/удалением автоматически.
const APPEND_TARGETS_CACHE_KEY = 'equipment-lists:append-targets'

// Свежие списки первыми: кнопкой пользуются, когда собирают текущее
// мероприятие, а не архивный документ полугодовой давности.
const TARGETS_LIMIT = 20

export function readCachedAppendTargets() {
  return readCachedQuery<AppendTarget[]>(APPEND_TARGETS_CACHE_KEY)
}

export async function fetchAppendTargets(): Promise<AppendTarget[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(APPEND_TARGETS_CACHE_KEY, 10 * 60 * 1000, async () => {
    const { data, error } = await client
      .from('equipment_lists')
      .select('id,name,reservation_start')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(TARGETS_LIMIT)
    if (error) throw error
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, reservation_start: row.reservation_start }))
  })
}

/**
 * Точечное добавление единицы в сохранённый список — RPC append_equipment_to_list
 * (миграция 20260823080000). Сервер сам берёт brand/model/type/subtype из
 * equipment по id и блокирует строку списка: параллельная правка в редакторе
 * не затирается, дубль серийной единицы не создаётся ('already' — не ошибка).
 */
export async function appendEquipmentToList(
  listId: string,
  equipmentId: string,
  trackingMode: 'serialized' | 'quantity',
): Promise<AppendResult> {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase.rpc('append_equipment_to_list', {
    p_list_id: listId,
    p_equipment_id: equipmentId,
    p_tracking_mode: trackingMode,
  })

  if (error) throw error
  // Состав списка изменился — сбрасываем весь префикс, как это делают
  // create/update/delete в lists/api: под ним и реестр, и «Сейчас в списках».
  invalidateCachePrefix('equipment-lists:')
  // Два формата ответа — не подстраховка, а порядок выкатки: этот код уезжает
  // в прод РАНЬШЕ миграции 20260823090000, пока RPC ещё отвечает строкой.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const status = (data as { status?: unknown }).status === 'already' ? 'already' : 'added'
    const count = (data as { count?: unknown }).count
    return { status, count: typeof count === 'number' ? count : null }
  }
  return { status: data === 'already' ? 'already' : 'added', count: null }
}
