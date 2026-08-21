import { companyDetails, companyLegalName, listDocumentDefaults } from './documentDefaults'

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

const encoder = new TextEncoder()

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function textCell(reference: string, value: string, style: number) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function numberCell(reference: string, value: number, style: number) {
  return `<c r="${reference}" s="${style}"><v>${value}</v></c>`
}

function formulaCell(reference: string, formula: string, cachedValue: number, style: number) {
  return `<c r="${reference}" s="${style}"><f>${xml(formula)}</f><v>${cachedValue}</v></c>`
}

function getSheetMetrics(input: ExportListInput) {
  const metadataStart = input.documentMode === 'approval' ? 7 : 3
  const headerRow = metadataStart + 8
  const dataStart = headerRow + 1
  return { metadataStart, headerRow, dataStart, totalRow: dataStart + input.rows.length }
}

function buildSheet(input: ExportListInput) {
  const defaults = listDocumentDefaults[input.language]
  const t = input.language === 'uz'
    ? { title: 'USKUNALAR RO‘YXATI', project: 'Loyiha / tadbir', client: 'Buyurtmachi / tashkilotchi', venue: 'Maydon / joylashuv', date: 'Tadbir sanasi', description: 'Hujjatga izoh', generated: 'Tuzilgan', number: '№', equipment: 'Uskuna', count: 'Miqdor', serials: 'Seriya raqamlari', note: 'Eslatma', total: 'Jami birliklar', noSerials: '—', contents: 'JAMLAMA TARKIBI', positions: 'Pozitsiyalar', units: 'Birliklar' }
    : { title: 'СПИСОК ОБОРУДОВАНИЯ', project: 'Проект / мероприятие', client: 'Заказчик / организатор', venue: 'Площадка / локация', date: 'Дата мероприятия', description: 'Комментарий к документу', generated: 'Сформирован', number: '№', equipment: 'Оборудование', count: 'Кол-во', serials: 'Серийные номера', note: 'Примечание', total: 'Всего единиц', noSerials: '—', contents: 'СОСТАВ КОМПЛЕКТА', positions: 'Позиций', units: 'Единиц' }
  const date = input.eventDate
    ? new Intl.DateTimeFormat(input.locale).format(new Date(`${input.eventDate}T12:00:00`))
    : '—'
  const generatedAt = new Intl.DateTimeFormat(input.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  const approvalMode = input.documentMode === 'approval'
  const { metadataStart, headerRow, dataStart, totalRow } = getSheetMetrics(input)
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

  // Пары «подпись → значение»: тип кортежем, иначе деструктуризация даёт string | undefined
  const metadata: [string, string][] = [
    [t.project, input.name || defaults.name],
    [t.client, input.clientName || defaults.clientName],
    [t.venue, input.venue || defaults.venue],
    [t.date, date],
    [t.description, input.description || '—'],
    [t.generated, generatedAt],
  ]
  metadata.forEach(([label, value], index) => {
    const rowNumber = metadataStart + index
    const rowHeight = index === 4 ? 38 : 27
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
  <headerFooter differentOddEven="1"><oddHeader>&amp;LARGO MEDIA&amp;R${xml(input.name || defaults.name)}</oddHeader><evenHeader>&amp;LARGO MEDIA&amp;R${xml(input.name || defaults.name)}</evenHeader><oddFooter>&amp;LARGO MEDIA&amp;C${input.language === 'uz' ? 'Sahifa' : 'Страница'} &amp;P / &amp;N&amp;R${date}</oddFooter><evenFooter>&amp;LARGO MEDIA&amp;C${input.language === 'uz' ? 'Sahifa' : 'Страница'} &amp;P / &amp;N&amp;R${date}</evenFooter></headerFooter>
</worksheet>`
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><color rgb="FF22282C"/><sz val="10"/><name val="Arial"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Arial"/><family val="2"/></font>
    <font><b/><color rgb="FF22282C"/><sz val="9"/><name val="Arial"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/><family val="2"/></font>
    <font><b/><color rgb="FF22282C"/><sz val="13"/><name val="Arial"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Arial"/><family val="2"/></font>
    <font><color rgb="FF687178"/><sz val="9"/><name val="Arial"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEF1236"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F1"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF171C20"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFAFBF9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1F4"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFDDE2DD"/></bottom><diagonal/></border>
    <border><left/><right/><top style="medium"><color rgb="FFEF1236"/></top><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="20">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function write16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true) }
function write32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, true) }

function zip(files: Array<{ name: string; content: string }>) {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const localView = new DataView(local.buffer)
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800); write16(localView, 8, 0)
    write32(localView, 14, crc); write32(localView, 18, data.length); write32(localView, 22, data.length); write16(localView, 26, name.length)
    local.set(name, 30); local.set(data, 30 + name.length); chunks.push(local)

    const directory = new Uint8Array(46 + name.length)
    const directoryView = new DataView(directory.buffer)
    write32(directoryView, 0, 0x02014b50); write16(directoryView, 4, 20); write16(directoryView, 6, 20); write16(directoryView, 8, 0x0800); write16(directoryView, 10, 0)
    write32(directoryView, 16, crc); write32(directoryView, 20, data.length); write32(directoryView, 24, data.length); write16(directoryView, 28, name.length); write32(directoryView, 42, offset)
    directory.set(name, 46); central.push(directory); offset += local.length
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  write32(endView, 0, 0x06054b50); write16(endView, 8, files.length); write16(endView, 10, files.length); write32(endView, 12, centralSize); write32(endView, 16, offset)
  const parts = [...chunks, ...central, end]
  const archive = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let archiveOffset = 0
  for (const part of parts) {
    archive.set(part, archiveOffset)
    archiveOffset += part.length
  }
  return new Blob([archive.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function safeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'equipment-list'
}

function createEquipmentListXlsxBlob(input: ExportListInput) {
  const sheetName = input.language === 'uz' ? 'Uskunalar' : 'Оборудование'
  const { headerRow, totalRow } = getSheetMetrics(input)
  const files = [
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'docProps/app.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ARGO Warehouse</Application></Properties>` },
    { name: 'docProps/core.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(input.name)}</dc:title><dc:creator>ARGO Warehouse</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;${sheetName}&apos;!$A$1:$E$${totalRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">&apos;${sheetName}&apos;!$${headerRow}:$${headerRow}</definedName></definedNames><calcPr fullCalcOnLoad="1" forceFullCalc="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', content: styles },
    { name: 'xl/worksheets/sheet1.xml', content: buildSheet(input) },
  ]
  return zip(files)
}

export function downloadEquipmentListXlsx(input: ExportListInput) {
  const blob = createEquipmentListXlsxBlob(input)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFileName(input.name)}.xlsx`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
