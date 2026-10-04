import { MAX_FROM_ADDRESS, parseLength } from './delay'

// Состояние калькулятора ITC ⇄ адрес. Чистый модуль без React: разбор и сборка
// адреса проверяются голым node. Линий одна или две: первая живёт в ?l=…,
// вторая — в ?l2=…; старая ссылка с одним l — это просто одна линия.

export type Row = { id: number; draft: string }
export type Line = { id: number; rows: Row[] }

// Первый ключ — «l», как в ссылках до появления второй линии.
export const LINE_PARAMS = ['l', 'l2'] as const
// Нетронутый экран — одна линия с одним излучателем: в одной линии их обычно
// до шести, лишние пустые ряды только мешали бы; остальные добавляют кнопкой.
const DEFAULT_ROWS = 1

// Ключ строки и линии — не индекс: удаление из середины сдвинуло бы индексы, и
// React переиспользовал бы чужие поля ввода вместе с их фокусом.
let rowSeq = 0
export function makeRow(draft: string): Row {
  rowSeq += 1
  return { id: rowSeq, draft }
}

let lineSeq = 0
export function makeLine(rows: Row[]): Line {
  lineSeq += 1
  return { id: lineSeq, rows }
}

function rowsFromParam(value: string | null): Row[] {
  if (value === null) return Array.from({ length: DEFAULT_ROWS }, () => makeRow(''))
  return value.split(',').slice(0, MAX_FROM_ADDRESS).map((token) => makeRow(parseLength(token) === null ? '' : token.trim()))
}

// В адрес уходит число с точкой, а не то, что набрано: запятая в адресе —
// разделитель строк, и «12,5» превратилось бы в два излучателя.
function paramFromRows(rows: Row[]): string {
  return rows.map((row) => {
    const value = parseLength(row.draft)
    return value === null ? '' : String(value)
  }).join(',')
}

// Линии из адреса. Вторая есть, только если в адресе есть l2 (пустой l2= — вторая
// линия с одной пустой строкой).
export function linesFromSearch(l: string | null, l2: string | null): Line[] {
  const lines = [makeLine(rowsFromParam(l))]
  if (l2 !== null) lines.push(makeLine(rowsFromParam(l2)))
  return lines
}

// Строка адреса для линий: 'l=…' | 'l=…&l2=…' | null у нетронутого экрана
// (одна пустая строка адрес не пачкает). Две линии пишутся всегда, даже пустые.
export function searchFromLines(lines: Line[]): string | null {
  const [first, second] = lines
  if (!first) return null
  const a = paramFromRows(first.rows)
  if (!second) return first.rows.length === DEFAULT_ROWS && first.rows.every((row) => !row.draft.trim()) ? null : `l=${a}`
  return `l=${a}&l2=${paramFromRows(second.rows)}`
}

// Тот же формат из СЫРОГО адреса — для отметки writtenRef: сравниваем «что
// записали мы» с «что лежит в адресе», не собирая линии заново.
export function searchKey(l: string | null, l2: string | null): string | null {
  if (l === null && l2 === null) return null
  return `l=${l ?? ''}${l2 === null ? '' : `&l2=${l2}`}`
}

// Убрать излучатель из линии. Длины НЕ складываются (решение прораба с42): кабель
// удалённого излучателя исчезает вместе с ним, у остальных строк черновики и id
// те же. Последний излучатель линии не убирается — линии возвращаются как есть.
export function removeRow(lines: Line[], lineIndex: number, rowIndex: number): Line[] {
  const line = lines[lineIndex]
  if (!line || line.rows.length < 2 || !line.rows[rowIndex]) return lines
  return lines.map((item, index) => (index === lineIndex ? { ...item, rows: item.rows.filter((_, at) => at !== rowIndex) } : item))
}

// Длины линии, м; пустое и нераспознанное — нулём.
export function lineLengths(line: Line): number[] {
  return line.rows.map((row) => parseLength(row.draft) ?? 0)
}
