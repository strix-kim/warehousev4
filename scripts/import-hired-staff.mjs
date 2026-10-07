// Разовый импорт наёмных сотрудников из docx-образца в прод (решение прораба 7, с53).
//
//   node scripts/import-hired-staff.mjs --parse-only        разбор файла без сети, только счётчики
//   IMPORT_EMAIL=… IMPORT_PASSWORD=… node scripts/import-hired-staff.mjs            сухой прогон
//   IMPORT_EMAIL=… IMPORT_PASSWORD=… node scripts/import-hired-staff.mjs --apply    запись
//
// Путь к docx — необязательным аргументом; по умолчанию единственный .docx в docs/reference/.
//
// Пишем НЕ service_role, а живым REST прода с настоящим JWT (gotchas §2): политики,
// триггер нормализации и UNIQUE те же, что видит форма приложения. Строка сотрудника
// собирается так же, как employeeRow в src/react/features/employees/api.ts, фото —
// как uploadEmployeeFile: объект в бакет, строка employee_files, document_photo_id.
//
// Персональные данные: файл читается в память (unzip -p), на диск не пишется ничего,
// наружу уходит только прод-база и терминал.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const BUCKET = 'employee-files'
// Типы из белого списка бакета (миграция employee_files_bucket); остальное бакет отобьёт.
const PHOTO_CONTENT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
// Порядок граф образца: Т/р, Ф.И.Ш, Туғилган вақти, Тўғилган жойи, Паспорт серияси,
// ЖШШИР рақами, Фотосурати, Лавозими. Сверяем шапку по ключевым словам, чтобы чужой
// файл с другой раскладкой не уехал в базу молча.
const HEADER_MARKS = [null, 'Ф.И.Ш', 'Туғилган', 'жойи', 'Паспорт', 'ЖШШИР', 'Фото', 'Лавозим']

// ───────────────────────── аргументы ─────────────────────────

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const positional = args.filter((arg) => !arg.startsWith('--'))
for (const flag of flags) {
  if (flag !== '--apply' && flag !== '--parse-only') fail(`Неизвестный флаг ${flag}. Есть --parse-only и --apply.`)
}
if (flags.has('--apply') && flags.has('--parse-only')) fail('--apply и --parse-only вместе не имеют смысла.')
if (positional.length > 1) fail('Путь к docx — один аргумент.')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function resolveDocxPath() {
  if (positional[0]) return resolve(positional[0])
  const directory = join(root, 'docs/reference')
  const found = readdirSync(directory).filter((name) => name.toLowerCase().endsWith('.docx') && !name.startsWith('~$'))
  if (found.length !== 1) {
    fail(`В docs/reference/ ожидался ровно один .docx, найдено ${found.length}. Передайте путь аргументом.`)
  }
  return join(directory, found[0])
}

// ───────────────────────── docx ─────────────────────────

// docx — это zip; системный unzip отдаёт запись в stdout, временных файлов нет.
function readZipEntry(docxPath, entry) {
  return execFileSync('unzip', ['-p', docxPath, entry], { maxBuffer: 256 * 1024 * 1024 })
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

// Текст ячейки: абзацы и разрывы строк — переводом строки (серия и номер паспорта
// стоят в ячейке двумя абзацами, а в одной строке — через <w:br/>).
function cellText(cellXml) {
  const parts = cellXml.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:br\/>|<w:tab\/>|<\/w:p>/g) ?? []
  return decodeXml(parts.map((part) => (part.startsWith('<w:t>') || part.startsWith('<w:t ') ? part.replace(/<[^>]+>/g, '') : '\n')).join(''))
}

function oneLine(text) {
  return text.replace(/\s+/g, ' ').trim()
}

// ДД.ММ.ГГГГ → ГГГГ-ММ-ДД (формат date-колонки и <input type="date"> формы).
function parseBirthDate(text) {
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text)
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  if (date.getTime() > Date.now()) return null
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseDocx(docxPath) {
  const documentXml = readZipEntry(docxPath, 'word/document.xml').toString('utf8')
  const relsXml = readZipEntry(docxPath, 'word/_rels/document.xml.rels').toString('utf8')

  // rId → путь картинки внутри архива. Порядок атрибутов в Relationship не гарантирован.
  const mediaByRid = new Map()
  for (const relationship of relsXml.match(/<Relationship [^>]*>/g) ?? []) {
    const id = /\bId="([^"]+)"/.exec(relationship)?.[1]
    const target = /\bTarget="([^"]+)"/.exec(relationship)?.[1]
    if (id && target && /\/image"/.test(relationship)) mediaByRid.set(id, `word/${target.replace(/^\/?(word\/)?/, '')}`)
  }

  const tableCount = (documentXml.match(/<w:tbl>/g) ?? []).length
  if (tableCount !== 1) fail(`В документе ожидалась одна таблица, найдено ${tableCount}.`)

  const tableRows = documentXml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []
  const [headerXml, ...bodyRows] = tableRows
  const headerCells = (headerXml?.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map((cell) => oneLine(cellText(cell)))
  const headerOk = headerCells.length === HEADER_MARKS.length
    && HEADER_MARKS.every((mark, index) => mark === null || headerCells[index].replace(/\s/g, '').includes(mark))
  if (!headerOk) fail('Шапка таблицы не совпала с образцом (8 граф: Т/р, Ф.И.Ш, …, Лавозими). Импорт остановлен.')

  const rows = []
  const seenPinfl = new Map()
  const seenPassport = new Map()

  bodyRows.forEach((rowXml, index) => {
    // Графа Т/р в образце — автонумерация Word, текста в ней нет: номер = порядок строки.
    const number = index + 1
    const cells = rowXml.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []
    const row = { number, problems: [], warnings: [], fullName: '', photo: null }
    rows.push(row)
    if (cells.length !== HEADER_MARKS.length) {
      row.problems.push(`в строке ${cells.length} граф вместо ${HEADER_MARKS.length}`)
      return
    }
    const [, nameCell, birthDateCell, birthPlaceCell, passportCell, pinflCell, photoCell, positionCell] = cells

    // ФИО: первое слово — фамилия, второе — имя, всё остальное — отчество
    // («Каримович» и «Карим ўғли» одинаково уезжают в middle_name целиком).
    row.fullName = oneLine(cellText(nameCell))
    const nameParts = row.fullName ? row.fullName.split(' ') : []
    if (nameParts.length < 2) row.problems.push('ФИО: нужны хотя бы фамилия и имя')
    row.last_name = nameParts[0] ?? ''
    row.first_name = nameParts[1] ?? ''
    row.middle_name = nameParts.slice(2).join(' ') || null

    const birthDateText = oneLine(cellText(birthDateCell))
    row.birth_date = birthDateText ? parseBirthDate(birthDateText) : null
    if (birthDateText && !row.birth_date) row.problems.push('дата рождения не в виде ДД.ММ.ГГГГ')

    row.birth_place = oneLine(cellText(birthPlaceCell)) || null
    row.position = oneLine(cellText(positionCell)) || null

    // Паспорт: две буквы серии и семь цифр номера, пробелы и переносы между ними любые.
    // Серия — только латиница: кириллическая «А» разошлась бы с латинской в UNIQUE.
    const passportText = cellText(passportCell).replace(/\s+/g, '').toUpperCase()
    row.passport_series = null
    row.passport_number = null
    if (passportText) {
      const match = /^([A-Z]{2})(\d{7})$/.exec(passportText)
      if (match) [, row.passport_series, row.passport_number] = match
      else row.problems.push('паспорт не в виде «две латинские буквы + 7 цифр»')
    }

    const pinflText = cellText(pinflCell).replace(/\s+/g, '')
    row.pinfl = null
    if (pinflText) {
      if (/^\d{14}$/.test(pinflText)) row.pinfl = pinflText
      else row.problems.push('ПИНФЛ не из 14 цифр')
    }

    // Без ПИНФЛ и паспорта строку не с чем сверить: повторный запуск завёл бы дубль.
    if (!row.pinfl && !row.passport_number && row.problems.length === 0) {
      row.problems.push('нет ни ПИНФЛ, ни паспорта — сверить с базой нечем')
    }

    // Цифры 2–7 ПИНФЛ — дата рождения ДДММГГ (так сверяли импорт с17). Расхождение —
    // предупреждение, а не отказ: решает прораб, глядя на сухой прогон.
    if (row.pinfl && row.birth_date) {
      const [year, month, day] = row.birth_date.split('-')
      if (row.pinfl.slice(1, 7) !== `${day}${month}${year.slice(2)}`) row.warnings.push('дата рождения не сходится с ПИНФЛ')
    }

    // Дубль внутри самого файла: вторую строку не заводим.
    const passportKey = row.passport_number ? `${row.passport_series}${row.passport_number}` : null
    const twin = (row.pinfl && seenPinfl.get(row.pinfl)) || (passportKey && seenPassport.get(passportKey))
    if (twin) row.problems.push(`повтор строки ${twin} по ПИНФЛ или паспорту`)
    if (row.pinfl && !seenPinfl.has(row.pinfl)) seenPinfl.set(row.pinfl, number)
    if (passportKey && !seenPassport.has(passportKey)) seenPassport.set(passportKey, number)

    // Фото — встроенная картинка ячейки: r:embed → rels → word/media/…
    const rid = /r:embed="([^"]+)"/.exec(photoCell)?.[1]
    const entry = rid ? mediaByRid.get(rid) : null
    if (entry) {
      const extension = extname(entry).slice(1).toLowerCase()
      row.photo = { entry, extension, contentType: PHOTO_CONTENT_TYPES[extension] ?? null }
      if (!row.photo.contentType) row.warnings.push(`фото в формате .${extension} — бакет его не примет, заведётся без фото`)
    }
  })

  return rows
}

// ───────────────────────── сеть ─────────────────────────

function parseEnv(source) {
  return Object.fromEntries(source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]
    }))
}

function loadConfig() {
  let env = {}
  try {
    env = parseEnv(readFileSync(join(root, '.env'), 'utf8'))
  } catch {
    // .env нет — остаются переменные окружения.
  }
  const url = (process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? ''
  const email = process.env.IMPORT_EMAIL ?? ''
  const password = process.env.IMPORT_PASSWORD ?? ''
  if (!url || !key) fail('Нет VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ищу в .env проекта).')
  if (!email || !password) fail('Нужны переменные окружения IMPORT_EMAIL и IMPORT_PASSWORD.')
  return { url, key, email, password }
}

// Ошибка с кодом базы: по коду 23505 отличаем «уже есть» от настоящего отказа.
class ApiError extends Error {
  constructor(status, payload) {
    const text = typeof payload === 'object' && payload !== null
      ? [payload.code, payload.message ?? payload.msg ?? payload.error_description ?? payload.error, payload.details].filter(Boolean).join(' · ')
      : String(payload)
    super(`HTTP ${status}${text ? ` · ${text}` : ''}`)
    this.status = status
    this.code = typeof payload === 'object' && payload !== null ? payload.code : undefined
  }
}

function createClient({ url, key }) {
  let token = null

  async function request(method, path, { body, headers = {}, raw = false } = {}) {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        apikey: key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    })
    const text = await response.text()
    let payload = text
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      // Не JSON — отдаём текстом.
    }
    if (!response.ok) throw new ApiError(response.status, payload)
    return payload
  }

  return {
    async signIn(email, password) {
      const session = await request('POST', '/auth/v1/token?grant_type=password', { body: { email, password } })
      token = session.access_token
    },
    select: (path) => request('GET', `/rest/v1/${path}`),
    // Те же заголовки, что шлёт supabase-js на .insert().select().single().
    insert: (table, row) => request('POST', `/rest/v1/${table}`, {
      body: row,
      headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' },
    }),
    update: (table, filter, patch) => request('PATCH', `/rest/v1/${table}?${filter}`, {
      body: patch,
      headers: { Prefer: 'return=representation' },
    }),
    upload: (path, bytes, contentType) => request('POST', `/storage/v1/object/${BUCKET}/${path}`, {
      body: bytes,
      raw: true,
      headers: { 'Content-Type': contentType, 'cache-control': 'max-age=3600', 'x-upsert': 'false' },
    }),
  }
}

// Зеркало employeeRow из features/employees/api.ts: тот же набор ключей, пустое — null.
// Нормализацию (trim, верхний регистр серии, цифры номера) доделает триггер базы.
function employeeRow(row) {
  return {
    last_name: row.last_name,
    first_name: row.first_name,
    middle_name: row.middle_name,
    position: row.position,
    department: 'hired',
    phone: null,
    passport_series: row.passport_series,
    passport_number: row.passport_number,
    pinfl: row.pinfl,
    birth_date: row.birth_date,
    birth_place: row.birth_place,
    passport_issued_by: null,
    passport_issued_at: null,
    passport_expires_at: null,
    residence_address: null,
    clearance_expires_at: null,
    t_shirt_size: null,
  }
}

// Зеркало uploadEmployeeFile + setEmployeeDocumentPhoto: объект, строка, выбор фото.
async function uploadPhoto(client, docxPath, employeeId, photo) {
  const bytes = readZipEntry(docxPath, photo.entry)
  const path = `${employeeId}/photo/${randomUUID()}.${photo.extension}`
  await client.upload(path, bytes, photo.contentType)
  const file = await client.insert('employee_files', {
    employee_id: employeeId,
    kind: 'photo',
    storage_path: path,
    original_name: basename(photo.entry),
  })
  const updated = await client.update('employees', `id=eq.${employeeId}`, { document_photo_id: file.id })
  // 200 и пустая выборка — это отказ политики, а не успех (gotchas §2).
  if (!Array.isArray(updated) || updated.length !== 1) throw new Error('фото загружено, но document_photo_id не записался (0 строк)')
}

// ───────────────────────── вывод ─────────────────────────

function printTable(title, columns, lines) {
  console.log(`\n${title}: ${lines.length}`)
  if (lines.length === 0) return
  const widths = columns.map((column, index) => Math.max(column.length, ...lines.map((line) => String(line[index]).length)))
  const format = (line) => line.map((value, index) => String(value).padEnd(widths[index])).join('  ').trimEnd()
  console.log(format(columns))
  console.log(widths.map((width) => '─'.repeat(width)).join('  '))
  for (const line of lines) console.log(format(line))
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error)
}

// ───────────────────────── прогон ─────────────────────────

const docxPath = resolveDocxPath()
const rows = parseDocx(docxPath)
const broken = rows.filter((row) => row.problems.length > 0)
const parsed = rows.filter((row) => row.problems.length === 0)

if (flags.has('--parse-only')) {
  // Только счётчики: этот режим гоняют без прораба, имён в выводе быть не должно.
  console.log(`строк:          ${rows.length}`)
  console.log(`с фото:         ${rows.filter((row) => row.photo).length}`)
  console.log(`с ПИНФЛ:        ${rows.filter((row) => row.pinfl).length}`)
  console.log(`с паспортом:    ${rows.filter((row) => row.passport_number).length}`)
  console.log(`с датой рожд.:  ${rows.filter((row) => row.birth_date).length}`)
  console.log(`с должностью:   ${rows.filter((row) => row.position).length}`)
  console.log(`предупреждений: ${rows.filter((row) => row.warnings.length > 0).length}`)
  console.log(`неразобранных:  ${broken.length}`)
  for (const row of broken) console.log(`  строка ${row.number}: ${row.problems.join('; ')}`)
  process.exit(0)
}

const apply = flags.has('--apply')
const config = loadConfig()
const client = createClient(config)

try {
  await client.signIn(config.email, config.password)
} catch (error) {
  fail(`Вход не удался: ${describeError(error)}`)
}

// Текущие сотрудники целиком: их десятки, предел Data API в 1000 строк далеко.
const existing = await client.select('employees?select=id,pinfl,passport_series,passport_number,department&limit=1000')
const photoRows = await client.select('employee_files?select=employee_id&kind=eq.photo&limit=1000')
const withPhoto = new Set(photoRows.map((file) => file.employee_id))
const byPinfl = new Map(existing.filter((employee) => employee.pinfl).map((employee) => [employee.pinfl, employee]))
const byPassport = new Map(existing
  .filter((employee) => employee.passport_series && employee.passport_number)
  .map((employee) => [`${employee.passport_series}${employee.passport_number}`, employee]))

// Сверка: ПИНФЛ, запасная — серия+номер паспорта.
function findExisting(row) {
  return (row.pinfl && byPinfl.get(row.pinfl))
    || (row.passport_number && byPassport.get(`${row.passport_series}${row.passport_number}`))
    || null
}

const toCreate = []
const skipped = []
// Наёмный заведён прошлым запуском, а фото тогда не доехало: догружаем только фото.
// Штатных это не касается никогда — их карточки скрипт не трогает.
const toRepairPhoto = []
for (const row of parsed) {
  const match = findExisting(row)
  if (!match) toCreate.push(row)
  else {
    skipped.push({ row, match })
    if (match.department === 'hired' && row.photo?.contentType && !withPhoto.has(match.id)) toRepairPhoto.push({ row, match })
  }
}

console.log(`Файл: ${basename(docxPath)}`)
console.log(`Режим: ${apply ? 'ЗАПИСЬ (--apply)' : 'сухой прогон — в базу и бакет не пишется ничего'}`)
console.log(`В базе сейчас: ${existing.length} (штат ${existing.filter((employee) => employee.department === 'staff').length}, наёмные ${existing.filter((employee) => employee.department === 'hired').length})`)

printTable(
  apply ? 'Заводим наёмными' : 'Будут заведены наёмными',
  ['№', 'ФИО', 'Дата рождения', 'Должность', 'Фото', 'Замечания'],
  toCreate.map((row) => [row.number, row.fullName, row.birth_date ?? '—', row.position ?? '—', row.photo?.contentType ? 'да' : 'НЕТ', row.warnings.join('; ')]),
)
printTable(
  'Пропущены — уже есть в базе',
  ['№', 'ФИО', 'Отдел в базе', 'Примечание'],
  skipped.map(({ row, match }) => [row.number, row.fullName, match.department === 'hired' ? 'наёмные' : 'штат',
    toRepairPhoto.some((item) => item.row === row) ? 'фото не доехало — догрузим' : '']),
)
printTable(
  'Не разобраны — в базу не пойдут',
  ['№', 'ФИО', 'Причина'],
  broken.map((row) => [row.number, row.fullName || '—', row.problems.join('; ')]),
)

if (!apply) {
  console.log(`\nИтог сухого прогона: строк в файле ${rows.length} · будет заведено ${toCreate.length} · пропущено ${skipped.length} · не разобрано ${broken.length} · догрузить фото ${toRepairPhoto.length}`)
  console.log('Запись — тем же вызовом с флагом --apply.')
  process.exit(0)
}

let created = 0
let photosUploaded = 0
let skippedCount = skipped.length
const errors = broken.map((row) => ({ number: row.number, text: `не разобрана: ${row.problems.join('; ')}` }))

console.log('')
for (const row of toCreate) {
  let employee
  try {
    employee = await client.insert('employees', employeeRow(row))
  } catch (error) {
    // UNIQUE по ПИНФЛ/паспорту — страховка сверки: кто-то завёл человека между
    // чтением и вставкой. Это «уже есть», а не падение.
    if (error instanceof ApiError && error.code === '23505') {
      skippedCount += 1
      console.log(`строка ${row.number}: уже есть в базе (отказ UNIQUE) — пропущена`)
    } else {
      errors.push({ number: row.number, text: `сотрудник не заведён: ${describeError(error)}` })
      console.log(`строка ${row.number}: ОШИБКА`)
    }
    continue
  }
  created += 1
  if (!row.photo?.contentType) {
    console.log(`строка ${row.number}: заведён, без фото`)
    continue
  }
  try {
    await uploadPhoto(client, docxPath, employee.id, row.photo)
    photosUploaded += 1
    console.log(`строка ${row.number}: заведён, фото загружено`)
  } catch (error) {
    errors.push({ number: row.number, text: `сотрудник заведён, фото НЕ загружено (повторный запуск догрузит): ${describeError(error)}` })
    console.log(`строка ${row.number}: заведён, ОШИБКА фото`)
  }
}

for (const { row, match } of toRepairPhoto) {
  try {
    await uploadPhoto(client, docxPath, match.id, row.photo)
    photosUploaded += 1
    console.log(`строка ${row.number}: фото догружено`)
  } catch (error) {
    errors.push({ number: row.number, text: `фото не догружено: ${describeError(error)}` })
    console.log(`строка ${row.number}: ОШИБКА фото`)
  }
}

console.log(`\nИтог: заведено ${created} · фото загружено ${photosUploaded} · пропущено ${skippedCount} · ошибок ${errors.length}`)
if (errors.length > 0) {
  console.log('Ошибки по строкам:')
  for (const error of errors) console.log(`  строка ${error.number}: ${error.text}`)
  process.exit(1)
}
