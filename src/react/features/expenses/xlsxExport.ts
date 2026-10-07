import { readStoredLanguage } from '../../lib/i18n'
import { textCell, numberCell, formulaCell, headerFooterText } from '../../lib/xlsx/cells'
import { downloadBlob, exportFileName } from '../../lib/xlsx/download'
import { formatDocumentDate } from '../../lib/xlsx/eventDocument'
import { buildWorkbookPackage } from '../../lib/xlsx/package'

export type ExpensesExportInput = {
  // «Октябрь 2026» на текущем языке — склейку делает вызывающий.
  monthLabel: string
  // В любом порядке: лист сортирует сам.
  rows: { name: string; spentOn: string; amount: number; comment: string | null }[]
  // Итог из базы (RPC expenses_period), а не сумма по строкам.
  total: number
}

type Tr = (ru: string, uz: string) => string

// Сетка листа по образцу сотрудника: заголовок, месяц, шапка, строки, «Итого».
// Графы — A наименование, B дата, C сумма, D комментарий (с52): деньги остались
// в C, поэтому формула итога и область суммы не сдвинулись.
const MONTH_ROW = 2
const HEADER_ROW = 3
const DATA_START_ROW = 4

// Стили — индексы в cellXfs (lib/xlsx/styles.ts). Пары «обычная / чередующаяся».
const NAME_STYLES = [6, 16] as const
const DATE_STYLES = [7, 17] as const
const AMOUNT_STYLES = [21, 22] as const
// Комментарий — тем же стилем, что наименование: перенос по словам, отступ.
const COMMENT_STYLES = NAME_STYLES

// Сколько знаков помещается в строку ячейки при её ширине (A — 46, D — 40):
// оценка для высоты строки, а не точная метрика шрифта.
const NAME_LINE_CHARS = 42
const COMMENT_LINE_CHARS = 36

// Число строк текста в ячейке с переносом: собственные переводы строки плюс
// перенос длинных. Пустой текст — одна строка.
function wrappedLines(text: string, lineChars: number) {
  return text.split('\n').reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / lineChars)), 0)
}
const TOTAL_AMOUNT_STYLE = 23

// Проверки перед сборкой. Сверку с базой делает и вызывающий, но файл с деньгами
// уходит руководству без экрана рядом, поэтому генератор не верит входу сам:
// не сошлось хоть что-то — исключение, и файла нет вовсе.
function assertExportable(input: ExpensesExportInput, tr: Tr) {
  // Пустой месяц не выгружается: лист из шапки и «Итого 0» выглядел бы отчётом
  // «расходов не было», а на деле чаще значит «не тот месяц выбран».
  if (!input.rows.length) throw new Error(tr('За этот месяц расходов нет — выгружать нечего', 'Bu oyda xarajatlar yo‘q — yuklab olinadigan narsa yo‘q'))

  for (const row of input.rows) {
    // Дробь или NaN в <v> дали бы файл, который Excel открывает с другой суммой
    // либо не открывает вовсе; в базе amount — bigint.
    if (!Number.isSafeInteger(row.amount) || !/^\d{4}-\d{2}-\d{2}$/.test(row.spentOn)) {
      throw new Error(tr('В строках расходов повреждены данные — файл не собран', 'Xarajatlar qatorlarida ma’lumot buzilgan — fayl yaratilmadi'))
    }
  }

  const sum = input.rows.reduce((value, row) => value + row.amount, 0)
  if (sum !== input.total) {
    throw new Error(tr('Сумма строк не сошлась с итогом из базы — файл не собран, обновите страницу', 'Qatorlar yig‘indisi bazadagi jami bilan mos kelmadi — fayl yaratilmadi, sahifani yangilang'))
  }
}

function buildSheet(input: ExpensesExportInput, title: string, tr: Tr) {
  // Строки YYYY-MM-DD сравниваются как текст — это и есть календарный порядок.
  // sort устойчив: при равной дате остаётся порядок, в котором строки пришли.
  const sorted = [...input.rows].sort((a, b) => (a.spentOn < b.spentOn ? -1 : a.spentOn > b.spentOn ? 1 : 0))
  const totalRow = DATA_START_ROW + sorted.length
  const rows: string[] = [
    `<row r="1" ht="38" customHeight="1">${textCell('A1', title, 1)}</row>`,
    `<row r="${MONTH_ROW}" ht="27" customHeight="1">${textCell(`A${MONTH_ROW}`, input.monthLabel, 2)}</row>`,
    `<row r="${HEADER_ROW}" ht="30" customHeight="1">${textCell(`A${HEADER_ROW}`, tr('Наименование расхода', 'Xarajat nomi'), 3)}${textCell(`B${HEADER_ROW}`, tr('Дата', 'Sana'), 3)}${textCell(`C${HEADER_ROW}`, tr('Сумма, UZS', 'Summa, UZS'), 3)}${textCell(`D${HEADER_ROW}`, tr('Комментарий', 'Izoh'), 3)}</row>`,
  ]

  sorted.forEach((item, index) => {
    const rowNumber = DATA_START_ROW + index
    const alternating = index % 2 === 1 ? 1 : 0
    const comment = item.comment ?? ''
    // Наименование до 200 знаков и комментарий до 500 переносятся по словам;
    // высота — оценка по более высокой из двух ячеек, как у списка оборудования.
    // Потолок 240 (был 96): комментарий в 500 знаков — это 14 строк, и под
    // прежним потолком его хвост на бумаге пропал бы.
    const lines = Math.max(wrappedLines(item.name, NAME_LINE_CHARS), wrappedLines(comment, COMMENT_LINE_CHARS))
    const rowHeight = Math.min(240, 30 + ((lines - 1) * 15))
    // Дата едет текстом «ДД.ММ.ГГГГ»: так она выглядит одинаково в любой системе
    // и не зависит от формата дат Excel. Сумма — числом, иначе её не сложить.
    // Ячейка комментария пишется и пустой: без неё у строки обрывались бы
    // заливка и нижняя линия.
    rows.push(`<row r="${rowNumber}" ht="${rowHeight}" customHeight="1">${textCell(`A${rowNumber}`, item.name, NAME_STYLES[alternating])}${textCell(`B${rowNumber}`, formatDocumentDate(item.spentOn), DATE_STYLES[alternating])}${numberCell(`C${rowNumber}`, item.amount, AMOUNT_STYLES[alternating])}${textCell(`D${rowNumber}`, comment, COMMENT_STYLES[alternating])}</row>`)
  })

  // «Итого» — живая формула: поправили сумму в Excel — итог пересчитался. Кэш-
  // значение рядом с формулой — итог ИЗ БАЗЫ: его показывают просмотрщики,
  // которые формулы не считают (QuickLook, предпросмотр в мессенджере).
  rows.push(`<row r="${totalRow}" ht="32" customHeight="1">${textCell(`A${totalRow}`, tr('Итого', 'Jami'), 9)}${textCell(`B${totalRow}`, '', 9)}${formulaCell(`C${totalRow}`, `SUM(C${DATA_START_ROW}:C${totalRow - 1})`, input.total, TOTAL_AMOUNT_STYLE)}${textCell(`D${totalRow}`, '', 9)}</row>`)

  const merges = ['A1:D1', `A${MONTH_ROW}:D${MONTH_ROW}`]
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:D${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"/></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols><col min="1" max="1" width="46" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/><col min="4" max="4" width="40" customWidth="1"/></cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((reference) => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.25" footer="0.25"/>
  <pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0" paperSize="9" pageOrder="downThenOver"/>
  <headerFooter><oddHeader>&amp;LARGO MEDIA&amp;R${headerFooterText(`${title} · ${input.monthLabel}`)}</oddHeader><oddFooter>&amp;LARGO MEDIA&amp;C${tr('Страница', 'Sahifa')} &amp;P / &amp;N</oddFooter></headerFooter>
</worksheet>`

  return { sheetXml, totalRow }
}

export async function exportExpensesXlsx(input: ExpensesExportInput): Promise<void> {
  // Язык — тем же чтением, что у корневой границы ошибок: генератор работает вне
  // React, а monthLabel приходит уже на языке интерфейса, и шапка обязана с ним
  // совпасть.
  const language = readStoredLanguage()
  const tr: Tr = (ru, uz) => (language === 'uz' ? uz : ru)

  assertExportable(input, tr)

  const title = tr('Производственные расходы', 'Ishlab chiqarish xarajatlari')
  const { sheetXml, totalRow } = buildSheet(input, title, tr)
  const blob = buildWorkbookPackage({
    sheetName: tr('Расходы', 'Xarajatlar'),
    title: `${title} · ${input.monthLabel}`,
    sheetXml,
    // Четыре графы шире листа A4 в масштабе 100%: по ширине страницы их держит
    // fitToPage/fitToWidth="1" в pageSetup — лист ужимается, а не рвётся на два.
    printArea: `$A$1:$D$${totalRow}`,
    printTitles: `$${HEADER_ROW}:$${HEADER_ROW}`,
  })

  // Дата в имени — день выгрузки: месяц уже стоит в названии.
  downloadBlob(blob, exportFileName({ kind: 'expenses', name: input.monthLabel, date: null, language }))
}
