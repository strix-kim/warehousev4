// Каркас листа документа «на мероприятие»: плашка, абзац-заголовок, реквизиты
// фирмы, шапка таблицы, чередование строк, итог и настройки печати. Общий на
// список персонала и список автотранспорта — разъехавшись, две выгрузки дали бы
// две разные бумаги с одной и той же шапкой.
//
// Снаружи остаётся только содержимое: ширины колонок, значения ячеек и слой
// картинок. Про картинки каркас знает ровно одно — есть они или нет: по схеме
// CT_Worksheet элемент <drawing> идёт ПОСЛЕ headerFooter, поэтому его место
// здесь, а сам слой собирает тот, кто его наполняет.

import { numberCell, textCell, xml } from './cells'
import { companyDetails } from './documentDefaults'
import { docText, eventDocumentTitle, formatDocumentDate, type EventDocumentMeta } from './eventDocument'

// Выравнивание колонки — ровно три варианта, которые есть в cellXfs: текст с
// отступом и переносом, по центру без переноса и по центру с переносом.
// Перенос важен не только для длинного текста: символ \n внутри ячейки Excel
// показывает переводом строки ТОЛЬКО при wrapText, иначе склеивает всё в одну.
export type EventSheetAlign = 'left' | 'center' | 'centerWrap'

export type EventSheetColumn = { width: number; header: string; align: EventSheetAlign }

// Число едет в лист числом (колонка «№»), остальное — inlineStr.
export type EventSheetCell = string | number

export const HEADER_ROW = 6
export const DATA_START_ROW = 7

// Высоты служебных строк 1–5 (плашка, зазор, заголовок, реквизиты, зазор) в
// пунктах. Наружу — потому что слой картинок складывает из них абсолютный y
// для a:xfrm: просмотрщики без раскладки листа (QuickLook на iPhone) читают
// не якорь, а готовые координаты.
export const TOP_ROW_HEIGHTS_PT = [46, 9, 58, 32, 9] as const

// Стили данных парами «обычная строка / чередующаяся»: индексы в cellXfs.
const DATA_STYLES: Record<EventSheetAlign, [number, number]> = {
  left: [6, 16],
  center: [7, 17],
  centerWrap: [8, 18],
}

// Буква колонки по индексу: документы этого вида не шире Z, одной буквы хватает.
export function columnLetter(index: number) {
  return String.fromCharCode(65 + index)
}

export type EventSheetInput = {
  kind: 'staff' | 'vehicles'
  meta: EventDocumentMeta
  // Текст красной плашки в первой строке — без префикса «ARGO MEDIA · ».
  plaque: string
  columns: EventSheetColumn[]
  // Значения по колонкам, строка в строку с `columns`.
  rows: EventSheetCell[][]
  // Готовая фраза итога («Всего: 12») — склейку делает вызывающий: у него язык
  // документа и своё слово для единицы счёта.
  totalLabel: string
  orientation: 'portrait' | 'landscape'
  // Высота шапки в пунктах: узбекские заголовки в узкой колонке уезжают на три
  // строки, и общей высоты на оба документа не существует.
  headerHeightPt: number
  // Фиксированная высота строки данных (customHeight — Excel её не пересчитывает,
  // что и нужно ровной сетке под фото) либо оценка под авто-подбор: без
  // customHeight Excel меряет строку сам, а ht остаётся кэшем на случай
  // просмотрщика, который мерить не станет.
  rowHeight: { pt: number } | { estimate: (row: EventSheetCell[]) => number }
  hasDrawing?: boolean
}

export type EventSheet = { sheetXml: string; printArea: string; printTitles: string }

export function buildEventSheet(input: EventSheetInput): EventSheet {
  const { columns, rows, meta } = input
  const last = columnLetter(columns.length - 1)
  const title = eventDocumentTitle(input.kind, meta)
  const page = docText(meta.language, 'Страница', 'Саҳифа')
  const totalRow = DATA_START_ROW + rows.length
  const merges = [`B1:${last}1`, `A3:${last}3`, `A4:${last}4`]
  const cells: string[] = []

  cells.push(
    // Плашка как у оборудования: красный квадрат с «A» в первой колонке и тёмная
    // полоса на всю остальную ширину.
    `<row r="1" ht="${TOP_ROW_HEIGHTS_PT[0]}" customHeight="1">${textCell('A1', 'A', 12)}${textCell('B1', `ARGO MEDIA · ${input.plaque}`, 13)}</row>`,
    `<row r="2" ht="${TOP_ROW_HEIGHTS_PT[1]}" customHeight="1"/>`,
    `<row r="3" ht="${TOP_ROW_HEIGHTS_PT[2]}" customHeight="1">${textCell('A3', title, 20)}</row>`,
    `<row r="4" ht="${TOP_ROW_HEIGHTS_PT[3]}" customHeight="1">${textCell('A4', companyDetails, 19)}</row>`,
    `<row r="5" ht="${TOP_ROW_HEIGHTS_PT[4]}" customHeight="1"/>`,
    `<row r="${HEADER_ROW}" ht="${input.headerHeightPt}" customHeight="1">${columns
      .map((column, index) => textCell(`${columnLetter(index)}${HEADER_ROW}`, column.header, 3))
      .join('')}</row>`,
  )

  rows.forEach((row, index) => {
    const rowNumber = DATA_START_ROW + index
    const alternating = index % 2 === 1 ? 1 : 0
    const height = 'pt' in input.rowHeight
      ? ` ht="${input.rowHeight.pt}" customHeight="1"`
      : ` ht="${input.rowHeight.estimate(row)}"`
    const body = row.map((value, column) => {
      const reference = `${columnLetter(column)}${rowNumber}`
      const style = DATA_STYLES[columns[column]?.align ?? 'left'][alternating]
      return typeof value === 'number' ? numberCell(reference, value, style) : textCell(reference, value, style)
    }).join('')
    cells.push(`<row r="${rowNumber}"${height}>${body}</row>`)
  })

  // Итог занимает всю ширину полосой одного стиля: текст стоит во второй колонке —
  // первая узкая под номер, и фраза из неё бы вывалилась.
  cells.push(`<row r="${totalRow}" ht="32" customHeight="1">`
    + columns.map((_, index) => textCell(`${columnLetter(index)}${totalRow}`, index === 1 ? input.totalLabel : '', 9)).join('')
    + '</row>')

  const period = formatDocumentDate(meta.dateFrom)
  // xmlns:r объявлен всегда, а сам <drawing> появляется только с картинками:
  // по схеме CT_Worksheet он идёт ПОСЛЕ headerFooter, иначе Excel зовёт файл
  // повреждённым и предлагает «восстановить».
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${last}${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`).join('')}</cols>
  <sheetData>${cells.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((reference) => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.25" footer="0.25"/>
  <pageSetup orientation="${input.orientation}" fitToWidth="1" fitToHeight="0" paperSize="9" pageOrder="downThenOver"/>
  <headerFooter differentOddEven="1"><oddHeader>&amp;LARGO MEDIA&amp;R${xml(meta.name)}</oddHeader><evenHeader>&amp;LARGO MEDIA&amp;R${xml(meta.name)}</evenHeader><oddFooter>&amp;LARGO MEDIA&amp;C${page} &amp;P / &amp;N&amp;R${period}</oddFooter><evenFooter>&amp;LARGO MEDIA&amp;C${page} &amp;P / &amp;N&amp;R${period}</evenFooter></headerFooter>
  ${input.hasDrawing ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`

  return {
    sheetXml,
    printArea: `$A$1:$${last}$${totalRow}`,
    printTitles: `$${HEADER_ROW}:$${HEADER_ROW}`,
  }
}
