import { X } from 'lucide-react'
import { PhotoPickField } from '../../components/PhotoPickField'
import { useLanguage } from '../../lib/i18n'
import { employeeFileKindLabel, type EmployeeFileKind } from './types'

// Виды документов: по одному файлу на вид. Фото живут отдельно — их несколько,
// поэтому 'photo' из союза исключён: selection[kind] обязан быть File | null.
type ScanKind = Exclude<EmployeeFileKind, 'photo'>
const scanKinds: ScanKind[] = ['passport_front', 'passport_back', 'intl_passport', 'residence_reg']

export type EmployeeFileSelection = {
  photos: File[]
  passport_front: File | null
  passport_back: File | null
  intl_passport: File | null
  residence_reg: File | null
}

export const emptyFileSelection: EmployeeFileSelection = {
  photos: [],
  passport_front: null,
  passport_back: null,
  intl_passport: null,
  residence_reg: null,
}

// Плоская очередь для загрузки: порядок фиксированный — фото, потом документы.
export function selectedFiles(selection: EmployeeFileSelection): { kind: EmployeeFileKind; file: File }[] {
  return [
    ...selection.photos.map((file) => ({ kind: 'photo' as const, file })),
    ...scanKinds.flatMap((kind) => {
      const file = selection[kind]
      return file ? [{ kind, file }] : []
    }),
  ]
}

export function EmployeeFileFields({ selection, onChange, disabled }: {
  selection: EmployeeFileSelection
  onChange: (next: EmployeeFileSelection) => void
  disabled: boolean
}) {
  const { tr } = useLanguage()

  return (
    <div className="form-grid">
      <PhotoPickField files={selection.photos} onChange={(photos) => onChange({ ...selection, photos })} disabled={disabled} />

      {scanKinds.map((kind) => {
        const file = selection[kind]
        return (
          <label className="field" key={kind}>
            <span>{employeeFileKindLabel(kind, tr)}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...selection, [kind]: event.target.files?.[0] ?? null })
                event.target.value = ''
              }}
            />
            {file && (
              <ul className="employee-file-picks">
                <li>
                  <span>{file.name}</span>
                  <button type="button" className="icon-button" disabled={disabled} onClick={() => onChange({ ...selection, [kind]: null })} aria-label={tr('Убрать файл', 'Faylni olib tashlash')}>
                    <X size={15} />
                  </button>
                </li>
              </ul>
            )}
          </label>
        )
      })}
    </div>
  )
}
