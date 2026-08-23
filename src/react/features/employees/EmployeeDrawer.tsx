import { CircleAlert, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEmployeeFiles, getSignedUrls } from './api'
import { EmployeeFilesList } from './EmployeeFilesList'
import { employeeFullName, type Employee, type EmployeeFile, type Tr } from './types'
import { formatEventDate, parseDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'

// Календарный день словами. Мусор в колонке parseDateValue отдаёт как null —
// показываем тогда сырое значение, а не пустоту: это данные, а не наш формат.
function dateLabel(value: string | null, locale: string) {
  if (!value) return null
  const date = parseDateValue(value)
  return date ? formatEventDate(date, locale) : value
}

type DetailRow = { key: string; label: string; value: string | null; wide?: boolean }

// Строки карточки: показываем ТОЛЬКО заполненные — пустая половина «—» на два
// десятка полей превращала бы карточку в бланк.
function detailRows(employee: Employee, tr: Tr, locale: string): DetailRow[] {
  const passport = [employee.passport_series, employee.passport_number].filter(Boolean).join(' ')
  return [
    { key: 'position', label: tr('Должность', 'Lavozim'), value: employee.position },
    { key: 'phone', label: tr('Телефон', 'Telefon'), value: employee.phone },
    { key: 'birth_date', label: tr('Дата рождения', 'Tug‘ilgan sana'), value: dateLabel(employee.birth_date, locale) },
    { key: 'birth_place', label: tr('Место рождения', 'Tug‘ilgan joyi'), value: employee.birth_place },
    { key: 'passport', label: tr('Паспорт', 'Pasport'), value: passport || null },
    { key: 'pinfl', label: tr('ПИНФЛ', 'JSHSHIR'), value: employee.pinfl },
    { key: 'passport_issued_at', label: tr('Дата выдачи', 'Berilgan sana'), value: dateLabel(employee.passport_issued_at, locale) },
    { key: 'passport_expires_at', label: tr('Действителен до', 'Amal qilish muddati'), value: dateLabel(employee.passport_expires_at, locale) },
    { key: 'clearance_expires_at', label: tr('Допуск до', 'Ruxsat muddati'), value: dateLabel(employee.clearance_expires_at, locale) },
    { key: 't_shirt_size', label: tr('Размер футболки / худи', 'Futbolka / xudi o‘lchami'), value: employee.t_shirt_size },
    { key: 'passport_issued_by', label: tr('Кем выдан', 'Kim tomonidan berilgan'), value: employee.passport_issued_by, wide: true },
    { key: 'residence_address', label: tr('Адрес прописки', 'Ro‘yxatdan o‘tgan manzil'), value: employee.residence_address, wide: true },
  ].filter((row) => Boolean(row.value))
}

export function EmployeeDrawer({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { tr, locale } = useLanguage()
  const navigate = useNavigate()
  useModalLayer(onClose)
  const [files, setFiles] = useState<EmployeeFile[]>([])
  // Подписанные ссылки живут час и в персистентный кэш не кладутся — только
  // память страницы, ключ — путь в бакете.
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  // Флаг вместо текста: строка в стейте потянула бы tr в зависимости эффекта,
  // и смена языка перезапрашивала бы файлы.
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasError(false)
    fetchEmployeeFiles(employee.id)
      .then(async (rows) => {
        if (!isCurrent) return
        setFiles(rows)
        // Ссылки подписываем пачкой: по запросу на файл дало бы десяток
        // обращений на одну карточку.
        const signed = await getSignedUrls(rows.map((row) => row.storage_path))
        if (isCurrent) setUrls(signed)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { employee: employee.id } })
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [employee.id])

  const rows = detailRows(employee, tr, locale)

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Карточка сотрудника', 'Xodim kartasi')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <p className="eyebrow">{employee.position || tr('Сотрудник', 'Xodim')}</p>
            <h2>{employeeFullName(employee)}</h2>
          </div>
          <div className="drawer__header-actions">
            <button className="button button--secondary" onClick={() => navigate(`/employees/${employee.id}/edit`)}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>

        {rows.length > 0
          ? <dl className="detail-list">
            {rows.map((row) => (
              <div key={row.key} className={row.wide ? 'detail-list__wide' : undefined}>
                <dt>{row.label}</dt><dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          : <p className="muted">{tr('Кроме имени, в карточке пока ничего нет.', 'Kartada ismdan boshqa hozircha hech narsa yo‘q.')}</p>}

        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Файлы', 'Fayllar')}</h3><p>{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p></div></div>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить файлы сотрудника.', 'Xodim fayllarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <p className="muted">{tr('Загружаем файлы…', 'Fayllar yuklanmoqda…')}</p>
              : files.length === 0
                ? <p className="muted">{tr('Файлов пока нет.', 'Hozircha fayllar yo‘q.')}</p>
                : <EmployeeFilesList files={files} urls={urls} photoAlt={employeeFullName(employee)} />}
        </section>
      </aside>
    </div>
  )
}
