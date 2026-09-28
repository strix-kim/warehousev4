import { ImageOff } from 'lucide-react'
import type { VehicleFile } from './types'
import { PhotoThumb } from '../../components/PhotoThumb'
import { toDownloadUrl } from '../../lib/signedUrlCache'
import { useLanguage } from '../../lib/i18n'

// Фото машины — ТОЛЬКО на чтение: удаление запрещено политиками бакета, поэтому
// кнопки «убрать» здесь нет. Вид у файлов машины пока один (CHECK на
// vehicle_files.kind), так что раскладки по секциям, как у сотрудников, нет:
// пришёл бы техпаспорт — здесь появилась бы вторая ветка.
// Плитка 4:3 (.vehicle-photos): машину снимают вдоль, портретная плитка
// сотрудника 92×116 обрезала бы кадр.
export function VehicleFilesList({ files, urls, photoAlt }: {
  files: VehicleFile[]
  urls: Map<string, string>
  photoAlt: string
}) {
  const { tr } = useLanguage()

  return (
    <div className="vehicle-photos">
      {files.map((file) => {
        const url = urls.get(file.storage_path)
        return url
          // Нажатие скачивает снимок — как и у сотрудника (с27).
          ? <a key={file.id} href={toDownloadUrl(url, file.original_name)} rel="noreferrer" title={tr('Скачать снимок', 'Suratni yuklab olish')}>
            <PhotoThumb url={url} alt={file.original_name ?? photoAlt} placeholder={<ImageOff size={18} />} />
          </a>
          : <span key={file.id} className="vehicle-photos__missing" title={tr('Ссылка не получена', 'Havola olinmadi')}><ImageOff size={18} /></span>
      })}
    </div>
  )
}

// Заглушка на время загрузки. Рядом со списком по той же причине, что и у
// сотрудников: фото показывают два места — дровер и режим правки, — и высота
// ожидания у них обязана быть одинаковой.
// Классы болванки взяты employee-*: строка-заглушка одна на оба профиля, второй
// набор имён под ту же полосу закрепил бы расхождение. Дровер машины болванку не
// показывает (пока файлов нет — нет и блока), она нужна только форме правки.
export function VehicleFilesSkeleton({ rows = 2 }: { rows?: number }) {
  const { tr } = useLanguage()

  return (
    <div className="employee-files-skeleton" role="status" aria-label={tr('Загружаем фото', 'Fotolar yuklanmoqda')}>
      {Array.from({ length: rows }, (_, index) => <div className="detail-skeleton employee-files-skeleton__row" key={index} />)}
    </div>
  )
}
