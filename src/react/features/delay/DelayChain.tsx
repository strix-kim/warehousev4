import { Cpu, Speaker } from 'lucide-react'
import { Fragment, type RefObject } from 'react'
import { useCountUp } from '../../lib/useCountUp'
import { useLanguage } from '../../lib/i18n'
import type { ChainOrientation } from './chainLayout'
import { parseLength, type EmitterDelay } from './delay'

// Цепочка калькулятора ITC: мозги — кабель — излучатель — кабель — … Разметка
// одна на обе ориентации, меняется только класс на секции (--row / --column):
// иначе при смене раскладки поле длины с фокусом размонтировалось бы.

// Число с единицей не рвём по строкам.
const NBSP = '\u00a0'

export type Row = { id: number; draft: string }

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

export function DelayChain({ chainRef, rows, delays, maxSteps, orientation, widths, focusId, onChange }: {
  chainRef: RefObject<HTMLElement | null>
  rows: Row[]
  delays: EmitterDelay[]
  maxSteps: number
  orientation: ChainOrientation
  widths: number[]
  focusId: number | null
  onChange: (id: number, draft: string) => void
}) {
  const { tr, locale } = useLanguage()
  const meters = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 })

  return (
    <section className={`delay-chain delay-chain--${orientation}`} ref={chainRef} aria-label={tr('Цепочка излучателей', 'Nurlatgichlar zanjiri')}>
      <span className="delay-signal" data-signal-dot aria-hidden="true" />

      <div className="delay-node delay-node--brain">
        <span className="delay-node__box" data-signal-anchor aria-hidden="true">
          <span className="delay-node__glow" data-signal-glow />
          <span className="delay-node__icon" data-signal-icon><Cpu size={24} /></span>
        </span>
        <div className="delay-node__lab">
          <span className="delay-node__name">{tr('Мозги', 'Protsessor')}</span>
          <span className="delay-node__unit">{tr('процессор — отсюда уходит сигнал', 'signal shu yerdan chiqadi')}</span>
        </div>
      </div>

      {rows.map((row, index) => {
        const number = index + 1
        const isLast = index === rows.length - 1
        const isNew = row.id === focusId
        const isInvalid = row.draft.trim() !== '' && parseLength(row.draft) === null
        const delay = delays[index]
        const steps = delay?.steps ?? 0
        const rest = restRotation(steps, maxSteps)
        const noteId = `delay-note-${row.id}`
        const note = isInvalid
          ? tr('не число — считаем как 0', 'son emas — 0 deb hisoblanadi')
          : index === 0 ? tr('от мозгов — на задержки не влияет', 'protsessordan — kechikishlarga ta’sir qilmaydi') : null

        return (
          <Fragment key={row.id}>
            <div
              className={`delay-cable${index === 0 ? ' delay-cable--first' : ''}${isNew ? ' delay-cable--new' : ''}`}
              style={orientation === 'row' ? { width: widths[index] } : undefined}
            >
              <span className="delay-cable__line" aria-hidden="true" />
              <div className="delay-cable__body">
                <label className={`delay-len${isInvalid ? ' delay-len--invalid' : ''}`}>
                  <input
                    value={row.draft}
                    onChange={(event) => onChange(row.id, event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus={isNew}
                    placeholder="0"
                    maxLength={8}
                    aria-invalid={isInvalid}
                    aria-describedby={note ? noteId : undefined}
                    aria-label={tr(`Длина кабеля до излучателя ${number}, м`, `${number}-nurlatgichgacha kabel uzunligi, m`)}
                  />
                  <span aria-hidden="true">{tr('м', 'm')}</span>
                </label>
                {note && <span id={noteId} className={`delay-cable__note${isInvalid ? ' delay-cable__note--bad' : ''}`}>{note}</span>}
              </div>
            </div>

            <div className={`delay-node${isNew ? ' delay-node--new' : ''}`}>
              <span className="delay-node__box" data-signal-anchor aria-hidden="true">
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
                <span className="delay-node__name">{tr(`Излучатель ${number}`, `Nurlatgich ${number}`)}</span>
                <span className="delay-node__stepsbox">
                  <strong className="delay-node__steps"><CountUp value={steps} /></strong>
                  <small className="delay-node__stepword">{tr('шаг', 'qadam')}</small>
                </span>
                <span className="delay-node__unit">
                  {isLast ? tr('последний — не ждёт', 'oxirgisi — kutmaydi') : (
                    <>
                      <span className="delay-node__ns">
                        <span className="delay-node__word">{tr('шаг', 'qadam')} · </span>
                        <b>{Math.round(delay?.ns ?? 0).toLocaleString(locale)}{NBSP}{tr('нс', 'ns')}</b>
                      </span>
                      <span className="delay-node__down">{meters(delay?.downstreamMeters ?? 0)}{NBSP}{tr('м', 'm')} {tr('до последнего', 'oxirgisigacha')}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </Fragment>
        )
      })}
    </section>
  )
}
