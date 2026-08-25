import { ImageOff } from 'lucide-react'
import type { VehicleFile } from './types'
import { PhotoThumb } from '../../components/PhotoThumb'
import { toDownloadUrl } from '../../lib/signedUrlCache'
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
          // Нажатие скачивает снимок — как и у сотрудника (с27).
          ? <a key={file.id} href={toDownloadUrl(url, file.original_name)} rel="noreferrer" title={tr('Скачать снимок', 'Suratni yuklab olish')}>
            <PhotoThumb url={url} alt={file.original_name ?? photoAlt} placeholder={<ImageOff size={18} />} />
          </a>
          : <span key={file.id} className="employee-photos__missing" title={tr('Ссылка не получена', 'Havola olinmadi')}><ImageOff size={18} /></span>
      })}
    </div>
  )
}

// Заглушка на время загрузки. Рядом со списком по той же причине, что и у
// сотрудников: фото показывают два места — дровер и режим правки, — и высота
// ожидания у них обязана быть одинаковой.
// Классы взяты employee-*: фото машин и сегодня рисуются геометрией человека
// (.employee-photos выше в этом же файле). Заводить второй набор имён под ту
// же разметку значит закрепить расхождение, а не вылечить его — машинная
// геометрия отдельным шагом, вместе с миниатюрой в строке реестра.
export function VehicleFilesSkeleton({ rows = 2 }: { rows?: number }) {
  const { tr } = useLanguage()

  return (
    <div className="employee-files-skeleton" role="status" aria-label={tr('Загружаем фото', 'Fotolar yuklanmoqda')}>
      {Array.from({ length: rows }, (_, index) => <div className="detail-skeleton employee-files-skeleton__row" key={index} />)}
    </div>
  )
}
