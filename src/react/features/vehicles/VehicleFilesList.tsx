import { ImageOff } from 'lucide-react'
import type { VehicleFile } from './types'
import { useLanguage } from '../../lib/i18n'

// Фото машины — ТОЛЬКО на чтение: удаление запрещено политиками бакета, поэтому
// кнопки «убрать» здесь нет. Вид у файлов машины пока один (CHECK на
// vehicle_files.kind), так что раскладки по секциям, как у сотрудников, нет:
// пришёл бы техпаспорт — здесь появилась бы вторая ветка.
// Плитка та же, что в карточке сотрудника (.employee-photos): своей сетки под
// один и тот же список миниатюр заводить незачем.
export function VehicleFilesList({ files, urls, photoAlt }: {
  files: VehicleFile[]
  urls: Map<string, string>
  photoAlt: string
}) {
  const { tr } = useLanguage()

  return (
    <div className="employee-photos">
      {files.map((file) => {
        const url = urls.get(file.storage_path)
        return url
          ? <a key={file.id} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={file.original_name ?? photoAlt} loading="lazy" decoding="async" />
          </a>
          : <span key={file.id} className="employee-photos__missing" title={tr('Ссылка не получена', 'Havola olinmadi')}><ImageOff size={18} /></span>
      })}
    </div>
  )
}
