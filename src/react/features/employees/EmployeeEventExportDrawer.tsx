import { FileSpreadsheet, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { pickDocumentPhoto, type EmployeePhotoRef } from './api'
import { employeeFullName, type EmployeeListItem } from './types'
import { EventDocumentFields } from '../../components/EventDocumentFields'
import { todayDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

// Фаза одной сборки. Союзом, а не тремя флагами: «готовим» без счётчика и
// «готово» без числа непрочитанных фото — состояния, которых не бывает.
type ExportPhase =
  | { kind: 'idle' }
  | { kind: 'preparing'; done: number; total: number }
  | { kind: 'done'; failed: number }
  | { kind: 'error' }

export type EmployeeEventExportRun = (meta: EventDocumentMeta, options: {
  onProgress: (done: number, total: number) => void
  signal: AbortSignal
}) => Promise<{ failed: number }>

// «Список сотрудников на мероприятие»: реквизиты документа поверх выбранного на
// странице состава. Выбор остаётся на странице — дровер его не копирует и при
// закрытии не сбрасывает.
export function EmployeeEventExportDrawer({ employees, photos, photosKnown, onClose, onExport }: {
  // Строки РЕЕСТРА: дровер печатает имена и считает, у кого нет фото, — паспорт
  // ему не нужен. Полные строки страница дотягивает в момент сборки файла.
  employees: EmployeeListItem[]
  photos: Map<string, EmployeePhotoRef[]>
  // Карта фото загружена. false — запрос не ответил: «фото есть у всех» тогда
  // было бы не сводкой, а выдумкой (gotchas §11).
  photosKnown: boolean
  onClose: () => void
  onExport?: EmployeeEventExportRun
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
  // Закрытие дровера обязано гасить очередь загрузок: без этого человек, закрыв
  // документ на тридцати портретах, продолжал бы качать их в фоне.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const nameEmpty = !meta.name.trim()
  // Даты — строки YYYY-MM-DD, поэтому сравниваются как есть, без разбора в Date.
  const rangeError = Boolean(meta.dateTo && meta.dateFrom && meta.dateTo < meta.dateFrom)
  const canExport = !nameEmpty && !rangeError && Boolean(meta.dateFrom)

  // Кого в документе покажет пустая рамка вместо лица — считаем тем же правилом,
  // что и миниатюры списка, чтобы сводка не расходилась с бумагой.
  const withoutPhoto = employees.filter((employee) => !pickDocumentPhoto(employee, photos.get(employee.id)))

  async function runExport() {
    if (!onExport || !canExport) return
    const controller = new AbortController()
    abortRef.current = controller
    // Знаменатель известен заранее — по той же сводке «без фото», что выше:
    // иначе первая секунда показывала бы «0 из 0».
    setPhase({ kind: 'preparing', done: 0, total: employees.length - withoutPhoto.length })
    try {
      const result = await onExport(meta, {
        signal: controller.signal,
        onProgress: (done, total) => {
          if (!controller.signal.aborted) setPhase({ kind: 'preparing', done, total })
        },
      })
      if (!controller.signal.aborted) setPhase({ kind: 'done', failed: result.failed })
    } catch (error) {
      // Отмена — не отказ: дровер уже закрыт, показывать некому и незачем.
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'event-export' } })
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
            <p className="drawer__lead">{tr('Сотрудников', 'Xodimlar')}: {employees.length.toLocaleString(locale)}</p>
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
          {!photosKnown
            ? <strong>{tr('Фото проверить не удалось — обновите страницу', 'Fotolarni tekshirib bo‘lmadi — sahifani yangilang')}</strong>
            : withoutPhoto.length === 0
              ? <strong>{tr('Фото есть у всех', 'Hammada foto bor')}</strong>
              : <>
                <strong>{tr('Без фото', 'Fotosiz')}: {withoutPhoto.length.toLocaleString(locale)}</strong>
                <small>{withoutPhoto.map((employee) => employeeFullName(employee)).join(', ')}</small>
              </>}
        </div>

        <div className="event-export-actions">
          <button className="button button--primary button--wide" disabled={!onExport || !canExport || phase.kind === 'preparing'} onClick={() => void runExport()}>
            <FileSpreadsheet size={17} /> {tr('Скачать Excel', 'Excel yuklab olish')}
          </button>
          {phase.kind === 'preparing' && (
            <small className="field-hint">
              {tr(`Готовим фото ${phase.done} из ${phase.total}…`, `Suratlar tayyorlanmoqda: ${phase.done} / ${phase.total}…`)}
            </small>
          )}
          {phase.kind === 'done' && (
            <small className="field-hint">
              {tr('Файл скачан', 'Fayl yuklab olindi')}
              {phase.failed > 0 && ` · ${tr(`Не удалось получить фото: ${phase.failed} — в документе прочерк`, `Suratlarni olib bo‘lmadi: ${phase.failed} — hujjatda chiziqcha`)}`}
            </small>
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
