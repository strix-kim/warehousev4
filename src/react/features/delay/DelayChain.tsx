import { Cpu, Plus, Speaker, X } from 'lucide-react'
import { Fragment, type CSSProperties, type RefObject } from 'react'
import { useCountUp } from '../../lib/useCountUp'
import { useLanguage } from '../../lib/i18n'
import type { ChainOrientation } from './chainLayout'
import { parseLength, sanitizeLength, type EmitterDelay } from './delay'
import type { Line } from './lengthsParam'

// Цепочка калькулятора ITC: мозги — кабель — излучатель — кабель — … Линий от
// мозгов одна или две. Разметка одна на обе ориентации и на оба числа линий,
// меняются только классы на секции (--row / --column / --two): иначе при смене
// раскладки поле длины с фокусом размонтировалось бы. Первая линия при
// добавлении и удалении второй сохраняет ключ и не перемонтируется.
//
// Кнопки линий в столбце живут в самих линиях (с43): «+ Излучатель» — в конце
// каждой, заголовок «Линия N» и «Убрать линию» — в её начале. Под цепочкой кнопка
// первой линии оказывалась за второй, в сотнях px от своего конца. В ряду их в
// разметке нет вовсе — там они в .delay-tools на странице: лишний потомок линии
// сломал бы расчёт ширин (chainLayout.ts). Всё это — соседи строк, не обёртки:
// смена раскладки поля длины не перемонтирует.
//
// Фон: цепочка «живёт» без нажатий — ореол мозгов (delay-node__aura), импульс по
// каждому кабелю (delay-cable__flow) и эхо у излучателя (delay-node__echo). Всё
// на CSS-keyframes в 05-delay.css; отсюда приходит только порядковый номер в
// линии (--delay-i) — от него считается отставание импульса от мозгов.

// Число с единицей не рвём по строкам.
const NBSP = '\u00a0'

// Число, которое докручивается до нового значения (180 мс, lib/useCountUp).
// Целые: дробные метры страница передаёт в сотых долях и форматирует сама.
export function CountUp({ value, format }: { value: number; format?: (shown: number) => string }) {
  const { locale } = useLanguage()
  const shown = useCountUp(value, true)
  return <>{format ? format(shown) : shown.toLocaleString(locale)}</>
}

// Доля кольца в покое → поворот двух половин: правая заполняется первой,
// левая — второй (порядок такой же, как у анимации сигнала).
function restRotation(steps: number, maxSteps: number) {
  const fill = maxSteps ? steps / maxSteps : 0
  return {
    right: `rotate(${Math.min(1, 2 * fill) * 180}deg)`,
    left: `rotate(${Math.max(0, 2 * fill - 1) * 180}deg)`,
  }
}

export function DelayChain({ chainRef, lines, delays, maxSteps, orientation, widths, signalRunning, focusId, maxPerLine, onChange, onRemove, onAddRow, onRemoveLine }: {
  chainRef: RefObject<HTMLElement | null>
  lines: Line[]
  delays: EmitterDelay[][]
  maxSteps: number
  orientation: ChainOrientation
  widths: number[][]
  // Идёт прогон по кнопке — фон гаснет, пока он не кончится.
  signalRunning: boolean
  focusId: number | null
  // Лимит излучателей в линии — на нём «+ Излучатель» гаснет.
  maxPerLine: number
  onChange: (id: number, draft: string) => void
  onRemove: (lineIndex: number, rowIndex: number) => void
  // Кнопки линий — только в столбце (в ряду они на странице, в .delay-tools).
  onAddRow: (lineIndex: number) => void
  onRemoveLine: () => void
}) {
  const { tr, locale } = useLanguage()
  const meters = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 })
  const two = lines.length > 1
  const column = orientation === 'column'

  return (
    <section className={`delay-chain delay-chain--${orientation}${two ? ' delay-chain--two' : ''}${signalRunning ? ' delay-chain--signal' : ''}`} ref={chainRef} aria-label={tr('Цепочка излучателей', 'Nurlatgichlar zanjiri')}>
      {lines.map((line) => <span key={line.id} className="delay-signal" data-signal-dot aria-hidden="true" />)}

      <div className="delay-node delay-node--brain">
        <span className="delay-node__box" data-signal-anchor data-signal-brain aria-hidden="true">
          <span className="delay-node__aura" />
          <span className="delay-node__glow" data-signal-glow />
          <span className="delay-node__icon" data-signal-icon><Cpu size={24} /></span>
        </span>
        <div className="delay-node__lab">
          <span className="delay-node__name">{tr('Мозги', 'Protsessor')}</span>
          <span className="delay-node__unit">{tr('процессор — отсюда уходит сигнал', 'signal shu yerdan chiqadi')}</span>
        </div>
      </div>

      {/* Отвод: короткая горизонталь от мозгов и вертикальная шина к двум линиям. */}
      {two && <span className="delay-fork" aria-hidden="true" />}

      {lines.map((line, lineIndex) => (
        <div key={line.id} className="delay-line" data-signal-line>
          {/* Заголовок первой линии в столбце — строкой между мозгами и её первым
              кабелем. Слева отрезок рельса: без него кабель от мозгов рвался бы
              на высоту строки. */}
          {column && two && lineIndex === 0 && (
            <div className="delay-line__head">
              <span className="delay-line__rail" aria-hidden="true" />
              <span className="delay-line__tag">{tr('Линия 1', '1-liniya')}</span>
            </div>
          )}

          {/* Начало второй линии в столбце: маленькие мозги, откуда бежит её сигнал,
              её заголовок и «Убрать линию». В ряду строка скрыта, но остаётся в
              разметке — по data-signal-start её ищет анимация сигнала. */}
          {lineIndex === 1 && (
            <div className="delay-line__start">
              <span className="delay-line__box" data-signal-start aria-hidden="true">
                <span className="delay-node__glow" data-signal-glow />
                <Cpu size={16} />
              </span>
              <span className="delay-line__title">
                {column && <span className="delay-line__tag">{tr('Линия 2', '2-liniya')}</span>}
                <span className="delay-line__name">{tr('Мозги', 'Protsessor')}</span>
              </span>
              {column && (
                <button type="button" className="delay-quiet" onClick={onRemoveLine}
                  aria-label={tr('Убрать линию 2', '2-liniyani olib tashlash')}>
                  <X size={16} /> {tr('Убрать линию', 'Liniyani olib tashlash')}
                </button>
              )}
            </div>
          )}

          {line.rows.map((row, index) => {
            const number = index + 1
            const lineNumber = lineIndex + 1
            const isLast = index === line.rows.length - 1
            const isNew = row.id === focusId
            const isEmpty = row.draft.trim() === ''
            const isInvalid = !isEmpty && parseLength(row.draft) === null
            // Пустое поле молча считается нулём — говорим об этом там, где ноль
            // меняет результат: при одной линии кабель от мозгов на задержки не
            // влияет, его пустота ничего не значит.
            const isAssumedZero = isEmpty && (two || index !== 0)
            const delay = delays[lineIndex]?.[index]
            const steps = delay?.steps ?? 0
            const downstream = delay?.downstreamMeters ?? 0
            const rest = restRotation(steps, maxSteps)
            const noteId = `delay-note-${row.id}`
            const lineTag = two && index === 0 ? tr(`линия ${lineNumber} · `, `${lineNumber}-liniya · `) : ''
            const note = isInvalid
              ? `${lineTag}${tr('не число — считаем как 0', 'son emas — 0 deb hisoblanadi')}`
              : isAssumedZero ? `${lineTag}${tr('длина не указана — считаем 0', 'uzunlik kiritilmagan — 0 deb hisoblanadi')}`
                : index !== 0 ? null
                  : two ? tr(`линия ${lineNumber} · от мозгов, в расчёте`, `${lineNumber}-liniya · protsessordan, hisobda`)
                    : tr('от мозгов — на задержки не влияет', 'protsessordan — kechikishlarga ta’sir qilmaydi')
            const fieldLabel = two
              ? tr(`Линия ${lineNumber}: длина кабеля до излучателя ${number}, м`, `${lineNumber}-liniya: ${number}-nurlatgichgacha kabel uzunligi, m`)
              : tr(`Длина кабеля до излучателя ${number}, м`, `${number}-nurlatgichgacha kabel uzunligi, m`)
            // Одна линия — «последний» (D); две — «самый дальний»: он не обязан стоять последним.
            const waitless = two ? downstream === 0 : isLast
            const order = { '--delay-i': index } as CSSProperties
            const removeLabel = two
              ? tr(`Убрать излучатель ${number} линии ${lineNumber}`, `${lineNumber}-liniya: ${number}-nurlatgichni olib tashlash`)
              : tr(`Убрать излучатель ${number}`, `${number}-nurlatgichni olib tashlash`)

            return (
              <Fragment key={row.id}>
                <div
                  className={`delay-cable${index === 0 ? ' delay-cable--first' : ''}${isNew ? ' delay-cable--new' : ''}`}
                  style={orientation === 'row' ? { ...order, width: widths[lineIndex]?.[index] } : order}
                >
                  <span className="delay-cable__line" aria-hidden="true" />
                  <span className="delay-cable__flow" aria-hidden="true"><i /></span>
                  <div className="delay-cable__body">
                    <label className={`delay-len${isInvalid ? ' delay-len--invalid' : ''}`}>
                      <input
                        value={row.draft}
                        onChange={(event) => onChange(row.id, sanitizeLength(event.target.value))}
                        inputMode="decimal"
                        autoComplete="off"
                        autoFocus={isNew}
                        placeholder="0"
                        maxLength={8}
                        aria-invalid={isInvalid}
                        aria-describedby={note ? noteId : undefined}
                        aria-label={fieldLabel}
                      />
                      <span aria-hidden="true">{tr('м', 'm')}</span>
                    </label>
                    {note && <span id={noteId} className={`delay-cable__note${isInvalid ? ' delay-cable__note--bad' : ''}${isAssumedZero ? ' delay-cable__note--zero' : ''}`}>{note}</span>}
                  </div>
                </div>

                <div className={`delay-node${isNew ? ' delay-node--new' : ''}`} style={order}>
                  <span className="delay-node__box" data-signal-anchor aria-hidden="true">
                    <span className="delay-node__echo" />
                    <span className="delay-node__glow" data-signal-glow />
                    <span className="delay-wave" data-signal-wave />
                    <span className="delay-wave" data-signal-wave />
                    {/* Кольцо ожидания — две половины, каждая открывается поворотом
                        (только transform). Порядок в разметке — порядок заполнения:
                        сначала правая, потом левая. Покой — инлайн-поворот: анимация
                        сигнала кладётся поверх и после отмены возвращает к нему. */}
                    <span className="delay-ring">
                      <span className="delay-ring__fill">
                        <span className="delay-ring__half delay-ring__half--right"><span className="delay-ring__sweep" data-ring-sweep style={{ transform: rest.right }}><span className="delay-ring__semi"><i /></span></span></span>
                        <span className="delay-ring__half delay-ring__half--left"><span className="delay-ring__sweep" data-ring-sweep style={{ transform: rest.left }}><span className="delay-ring__semi"><i /></span></span></span>
                      </span>
                    </span>
                    <span className="delay-node__icon" data-signal-icon><Speaker size={24} /></span>
                  </span>
                  <div className="delay-node__lab">
                    <span className="delay-node__name">
                      {tr(`Излучатель ${number}`, `Nurlatgich ${number}`)}
                      {/* Крестик — в подписи, а не в коробке узла: та aria-hidden.
                          Единственный излучатель линии не убирается. data-remove-row —
                          по нему страница возвращает фокус после удаления соседа. */}
                      {line.rows.length > 1 && (
                        <button type="button" className="delay-node__remove" data-remove-row={row.id} aria-label={removeLabel} onClick={() => onRemove(lineIndex, index)}>
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                    <span className="delay-node__stepsbox">
                      <strong className="delay-node__steps"><CountUp value={steps} /></strong>
                      <small className="delay-node__stepword">{tr('шаг', 'qadam')}</small>
                    </span>
                    <span className="delay-node__unit">
                      {/* Двумя блоками, как «нс / метры» у соседей: одной строкой с тире
                          подпись крайнего узла доставала до рамки карточки (с41). */}
                      {waitless ? (
                        <>
                          <span className="delay-node__ns">{two ? tr('самый дальний', 'eng uzoqdagisi') : tr('последний', 'oxirgisi')}</span>
                          <span className="delay-node__down">{tr('не ждёт', 'kutmaydi')}</span>
                        </>
                      ) : (
                        <>
                          <span className="delay-node__ns">
                            <span className="delay-node__word">{tr('шаг', 'qadam')} · </span>
                            <b>{Math.round(delay?.ns ?? 0).toLocaleString(locale)}{NBSP}{tr('нс', 'ns')}</b>
                          </span>
                          <span className="delay-node__down">{meters(downstream)}{NBSP}{tr('м', 'm')} {two ? tr('до дальнего', 'eng uzoqqacha') : tr('до последнего', 'oxirgisigacha')}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </Fragment>
            )
          })}

          {/* data-add-row — по нему страница возвращает фокус, когда крестиков в
              линии не осталось; в ряду тот же атрибут носит кнопка в .delay-tools. */}
          {column && (
            <button type="button" className="delay-quiet delay-line__add" data-add-row={lineIndex} onClick={() => onAddRow(lineIndex)} disabled={line.rows.length >= maxPerLine}
              aria-label={two
                ? tr(`Добавить излучатель в линию ${lineIndex + 1}`, `${lineIndex + 1}-liniyaga nurlatgich qo‘shish`)
                : tr('Добавить излучатель', 'Nurlatgich qo‘shish')}>
              <Plus size={16} /> {tr('Излучатель', 'Nurlatgich')}
            </button>
          )}
        </div>
      ))}
    </section>
  )
}
