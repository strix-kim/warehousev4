import { Check, Copy, GitFork, Minus, Play, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { copyText } from '../../lib/clipboard'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { useChainLayout } from './chainLayout'
import { computeDelays, MAX_LINES, MAX_PER_LINE } from './delay'
import { CountUp, DelayChain } from './DelayChain'
import { DelayGuide } from './DelayGuide'
import { LINE_PARAMS, lineLengths, linesFromSearch, makeLine, makeRow, searchFromLines, searchKey } from './lengthsParam'
import { useSignalAnimation } from './useSignalAnimation'

// Калькулятор задержки излучателей ITC. Базы здесь нет вовсе: всё состояние —
// длины кабелей, и живут они в адресе (?l=15,50,15,70,15 и, если линий две,
// &l2=…). Так расчёт переживает F5, а ссылку можно скинуть в чат — у получателя
// откроется та же схема. Разбор и сборка адреса — lengthsParam.ts.

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

  useEffect(() => {
    const key = searchKey(urlFirst, urlSecond)
    if (key === writtenRef.current) return
    writtenRef.current = key
    setLines(linesFromSearch(urlFirst, urlSecond))
  }, [urlFirst, urlSecond])

  useEffect(() => {
    const next = searchFromLines(lines)
    if (next === writtenRef.current) return
    writtenRef.current = next
    // Строку поиска собираем сами, а не через setSearchParams: тот кодирует
    // запятые в %2C, и ссылка для чата читалась бы как l=15%2C50%2C15. В нашем
    // значении только цифры, точки, запятые и «&» между линиями — кодировать нечего.
    // replace: каждое нажатие клавиши не должно становиться шагом «назад».
    const rest = new URLSearchParams(params)
    LINE_PARAMS.forEach((key) => rest.delete(key))
    const search = [rest.toString(), next ?? ''].filter(Boolean).join('&')
    navigate({ search: search ? `?${search}` : '' }, { replace: true })
  }, [lines, params, navigate])

  // Таймер подтверждения живёт дольше страницы — снимаем при уходе.
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

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

  function updateRow(id: number, draft: string) {
    setLines((current) => current.map((line) => ({ ...line, rows: line.rows.map((row) => (row.id === id ? { ...row, draft } : row)) })))
  }

  function addRow(lineIndex: number) {
    if ((lines[lineIndex]?.rows.length ?? MAX_PER_LINE) >= MAX_PER_LINE) return
    const row = makeRow('')
    setFocusId(row.id)
    setLines((current) => current.map((line, index) => (index === lineIndex ? { ...line, rows: [...line.rows, row] } : line)))
  }

  function removeLast(lineIndex: number) {
    setLines((current) => current.map((line, index) => (index === lineIndex && line.rows.length > 1 ? { ...line, rows: line.rows.slice(0, -1) } : line)))
  }

  // Новая линия приходит с одним пустым излучателем, фокус — в его поле.
  function addLine() {
    if (lines.length >= MAX_LINES) return
    const row = makeRow('')
    setFocusId(row.id)
    setLines((current) => [...current, makeLine([row])])
  }

  // Убрать можно только вторую: первая — та, что живёт в ?l=.
  function removeLine() {
    setLines((current) => (current.length > 1 ? current.slice(0, 1) : current))
  }

  function reset() {
    setFocusId(null)
    setLines(linesFromSearch(null, null))
  }

  async function copyForChat() {
    const plain = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false })
    const emitter = tr('И', 'N')
    const cables = (line: number[]) => `${tr('кабели', 'kabellar')} ${line.map(plain).join('/')} ${tr('м', 'm')}`
    const list = (index: number) => (delays[index] ?? []).map((delay, at) => `${emitter}${at + 1} — ${delay.steps}`).join(', ')
    const title = tr('Задержки ITC', 'ITC kechikishlari')
    const text = two
      ? `${title}. ${lengths.map((line, index) => `${tr(`Линия ${index + 1}`, `${index + 1}-liniya`)}: ${list(index)} (${cables(line)})`).join('. ')}`
      : `${title}: ${list(0)} (${cables(lengths[0] ?? [])})`
    const ok = await copyText(text)
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
          <button type="button" className={`button button--primary delay-copy${copyClass}`} onClick={() => void copyForChat()}>
            {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
            {/* aria-live, а не role="status": роль вырезала бы текст из имени
                кнопки, и скринридер слышал бы безымянную кнопку. */}
            <span aria-live="polite">{copyLabel(tr('Скопировать для чата', 'Chat uchun nusxalash'))}</span>
          </button>
        </div>
      </header>

      <div className="delay-layout">
        <div className="delay-stage">
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
          />

          <div className="delay-tools">
            {two ? lines.map((line, index) => {
              const number = index + 1
              return (
                <div key={line.id} className="delay-tools__line">
                  <span className="delay-tools__tag">{tr(`Линия ${number}`, `${number}-liniya`)}</span>
                  <button type="button" className="delay-quiet" onClick={() => addRow(index)} disabled={line.rows.length >= MAX_PER_LINE}
                    aria-label={tr(`Добавить излучатель в линию ${number}`, `${number}-liniyaga nurlatgich qo‘shish`)}>
                    <Plus size={16} /> {tr('Излучатель', 'Nurlatgich')}
                  </button>
                  <button type="button" className="delay-quiet" onClick={() => removeLast(index)} disabled={line.rows.length <= 1}
                    aria-label={tr(`Убрать последний излучатель линии ${number}`, `${number}-liniya: oxirgisini olib tashlash`)}>
                    <Minus size={16} /> {tr('Последний', 'Oxirgisi')}
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
                <button type="button" className="delay-quiet" onClick={() => addRow(0)} disabled={atLimit}>
                  <Plus size={16} /> {tr('Добавить излучатель', 'Nurlatgich qo‘shish')}
                </button>
                <button type="button" className="delay-quiet" onClick={() => removeLast(0)} disabled={(lines[0]?.rows.length ?? 1) <= 1}>
                  <Minus size={16} /> {tr('Убрать последний', 'Oxirgisini olib tashlash')}
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
        <button type="button" className={`button button--primary delay-copy${copyClass}`} onClick={() => void copyForChat()}>
          <span aria-live="polite">{copyLabel(tr('В чат', 'Chatga'))}</span>
        </button>
      </div>
    </>
  )
}
