import type { Tables } from '../../lib/database.types'

// Строки таблиц ровно в том виде, в каком их отдаёт база: производных полей у
// сотрудника нет, нормализацией занимается триггер normalize_employee_fields.
export type Employee = Tables<'employees'>
export type EmployeeFile = Tables<'employee_files'>

// Краткая карточка сотрудника — подмножество колонок для мест, где нужно только
// «кого зовут и кому звонить»: чипы водителей у машины, выдача пикера. Полная
// запись живёт в разделе «Сотрудники».
export type EmployeeBrief = Pick<Tables<'employees'>, 'id' | 'last_name' | 'first_name' | 'middle_name' | 'phone' | 'position'>

// Те же колонки строкой для select(): список полей обязан жить в одном месте
// с типом EmployeeBrief, иначе они разъедутся на первой же новой колонке.
export const EMPLOYEE_BRIEF_COLUMNS = 'id, last_name, first_name, middle_name, phone, position'

// Виды файлов повторяют CHECK на employee_files.kind: список закрыт базой,
// клиент только раскладывает его по секциям формы и карточки.
export type EmployeeFileKind = 'photo' | 'passport_front' | 'passport_back' | 'intl_passport' | 'residence_reg'

export type Tr = (ru: string, uz: string) => string

// kind в базе — text, поэтому строка из базы приходит шире нашего союза:
// неизвестный вид показываем кодом, а не пустотой.
export function employeeFileKindLabel(kind: string, tr: Tr): string {
  switch (kind) {
    case 'photo': return tr('Фото', 'Foto')
    case 'passport_front': return tr('Паспорт — лицевая сторона', 'Pasport — old tomoni')
    case 'passport_back': return tr('Паспорт — обратная сторона', 'Pasport — orqa tomoni')
    case 'intl_passport': return tr('Загранпаспорт', 'Xorijiy pasport')
    case 'residence_reg': return tr('Прописка', 'Propiska')
    default: return kind
  }
}

// ФИО одной строкой. Отчество может отсутствовать — лишний пробел убираем здесь,
// а не в каждом месте показа.
export function employeeFullName(employee: Pick<Employee, 'last_name' | 'first_name' | 'middle_name'>) {
  return [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(' ')
}
