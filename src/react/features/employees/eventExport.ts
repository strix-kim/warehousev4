// Документ «Список персонала на мероприятие»: качает фото из приватного бакета,
// собирает лист и отдаёт готовый xlsx. Дизайн — тот же язык, что у списка
// оборудования (features/lists/xlsxExport.ts): красная плашка, реквизиты, шапка
// таблицы, чередование строк, итог.
//
// Всё считается в браузере и никуда не пишется: файл — снимок выбранного состава
// на момент нажатия, а не запись в базе.

import { compressPhoto } from '../../lib/compressPhoto'
import { reportAppError } from '../../lib/reportAppError'
import { supabase } from '../../lib/supabase'
import { numberCell, textCell, xml } from '../../lib/xlsx/cells'
import { companyDetails } from '../../lib/xlsx/documentDefaults'
import { downloadBlob, safeFileName } from '../../lib/xlsx/download'
import { docText, eventDocumentTitle, formatDocumentDate, type EventDocumentMeta } from '../../lib/xlsx/eventDocument'
import { columnWidthToPx, drawingXml, EMU_PER_PX, fitImage, oneCellAnchor, rowHeightToEmu } from '../../lib/xlsx/images'
import { buildWorkbookPackage } from '../../lib/xlsx/package'
import { BUCKET } from './api'
import { employeeFullName, type Employee } from './types'

// Кадр, уже пережатый под документ: байты JPEG и размеры этих самых байтов.
export type EventPhoto = { bytes: Uint8Array; width: number; height: number }

export type EventPhotoRequest = { employeeId: string; storage_path: string }

// Три файла разом: последовательная загрузка растягивает 30 портретов на минуту,
// а десяток параллельных упирается в лимит соединений браузера и в память под
// декодированные кадры.
const DOWNLOAD_CONCURRENCY = 3

// Портрет для опознания, а не для печати плаката: 320 px по длинной стороне даёт
// запас над рамкой 120×160 px даже на ретине.
const PHOTO_MAX_SIDE = 320
const PHOTO_QUALITY = 0.8

/**
 * Тянет фото выбранных сотрудников байтами (подписанная ссылка здесь не нужна —
 * файл уезжает внутрь документа, а не в вёрстку).
 *
 * Упавший или неподдерживаемый файл (HEIC на десктопе) в результат НЕ кладётся и
 * считается отдельно: одно битое фото не повод не выдать человеку документ, но и
 * молчать о нём нельзя — вызывающий показывает число и ставит в ячейке прочерк.
 */
export async function loadEventPhotos(
  refs: EventPhotoRequest[],
  options: { onProgress: (done: number, total: number) => void; signal: AbortSignal },
): Promise<{ photos: Map<string, EventPhoto>; failed: number }> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const photos = new Map<string, EventPhoto>()
  let failed = 0
  let done = 0
  let next = 0

  // Storage-клиент отмену не принимает, поэтому abort работает единственным
  // честным способом: уже начатая загрузка доигрывает, новые не стартуют.
  async function worker() {
    while (!options.signal.aborted) {
      const index = next
      next += 1
      const ref = refs[index]
      if (!ref) return

      try {
        const { data, error } = await client.storage.from(BUCKET).download(ref.storage_path)
        if (error) throw error
        const file = new File([data], ref.storage_path.split('/').pop() || 'photo.jpg', { type: data.type })
        const compressed = await compressPhoto(file, { maxSide: PHOTO_MAX_SIDE, quality: PHOTO_QUALITY })
        if (compressed.status === 'ok') {
          photos.set(ref.employeeId, {
            bytes: new Uint8Array(await compressed.file.arrayBuffer()),
            width: compressed.width,
            height: compressed.height,
          })
        } else {
          failed += 1
        }
      } catch (error) {
        failed += 1
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'event-photo' } })
      }

      done += 1
      options.onProgress(done, refs.length)
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, () => worker()))
  return { photos, failed }
}

// Колонки листа в «символах» Excel. Ширина G участвует в расчёте якоря картинки,
// поэтому она здесь константой, а не числом в строке cols.
const PHOTO_COLUMN_WIDTH = 20
// Индекс колонки G в нумерации DrawingML (A = 0).
const PHOTO_COLUMN_INDEX = 6
const COLUMN_WIDTHS = [5, 30, 13, 22, 16, 17, PHOTO_COLUMN_WIDTH, 22]

// Ровная сетка под фото: высота одна на все строки данных, иначе якорь каждой
// картинки пришлось бы считать по накопленной высоте предыдущих.
const DATA_ROW_HEIGHT_PT = 128
// Рамка под портрет внутри ячейки — с полями до её границ.
const PHOTO_BOX = { widthPx: 120, heightPx: 160 }

const HEADER_ROW = 6
const DATA_START_ROW = 7

function sheetTexts(language: 'ru' | 'uz') {
  return {
    plaque: docText(language, 'СПИСОК ПЕРСОНАЛА НА МЕРОПРИЯТИЕ', 'ТАДБИРГА ЖАЛБ ЭТИЛГАН ХОДИМЛАР РЎЙХАТИ'),
    number: docText(language, '№', 'Т/р'),
    fullName: docText(language, 'Ф.И.О.', 'Ф.И.Ш.'),
    birthDate: docText(language, 'Дата рождения', 'Туғилган сана'),
    birthPlace: docText(language, 'Место рождения', 'Туғилган жойи'),
    passport: docText(language, 'Серия и номер паспорта', 'Паспорт серияси ва рақами'),
    pinfl: docText(language, 'ПИНФЛ', 'ЖШШИР рақами'),
    photo: docText(language, 'Фото', 'Фотосурати'),
    position: docText(language, 'Должность', 'Лавозими'),
    total: docText(language, 'Всего', 'Жами'),
    page: docText(language, 'Страница', 'Саҳифа'),
  }
}

// Пустое поле в документе — прочерк, а не пустая ячейка: пустая читается как
// «забыли напечатать», прочерк — как «данных нет».
const DASH = '—'

function passportText(employee: Employee) {
  return [employee.passport_series, employee.passport_number].filter(Boolean).join(' ') || DASH
}

export type EmployeeEventSheet = {
  sheetXml: string
  drawing?: { xml: string; images: Uint8Array[] }
  printArea: string
  printTitles: string
}

export function buildEmployeeEventSheet(rows: Employee[], meta: EventDocumentMeta, photos: Map<string, EventPhoto>): EmployeeEventSheet {
  const t = sheetTexts(meta.language)
  const title = eventDocumentTitle('staff', meta)
  const totalRow = DATA_START_ROW + rows.length
  const cells: string[] = []
  const merges: string[] = ['B1:H1', 'A3:H3', 'A4:H4']
  const anchors: string[] = []
  const images: Uint8Array[] = []

  // Размеры ячейки G в EMU — по ним картинка центрируется офсетами якоря.
  const cellWidthEmu = columnWidthToPx(PHOTO_COLUMN_WIDTH) * EMU_PER_PX
  const cellHeightEmu = rowHeightToEmu(DATA_ROW_HEIGHT_PT)

  cells.push(
    // Плашка как у оборудования: красный квадрат с «A» в первой колонке и тёмная
    // полоса на всю остальную ширину.
    `<row r="1" ht="46" customHeight="1">${textCell('A1', 'A', 12)}${textCell('B1', `ARGO MEDIA · ${t.plaque}`, 13)}</row>`,
    '<row r="2" ht="9" customHeight="1"/>',
    `<row r="3" ht="58" customHeight="1">${textCell('A3', title, 20)}</row>`,
    `<row r="4" ht="32" customHeight="1">${textCell('A4', companyDetails, 19)}</row>`,
    '<row r="5" ht="9" customHeight="1"/>',
    `<row r="${HEADER_ROW}" ht="30" customHeight="1">${[t.number, t.fullName, t.birthDate, t.birthPlace, t.passport, t.pinfl, t.photo, t.position]
      .map((label, index) => textCell(`${columnLetter(index)}${HEADER_ROW}`, label, 3))
      .join('')}</row>`,
  )

  rows.forEach((employee, index) => {
    const rowNumber = DATA_START_ROW + index
    const alternating = index % 2 === 1
    const text = alternating ? 16 : 6
    const center = alternating ? 17 : 7
    const centerWrap = alternating ? 18 : 8
    const photo = photos.get(employee.id)

    cells.push(`<row r="${rowNumber}" ht="${DATA_ROW_HEIGHT_PT}" customHeight="1">`
      + numberCell(`A${rowNumber}`, index + 1, center)
      + textCell(`B${rowNumber}`, employeeFullName(employee), text)
      + textCell(`C${rowNumber}`, employee.birth_date ? formatDocumentDate(employee.birth_date) : DASH, center)
      + textCell(`D${rowNumber}`, employee.birth_place || DASH, centerWrap)
      + textCell(`E${rowNumber}`, passportText(employee), centerWrap)
      + textCell(`F${rowNumber}`, employee.pinfl || DASH, center)
      // Ячейка под фото остаётся текстовой и при наличии снимка: она даёт рамку и
      // заливку, а сама картинка лежит слоем поверх листа, а не «в» ячейке.
      + textCell(`G${rowNumber}`, photo ? '' : DASH, center)
      + textCell(`H${rowNumber}`, employee.position || DASH, text)
      + '</row>')

    if (!photo) return
    // Потолок масштаба 1 задаётся боксом: снимок мельче рамки становится боксом
    // сам себе, и fitImage его не растягивает — апскейл дал бы мыло на бумаге.
    const { cx, cy } = fitImage(photo, {
      widthPx: Math.min(PHOTO_BOX.widthPx, photo.width),
      heightPx: Math.min(PHOTO_BOX.heightPx, photo.height),
    })
    images.push(photo.bytes)
    anchors.push(oneCellAnchor({
      // id фигуры начинается с 2: единицу занимает сам лист.
      id: images.length + 1,
      name: `photo-${images.length}`,
      descr: employeeFullName(employee),
      col: PHOTO_COLUMN_INDEX,
      row: rowNumber - 1,
      colOffEmu: Math.max(0, Math.round((cellWidthEmu - cx) / 2)),
      rowOffEmu: Math.max(0, Math.round((cellHeightEmu - cy) / 2)),
      cx,
      cy,
      rId: images.length,
    }))
  })

  cells.push(`<row r="${totalRow}" ht="32" customHeight="1">`
    + textCell(`A${totalRow}`, '', 9)
    + textCell(`B${totalRow}`, `${t.total}: ${rows.length}`, 9)
    + ['C', 'D', 'E', 'F', 'G', 'H'].map((letter) => textCell(`${letter}${totalRow}`, '', 9)).join('')
    + '</row>')

  const period = formatDocumentDate(meta.dateFrom)
  // xmlns:r объявлен всегда, а сам <drawing> появляется только с картинками:
  // по схеме CT_Worksheet он идёт ПОСЛЕ headerFooter, иначе Excel зовёт файл
  // повреждённым и предлагает «восстановить».
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:H${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${COLUMN_WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>
  <sheetData>${cells.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((reference) => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.25" footer="0.25"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9" pageOrder="downThenOver"/>
  <headerFooter differentOddEven="1"><oddHeader>&amp;LARGO MEDIA&amp;R${xml(meta.name)}</oddHeader><evenHeader>&amp;LARGO MEDIA&amp;R${xml(meta.name)}</evenHeader><oddFooter>&amp;LARGO MEDIA&amp;C${t.page} &amp;P / &amp;N&amp;R${period}</oddFooter><evenFooter>&amp;LARGO MEDIA&amp;C${t.page} &amp;P / &amp;N&amp;R${period}</evenFooter></headerFooter>
  ${anchors.length ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`

  return {
    sheetXml,
    drawing: anchors.length ? { xml: drawingXml(anchors), images } : undefined,
    printArea: `$A$1:$H$${totalRow}`,
    printTitles: `$${HEADER_ROW}:$${HEADER_ROW}`,
  }
}

// Буква колонки по индексу: лист не шире H, поэтому одной буквы хватает.
function columnLetter(index: number) {
  return String.fromCharCode(65 + index)
}

// Порядок в документе — по фамилии и имени, а не тот, в котором галки ставили:
// принимающая сторона ищет человека глазами. localeCompare, а не сравнение строк:
// «Ё» и «Е» иначе разъезжаются на разные концы списка.
function byName(a: Employee, b: Employee) {
  return a.last_name.localeCompare(b.last_name, 'ru') || a.first_name.localeCompare(b.first_name, 'ru')
}

export function downloadEmployeeEventXlsx({ employees, meta, photos }: {
  employees: Employee[]
  meta: EventDocumentMeta
  photos: Map<string, EventPhoto>
}) {
  const sorted = [...employees].sort(byName)
  const sheet = buildEmployeeEventSheet(sorted, meta, photos)
  const blob = buildWorkbookPackage({
    sheetName: docText(meta.language, 'Сотрудники', 'Ходимлар'),
    title: eventDocumentTitle('staff', meta),
    sheetXml: sheet.sheetXml,
    printArea: sheet.printArea,
    printTitles: sheet.printTitles,
    drawing: sheet.drawing,
  })
  const suffix = docText(meta.language, 'сотрудники', 'ходимлар')
  downloadBlob(blob, `${meta.dateFrom}_${safeFileName(meta.name, 'event')}_${suffix}.xlsx`)
}
