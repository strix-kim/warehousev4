import { FileSpreadsheet, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type VehicleWithDrivers } from './types'
import { EventDocumentFields } from '../../components/EventDocumentFields'
import { todayDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

// Фаза одной сборки. Союзом, а не флагами: «готовим» и «готово» — состояния, а
// не два независимых булевых значения. Счётчика здесь нет: карточки водителей
// приезжают одним запросом, показывать «3 из 12» нечего.
type ExportPhase = { kind: 'idle' } | { kind: 'preparing' } | { kind: 'done' } | { kind: 'error' }

export type VehicleEventExportRun = (meta: EventDocumentMeta, options: { signal: AbortSignal }) => Promise<void>

// «Список автотранспорта на мероприятие»: реквизиты документа поверх выбранных
// на странице машин. Выбор остаётся на странице — дровер его не копирует и при
// закрытии не сбрасывает.
export function VehicleEventExportDrawer({ vehicles, onClose, onExport }: {
  vehicles: VehicleWithDrivers[]
  onClose: () => void
  onExport?: VehicleEventExportRun
}) {
  const { tr, locale } = useLanguage()
  useModalLayer(onClose)
  // Язык документа по умолчанию UZ: бумагу на объект подают по-узбекски, а
  // интерфейс у большинства русский — совпадать этим двум незачем.
  const [meta, setMeta] = useState<EventDocumentMeta>({ name: '', dateFrom: todayDateValue(), dateTo: null, language: 'uz' })
  // Пустое название подсвечиваем не сразу: красное поле на только что открытом
  // дровере читается как отказ, а человек ещё ничего не сделал.
  const [nameTouched, setNameTouched] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>({ kind: 'idle' })
  // Закрытие дровера гасит незаконченную выборку: ответ уже некому показывать.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const nameEmpty = !meta.name.trim()
  // Даты — строки YYYY-MM-DD, поэтому сравниваются как есть, без разбора в Date.
  const rangeError = Boolean(meta.dateTo && meta.dateFrom && meta.dateTo < meta.dateFrom)
  const canExport = !nameEmpty && !rangeError && Boolean(meta.dateFrom)

  // Машина без водителя даёт строку из одних прочерков — это законно, но человек
  // должен увидеть это ДО того, как отдаст бумагу принимающей стороне.
  const withoutDriver = vehicles.filter((vehicle) => vehicle.drivers.length === 0)

  async function runExport() {
    if (!onExport || !canExport) return
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'preparing' })
    try {
      await onExport(meta, { signal: controller.signal })
      if (!controller.signal.aborted) setPhase({ kind: 'done' })
    } catch (error) {
      // Отмена — не отказ: дровер уже закрыт, показывать некому и незачем.
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/vehicles', detail: { source: 'event-export' } })
      setPhase({ kind: 'error' })
    }
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Список на мероприятие', 'Tadbir uchun ro‘yxat')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <p className="eyebrow">{tr('Документ', 'Hujjat')}</p>
            <h2>{tr('Список на мероприятие', 'Tadbir uchun ro‘yxat')}</h2>
            <p className="drawer__lead">{tr('Машин', 'Mashinalar')}: {vehicles.length.toLocaleString(locale)}</p>
          </div>
          <div className="drawer__header-actions">
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>

        {/* onBlur ловим на обёртке: React пускает его вверх по дереву, и одного
            обработчика хватает на все поля блока — «человек уже потрогал форму». */}
        <div onBlur={() => setNameTouched(true)}>
          <EventDocumentFields value={meta} onChange={setMeta} nameError={nameTouched && nameEmpty} rangeError={rangeError} />
        </div>

        <div className="event-export-summary">
          {withoutDriver.length === 0
            ? <strong>{tr('Водители есть у всех машин', 'Hamma mashinada haydovchi bor')}</strong>
            : <>
              <strong>{tr('Без водителя', 'Haydovchisiz')}: {withoutDriver.length.toLocaleString(locale)}</strong>
              <small>{withoutDriver.map((vehicle) => vehicle.plate_number).join(', ')}</small>
            </>}
        </div>

        <div className="event-export-actions">
          <button className="button button--primary button--wide" disabled={!onExport || !canExport || phase.kind === 'preparing'} onClick={() => void runExport()}>
            <FileSpreadsheet size={17} /> {tr('Скачать Excel', 'Excel yuklab olish')}
          </button>
          {phase.kind === 'preparing' && (
            <small className="field-hint">{tr('Готовим карточки водителей…', 'Haydovchilar kartalari tayyorlanmoqda…')}</small>
          )}
          {phase.kind === 'done' && (
            <small className="field-hint">{tr('Файл скачан', 'Fayl yuklab olindi')}</small>
          )}
          {phase.kind === 'error' && (
            <small className="field-hint field-hint--error">
              {tr('Не удалось собрать файл. Повторите попытку.', 'Faylni yig‘ib bo‘lmadi. Qayta urinib ko‘ring.')}
            </small>
          )}
        </div>
      </aside>
    </div>
  )
}
