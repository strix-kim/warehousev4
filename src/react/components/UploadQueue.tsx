import { useLanguage } from '../lib/i18n'

// Строка очереди загрузки. 'unsupported' — файл не декодировался (HEIC на
// десктопе): повторять нечего, нужен другой файл, поэтому это отдельный исход,
// а не разновидность 'failed'.
// Вид файла параметризован: набор видов свой у каждой сущности, а очередь одна.
export type UploadItem<Kind extends string = string> = {
  id: string
  kind: Kind
  file: File
  status: 'pending' | 'running' | 'done' | 'failed' | 'unsupported'
}

// Очередь загрузки одним списком: один и тот же вид на экране успеха создания и
// в форме правки. Подпись вида приходит пропсом — словарь видов живёт у фичи.
export function UploadQueue<Kind extends string>({ uploads, label }: {
  uploads: UploadItem<Kind>[]
  label: (kind: Kind) => string
}) {
  const { tr } = useLanguage()
  return (
    <ul className="employee-upload-list">
      {uploads.map((item) => (
        <li key={item.id}>
          <span>{label(item.kind)} · {item.file.name}</span>
          <span className={`badge badge--${item.status === 'done' ? 'success' : item.status === 'pending' || item.status === 'running' ? 'neutral' : 'danger'}`}>
            <i />{item.status === 'done'
              ? tr('Загружен', 'Yuklandi')
              : item.status === 'running'
                ? tr('Загружаем…', 'Yuklanmoqda…')
                : item.status === 'pending'
                  ? tr('В очереди', 'Navbatda')
                  : item.status === 'unsupported'
                    ? tr('Формат не поддерживается — нужен JPG или PNG', 'Format qo‘llab-quvvatlanmaydi — JPG yoki PNG kerak')
                    : tr('Не загрузился', 'Yuklanmadi')}
          </span>
        </li>
      ))}
    </ul>
  )
}
