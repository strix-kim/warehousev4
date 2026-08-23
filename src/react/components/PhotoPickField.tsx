import { X } from 'lucide-react'
import { useLanguage } from '../lib/i18n'

// Выбор фотографий пачками: общий блок для карточек, где фото несколько (сотрудник,
// автомобиль). Документы-сканы сюда не попадают — там по одному файлу на вид.
export function PhotoPickField({ files, onChange, disabled }: {
  files: File[]
  onChange: (next: File[]) => void
  disabled: boolean
}) {
  const { tr } = useLanguage()

  return (
    <label className="field form-grid__wide">
      <span>{tr('Фотографии', 'Fotosuratlar')}</span>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => {
          const picked = [...(event.target.files ?? [])]
          // Список копится: пачку фотографий выбирают в несколько заходов, а
          // native-инпут при каждом выборе заменяет свой FileList целиком.
          onChange([...files, ...picked])
          // Сброс значения — чтобы повторный выбор того же файла снова дал change.
          event.target.value = ''
        }}
      />
      <small className="field-hint">{tr('Перед загрузкой ужимаются до 1600 px по длинной стороне.', 'Yuklashdan oldin uzun tomoni bo‘yicha 1600 px gacha kichraytiriladi.')}</small>
      {files.length > 0 && (
        <ul className="employee-file-picks">
          {files.map((file, index) => (
            <li key={`${file.name}:${file.size}:${index}`}>
              <span>{file.name}</span>
              <button type="button" className="icon-button" disabled={disabled} onClick={() => onChange(files.filter((_, position) => position !== index))} aria-label={tr('Убрать файл', 'Faylni olib tashlash')}>
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}
