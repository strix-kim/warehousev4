import { supabase } from '../../lib/supabase'
import { invalidateProjectCounters } from './cacheKeys'
import type { Tr } from './types'
import { EMPLOYEE_LIST_COLUMNS, type Employee, type EmployeeListItem } from '../employees/types'

// Состав мероприятия (project_staff). Отдельный файл от api.ts: там реквизиты и
// реестр с кэшем, здесь — люди, и НИ ОДНА выдача отсюда в persistentCache не
// ложится: экран читает базу каждый раз, а полные строки с паспортом живут
// ровно столько, сколько собирается документ.

// Предел Data API на один ответ (gotchas §1).
const BATCH_SIZE = 1000

// Строка состава для экрана: сам человек — теми же колонками, что реестр
// сотрудников (EMPLOYEE_LIST_COLUMNS), то есть без паспорта, ПИНФЛ и адреса.
export type ProjectStaffMember = {
  id: string
  employee_id: string
  employee: EmployeeListItem
}

// Порядок на экране — как в реестре сотрудников: фамилия, имя, id. Собирается на
// клиенте: PostgREST не сортирует родительские строки по колонке встроенной
// таблицы так, чтобы на это можно было опереть батчи.
export function sortStaff(members: ProjectStaffMember[]): ProjectStaffMember[] {
  return [...members].sort((left, right) => left.employee.last_name.localeCompare(right.employee.last_name, 'ru')
    || left.employee.first_name.localeCompare(right.employee.first_name, 'ru')
    || left.employee_id.localeCompare(right.employee_id))
}

// Люди состава читаются embed-ом project_staff → employees, а не `.in()` по
// списку id: сотня uuid в адресе запроса упирается в длину URL. Батчи по 1000 с
// полным ключом порядка (created_at, id) — состав в сотню человек реален, а
// обрезка без ошибки показала бы неполный список как полный.
export async function fetchProjectStaff(projectId: string): Promise<ProjectStaffMember[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const rows: ProjectStaffMember[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from('project_staff')
      .select(`id, employee_id, employee:employees(${EMPLOYEE_LIST_COLUMNS})`)
      .eq('project_id', projectId)
      .order('created_at')
      .order('id')
      .range(from, from + BATCH_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) return sortStaff(rows)
  }
}

// ПОЛНЫЕ строки людей состава — для сборки документа, в момент нажатия и мимо
// кэша (тот же довод, что у fetchEmployeesByIds). Тем же embed-ом и теми же
// батчами; порядок строк в документе задаёт сам генератор.
export async function fetchProjectStaffEmployees(projectId: string): Promise<Employee[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const rows: Employee[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from('project_staff')
      .select('id, employee:employees(*)')
      .eq('project_id', projectId)
      .order('created_at')
      .order('id')
      .range(from, from + BATCH_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    for (const row of batch) rows.push(row.employee)
    if (batch.length < BATCH_SIZE) return rows
  }
}

// Один человек в состав. null — не отказ, а «он уже в составе»: правило держит
// project_staff_member_key, и дубль здесь — норма гонки двух вкладок, а не
// ошибка человека (тот же приём, что у createCatalogEntry в halls/api). Проверки
// «до вставки» нет намеренно: её не спасла бы та же гонка, решает индекс.
// created_by не шлём: вставка одиночная, default auth.uid() подставляет база.
export async function addProjectStaffMember(projectId: string, employeeId: string): Promise<ProjectStaffMember | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('project_staff')
    .insert({ project_id: projectId, employee_id: employeeId })
    .select(`id, employee_id, employee:employees(${EMPLOYEE_LIST_COLUMNS})`)
    .single()
  if (error) {
    if (error.code !== '23505' || !error.message.includes('project_staff_member_key')) throw error
    // Число в реестре у нас тоже устарело: человека добавила другая вкладка.
    invalidateProjectCounters()
    return null
  }
  invalidateProjectCounters()
  return data
}

// Отказ удаления, который база не называет ошибкой: RLS молча отсекает строку,
// и ноль строк в ответе бывает ещё и честным — человека уже убрала другая
// вкладка. Различить эти случаи клиент не может (тот же приём — deleteProject).
export const STAFF_DELETE_NOT_APPLIED = 'project-staff-delete-not-applied'

export async function removeProjectStaffMember(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.from('project_staff').delete().eq('id', id).select('id')
  if (error) throw error
  // Сброс и при нуле строк: если человека убрал кто-то другой, счётчик реестра
  // устарел ровно так же.
  invalidateProjectCounters()
  if (!data?.length) throw new Error(STAFF_DELETE_NOT_APPLIED)
}

// Перевод отказа базы в человеческую фразу — по имени ограничения, как
// projectErrorText: под 23503 у строки состава два разных внешних ключа.
export function projectStaffErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (message === STAFF_DELETE_NOT_APPLIED) {
    return tr('Не убрано: нет прав или человека уже убрали из состава.', 'Olib tashlanmadi: huquq yo‘q yoki xodim tarkibdan allaqachon chiqarilgan.')
  }
  // Обычный путь сюда не приходит: addProjectStaffMember глотает дубль сам.
  if (code === '23505' && message.includes('project_staff_member_key')) {
    return tr('Этот человек уже в составе.', 'Bu xodim allaqachon tarkibda.')
  }
  // Карточку сотрудника удалили, пока он висел в выдаче пикера.
  if (code === '23503' && message.includes('project_staff_employee_id_fkey')) {
    return tr('Этого сотрудника больше нет в базе — обновите страницу.', 'Bu xodim endi bazada yo‘q — sahifani yangilang.')
  }
  if (code === '23503' && message.includes('project_staff_project_id_fkey')) {
    return tr('Мероприятие удалили — состав сохранить некуда.', 'Tadbir o‘chirilgan — tarkibni saqlab bo‘lmaydi.')
  }
  if (code === '42501') {
    return tr('Недостаточно прав: состав ведут техники, менеджеры и администраторы.', 'Huquq yetarli emas: tarkibni texniklar, menejerlar va administratorlar yuritadi.')
  }
  return tr('Не удалось изменить состав. Повторите попытку.', 'Tarkibni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.')
}
