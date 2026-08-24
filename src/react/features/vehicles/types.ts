import type { Tables } from '../../lib/database.types'
import type { EmployeeBrief } from '../employees/types'

// Строки таблиц ровно в том виде, в каком их отдаёт база: нормализацией марки,
// модели, цвета и госномера занимается триггер normalize_vehicle_fields.
export type Vehicle = Tables<'vehicles'>
export type VehicleFile = Tables<'vehicle_files'>

// Водитель в карточке машины — та же краткая карточка сотрудника, что ходит
// в пикере: здесь нужно только «кому звонить», полная запись живёт в разделе
// «Сотрудники». Имя оставлено своё — в коде машин водитель называется водителем.
export type VehicleDriver = EmployeeBrief

// Машина со встроенными водителями — ровно то, что отдаёт fetchVehicles.
// Связка vehicle_drivers в этот тип не попадает: у неё нет собственных полей,
// которые показывает интерфейс.
export type VehicleWithDrivers = Vehicle & { drivers: VehicleDriver[] }

export type Tr = (ru: string, uz: string) => string

// «Chevrolet Cobalt». Модель необязательна — лишний пробел убираем здесь,
// а не в каждом месте показа.
export function vehicleTitle(brand: string, model: string | null) {
  return [brand, model].filter(Boolean).join(' ')
}

// Ключ клиентского поиска по номеру: «01 439 SNA», «01439sna» и «01 439sna» —
// один и тот же номер. Канон в базе держит триггер normalize_vehicle_fields,
// здесь — только сравнение строк на экране, поэтому кириллические двойники
// не трогаем: в поиске «С» вместо «C» просто ничего не найдёт.
export function plateForSearch(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

// «Каримов А. О.» — водители в строке таблицы. Полное ФИО там не помещается,
// а фамилии без инициалов не различают однофамильцев.
export function driverShortName(driver: Pick<VehicleDriver, 'last_name' | 'first_name' | 'middle_name'>) {
  const initials = [driver.first_name, driver.middle_name]
    .filter(Boolean)
    .map((part) => `${part!.slice(0, 1).toUpperCase()}.`)
    .join(' ')
  return initials ? `${driver.last_name} ${initials}` : driver.last_name
}

// ФИО одной строкой — для дровера, где место есть.
export function driverFullName(driver: Pick<VehicleDriver, 'last_name' | 'first_name' | 'middle_name'>) {
  return [driver.last_name, driver.first_name, driver.middle_name].filter(Boolean).join(' ')
}
