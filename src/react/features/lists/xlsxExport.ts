import { toDateValue } from '../../lib/date'
import { textCell, numberCell, formulaCell, xml } from '../../lib/xlsx/cells'
import { companyDetails, companyLegalName } from '../../lib/xlsx/documentDefaults'
import { downloadBlob, safeFileName } from '../../lib/xlsx/download'
import { buildWorkbookPackage } from '../../lib/xlsx/package'

export type ExportListRow = {
  category: string
  equipment: string
  subtype: string
  count: number
  serialNumbers: string[]
  note?: string
}

export type ExportListInput = {
  name: string
  clientName: string
  venue: string
  description: string
  eventDate: string | null
  rows: ExportListRow[]
  locale: 'ru-RU' | 'uz-UZ'
  language: 'ru' | 'uz'
  documentMode?: 'working' | 'approval'
}

function sheetTexts(language: 'ru' | 'uz') {
  return language === 'uz'
    ? { title: 'USKUNALAR RO‘YXATI', project: 'Loyiha / tadbir', client: 'Buyurtmachi / tashkilotchi', venue: 'Maydon / joylashuv', date: 'Tadbir sanasi', description: 'Hujjatga izoh', generated: 'Tuzilgan', number: '№', equipment: 'Uskuna', count: 'Miqdor', serials: 'Seriya raqamlari', note: 'Eslatma', total: 'Jami birliklar', noSerials: '—', contents: 'JAMLAMA TARKIBI', positions: 'Pozitsiyalar', units: 'Birliklar' }
    : { title: 'СПИСОК ОБОРУДОВАНИЯ', project: 'Проект / мероприятие', client: 'Заказчик / организатор', venue: 'Площадка / локация', date: 'Дата мероприятия', description: 'Комментарий к документу', generated: 'Сформирован', number: '№', equipment: 'Оборудование', count: 'Кол-во', serials: 'Серийные номера', note: 'Примечание', total: 'Всего единиц', noSerials: '—', contents: 'СОСТАВ КОМПЛЕКТА', positions: 'Позиций', units: 'Единиц' }
}

type SheetTexts = ReturnType<typeof sheetTexts>

// Строка шапки документа: подпись, значение и ключ. Ключ нужен потому, что сетка
// листа стала переменной — по индексу строку «Комментарий» уже не опознать.
type MetadataRow = [label: string, value: string, key: 'project' | 'client' | 'venue' | 'date' | 'description' | 'generated']

function formatEventDate(input: ExportListInput) {
  return input.eventDate
    ? new Intl.DateTimeFormat(input.locale).format(new Date(`${input.eventDate}T12:00:00`))
    : '—'
}

// Пустые реквизиты в документ не выводятся вовсе. Раньше на их месте стояли
// выдуманные дефолты («Заказчик не указан»), и файл под грифом «УТВЕРЖДАЮ» врал.
// Отсюда же берётся число строк метаданных: позиции остальных строк листа
// считаются от него, а не от зашитой шестёрки.
function buildMetadata(input: ExportListInput, t: SheetTexts): MetadataRow[] {
  const rows: MetadataRow[] = [[t.project, input.name, 'project']]
  if (input.clientName.trim()) rows.push([t.client, input.clientName, 'client'])
  if (input.venue.trim()) rows.push([t.venue, input.venue, 'venue'])
  rows.push([t.date, formatEventDate(input), 'date'])
  if (input.description.trim()) rows.push([t.description, input.description, 'description'])
  rows.push([t.generated, new Intl.DateTimeFormat(input.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), 'generated'])
  return rows
}

function getSheetMetrics(input: ExportListInput, metadataRows: number) {
  const metadataStart = input.documentMode === 'approval' ? 7 : 3
  const headerRow = metadataStart + metadataRows + 2
  const dataStart = headerRow + 1
  return { metadataStart, headerRow, dataStart, totalRow: dataStart + input.rows.length }
}

function buildSheet(input: ExportListInput) {
  const t = sheetTexts(input.language)
  const date = formatEventDate(input)
  const approvalMode = input.documentMode === 'approval'
  const metadata = buildMetadata(input, t)
  const { metadataStart, headerRow, dataStart, totalRow } = getSheetMetrics(input, metadata.length)
  const total = input.rows.reduce((sum, item) => sum + item.count, 0)
  const rows: string[] = []
  const merges: string[] = []

  if (approvalMode) {
    const year = new Date().getFullYear()
    const approvalText = input.language === 'uz'
      ? `TASDIQLAYMAN\n${companyLegalName.uz} direktori\n_____________Sharapova S.Sh.\n“___” _________ ${year}-y.`
      : `УТВЕРЖДАЮ\nДиректор ${companyLegalName.ru}\n_____________ Шарапова С.Ш.\n«___» __________ ${year} г.`
    rows.push(
      // Шапка бланка остаётся русской при любом языке документа — как и было.
      `<row r="1" ht="42" customHeight="1">${textCell('A1', 'A', 12)}${textCell('B1', companyLegalName.ru, 13)}${textCell('D1', approvalText, 11)}</row>`,
      `<row r="2" ht="25" customHeight="1">${textCell('A2', companyDetails, 19)}</row>`,
      '<row r="3" ht="25" customHeight="1"/>',
      '<row r="4" ht="8" customHeight="1"/>',
      `<row r="5" ht="38" customHeight="1">${textCell('A5', `ARGO MEDIA · ${t.title}`, 1)}</row>`,
      '<row r="6" ht="9" customHeight="1"/>',
    )
    merges.push('B1:C1', 'A2:C3', 'D1:E3', 'A5:E5')
  } else {
    rows.push(
      `<row r="1" ht="46" customHeight="1">${textCell('A1', 'A', 12)}${textCell('B1', `ARGO MEDIA · ${t.title}`, 13)}</row>`,
      '<row r="2" ht="9" customHeight="1"/>',
    )
    merges.push('B1:E1')
  }

  metadata.forEach(([label, value, key], index) => {
    const rowNumber = metadataStart + index
    const rowHeight = key === 'description' ? 38 : 27
    rows.push(`<row r="${rowNumber}" ht="${rowHeight}" customHeight="1">${textCell(`A${rowNumber}`, label, 2)}${textCell(`C${rowNumber}`, value, 4)}</row>`)
    merges.push(`A${rowNumber}:B${rowNumber}`, `C${rowNumber}:E${rowNumber}`)
  })
  rows.push(
    `<row r="${headerRow - 2}" ht="9" customHeight="1"/>`,
    `<row r="${headerRow - 1}" ht="32" customHeight="1">${textCell(`A${headerRow - 1}`, t.contents, 14)}${textCell(`C${headerRow - 1}`, `${t.positions}: ${input.rows.length}`, 15)}${textCell(`D${headerRow - 1}`, `${t.units}: ${total}`, 15)}</row>`,
    `<row r="${headerRow}" ht="30" customHeight="1">${textCell(`A${headerRow}`, t.number, 3)}${textCell(`B${headerRow}`, t.equipment, 3)}${textCell(`C${headerRow}`, t.count, 3)}${textCell(`D${headerRow}`, t.serials, 3)}${textCell(`E${headerRow}`, t.note, 3)}</row>`,
  )
  merges.push(`A${headerRow - 1}:B${headerRow - 1}`, `D${headerRow - 1}:E${headerRow - 1}`)
  input.rows.forEach((item, index) => {
    const rowNumber = index + dataStart
    const rowLines = Math.max(1, item.serialNumbers.length, Math.ceil(item.equipment.length / 42), Math.ceil((item.note?.length ?? 0) / 30))
    const rowHeight = Math.min(96, 30 + ((rowLines - 1) * 15))
    const alternating = index % 2 === 1
    const textStyle = alternating ? 16 : 6
    const numberStyle = alternating ? 17 : 7
    const serialStyle = alternating ? 18 : 8
    rows.push(`<row r="${rowNumber}" ht="${rowHeight}" customHeight="1">${numberCell(`A${rowNumber}`, index + 1, numberStyle)}${textCell(`B${rowNumber}`, item.equipment, textStyle)}${numberCell(`C${rowNumber}`, item.count, numberStyle)}${textCell(`D${rowNumber}`, item.serialNumbers.length ? item.serialNumbers.join('\n') : t.noSerials, serialStyle)}${textCell(`E${rowNumber}`, item.note || '', textStyle)}</row>`)
  })
  rows.push(`<row r="${totalRow}" ht="32" customHeight="1">${textCell(`A${totalRow}`, '', 9)}${textCell(`B${totalRow}`, t.total, 9)}${formulaCell(`C${totalRow}`, `SUM(C${dataStart}:C${Math.max(dataStart, totalRow - 1)})`, total, 10)}${textCell(`D${totalRow}`, '', 9)}${textCell(`E${totalRow}`, '', 9)}</row>`)

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:E${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="44" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="30" customWidth="1"/><col min="5" max="5" width="28" customWidth="1"/></cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((reference) => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.25" footer="0.25"/>
  <pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0" paperSize="9" pageOrder="downThenOver"/>
  <headerFooter differentOddEven="1"><oddHeader>&amp;LARGO MEDIA&amp;R${xml(input.name)}</oddHeader><evenHeader>&amp;LARGO MEDIA&amp;R${xml(input.name)}</evenHeader><oddFooter>&amp;LARGO MEDIA&amp;C${input.language === 'uz' ? 'Sahifa' : 'Страница'} &amp;P / &amp;N&amp;R${date}</oddFooter><evenFooter>&amp;LARGO MEDIA&amp;C${input.language === 'uz' ? 'Sahifa' : 'Страница'} &amp;P / &amp;N&amp;R${date}</evenFooter></headerFooter>
</worksheet>`
}

// Имя файла: дата мероприятия, название и режим документа. До этого оба режима
// давали одно и то же имя — второй файл ложился в загрузки как «… (1)», и понять,
// где рабочий список, а где документ с реквизитами, можно было только открыв оба.
function exportFileName(input: ExportListInput) {
  const suffix = input.documentMode === 'approval'
    ? (input.language === 'uz' ? 'kelishuvga' : 'на-согласование')
    : (input.language === 'uz' ? 'ishchi' : 'рабочий')
  return `${input.eventDate ?? toDateValue(new Date())}_${safeFileName(input.name)}_${suffix}.xlsx`
}

function createEquipmentListXlsxBlob(input: ExportListInput) {
  const sheetName = input.language === 'uz' ? 'Uskunalar' : 'Оборудование'
  // Область печати и повтор шапки считаются по той же сетке, что и сам лист:
  // число строк метаданных зависит от заполненных реквизитов.
  const { headerRow, totalRow } = getSheetMetrics(input, buildMetadata(input, sheetTexts(input.language)).length)
  return buildWorkbookPackage({
    sheetName,
    title: input.name,
    sheetXml: buildSheet(input),
    printArea: `$A$1:$E$${totalRow}`,
    printTitles: `$${headerRow}:$${headerRow}`,
  })
}

export function downloadEquipmentListXlsx(input: ExportListInput) {
  downloadBlob(createEquipmentListXlsxBlob(input), exportFileName(input))
}
