import { Check, Copy, GitFork, Play, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { copyText } from '../../lib/clipboard'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { useChainLayout } from './chainLayout'
import { computeDelays, MAX_LINES, MAX_PER_LINE } from './delay'
import { CountUp, DelayChain } from './DelayChain'
import { DelayGuide } from './DelayGuide'
import { LINE_PARAMS, lineLengths, linesFromSearch, makeLine, makeRow, removeRow, searchFromLines, searchKey, type Line } from './lengthsParam'
import { useSignalAnimation } from './useSignalAnimation'

// Калькулятор задержки излучателей ITC. Базы здесь нет вовсе: всё состояние —
// длины кабелей, и живут они в адресе (?l=15,50,15,70,15 и, если линий две,
// &l2=…). Так расчёт переживает F5, а ссылку можно скинуть в чат — у получателя
// откроется та же схема. Разбор и сборка адреса — lengthsParam.ts.

// Сколько плашка «Вернуть» ждёт нажатия.
const UNDO_MS = 8000

// Строка поиска целиком: чужие параметры адреса как были, линии — в конце. Одна
// сборка на запись в адрес и на ссылку «в чат» — разойтись им нельзя.
function searchWithLines(params: URLSearchParams, linesSearch: string | null) {
  const rest = new URLSearchParams(params)
  LINE_PARAMS.forEach((key) => rest.delete(key))
  const search = [rest.toString(), linesSearch ?? ''].filter(Boolean).join('&')
  return search ? `?${search}` : ''
}

export function DelayCalculatorPage() {
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Задержка излучателей', 'Nurlatgichlar kechikishi'))
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const urlFirst = params.get(LINE_PARAMS[0])
  const urlSecond = params.get(LINE_PARAMS[1])
  const [lines, setLines] = useState(() => linesFromSearch(urlFirst, urlSecond))
  // Что МЫ последним записали в адрес (обе линии одной строкой). Без этой отметки
  // своя запись, вернувшись из роутера, перетёрла бы поле: «12,» превратилось бы в
  // «12» посреди набора (gotchas §7). Догоняем адрес только при расхождении — это
  // чужая запись: «назад», ссылка, открытая поверх страницы.
  const writtenRef = useRef<string | null>(searchKey(urlFirst, urlSecond))
  // Только что добавленный излучатель получает фокус: следующее действие
  // человека — вписать длину его кабеля.
  const [focusId, setFocusId] = useState<number | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyTimer = useRef<number | undefined>(undefined)
  const chainRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Снимок линий ДО удаления, сброса или снятия линии — его кладёт обратно
  // «Вернуть». Живёт до любой другой правки, но не дольше UNDO_MS. focusRowId —
  // излучатель, к крестику которого вернётся фокус (кнопка «Вернуть» исчезает
  // вместе с плашкой).
  const [undo, setUndo] = useState<{ lines: Line[]; message: string; focusRowId: number | null } | null>(null)
  // Текст плашки отдельно от снимка: пока она уходит (180 мс), снимка уже нет,
  // а пустая плашка схлопнулась бы на глазах.
  const [undoMessage, setUndoMessage] = useState('')
  const undoTimer = useRef<number | undefined>(undefined)
  // Куда поставить фокус после того, как линии перерисуются: на крестик
  // излучателя (rowId) или, если крестиков в линии не осталось, на её кнопку
  // добавления. Не в поле длины: на телефоне оно открыло бы клавиатуру.
  const focusAfter = useRef<{ rowId: number | null; lineIndex: number } | null>(null)

  useEffect(() => {
    const key = searchKey(urlFirst, urlSecond)
    if (key === writtenRef.current) return
    writtenRef.current = key
    setLines(linesFromSearch(urlFirst, urlSecond))
    // Адрес сменили извне — снимок относится к расчёту, которого на экране уже нет.
    window.clearTimeout(undoTimer.current)
    setUndo(null)
  }, [urlFirst, urlSecond])

  useEffect(() => {
    const next = searchFromLines(lines)
    if (next === writtenRef.current) return
    writtenRef.current = next
    // Строку поиска собираем сами, а не через setSearchParams: тот кодирует
    // запятые в %2C, и ссылка для чата читалась бы как l=15%2C50%2C15. В нашем
    // значении только цифры, точки, запятые и «&» между линиями — кодировать нечего.
    // replace: каждое нажатие клавиши не должно становиться шагом «назад».
    navigate({ search: searchWithLines(params, next) }, { replace: true })
  }, [lines, params, navigate])

  // Таймеры подтверждения и плашки живут дольше страницы — снимаем при уходе.
  useEffect(() => () => {
    window.clearTimeout(copyTimer.current)
    window.clearTimeout(undoTimer.current)
  }, [])

  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const selector = target.rowId === null ? `[data-add-row="${target.lineIndex}"]` : `[data-remove-row="${target.rowId}"]`
    stageRef.current?.querySelector<HTMLElement>(selector)?.focus()
  }, [lines])

  const lengths = lines.map(lineLengths)
  const delays = computeDelays(lengths)
  const { orientation, widths } = useChainLayout(chainRef, lengths)
  const two = lines.length > 1
  const { play, running } = useSignalAnimation(chainRef, lengths, orientation)

  const totalMeters = lengths.flat().reduce((sum, meters) => sum + meters, 0)
  const allDelays = delays.flat()
  const maxSteps = allDelays.reduce((max, delay) => Math.max(max, delay.steps), 0)
  const isPristine = searchFromLines(lines) === null
  // Кабеля нет — задержки нулевые, объяснять движением нечего.
  const canPlay = totalMeters > 0
  const meters = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 })
  const atLimit = lines.some((line) => line.rows.length >= MAX_PER_LINE)

  function offerUndo(message: string, focusRowId: number | null) {
    window.clearTimeout(undoTimer.current)
    setUndo({ lines, message, focusRowId })
    setUndoMessage(message)
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS)
  }

  function dropUndo() {
    window.clearTimeout(undoTimer.current)
    setUndo(null)
  }

  // Снимок кладётся обратно целиком — те же объекты линий и строк, так что и
  // длины, и порядок, и адрес становятся прежними.
  function restore() {
    if (!undo) return
    focusAfter.current = { rowId: undo.focusRowId, lineIndex: 0 }
    setFocusId(null)
    setLines(undo.lines)
    dropUndo()
  }

  function updateRow(id: number, draft: string) {
    dropUndo()
    setLines((current) => current.map((line) => ({ ...line, rows: line.rows.map((row) => (row.id === id ? { ...row, draft } : row)) })))
  }

  function addRow(lineIndex: number) {
    if ((lines[lineIndex]?.rows.length ?? MAX_PER_LINE) >= MAX_PER_LINE) return
    const row = makeRow('')
    dropUndo()
    setFocusId(row.id)
    setLines((current) => current.map((line, index) => (index === lineIndex ? { ...line, rows: [...line.rows, row] } : line)))
  }

  function removeEmitter(lineIndex: number, rowIndex: number) {
    const rows = lines[lineIndex]?.rows ?? []
    const removed = rows[rowIndex]
    if (!removed || rows.length < 2) return
    const number = rowIndex + 1
    const lineNumber = lineIndex + 1
    offerUndo(two
      ? tr(`Линия ${lineNumber}: излучатель ${number} убран`, `${lineNumber}-liniya: ${number}-nurlatgich olib tashlandi`)
      : tr(`Излучатель ${number} убран`, `${number}-nurlatgich olib tashlandi`), removed.id)
    // Фокус — на крестик следующего, у последнего — предыдущего. Остался один
    // излучатель — крестиков в линии нет, фокус уходит на её кнопку добавления.
    const neighbour = rows[rowIndex + 1] ?? rows[rowIndex - 1]
    focusAfter.current = { rowId: rows.length > 2 && neighbour ? neighbour.id : null, lineIndex }
    setLines(removeRow(lines, lineIndex, rowIndex))
  }

  // Новая линия приходит с одним пустым излучателем, фокус — в его поле.
  function addLine() {
    if (lines.length >= MAX_LINES) return
    const row = makeRow('')
    dropUndo()
    setFocusId(row.id)
    setLines((current) => [...current, makeLine([row])])
  }

  // Убрать можно только вторую: первая — та, что живёт в ?l=.
  function removeLine() {
    if (lines.length < 2) return
    offerUndo(tr('Линия 2 убрана', '2-liniya olib tashlandi'), null)
    setLines(lines.slice(0, 1))
  }

  function reset() {
    offerUndo(tr('Расчёт сброшен', 'Hisob tozalandi'), null)
    setFocusId(null)
    setLines(linesFromSearch(null, null))
  }

  async function copyForChat() {
    const plain = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false })
    const emitter = tr('И', 'N')
    const cables = (line: number[]) => `${tr('кабели', 'kabellar')} ${line.map(plain).join('/')} ${tr('м', 'm')}`
    const list = (index: number) => (delays[index] ?? []).map((delay, at) => `${emitter}${at + 1} — ${delay.steps}`).join(', ')
    // «(шаги)» — в чате числа без единицы читали как метры или миллисекунды.
    const title = tr('Задержки ITC (шаги)', 'ITC kechikishlari (qadam)')
    const text = two
      ? `${title}. ${lengths.map((line, index) => `${tr(`Линия ${index + 1}`, `${index + 1}-liniya`)}: ${list(index)} (${cables(line)})`).join('. ')}`
      : `${title}: ${list(0)} (${cables(lengths[0] ?? [])})`
    // Второй строкой — ссылка на этот же расчёт: та же строка поиска, что в адресе.
    const link = `${window.location.origin}${window.location.pathname}${searchWithLines(params, searchFromLines(lines))}`
    const ok = await copyText(`${text}\n${link}`)
    window.clearTimeout(copyTimer.current)
    setCopyState(ok ? 'copied' : 'failed')
    // Полторы секунды — как у копирования в карточках профиля.
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 1500)
  }

  // Подтверждение цветом И словом, как у копирования в карточках: цвет без слова
  // не прочтёт дальтоник, слово без цвета — тот, кто смотрит мельком. Одно
  // состояние на обе кнопки (шапка на десктопе, панель на телефоне).
  const copyLabel = (idle: string) => (copyState === 'copied' ? tr('Скопировано', 'Nusxalandi') : copyState === 'failed' ? tr('Не скопировалось', 'Nusxalanmadi') : idle)
  const copyClass = copyState === 'idle' ? '' : ` delay-copy--${copyState}`

  // Самый долгий ожидатель: в одной линии — первый, при двух — по обеим.
  const farthestNs = Math.round(allDelays.reduce((max, delay) => Math.max(max, delay.ns), 0))

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Расчёт для ITC', 'ITC uchun hisob')}</p>
          <h1>{tr('Задержка излучателей', 'Nurlatgichlar kechikishi')}</h1>
        </div>
        <div className="delay-head__actions">
          <button type="button" className="button button--secondary" onClick={play} disabled={!canPlay}>
            <Play size={16} fill="currentColor" /> {tr('Прогнать сигнал', 'Signalni yuborish')}
          </button>
          <button type="button" className={`button button--primary delay-copy${copyClass}`} onClick={() => void copyForChat()} disabled={!canPlay}>
            {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
            {/* aria-live, а не role="status": роль вырезала бы текст из имени
                кнопки, и скринридер слышал бы безымянную кнопку. */}
            <span aria-live="polite">{copyLabel(tr('Скопировать для чата', 'Chat uchun nusxalash'))}</span>
          </button>
        </div>
      </header>

      <div className="delay-layout">
        <div className="delay-stage" ref={stageRef}>
          <section className="delay-summary" aria-label={tr('Сводка', 'Xulosa')}>
            <div>
              <strong><CountUp value={lines.reduce((sum, line) => sum + line.rows.length, 0)} /></strong>
              <span>{tr('Излучателей', 'Nurlatgichlar')}</span>
            </div>
            <div>
              <strong><CountUp value={Math.round(totalMeters * 100)} format={(shown) => meters(shown / 100)} /><small>{tr('м', 'm')}</small></strong>
              <span>{tr('Кабель всего', 'Jami kabel')}</span>
            </div>
            <div>
              <strong><CountUp value={maxSteps} /></strong>
              <span>{tr('Макс. шаг задержки', 'Eng katta kechikish qadami')}</span>
            </div>
            <div className="delay-summary__ns">
              <strong><CountUp value={farthestNs} /><small>{tr('нс', 'ns')}</small></strong>
              <span>{two ? tr('Сигнал до дальнего', 'Eng uzoqqacha signal') : tr('Сигнал до последнего', 'Oxirgisigacha signal')}</span>
            </div>
          </section>

          <DelayChain
            chainRef={chainRef}
            lines={lines}
            delays={delays}
            maxSteps={maxSteps}
            orientation={orientation}
            widths={widths}
            signalRunning={running}
            focusId={focusId}
            onChange={updateRow}
            onRemove={removeEmitter}
          />

          <div className="delay-tools">
            {two ? lines.map((line, index) => {
              const number = index + 1
              return (
                <div key={line.id} className="delay-tools__line">
                  <span className="delay-tools__tag">{tr(`Линия ${number}`, `${number}-liniya`)}</span>
                  <button type="button" className="delay-quiet" data-add-row={index} onClick={() => addRow(index)} disabled={line.rows.length >= MAX_PER_LINE}
                    aria-label={tr(`Добавить излучатель в линию ${number}`, `${number}-liniyaga nurlatgich qo‘shish`)}>
                    <Plus size={16} /> {tr('Излучатель', 'Nurlatgich')}
                  </button>
                  {index === 1 && (
                    <button type="button" className="delay-quiet" onClick={removeLine}
                      aria-label={tr('Убрать линию 2', '2-liniyani olib tashlash')}>
                      <X size={16} /> {tr('Убрать линию', 'Liniyani olib tashlash')}
                    </button>
                  )}
                </div>
              )
            }) : (
              <>
                <button type="button" className="delay-quiet" data-add-row={0} onClick={() => addRow(0)} disabled={atLimit}>
                  <Plus size={16} /> {tr('Добавить излучатель', 'Nurlatgich qo‘shish')}
                </button>
                <button type="button" className="delay-quiet" onClick={addLine}>
                  <GitFork size={16} /> {tr('Добавить линию', 'Liniya qo‘shish')}
                </button>
              </>
            )}
            <button type="button" className="delay-quiet" onClick={reset} disabled={isPristine}>
              <RotateCcw size={16} /> {tr('Сбросить', 'Tozalash')}
            </button>
            {atLimit && <span className="delay-tools__limit">{tr(`В линии не больше ${MAX_PER_LINE} излучателей`, `Liniyada ko‘pi bilan ${MAX_PER_LINE} ta nurlatgich`)}</span>}
            {!isPristine && (
              <span className="delay-url">{tr('Длины живут в адресе', 'Uzunliklar manzilda saqlanadi')}: <span className="delay-url__value">?{searchFromLines(lines)}</span></span>
            )}
          </div>
        </div>

        <DelayGuide twoLines={two} />
      </div>

      {/* Отдельным элементом в конце страницы, а не в шапке: у шапки анимация
          появления с transform, и fixed внутри неё считался бы от шапки. */}
      <div className="delay-dock">
        <button type="button" className="button button--secondary" onClick={play} disabled={!canPlay}>
          {tr('Сигнал', 'Signal')}
        </button>
        <button type="button" className={`button button--primary delay-copy${copyClass}`} onClick={() => void copyForChat()} disabled={!canPlay}>
          <span aria-live="polite">{copyLabel(tr('В чат', 'Chatga'))}</span>
        </button>
      </div>

      {/* Плашка «Вернуть». В разметке всегда — иначе уход не сыграть одним CSS;
          закрытая скрыта visibility — ни Tab, ни нажатие до неё не доходят. Рядом с панелью, а не в
          шапке, по той же причине: fixed под предком с transform. */}
      <div className={`delay-undo${undo ? ' delay-undo--open' : ''}`} role="status">
        <span className="delay-undo__text">{undoMessage}</span>
        <button type="button" className="button delay-undo__back" onClick={restore}>{tr('Вернуть', 'Qaytarish')}</button>
      </div>
    </>
  )
}
