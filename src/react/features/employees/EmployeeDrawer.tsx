import { CircleAlert, Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEmployeeById, fetchEmployeeFiles, getSignedUrls, setEmployeeDocumentPhoto } from './api'
import { EmployeeFilesList, EmployeeFilesSkeleton } from './EmployeeFilesList'
import { employeeFullName, type Employee, type EmployeeFile, type EmployeeListItem, type Tr } from './types'
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

// Строки, которые известны ДО запроса: они уже лежат в реестре, и прятать их за
// скелетом только ради единообразия значит показать пустоту вместо того, что
// у нас на руках.
function knownRows(employee: EmployeeListItem, tr: Tr): DetailRow[] {
  return [
    { key: 'position', label: tr('Должность', 'Lavozim'), value: employee.position },
    { key: 'phone', label: tr('Телефон', 'Telefon'), value: employee.phone },
  ].filter((row) => Boolean(row.value))
}

export function EmployeeDrawer({ employee, onClose, onDocumentPhotoChange }: {
  // Строка РЕЕСТРА, а не полная карточка: паспорт, ПИНФЛ и адрес прописки в
  // кэше реестра не лежат (решение с26), поэтому дровер догружает их сам —
  // шапка и контакты рисуются мгновенно, документы дорисовываются.
  employee: EmployeeListItem
  onClose: () => void
  // Выбор фото уезжает наверх, на страницу: там же лежит строка сотрудника, из
  // которой карточка получает employee, и там же — миниатюра списка.
  onDocumentPhotoChange?: (fileId: string) => void
}) {
  const { tr, locale } = useLanguage()
  const navigate = useNavigate()
  useModalLayer(onClose)
  // Полная карточка: приезжает отдельным запросом на открытие дровера.
  const [card, setCard] = useState<Employee | null>(null)
  const [isCardLoading, setIsCardLoading] = useState(true)
  const [hasCardError, setHasCardError] = useState(false)
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
    setIsCardLoading(true)
    setHasCardError(false)
    setCard(null)
    fetchEmployeeById(employee.id)
      .then((row) => { if (isCurrent) setCard(row) })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasCardError(true)
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { employee: employee.id, source: 'card' } })
      })
      .finally(() => { if (isCurrent) setIsCardLoading(false) })
    return () => { isCurrent = false }
  }, [employee.id])

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

  // Запрос идёт отдельно от «Сохранить» карточки: колонки document_photo_id нет
  // в EmployeeInput, и форма её не трогает. Ошибку пробрасываем в список файлов —
  // он показывает её строкой рядом с фото.
  async function chooseDocumentPhoto(fileId: string) {
    try {
      await setEmployeeDocumentPhoto(employee.id, fileId)
      onDocumentPhotoChange?.(fileId)
    } catch (saveError: unknown) {
      reportAppError(saveError, { scope: 'loader', route: '/employees', detail: { employee: employee.id, source: 'document-photo' } })
      throw saveError
    }
  }

  // Пока карточка едет, показываем то, что уже есть в реестре, и добираем
  // скелетом — так видно, что данные не кончились, а грузятся.
  const rows = card ? detailRows(card, tr, locale) : knownRows(employee, tr)

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

        {rows.length > 0 && (
          <dl className="detail-list">
            {rows.map((row) => (
              <div key={row.key} className={row.wide ? 'detail-list__wide' : undefined}>
                <dt>{row.label}</dt><dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {isCardLoading && <div className="detail-skeleton employee-card-skeleton" />}
        {hasCardError && <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить документы карточки.', 'Karta hujjatlarini yuklab bo‘lmadi.')}</p>}
        {!isCardLoading && !hasCardError && rows.length === 0 && (
          <p className="muted">{tr('Кроме имени, в карточке пока ничего нет.', 'Kartada ismdan boshqa hozircha hech narsa yo‘q.')}</p>
        )}

        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Файлы', 'Fayllar')}</h3><p>{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p></div></div>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить файлы сотрудника.', 'Xodim fayllarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <EmployeeFilesSkeleton />
              : files.length === 0
                ? <p className="muted">{tr('Файлов пока нет.', 'Hozircha fayllar yo‘q.')}</p>
                : <EmployeeFilesList
                  files={files}
                  urls={urls}
                  photoAlt={employeeFullName(employee)}
                  documentPhotoId={employee.document_photo_id}
                  onChooseDocumentPhoto={chooseDocumentPhoto}
                />}
        </section>
      </aside>
    </div>
  )
}
