import { CircleAlert, FileText } from 'lucide-react'
import { useState } from 'react'
import { documentPhotoErrorText } from './api'
import { employeeFileKindLabel, type EmployeeFile } from './types'
import { PhotoThumb } from '../../components/PhotoThumb'
import { useLanguage } from '../../lib/i18n'

// Уже загруженные файлы карточки — ТОЛЬКО на чтение: удаление запрещено
// политиками бакета, поэтому кнопки «убрать» здесь нет ни в дровере, ни в форме.
// Общий блок на оба места: дровер и режим правки показывают один и тот же список,
// и разъезжаться им незачем.
//
// Выбор «фото для документов» появляется, только если хозяин списка дал
// обработчик: у новой карточки файлов ещё нет, и выбирать там нечего.
export function EmployeeFilesList({ files, urls, photoAlt, documentPhotoId, onChooseDocumentPhoto }: {
  files: EmployeeFile[]
  urls: Map<string, string>
  photoAlt: string
  documentPhotoId?: string | null
  onChooseDocumentPhoto?: (fileId: string) => void | Promise<void>
}) {
  const { tr } = useLanguage()
  // Какое фото сейчас сохраняется: id вместо булева флага — по нему же гасим
  // кнопки остальных фото, чтобы двумя нажатиями подряд не устроить гонку.
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const photos = files.filter((file) => file.kind === 'photo')
  const documents = files.filter((file) => file.kind !== 'photo')

  // Список приходит новыми первыми, поэтому «последнее загруженное» — это
  // photos[0]. То же правило, что в pickDocumentPhoto, но здесь оно работает по
  // строкам employee_files, а не по ссылкам на фото.
  const effectiveId = photos.find((photo) => photo.id === documentPhotoId)?.id ?? photos[0]?.id ?? ''
  const isExplicit = Boolean(documentPhotoId) && effectiveId === documentPhotoId

  async function choose(fileId: string) {
    if (!onChooseDocumentPhoto || savingId) return
    setSavingId(fileId)
    setError('')
    try {
      await onChooseDocumentPhoto(fileId)
    } catch (chooseError: unknown) {
      setError(documentPhotoErrorText(chooseError, tr))
    } finally {
      setSavingId('')
    }
  }

  return (
    <>
      {photos.length > 0 && (
        <div className="employee-photos">
          {photos.map((photo) => {
            const url = urls.get(photo.storage_path)
            const isDocument = photo.id === effectiveId
            return (
              <div className={`employee-photos__item ${isDocument ? 'employee-photos__item--document' : ''}`} key={photo.id}>
                {url
                  ? <a href={url} target="_blank" rel="noreferrer">
                    <PhotoThumb url={url} alt={photo.original_name ?? photoAlt} placeholder={<FileText size={18} />} />
                  </a>
                  : <span className="employee-photos__missing" title={tr('Ссылка не получена', 'Havola olinmadi')}><FileText size={18} /></span>}
                {onChooseDocumentPhoto && (isDocument
                  ? <span className="employee-photos__badge">
                    {isExplicit
                      ? tr('Для документов', 'Hujjatlar uchun')
                      : tr('Для документов (последнее загруженное)', 'Hujjatlar uchun (oxirgi yuklangan)')}
                  </span>
                  : <button type="button" className="employee-photos__pick" disabled={Boolean(savingId)} onClick={() => void choose(photo.id)}>
                    {savingId === photo.id
                      ? tr('Сохраняем…', 'Saqlanmoqda…')
                      : tr('Использовать для документов', 'Hujjatlar uchun ishlatish')}
                  </button>)}
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="form-error employee-photos__error"><CircleAlert size={15} /> {error}</p>}
      {documents.length > 0 && (
        <ul className="unit-lists__items">
          {documents.map((file) => {
            const url = urls.get(file.storage_path)
            return (
              <li key={file.id}>
                {url
                  ? <a href={url} target="_blank" rel="noreferrer">
                    <FileText size={17} />
                    <span>
                      <strong>{employeeFileKindLabel(file.kind, tr)}</strong>
                      <small>{file.original_name ?? tr('Открыть', 'Ochish')}</small>
                    </span>
                  </a>
                  : <button type="button" disabled>
                    <FileText size={17} />
                    <span>
                      <strong>{employeeFileKindLabel(file.kind, tr)}</strong>
                      <small>{tr('Ссылка не получена', 'Havola olinmadi')}</small>
                    </span>
                  </button>}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// Заглушка на время загрузки списка. Живёт рядом с самим списком по той же
// причине, что и он: показывают файлы два места — дровер и режим правки, —
// и высота ожидания у них обязана быть одинаковой.
export function EmployeeFilesSkeleton({ rows = 3 }: { rows?: number }) {
  const { tr } = useLanguage()

  return (
    <div className="employee-files-skeleton" role="status" aria-label={tr('Загружаем файлы', 'Fayllar yuklanmoqda')}>
      {Array.from({ length: rows }, (_, index) => <div className="detail-skeleton employee-files-skeleton__row" key={index} />)}
    </div>
  )
}
