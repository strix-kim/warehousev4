import { Check, Copy, Minus, Play, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { copyText } from '../../lib/clipboard'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { useChainLayout } from './chainLayout'
import { CABLE_NS_PER_METER, computeDelays, DELAY_STEP_NS, MAX_EMITTERS, parseLength } from './delay'
import { CountUp, DelayChain, type Row } from './DelayChain'
import { useSignalAnimation } from './useSignalAnimation'

// Калькулятор задержки излучателей ITC. Базы здесь нет вовсе: всё состояние —
// длины кабелей, и живут они в адресе (?l=15,50,15,70,15). Так расчёт переживает
// F5, а ссылку можно скинуть в чат — у получателя откроется та же цепочка.

const LENGTHS_PARAM = 'l'
// Число с единицей не рвём по строкам: «5,6 нс/» на одной и «м» на другой (замечено на 1440).
const NBSP = '\u00a0'
const WJ = '\u2060'
// Нетронутый экран — один излучатель: в одной цепочке их обычно до шести, лишние
// пустые ряды только мешали бы; остальные добавляют кнопкой.
const DEFAULT_ROWS = 1

// Ключ строки — не индекс: удаление из середины сдвинуло бы индексы, и React
// переиспользовал бы чужие поля ввода вместе с их фокусом.
let rowSeq = 0
function makeRow(draft: string): Row {
  rowSeq += 1
  return { id: rowSeq, draft }
}

function rowsFromParam(value: string | null): Row[] {
  if (value === null) return Array.from({ length: DEFAULT_ROWS }, () => makeRow(''))
  return value.split(',').slice(0, MAX_EMITTERS).map((token) => makeRow(parseLength(token) === null ? '' : token.trim()))
}

// В адрес уходит число с точкой, а не то, что набрано: запятая в адресе —
// разделитель строк, и «12,5» превратилось бы в два излучателя. Нетронутый
// экран (одна пустая строка) адрес не пачкает.
function paramFromRows(rows: Row[]): string | null {
  if (rows.length === DEFAULT_ROWS && rows.every((row) => !row.draft.trim())) return null
  return rows.map((row) => {
    const value = parseLength(row.draft)
    return value === null ? '' : String(value)
  }).join(',')
}


export function DelayCalculatorPage() {
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Задержка излучателей', 'Nurlatgichlar kechikishi'))
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const urlValue = params.get(LENGTHS_PARAM)
  const [rows, setRows] = useState<Row[]>(() => rowsFromParam(urlValue))
  // Что МЫ последним записали в адрес. Без этой отметки своя запись, вернувшись
  // из роутера, перетёрла бы поле: «12,» превратилось бы в «12» посреди набора
  // (gotchas §7). Догоняем адрес только при расхождении — это чужая запись:
  // «назад», ссылка, открытая поверх страницы.
  const writtenRef = useRef<string | null>(urlValue)
  // Только что добавленный излучатель получает фокус: следующее действие
  // человека — вписать длину его кабеля.
  const [focusId, setFocusId] = useState<number | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyTimer = useRef<number | undefined>(undefined)
  const chainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (urlValue === writtenRef.current) return
    writtenRef.current = urlValue
    setRows(rowsFromParam(urlValue))
  }, [urlValue])

  useEffect(() => {
    const next = paramFromRows(rows)
    if (next === writtenRef.current) return
    writtenRef.current = next
    // Строку поиска собираем сами, а не через setSearchParams: тот кодирует
    // запятые в %2C, и ссылка для чата читалась бы как l=15%2C50%2C15. В нашем
    // значении только цифры, точки и запятые — кодировать там нечего.
    // replace: каждое нажатие клавиши не должно становиться шагом «назад».
    const rest = new URLSearchParams(params)
    rest.delete(LENGTHS_PARAM)
    const search = [rest.toString(), next === null ? '' : `${LENGTHS_PARAM}=${next}`].filter(Boolean).join('&')
    navigate({ search: search ? `?${search}` : '' }, { replace: true })
  }, [rows, params, navigate])

  // Таймер подтверждения живёт дольше страницы — снимаем при уходе.
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const lengths = rows.map((row) => parseLength(row.draft) ?? 0)
  const delays = computeDelays(lengths)
  const { orientation, widths } = useChainLayout(chainRef, lengths)
  const { play } = useSignalAnimation(chainRef, lengths, orientation)

  const totalMeters = lengths.reduce((sum, meters) => sum + meters, 0)
  const maxSteps = delays.reduce((max, delay) => Math.max(max, delay.steps), 0)
  const isPristine = paramFromRows(rows) === null
  const canAdd = rows.length < MAX_EMITTERS
  // Кабеля нет — задержки нулевые, объяснять движением нечего.
  const canPlay = totalMeters > 0
  const meters = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 })

  function updateRow(id: number, draft: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, draft } : row)))
  }

  function addRow() {
    if (!canAdd) return
    const row = makeRow('')
    setFocusId(row.id)
    setRows((current) => [...current, row])
  }

  function removeLast() {
    setRows((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }

  function reset() {
    setFocusId(null)
    setRows(rowsFromParam(null))
  }

  async function copyForChat() {
    const plain = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false })
    const list = delays.map((delay, index) => `${tr('И', 'N')}${index + 1} — ${delay.steps}`).join(', ')
    const text = `${tr('Задержки ITC', 'ITC kechikishlari')}: ${list} (${tr('кабели', 'kabellar')} ${lengths.map(plain).join('/')} ${tr('м', 'm')})`
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

  const formulaNumbers = { perMeter: CABLE_NS_PER_METER.toLocaleString(locale), step: DELAY_STEP_NS.toLocaleString(locale) }
  const lastNs = Math.round(delays[0]?.ns ?? 0)

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
              <strong><CountUp value={rows.length} /></strong>
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
              <strong><CountUp value={lastNs} /><small>{tr('нс', 'ns')}</small></strong>
              <span>{tr('Сигнал до последнего', 'Oxirgisigacha signal')}</span>
            </div>
          </section>

          <DelayChain
            chainRef={chainRef}
            rows={rows}
            delays={delays}
            maxSteps={maxSteps}
            orientation={orientation}
            widths={widths}
            focusId={focusId}
            onChange={updateRow}
          />

          <div className="delay-tools">
            <button type="button" className="delay-quiet" onClick={addRow} disabled={!canAdd}>
              <Plus size={16} /> {tr('Добавить излучатель', 'Nurlatgich qo‘shish')}
            </button>
            <button type="button" className="delay-quiet" onClick={removeLast} disabled={rows.length <= 1}>
              <Minus size={16} /> {tr('Убрать последний', 'Oxirgisini olib tashlash')}
            </button>
            <button type="button" className="delay-quiet" onClick={reset} disabled={isPristine}>
              <RotateCcw size={16} /> {tr('Сбросить', 'Tozalash')}
            </button>
            {!canAdd && <span className="delay-tools__limit">{tr(`Максимум ${MAX_EMITTERS} излучателей`, `Ko‘pi bilan ${MAX_EMITTERS} ta nurlatgich`)}</span>}
            {!isPristine && (
              <span className="delay-url">{tr('Длины живут в адресе', 'Uzunliklar manzilda saqlanadi')}: <span className="delay-url__value">?{LENGTHS_PARAM}={paramFromRows(rows)}</span></span>
            )}
          </div>
        </div>

        <div className="delay-side">
          <aside className="delay-guide" aria-label={tr('Как читать', 'Qanday o‘qish kerak')}>
            <p className="delay-guide__title">{tr('Как читать', 'Qanday o‘qish kerak')}</p>
            <ol>
              <li>{tr('Сигнал идёт от мозгов по цепочке и до ближних излучателей доходит раньше.', 'Signal protsessordan zanjir bo‘ylab boradi va yaqin nurlatgichlarga oldinroq yetadi.')}</li>
              <li>{tr('Каждому ставим задержку — сколько сигнал ещё идёт от него до последнего.', 'Har biriga kechikish qo‘yamiz — signal undan oxirgisigacha qancha yursa, shuncha.')}</li>
              <li>{tr('Первый ждёт дольше всех, последний не ждёт — все излучают одновременно.', 'Birinchisi hammadan uzoq kutadi, oxirgisi kutmaydi — hammasi bir vaqtda nurlatadi.')}</li>
              <li>{tr('Кабель от мозгов до первого на задержки не влияет.', 'Protsessordan birinchisigacha bo‘lgan kabel kechikishlarga ta’sir qilmaydi.')}</li>
            </ol>
          </aside>
          <p className="delay-formula">{tr(
            `шаг = ⌈${NBSP}кабель после излучателя × ${formulaNumbers.perMeter}${NBSP}нс/${WJ}м ÷ ${formulaNumbers.step}${NBSP}нс${NBSP}⌉`,
            `qadam = ⌈${NBSP}nurlatgichdan keyingi kabel × ${formulaNumbers.perMeter}${NBSP}ns/${WJ}m ÷ ${formulaNumbers.step}${NBSP}ns${NBSP}⌉`,
          )}</p>
        </div>
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
