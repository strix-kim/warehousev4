// Документ «Список автотранспорта на мероприятие»: одна строка на машину,
// паспортные данные водителей — из их полных карточек. Каркас листа общий со
// списком персонала (lib/xlsx/eventSheet.ts), здесь только колонки и значения.
//
// Всё считается в браузере и никуда не пишется: файл — снимок выбранных машин на
// момент нажатия, а не запись в базе.

import { driverFullName, vehicleTitle, type VehicleDriver, type VehicleWithDrivers } from './types'
import type { Employee } from '../employees/types'
import { companyDirector, companyLegalName } from '../../lib/xlsx/documentDefaults'
import { downloadBlob, safeFileName } from '../../lib/xlsx/download'
import { docText, eventDocumentTitle, formatDocumentDate, type EventDocumentMeta } from '../../lib/xlsx/eventDocument'
import { buildEventSheet, type EventSheet, type EventSheetCell, type EventSheetColumn } from '../../lib/xlsx/eventSheet'
import { buildWorkbookPackage } from '../../lib/xlsx/package'

// Пустое поле в документе — прочерк, а не пустая ячейка: пустая читается как
// «забыли напечатать», прочерк — как «данных нет».
const DASH = '—'

// Порядок колонок — из образца прораба (ARGO_MEDIA_транспортные_средства): серия
// и номер паспорта идут сразу за ФИО, телефон водителя стоит последним. Ширины
// подобраны так, чтобы тринадцать колонок влезли в портретный A4 при fitToWidth.
// Выравнивание почти везде с переносом не ради длины: у машины бывает несколько
// водителей, их значения склеены через \n, а Excel показывает \n только с wrapText.
const COLUMN_LAYOUT: Array<{ width: number; align: EventSheetColumn['align'] }> = [
  { width: 4, align: 'center' },      // A № / Т/р
  { width: 18, align: 'left' },       // B ФИО водителя
  { width: 7, align: 'centerWrap' },  // C серия паспорта
  { width: 10, align: 'centerWrap' }, // D номер паспорта
  { width: 11, align: 'centerWrap' }, // E дата рождения
  { width: 12, align: 'centerWrap' }, // F место рождения
  { width: 20, align: 'left' },       // G адрес проживания
  { width: 13, align: 'left' },       // H марка и модель
  { width: 9, align: 'centerWrap' },  // I цвет
  { width: 12, align: 'center' },     // J госномер
  { width: 12, align: 'centerWrap' }, // K организация
  { width: 15, align: 'centerWrap' }, // L руководитель
  { width: 15, align: 'centerWrap' }, // M телефон водителя
]

// Шапка втрое выше, чем у персонала: узбекские заголовки вроде «Транспорт давлат
// рақами» в колонке шириной 12 символов встают в три строки.
const HEADER_HEIGHT_PT = 60

// Строка текста Arial 10 с запасом на межстрочный интервал.
const LINE_HEIGHT_PT = 13

function sheetTexts(language: 'ru' | 'uz') {
  return {
    plaque: docText(language, 'СПИСОК АВТОТРАНСПОРТА НА МЕРОПРИЯТИЕ', 'ТАДБИРГА ЖАЛБ ЭТИЛГАН АВТОТРАНСПОРТ РЎЙХАТИ'),
    headers: [
      docText(language, '№', 'Т/р'),
      docText(language, 'Ф.И.О. водителя', 'Ҳайдовчининг Ф.И.Ш'),
      docText(language, 'Серия паспорта', 'Паспорт серияси'),
      docText(language, 'Номер паспорта', 'Паспорт рақами'),
      docText(language, 'Дата рождения', 'Туғилган сана'),
      docText(language, 'Место рождения', 'Туғилган жойи'),
      docText(language, 'Адрес проживания', 'Яшаш манзили'),
      docText(language, 'Марка и модель ТС', 'Транспорт русуми'),
      docText(language, 'Цвет ТС', 'Транспорт ранги'),
      docText(language, 'Госномер ТС', 'Транспорт давлат рақами'),
      docText(language, 'Организация', 'Ташкилот номи'),
      docText(language, 'Ф.И.О. и телефон руководителя', 'Раҳбари Ф.И.Ш, телефон рақами'),
      docText(language, 'Телефон водителя', 'Ҳайдовчи телефон рақами'),
    ],
    total: docText(language, 'Всего ТС', 'Жами ТВ'),
  }
}

/**
 * Колонка, значение которой берётся у каждого водителя машины. Несколько
 * водителей — несколько строк внутри одной ячейки: строка документа остаётся
 * одна на машину, иначе номер и марка дублировались бы у каждого человека.
 * Машина без водителей даёт один прочерк, а не пустоту.
 */
function driverColumn(drivers: VehicleDriver[], value: (driver: VehicleDriver) => string): string {
  if (drivers.length === 0) return DASH
  return drivers.map((driver) => value(driver) || DASH).join('\n')
}

// Оценка высоты строки: самая «многострочная» ячейка задаёт высоту всей строке.
// Считаем только колонки с переносом — в остальных перенос физически невозможен.
// customHeight не ставим (см. eventSheet.ts): Excel померит строку сам, а число
// остаётся кэшем для просмотрщика, который мерить не станет.
function estimateRowHeight(row: EventSheetCell[]): number {
  let lines = 1
  row.forEach((value, index) => {
    const column = COLUMN_LAYOUT[index]
    if (!column || column.align === 'center' || typeof value === 'number') return
    // Два символа съедают отступ и поля ячейки.
    const perLine = Math.max(1, column.width - 2)
    const count = value.split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / perLine)), 0)
    lines = Math.max(lines, count)
  })
  return Math.max(20, lines * LINE_HEIGHT_PT)
}

export function buildVehicleEventSheet(vehicles: VehicleWithDrivers[], employeesById: Map<string, Employee>, meta: EventDocumentMeta): EventSheet {
  const t = sheetTexts(meta.language)
  const columns: EventSheetColumn[] = COLUMN_LAYOUT.map((column, index) => ({ ...column, header: t.headers[index] ?? '' }))
  // Организация и руководитель одинаковы во всех строках — это реквизит фирмы,
  // а не поле машины, поэтому считаются один раз на документ.
  const organization = companyLegalName[meta.language]
  const director = `${companyDirector.name}, ${companyDirector.phone}`

  const rows: EventSheetCell[][] = vehicles.map((vehicle, index) => {
    // Полная карточка водителя (паспорт, адрес, дата рождения) живёт в разделе
    // «Сотрудники»: во встроенном в машину водителе этих колонок нет.
    const card = (driver: VehicleDriver) => employeesById.get(driver.id)
    return [
      index + 1,
      driverColumn(vehicle.drivers, driverFullName),
      driverColumn(vehicle.drivers, (driver) => card(driver)?.passport_series ?? ''),
      driverColumn(vehicle.drivers, (driver) => card(driver)?.passport_number ?? ''),
      driverColumn(vehicle.drivers, (driver) => {
        const birth = card(driver)?.birth_date
        return birth ? formatDocumentDate(birth) : ''
      }),
      driverColumn(vehicle.drivers, (driver) => card(driver)?.birth_place ?? ''),
      driverColumn(vehicle.drivers, (driver) => card(driver)?.residence_address ?? ''),
      vehicleTitle(vehicle.brand, vehicle.model),
      vehicle.color || DASH,
      // Госномер уходит ровно как в базе — «как на жестянке»: канон держит
      // триггер normalize_vehicle_fields, второй нормализации здесь не заводим.
      vehicle.plate_number,
      organization,
      director,
      // Телефон — из полной карточки, но с откатом на встроенного водителя:
      // выдача сотрудников могла не дойти, а номер уже есть в списке машин.
      driverColumn(vehicle.drivers, (driver) => card(driver)?.phone ?? driver.phone ?? ''),
    ]
  })

  return buildEventSheet({
    kind: 'vehicles',
    meta,
    plaque: t.plaque,
    columns,
    rows,
    totalLabel: `${t.total}: ${vehicles.length}`,
    orientation: 'landscape', // 13 колонок: в портрете fitToWidth ужимает лист до ~65 %, образец прораба просто уезжал на несколько страниц
    headerHeightPt: HEADER_HEIGHT_PT,
    rowHeight: { estimate: estimateRowHeight },
  })
}

// Порядок в документе — по марке и модели, а не тот, в котором ставили галки:
// принимающая сторона ищет машину глазами. localeCompare, а не сравнение строк:
// латиница и кириллица в марках иначе разъезжаются на разные концы списка.
// Внутри одной марки порядок остаётся как есть — его уже задал fetchVehicles.
function byTitle(a: VehicleWithDrivers, b: VehicleWithDrivers) {
  return vehicleTitle(a.brand, a.model).localeCompare(vehicleTitle(b.brand, b.model), 'ru')
}

export function downloadVehicleEventXlsx({ vehicles, employeesById, meta }: {
  vehicles: VehicleWithDrivers[]
  employeesById: Map<string, Employee>
  meta: EventDocumentMeta
}) {
  const sorted = [...vehicles].sort(byTitle)
  const sheet = buildVehicleEventSheet(sorted, employeesById, meta)
  const blob = buildWorkbookPackage({
    sheetName: docText(meta.language, 'Автомобили', 'Автомобиллар'),
    title: eventDocumentTitle('vehicles', meta),
    sheetXml: sheet.sheetXml,
    printArea: sheet.printArea,
    printTitles: sheet.printTitles,
  })
  const suffix = docText(meta.language, 'авто', 'автомобиллар')
  downloadBlob(blob, `${meta.dateFrom}_${safeFileName(meta.name, 'event')}_${suffix}.xlsx`)
}
