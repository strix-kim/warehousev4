import { supabase } from '../../lib/supabase'
import { createSignedUrlCache } from '../../lib/signedUrlCache'
import type { Tr, VehicleFile, VehicleWithDrivers } from './types'

// Приватный бакет: наружу фото уходит только по подписанной ссылке.
const BUCKET = 'vehicle-files'

// Колонки водителя, встраиваемые в выдачу машин. Строка вынесена в константу,
// чтобы список полей жил в одном месте с типом VehicleDriver.
const DRIVER_COLUMNS = 'id, last_name, first_name, middle_name, phone, position'

// Машин десятки — выдача целиком, и водители едут ОДНИМ запросом: встраивание
// связки vehicle_drivers избавляет от второго обхода и от склейки по id на
// клиенте. Порядок с ПОЛНЫМ ключом (…, id): две одинаковые «Chevrolet Cobalt»
// без него меняются местами между запросами.
export async function fetchVehicles(): Promise<VehicleWithDrivers[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicles')
    .select(`*, vehicle_drivers(employee_id, employees(${DRIVER_COLUMNS}))`)
    .order('brand')
    .order('plate_number')
    .order('id')
  if (error) throw error

  return (data ?? []).map((row) => {
    const { vehicle_drivers: links, ...vehicle } = row
    // Водителей сортируем здесь, а не в запросе: порядок вложенного ресурса
    // задаётся через referencedTable и на два уровня вглубь не дотягивается,
    // а водителей у машины единицы.
    const drivers = links
      .map((link) => link.employees)
      // Типы обещают объект (FK не nullable), но встроенный ресурс приходит
      // пустым, если строку сотрудника скрыла политика: такую связку молча
      // пропускаем, а не роняем список.
      .filter((driver) => driver !== null)
      .sort((left, right) => left.last_name.localeCompare(right.last_name) || left.first_name.localeCompare(right.first_name))
    return { ...vehicle, drivers }
  })
}

export async function fetchVehicleFiles(vehicleId: string): Promise<VehicleFile[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicle_files')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at')
    .order('id')
  if (error) throw error
  return data ?? []
}

// Первое фото каждой машины — для миниатюр списка. Отдельный запрос вместо
// fetchVehicleFiles по каждой строке: карточек десятки, запросов было бы столько же.
export async function fetchVehiclePhotoPaths(): Promise<Map<string, string>> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicle_files')
    .select('vehicle_id, storage_path, created_at, id')
    .eq('kind', 'photo')
    .order('vehicle_id')
    .order('created_at')
    .order('id')
    // Предел Data API — 1000 строк (gotchas §1). На десятке машин с несколькими
    // фото это с запасом; когда упрёмся, сюда придёт батчинг по .range().
    .limit(1000)
  if (error) throw error
  const firstByVehicle = new Map<string, string>()
  for (const row of data ?? []) {
    if (!firstByVehicle.has(row.vehicle_id)) firstByVehicle.set(row.vehicle_id, row.storage_path)
  }
  return firstByVehicle
}

// Подписанные ссылки на файлы машин. Кэш общий на бакет и живёт только
// в памяти вкладки — устройство памяти в lib/signedUrlCache.
export const { getSignedUrl, getSignedUrls } = createSignedUrlCache(BUCKET)

// Перевод отказа базы в человеческую фразу. Разбираем ИМЕНЕМ ограничения, а не
// одним кодом 23505: имя приходит в тексте ошибки, и «госномер уже есть» в ответ
// на столкновение по другому индексу было бы враньём. Уникальность смотрит на
// номер БЕЗ пробелов, поэтому «01439SNA» столкнётся с «01 439 SNA» — это и есть
// причина, по которой клиентская проверка дублей здесь не заводится вообще.
export function vehicleSaveErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (code === '23505' && message.includes('vehicles_plate_number_key')) {
    return tr('Машина с таким госномером уже есть.', 'Bunday davlat raqamiga ega mashina allaqachon mavjud.')
  }
  return tr('Не удалось сохранить машину. Проверьте поля и повторите попытку.', 'Mashinani saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}
