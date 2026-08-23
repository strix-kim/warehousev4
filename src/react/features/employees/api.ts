import { supabase } from '../../lib/supabase'
import { escapeLikePattern } from '../../lib/postgrest'
import { createSignedUrlCache } from '../../lib/signedUrlCache'
import type { Employee, EmployeeFile, EmployeeFileKind, Tr } from './types'

// Приватный бакет: наружу файл уходит только по подписанной ссылке.
const BUCKET = 'employee-files'

// Сотрудников ~200 — выдача целиком, без страниц. Порядок с ПОЛНЫМ ключом
// (…, id): без него однофамильцы-тёзки меняются местами между запросами.
export async function fetchEmployees(): Promise<Employee[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('last_name')
    .order('first_name')
    .order('id')
  if (error) throw error
  return data ?? []
}

export async function fetchEmployeeFiles(employeeId: string): Promise<EmployeeFile[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('employee_files')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at')
    .order('id')
  if (error) throw error
  return data ?? []
}

// Первое фото каждого сотрудника — для миниатюр списка. Отдельный запрос вместо
// fetchEmployeeFiles по каждой строке: 200 карточек дали бы 200 запросов.
export async function fetchEmployeePhotoPaths(): Promise<Map<string, string>> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('employee_files')
    .select('employee_id, storage_path, created_at, id')
    .eq('kind', 'photo')
    .order('employee_id')
    .order('created_at')
    .order('id')
    // Предел Data API — 1000 строк (gotchas §1). На ~200 сотрудниках с несколькими
    // фото это с запасом; когда упрёмся, сюда придёт батчинг по .range().
    .limit(1000)
  if (error) throw error
  const firstByEmployee = new Map<string, string>()
  for (const row of data ?? []) {
    if (!firstByEmployee.has(row.employee_id)) firstByEmployee.set(row.employee_id, row.storage_path)
  }
  return firstByEmployee
}

// Одна карточка прямо по id: прямая ссылка на /employees/:id/edit обязана
// открываться без загруженного списка. null — строки нет (или её не видно
// политикой), и это НЕ отказ запроса: отказ прилетает исключением.
export async function fetchEmployeeById(id: string): Promise<Employee | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export type EmployeeInput = {
  last_name: string
  first_name: string
  middle_name: string
  position: string
  phone: string
  passport_series: string
  passport_number: string
  pinfl: string
  birth_date: string
  birth_place: string
  passport_issued_by: string
  passport_issued_at: string
  passport_expires_at: string
  residence_address: string
  clearance_expires_at: string
  t_shirt_size: string
}

// Пустая строка в date-колонке — это ошибка типа, а не NULL, поэтому в базу
// уезжает null. Текстовые поля база сама триммит и пустые обращает в NULL
// (триггер normalize_employee_fields) — клиентский trim здесь только UX.
function orNull(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

// Раскладка формы в строку таблицы. Одна на вставку и на правку: разъедься они,
// новая колонка попала бы в создание и потерялась при редактировании.
function employeeRow(fields: EmployeeInput) {
  return {
    last_name: fields.last_name.trim(),
    first_name: fields.first_name.trim(),
    middle_name: orNull(fields.middle_name),
    position: orNull(fields.position),
    phone: orNull(fields.phone),
    passport_series: orNull(fields.passport_series),
    passport_number: orNull(fields.passport_number),
    pinfl: orNull(fields.pinfl),
    birth_date: orNull(fields.birth_date),
    birth_place: orNull(fields.birth_place),
    passport_issued_by: orNull(fields.passport_issued_by),
    passport_issued_at: orNull(fields.passport_issued_at),
    passport_expires_at: orNull(fields.passport_expires_at),
    residence_address: orNull(fields.residence_address),
    clearance_expires_at: orNull(fields.clearance_expires_at),
    t_shirt_size: orNull(fields.t_shirt_size),
  }
}

export async function createEmployee(fields: EmployeeInput): Promise<Employee> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('employees')
    .insert(employeeRow(fields))
    .select()
    .single()
  if (error) throw error
  return data
}

// Правка карточки целиком, без оптимистичной блокировки: сотрудников правят
// редко и по одному человеку за раз, поэтому версию строки не сверяем — при
// гонке двух вкладок выигрывает последняя запись (last-write-wins). Уникальность
// по ПИНФЛ и паспорту держат те же индексы, что и на вставке, так что отказ сюда
// приходит тем же кодом и разбирается employeeSaveErrorText.
export async function updateEmployee(id: string, fields: EmployeeInput): Promise<Employee> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('employees')
    .update(employeeRow(fields))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export type EmployeeNamesake = Pick<Employee, 'id' | 'last_name' | 'first_name' | 'middle_name' | 'birth_date' | 'position'>

// Тёзки — ПРЕДУПРЕЖДЕНИЕ, а не запрет: два Каримовых Азиза в базе легальны, и
// уникальность база держит по документам (ПИНФЛ, паспорт), а не по ФИО.
// ilike без подстановочных знаков — это точное совпадение без учёта регистра;
// escapeLikePattern гасит `%` и `_`, если они попали в само имя.
// excludeId — карточка, которую сейчас правят: без него человек, сохраняя
// собственную запись, каждый раз получал бы предупреждение «такой уже есть»
// про самого себя.
export async function findNamesakes(lastName: string, firstName: string, birthDate: string, excludeId?: string): Promise<EmployeeNamesake[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const last = lastName.trim()
  const first = firstName.trim()
  if (!last || !first) return []

  let query = supabase
    .from('employees')
    .select('id, last_name, first_name, middle_name, birth_date, position')
    .ilike('last_name', escapeLikePattern(last))
    .ilike('first_name', escapeLikePattern(first))
  if (birthDate) query = query.eq('birth_date', birthDate)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.order('last_name').order('first_name').order('id').limit(10)
  if (error) throw error
  return data ?? []
}

// Расширение берём из имени файла: тип из file.type врал бы на HEIC и на
// переименованных вручную сканах, а путь в бакете должен читаться глазами.
function fileExtension(file: File) {
  const dot = file.name.lastIndexOf('.')
  const fromName = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : ''
  if (/^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  return file.type === 'application/pdf' ? 'pdf' : 'bin'
}

// Две ступени: сначала объект в бакет, потом строка в employee_files. Ошибку
// каждой отдаём наружу как есть — вызывающий показывает по-файловый отказ и
// кнопку «Повторить». Обратного хода у первой ступени нет: DELETE в бакете
// запрещён политиками, поэтому объект без строки останется сиротой (backlog).
export async function uploadEmployeeFile(employeeId: string, kind: EmployeeFileKind, file: File): Promise<EmployeeFile> {
  if (!supabase) throw new Error('Supabase не настроен')
  const path = `${employeeId}/${kind}/${crypto.randomUUID()}.${fileExtension(file)}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('employee_files')
    .insert({ employee_id: employeeId, kind, storage_path: path, original_name: file.name })
    .select()
    .single()
  if (error) throw error
  return data
}

// Подписанные ссылки на файлы сотрудников. Кэш общий на бакет и живёт только
// в памяти вкладки — устройство памяти в lib/signedUrlCache.
export const { getSignedUrl, getSignedUrls } = createSignedUrlCache(BUCKET)

// Перевод отказа базы в человеческую фразу. Разбираем ИМЕНЕМ ограничения, а не
// одним кодом: под 23514 у employees три разных CHECK, и «ПИНФЛ — 14 цифр»
// в ответ на перепутанные даты паспорта было бы враньём.
export function employeeSaveErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (code === '23505' && message.includes('employees_pinfl_key')) {
    return tr('Сотрудник с таким ПИНФЛ уже есть.', 'Bunday JSHSHIRga ega xodim allaqachon mavjud.')
  }
  if (code === '23505' && message.includes('employees_passport_key')) {
    return tr('Паспорт с этой серией и номером уже заведён.', 'Bu seriya va raqamli pasport allaqachon kiritilgan.')
  }
  if (code === '23514' && message.includes('employees_passport_dates_check')) {
    return tr('«Действителен до» должен быть позже даты выдачи.', '«Amal qilish muddati» berilgan sanadan keyin bo‘lishi kerak.')
  }
  if (code === '23514') {
    return tr('ПИНФЛ — 14 цифр.', 'JSHSHIR — 14 ta raqam.')
  }
  return tr('Не удалось сохранить сотрудника. Проверьте поля и повторите попытку.', 'Xodimni saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}
