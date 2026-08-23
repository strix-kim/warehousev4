import { FileSpreadsheet, X } from 'lucide-react'
import { useState } from 'react'
import { pickDocumentPhoto, type EmployeePhotoRef } from './api'
import { employeeFullName, type Employee } from './types'
import { EventDocumentFields } from '../../components/EventDocumentFields'
import { todayDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

// «Список сотрудников на мероприятие»: реквизиты документа поверх выбранного на
// странице состава. Выбор остаётся на странице — дровер его не копирует и при
// закрытии не сбрасывает.
export function EmployeeEventExportDrawer({ employees, photos, photosKnown, onClose, onExport }: {
  employees: Employee[]
  photos: Map<string, EmployeePhotoRef[]>
  // Карта фото загружена. false — запрос не ответил: «фото есть у всех» тогда
  // было бы не сводкой, а выдумкой (gotchas §11).
  photosKnown: boolean
  onClose: () => void
  onExport?: (meta: EventDocumentMeta) => Promise<void>
}) {
  const { tr, locale } = useLanguage()
  useModalLayer(onClose)
  // Язык документа по умолчанию UZ: бумагу на объект подают по-узбекски, а
  // интерфейс у большинства русский — совпадать этим двум незачем.
  const [meta, setMeta] = useState<EventDocumentMeta>({ name: '', dateFrom: todayDateValue(), dateTo: null, language: 'uz' })
  // Пустое название подсвечиваем не сразу: красное поле на только что открытом
  // дровере читается как отказ, а человек ещё ничего не сделал.
  const [nameTouched, setNameTouched] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const nameEmpty = !meta.name.trim()
  // Даты — строки YYYY-MM-DD, поэтому сравниваются как есть, без разбора в Date.
  const rangeError = Boolean(meta.dateTo && meta.dateFrom && meta.dateTo < meta.dateFrom)
  const canExport = !nameEmpty && !rangeError && Boolean(meta.dateFrom)

  // Кого в документе покажет пустая рамка вместо лица — считаем тем же правилом,
  // что и миниатюры списка, чтобы сводка не расходилась с бумагой.
  const withoutPhoto = employees.filter((employee) => !pickDocumentPhoto(employee, photos.get(employee.id)))

  async function runExport() {
    if (!onExport || !canExport) return
    setIsExporting(true)
    try {
      await onExport(meta)
    } finally {
      setIsExporting(false)
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
          <button className="button button--primary button--wide" disabled={!onExport || !canExport || isExporting} onClick={() => void runExport()}>
            <FileSpreadsheet size={17} /> {tr('Скачать Excel', 'Excel yuklab olish')}
          </button>
          {/* Временная подпись: генератор приходит следующим шагом, и без неё
              выключенная кнопка читается как поломка. */}
          {!onExport && <small className="field-hint">{tr('Появится следующим шагом', 'Keyingi qadamda paydo bo‘ladi')}</small>}
        </div>
      </aside>
    </div>
  )
}
