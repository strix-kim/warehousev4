import { Check, Copy, Cpu, Plus, Radio, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { copyText } from '../../lib/clipboard'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { CABLE_NS_PER_METER, computeDelays, DELAY_STEP_NS, MAX_EMITTERS, parseLength, type EmitterDelay } from './delay'
import { useSignalAnimation } from './useSignalAnimation'

// Калькулятор задержки излучателей ITC. Базы здесь нет вовсе: всё состояние —
// длины кабелей, и живут они в адресе (?l=15,50,15,70,15). Так расчёт переживает
// F5, а ссылку можно скинуть в чат — у получателя откроется та же цепочка.

const LENGTHS_PARAM = 'l'
// Число с единицей не рвём по строкам: «5,6 нс/» на одной и «м» на другой (замечено на 1440).
const NBSP = '\u00a0'
const WJ = '\u2060'
const DEFAULT_ROWS = 3

type Row = { id: number; draft: string }

// Ключ строки — не индекс: удаление из середины сдвинуло бы индексы, и React
// переиспользовал бы чужие поля ввода вместе с их анимацией появления.
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
// экран (три пустые строки) адрес не пачкает.
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
  useSignalAnimation(chainRef, lengths)

  const totalMeters = lengths.reduce((sum, meters) => sum + meters, 0)
  const maxSteps = delays.reduce((max, delay) => Math.max(max, delay.steps), 0)
  const isPristine = paramFromRows(rows) === null
  const canAdd = rows.length < MAX_EMITTERS

  function updateRow(id: number, draft: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, draft } : row)))
  }

  function addRow() {
    if (!canAdd) return
    const row = makeRow('')
    setFocusId(row.id)
    setRows((current) => [...current, row])
  }

  function removeRow(id: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current))
  }

  function reset() {
    setFocusId(null)
    setRows(rowsFromParam(null))
  }

  async function copyForChat() {
    const text = `${tr('Задержки ITC', 'ITC kechikishlari')}: ${delays.map((delay, index) => `${index + 1} — ${delay.steps}`).join(' · ')}`
    const ok = await copyText(text)
    window.clearTimeout(copyTimer.current)
    setCopyState(ok ? 'copied' : 'failed')
    // Полторы секунды — как у копирования в карточках профиля.
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 1500)
  }

  const meters = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 })
  const formulaNumbers = { perMeter: CABLE_NS_PER_METER.toLocaleString(locale), step: DELAY_STEP_NS.toLocaleString(locale) }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Расчёт для ITC', 'ITC uchun hisob')}</p>
          <h1>{tr('Задержка излучателей', 'Nurlatgichlar kechikishi')}</h1>
          <p className="page-description">{tr(
            'Процессор, кабель, излучатели — по цепочке. Впишите длины кабелей, и у каждого излучателя появится шаг задержки, при котором все излучают одновременно.',
            'Protsessor, kabel, nurlatgichlar — zanjir bo‘ylab. Kabel uzunliklarini kiriting — har bir nurlatgich uchun hammasi bir vaqtda nurlatadigan kechikish qadami chiqadi.',
          )}</p>
        </div>
      </header>

      <div className="delay-layout">
        <div className="delay-main">
          <section className="delay-summary" aria-label={tr('Сводка', 'Xulosa')}>
            <div>
              <span>{tr('Излучателей', 'Nurlatgichlar')}</span>
              <strong>{rows.length.toLocaleString(locale)}</strong>
            </div>
            <div>
              <span>{tr('Кабель всего', 'Jami kabel')}</span>
              <strong>{meters(totalMeters)} <small>{tr('м', 'm')}</small></strong>
            </div>
            <div className="delay-summary__max">
              <span>{tr('Макс. задержка', 'Eng katta kechikish')}</span>
              <strong>{maxSteps.toLocaleString(locale)}</strong>
            </div>
          </section>

          <div className="delay-actions">
            {/* Подтверждение цветом И словом, как у копирования в карточках:
                цвет без слова не прочтёт дальтоник, слово без цвета — тот,
                кто смотрит мельком. */}
            <button
              type="button"
              className={`button button--secondary delay-copy${copyState === 'idle' ? '' : ` delay-copy--${copyState}`}`}
              onClick={() => void copyForChat()}
            >
              {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
              {/* aria-live, а не role="status": роль вырезала бы текст из имени
                  кнопки, и скринридер слышал бы безымянную кнопку. */}
              <span aria-live="polite">
                {copyState === 'copied' ? tr('Скопировано', 'Nusxalandi') : copyState === 'failed' ? tr('Не скопировалось', 'Nusxalanmadi') : tr('Скопировать для чата', 'Chat uchun nusxalash')}
              </span>
            </button>
            <button type="button" className="button button--secondary" onClick={reset} disabled={isPristine}>
              <RotateCcw size={16} /> {tr('Сбросить', 'Tozalash')}
            </button>
          </div>

          <section className="delay-chain" ref={chainRef} aria-label={tr('Цепочка излучателей', 'Nurlatgichlar zanjiri')}>
            <span className="delay-signal" data-signal-dot aria-hidden="true" />

            <div className="delay-row delay-row--brain">
              <div className="delay-rail">
                <span className="delay-beacon delay-beacon--brain" data-signal-anchor aria-hidden="true">
                  <span className="delay-beacon__glow" data-signal-glow />
                  <span className="delay-beacon__icon" data-signal-icon><Cpu size={24} /></span>
                </span>
              </div>
              <div className="delay-node">
                <strong>{tr('Мозги', 'Protsessor')}</strong>
                <span>{tr('Процессор — отсюда уходит сигнал', 'Signal shu yerdan chiqadi')}</span>
              </div>
            </div>

            {rows.map((row, index) => (
              <EmitterSegment
                key={row.id}
                row={row}
                index={index}
                delay={delays[index]}
                isLast={index === rows.length - 1}
                canRemove={rows.length > 1}
                autoFocus={row.id === focusId}
                onChange={(draft) => updateRow(row.id, draft)}
                onRemove={() => removeRow(row.id)}
              />
            ))}

            <div className="delay-row delay-row--add">
              <div className="delay-rail" />
              <div>
                <button type="button" className="delay-add" onClick={addRow} disabled={!canAdd}>
                  <Plus size={18} /> {tr('Излучатель', 'Nurlatgich')}
                </button>
                {!canAdd && <p className="delay-add__limit">{tr(`Максимум ${MAX_EMITTERS} излучателей`, `Ko‘pi bilan ${MAX_EMITTERS} ta nurlatgich`)}</p>}
              </div>
            </div>
          </section>
        </div>

        <aside className="delay-guide" aria-label={tr('Как читать', 'Qanday o‘qish kerak')}>
          <p className="eyebrow">{tr('Как читать', 'Qanday o‘qish kerak')}</p>
          <ol>
            <li>{tr('Сигнал идёт от мозгов по цепочке и до ближних излучателей доходит раньше, чем до дальних.', 'Signal protsessordan zanjir bo‘ylab boradi va yaqin nurlatgichlarga uzoqdagilardan oldinroq yetadi.')}</li>
            <li>{tr('Каждому излучателю ставим задержку — столько, сколько сигнал ещё идёт от него до последнего.', 'Har bir nurlatgichga kechikish qo‘yamiz — signal undan oxirgisigacha qancha yursa, shuncha.')}</li>
            <li>{tr('Первый ждёт дольше всех, последний не ждёт вовсе — и все излучают одновременно.', 'Birinchisi hammadan uzoq kutadi, oxirgisi umuman kutmaydi — va hammasi bir vaqtda nurlatadi.')}</li>
            <li>{tr('Кабель от мозгов до первого излучателя на задержки не влияет: он задерживает всех одинаково.', 'Protsessordan birinchi nurlatgichgacha bo‘lgan kabel kechikishlarga ta’sir qilmaydi: u hammani bir xil kechiktiradi.')}</li>
          </ol>
          <p className="delay-guide__formula">{tr(
            `Шаг = кабель после излучателя, м × ${formulaNumbers.perMeter}${NBSP}нс/${WJ}м ÷ ${formulaNumbers.step}${NBSP}нс, с округлением вверх.`,
            `Qadam = nurlatgichdan keyingi kabel, m × ${formulaNumbers.perMeter}${NBSP}ns/${WJ}m ÷ ${formulaNumbers.step}${NBSP}ns, yuqoriga yaxlitlanadi.`,
          )}</p>
        </aside>
      </div>
    </>
  )
}

// Отрезок цепочки: кабель до излучателя и сам излучатель. Одним узлом, чтобы
// появление нового излучателя читалось как одно движение: кабель дорастает,
// следом въезжает карточка.
function EmitterSegment({ row, index, delay, isLast, canRemove, autoFocus, onChange, onRemove }: {
  row: Row
  index: number
  delay: EmitterDelay | undefined
  isLast: boolean
  canRemove: boolean
  autoFocus: boolean
  onChange: (draft: string) => void
  onRemove: () => void
}) {
  const { tr, locale } = useLanguage()
  const number = index + 1
  const isInvalid = row.draft.trim() !== '' && parseLength(row.draft) === null
  const steps = delay?.steps ?? 0
  const ns = Math.round(delay?.ns ?? 0)

  return (
    <div className={`delay-segment${isLast ? ' delay-segment--last' : ''}`}>
      <div className="delay-row delay-row--cable">
        <div className="delay-rail"><span className="delay-cable" /></div>
        <div className="delay-link">
          <label className={`delay-length${isInvalid ? ' delay-length--invalid' : ''}`}>
            <input
              value={row.draft}
              onChange={(event) => onChange(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={autoFocus}
              placeholder="0"
              maxLength={8}
              aria-invalid={isInvalid}
              aria-label={tr(`Длина кабеля до излучателя ${number}, м`, `${number}-nurlatgichgacha kabel uzunligi, m`)}
            />
            <span aria-hidden="true">{tr('м', 'm')}</span>
          </label>
          <span className={`delay-link__hint${isInvalid ? ' delay-link__hint--invalid' : ''}`}>
            {isInvalid
              ? tr('не число — считаем как 0', 'son emas — 0 deb hisoblanadi')
              : index === 0
                ? tr('от мозгов — на задержки не влияет', 'protsessordan — kechikishlarga ta’sir qilmaydi')
                : tr(`от излучателя ${index}`, `${index}-nurlatgichdan`)}
          </span>
        </div>
      </div>

      <div className="delay-row delay-row--emitter">
        <div className="delay-rail">
          <span className="delay-beacon" data-signal-anchor aria-hidden="true">
            <span className="delay-beacon__glow" data-signal-glow />
            <span className="delay-signal-wave" data-signal-wave />
            <span className="delay-signal-wave" data-signal-wave />
            <span className="delay-ring">
              {/* Кольцо ожидания — две половины, каждая открывается поворотом
                  (только transform). Порядок в разметке — порядок заполнения:
                  сначала правая, потом левая. */}
              <span className="delay-ring__fill" data-ring-fill>
                <span className="delay-ring__half delay-ring__half--right"><span className="delay-ring__sweep" data-ring-sweep><span className="delay-ring__semi"><i /></span></span></span>
                <span className="delay-ring__half delay-ring__half--left"><span className="delay-ring__sweep" data-ring-sweep><span className="delay-ring__semi"><i /></span></span></span>
              </span>
            </span>
            <span className="delay-beacon__icon" data-signal-icon><Radio size={20} /></span>
          </span>
        </div>
        <article className="delay-emitter">
          <div className="delay-emitter__head">
            <span className="delay-emitter__index">{tr(`Излучатель ${number}`, `Nurlatgich ${number}`)}</span>
            <button
              type="button"
              className="icon-button delay-emitter__remove"
              onClick={onRemove}
              disabled={!canRemove}
              aria-label={tr(`Удалить излучатель ${number}`, `${number}-nurlatgichni o‘chirish`)}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="delay-emitter__value">
            <DelaySteps steps={steps} />
            <div>
              <span>{tr('шаг задержки', 'kechikish qadami')}</span>
              <small>{isLast ? tr('последний — не ждёт', 'oxirgisi — kutmaydi') : `≈ ${ns.toLocaleString(locale)} ${tr('нс', 'ns')}`}</small>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

// Число задержки коротко подсвечивается при смене — глаз ловит, какие
// излучатели задела правка длины. Прошлое значение помним в состоянии и
// сверяем прямо в рендере (приём React «значение из прошлого рендера»):
// эффект дал бы лишний кадр со старой подсветкой. Смена ключа перезапускает
// CSS-анимацию; на первом рендере подсветки нет.
function DelaySteps({ steps }: { steps: number }) {
  const [shown, setShown] = useState(steps)
  const [pulse, setPulse] = useState(0)
  if (shown !== steps) {
    setShown(steps)
    setPulse(pulse + 1)
  }

  return (
    <strong
      key={pulse}
      className={`delay-emitter__steps${pulse > 0 ? ' delay-emitter__steps--changed' : ''}${steps === 0 ? ' delay-emitter__steps--zero' : ''}`}
    >
      {steps}
    </strong>
  )
}
