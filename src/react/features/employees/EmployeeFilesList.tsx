import { FileText } from 'lucide-react'
import { employeeFileKindLabel, type EmployeeFile } from './types'
import { useLanguage } from '../../lib/i18n'

// Уже загруженные файлы карточки — ТОЛЬКО на чтение: удаление запрещено
// политиками бакета, поэтому кнопки «убрать» здесь нет ни в дровере, ни в форме.
// Общий блок на оба места: дровер и режим правки показывают один и тот же список,
// и разъезжаться им незачем.
export function EmployeeFilesList({ files, urls, photoAlt }: {
  files: EmployeeFile[]
  urls: Map<string, string>
  photoAlt: string
}) {
  const { tr } = useLanguage()
  const photos = files.filter((file) => file.kind === 'photo')
  const documents = files.filter((file) => file.kind !== 'photo')

  return (
    <>
      {photos.length > 0 && (
        <div className="employee-photos">
          {photos.map((photo) => {
            const url = urls.get(photo.storage_path)
            return url
              ? <a key={photo.id} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={photo.original_name ?? photoAlt} loading="lazy" decoding="async" />
              </a>
              : <span key={photo.id} className="employee-photos__missing" title={tr('Ссылка не получена', 'Havola olinmadi')}><FileText size={18} /></span>
          })}
        </div>
      )}
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
