import { supabase } from '../../lib/supabase'
import { createSignedUrlCache } from '../../lib/signedUrlCache'
import { EMPLOYEE_BRIEF_COLUMNS } from '../employees/types'
import type { Tr, Vehicle, VehicleDriver, VehicleFile, VehicleWithDrivers } from './types'

// Приватный бакет: наружу фото уходит только по подписанной ссылке.
const BUCKET = 'vehicle-files'

// Машин десятки — выдача целиком, и водители едут ОДНИМ запросом: встраивание
// связки vehicle_drivers избавляет от второго обхода и от склейки по id на
// клиенте. Порядок с ПОЛНЫМ ключом (…, id): две одинаковые «Chevrolet Cobalt»
// без него меняются местами между запросами.
// Раскладка строки со встроенной связкой в VehicleWithDrivers. Одна на список и
// на карточку по id: разъедься они, форма правки увидела бы других водителей,
// чем таблица.
function withDrivers(row: Vehicle & { vehicle_drivers: { employees: VehicleDriver | null }[] }): VehicleWithDrivers {
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
}

export async function fetchVehicles(): Promise<VehicleWithDrivers[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicles')
    .select(`*, vehicle_drivers(employee_id, employees(${EMPLOYEE_BRIEF_COLUMNS}))`)
    .order('brand')
    .order('plate_number')
    .order('id')
  if (error) throw error

  return (data ?? []).map(withDrivers)
}

// Одна машина прямо по id — вместе с водителями: прямая ссылка на
// /vehicles/:id/edit обязана открываться без загруженного списка, а форма без
// водителей стёрла бы их первым же сохранением. null — строки нет (или её не
// видно политикой), и это НЕ отказ запроса: отказ прилетает исключением.
export async function fetchVehicleById(id: string): Promise<VehicleWithDrivers | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicles')
    .select(`*, vehicle_drivers(employee_id, employees(${EMPLOYEE_BRIEF_COLUMNS}))`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? withDrivers(data) : null
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

export type VehicleInput = {
  brand: string
  model: string
  color: string
  plate_number: string
}

// Раскладка формы в строку таблицы. Одна на вставку и на правку: разъедься они,
// новая колонка попала бы в создание и потерялась при редактировании.
// Госномер уходит РОВНО как введён: регистр, пробелы и кириллические двойники
// приводит триггер normalize_vehicle_fields — клиентская нормализация завела бы
// второй канон, и он бы разошёлся с базой на первой же правке триггера.
function vehicleRow(fields: VehicleInput) {
  const orNull = (value: string) => value.trim() || null
  return {
    brand: fields.brand.trim(),
    model: orNull(fields.model),
    color: orNull(fields.color),
    plate_number: fields.plate_number,
  }
}

export async function createVehicle(fields: VehicleInput): Promise<Vehicle> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicles')
    .insert(vehicleRow(fields))
    .select()
    .single()
  if (error) throw error
  return data
}

// Правка карточки целиком, без оптимистичной блокировки: машин десятки, правят
// их по одной, поэтому версию строки не сверяем — при гонке двух вкладок
// выигрывает последняя запись (last-write-wins). Уникальность номера держит тот
// же индекс, что и на вставке, так что отказ сюда приходит тем же 23505.
export async function updateVehicle(id: string, fields: VehicleInput): Promise<Vehicle> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('vehicles')
    .update(vehicleRow(fields))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Водители — DIFF, а не «снести и записать заново»: перезапись связки всей
// пачкой в каждом сохранении дёргала бы created_at и created_by у водителей,
// которых никто не трогал.
// Добавление идёт upsert'ом с ignoreDuplicates: параллельная вкладка могла
// назначить того же человека, и 23505 по первичному ключу (vehicle_id,
// employee_id) в ответ на «и так уже назначен» был бы ложной ошибкой.
// defaultToNull: false — это Prefer: missing=default. Без него пачечная вставка
// подставляет NULL в НЕ переданный created_by, а политика вставки требует
// created_by = auth.uid(): строка отлетела бы по RLS.
export async function saveVehicleDrivers(vehicleId: string, before: string[], after: string[]): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const added = after.filter((id) => !before.includes(id))
  const removed = before.filter((id) => !after.includes(id))

  if (added.length > 0) {
    const { error } = await supabase
      .from('vehicle_drivers')
      .upsert(added.map((employeeId) => ({ vehicle_id: vehicleId, employee_id: employeeId })), {
        onConflict: 'vehicle_id,employee_id',
        ignoreDuplicates: true,
        defaultToNull: false,
      })
    if (error) throw error
  }

  if (removed.length > 0) {
    // Обязательно ОБА фильтра: .in() без .eq('vehicle_id') снял бы этих людей
    // со всех машин сразу.
    const { error } = await supabase
      .from('vehicle_drivers')
      .delete()
      .eq('vehicle_id', vehicleId)
      .in('employee_id', removed)
    if (error) throw error
  }
}

// Расширение берём из имени файла (близнец helper'а в employees/api.ts): тип из
// file.type врёт на HEIC. Ветки PDF здесь нет — в бакет машины едут только фото,
// и compressPhoto отдаёт их уже как .jpg.
function fileExtension(file: File) {
  const dot = file.name.lastIndexOf('.')
  const fromName = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : ''
  return /^[a-z0-9]{1,8}$/.test(fromName) ? fromName : 'jpg'
}

// Две ступени: сначала объект в бакет, потом строка в vehicle_files. Ошибку
// каждой отдаём наружу как есть — вызывающий показывает по-файловый отказ и
// кнопку «Повторить». Обратного хода у первой ступени нет: DELETE в бакете
// запрещён политиками, поэтому объект без строки останется сиротой (backlog).
export async function uploadVehiclePhoto(vehicleId: string, file: File): Promise<VehicleFile> {
  if (!supabase) throw new Error('Supabase не настроен')
  const path = `${vehicleId}/photo/${crypto.randomUUID()}.${fileExtension(file)}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('vehicle_files')
    .insert({ vehicle_id: vehicleId, kind: 'photo', storage_path: path, original_name: file.name })
    .select()
    .single()
  if (error) throw error
  return data
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
